// Supabase Edge Function for sending push notifications to iOS devices
// Deploy with: supabase functions deploy send-push-notification

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v4.14.4/index.ts";

// Configuration from environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID")!;
const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID")!;
const APNS_PRIVATE_KEY = Deno.env.get("APNS_PRIVATE_KEY")!;
const BUNDLE_ID = Deno.env.get("BUNDLE_ID") || "com.yourcompany.sharedtodolist";
const APNS_HOST =
  Deno.env.get("APNS_ENVIRONMENT") === "production"
    ? "api.push.apple.com"
    : "api.sandbox.push.apple.com";

// Notification types
type NotificationType =
  | "task_assigned"
  | "task_due_soon"
  | "task_overdue"
  | "task_completed"
  | "generic";

interface NotificationPayload {
  type: NotificationType;
  taskId?: string;
  taskText?: string;
  assignedBy?: string;
  completedBy?: string;
  timeUntil?: string;
  message?: string;
  badgeCount?: number;
}

interface RequestBody {
  type: NotificationType;
  payload: NotificationPayload;
  userIds?: string[]; // Send to specific users
  deviceTokens?: string[]; // Send to specific devices
  excludeUserId?: string; // Don't notify this user (e.g., the one who triggered the action)
}

// Generate APNs JWT token
async function generateAPNsToken(): Promise<string> {
  const privateKey = await importPKCS8(APNS_PRIVATE_KEY, "ES256");

  const jwt = await new SignJWT({})
    .setProtectedHeader({
      alg: "ES256",
      kid: APNS_KEY_ID,
    })
    .setIssuer(APNS_TEAM_ID)
    .setIssuedAt()
    .sign(privateKey);

  return jwt;
}

// Build notification content based on type
function buildNotification(
  type: NotificationType,
  payload: NotificationPayload
): object {
  const baseAps = {
    sound: "default",
    badge: payload.badgeCount ?? 1,
  };

  switch (type) {
    case "task_assigned":
      return {
        aps: {
          ...baseAps,
          alert: {
            title: "New Task Assigned",
            body: `${payload.assignedBy} assigned you: ${payload.taskText}`,
          },
          category: "TASK_ASSIGNED",
        },
        taskId: payload.taskId,
        type: "assigned",
      };

    case "task_due_soon":
      return {
        aps: {
          ...baseAps,
          alert: {
            title: "Task Due Soon",
            body: `"${payload.taskText}" is due ${payload.timeUntil}`,
          },
          category: "TASK_REMINDER",
        },
        taskId: payload.taskId,
        type: "due_reminder",
      };

    case "task_overdue":
      return {
        aps: {
          ...baseAps,
          alert: {
            title: "Overdue Task",
            body: `"${payload.taskText}" is overdue`,
          },
          category: "TASK_OVERDUE",
          "interruption-level": "time-sensitive",
        },
        taskId: payload.taskId,
        type: "overdue",
      };

    case "task_completed":
      return {
        aps: {
          ...baseAps,
          alert: {
            title: "Task Completed",
            body: `${payload.completedBy} completed: ${payload.taskText}`,
          },
        },
        taskId: payload.taskId,
        type: "completed",
      };

    case "generic":
    default:
      return {
        aps: {
          ...baseAps,
          alert: payload.message || "You have a new notification",
        },
      };
  }
}

// Send notification to a single device
async function sendToDevice(
  token: string,
  notification: object,
  apnsToken: string
): Promise<{ success: boolean; token: string; error?: string }> {
  try {
    const response = await fetch(`https://${APNS_HOST}/3/device/${token}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${apnsToken}`,
        "apns-topic": BUNDLE_ID,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-expiration": "0",
      },
      body: JSON.stringify(notification),
    });

    if (response.ok) {
      return { success: true, token };
    }

    const error = await response.text();
    console.error(`APNs error for token ${token}:`, error);

    // Handle specific APNs errors
    if (response.status === 410) {
      // Device token is no longer active - should be removed
      return { success: false, token, error: "UNREGISTERED" };
    }

    return { success: false, token, error };
  } catch (error) {
    console.error(`Failed to send to ${token}:`, error);
    return { success: false, token, error: error.message };
  }
}

// Get device tokens for users
async function getDeviceTokens(
  supabase: any,
  userIds: string[]
): Promise<string[]> {
  const { data, error } = await supabase
    .from("device_tokens")
    .select("token")
    .in("user_id", userIds)
    .eq("platform", "ios");

  if (error) {
    console.error("Error fetching device tokens:", error);
    return [];
  }

  return data.map((row: { token: string }) => row.token);
}

// Remove invalid device tokens
async function removeInvalidTokens(
  supabase: any,
  tokens: string[]
): Promise<void> {
  if (tokens.length === 0) return;

  const { error } = await supabase
    .from("device_tokens")
    .delete()
    .in("token", tokens);

  if (error) {
    console.error("Error removing invalid tokens:", error);
  }
}

// Main handler
serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  // Handle OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { type, payload, userIds, deviceTokens, excludeUserId } = body;

    // Validate request
    if (!type || !payload) {
      return new Response(
        JSON.stringify({ error: "Missing type or payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get device tokens
    let tokens: string[] = [];

    if (deviceTokens && deviceTokens.length > 0) {
      tokens = deviceTokens;
    } else if (userIds && userIds.length > 0) {
      // Filter out excluded user
      const targetUserIds = excludeUserId
        ? userIds.filter((id) => id !== excludeUserId)
        : userIds;
      tokens = await getDeviceTokens(supabase, targetUserIds);
    }

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No device tokens to send to",
          sent: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate APNs token
    const apnsToken = await generateAPNsToken();

    // Build notification
    const notification = buildNotification(type, payload);

    // Send to all devices
    const results = await Promise.all(
      tokens.map((token) => sendToDevice(token, notification, apnsToken))
    );

    // Track results
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    const unregistered = failed
      .filter((r) => r.error === "UNREGISTERED")
      .map((r) => r.token);

    // Remove unregistered tokens
    if (unregistered.length > 0) {
      await removeInvalidTokens(supabase, unregistered);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successful.length,
        failed: failed.length,
        unregistered: unregistered.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
