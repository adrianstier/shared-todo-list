# Apple Push Notification Service (APNs) Setup

This guide walks you through setting up push notifications for the Shared Todo List iOS app.

## Prerequisites

- Apple Developer Account ($99/year)
- Access to Apple Developer Portal
- Supabase project with Edge Functions enabled

## Step 1: Create an APNs Key

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Keys** in the sidebar
4. Click the **+** button to create a new key
5. Enter a name (e.g., "Shared Todo APNs Key")
6. Check **Apple Push Notifications service (APNs)**
7. Click **Continue**, then **Register**
8. **Download the key** (you can only download it once!)
9. Note the **Key ID** displayed on the page

The downloaded file will be named `AuthKey_XXXXXXXXXX.p8`

## Step 2: Note Your Team ID

1. In the Apple Developer Portal, click your name in the top right
2. Click **View Account**
3. Your **Team ID** is displayed in the Membership section

## Step 3: Create App ID with Push Notifications

1. Go to **Certificates, Identifiers & Profiles**
2. Click **Identifiers** in the sidebar
3. Click **+** to create a new App ID
4. Select **App IDs** and click **Continue**
5. Select **App** and click **Continue**
6. Enter:
   - Description: "Shared Todo List"
   - Bundle ID: `com.yourcompany.sharedtodolist` (Explicit)
7. Scroll down and check **Push Notifications**
8. Click **Continue**, then **Register**

## Step 4: Configure Supabase Edge Function

### Add Environment Variables

In your Supabase project dashboard:

1. Go to **Project Settings** → **Edge Functions**
2. Add the following secrets:

| Name | Value |
|------|-------|
| `APNS_KEY_ID` | Your Key ID (10 characters) |
| `APNS_TEAM_ID` | Your Team ID (10 characters) |
| `APNS_PRIVATE_KEY` | Contents of the .p8 file (including BEGIN/END lines) |
| `BUNDLE_ID` | `com.yourcompany.sharedtodolist` |
| `APNS_ENVIRONMENT` | `development` or `production` |

### Format the Private Key

The .p8 file content should be added as-is, including the header and footer:

```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
...your key content...
-----END PRIVATE KEY-----
```

### Deploy the Edge Function

```bash
cd /path/to/shared-todo-list

# Login to Supabase
supabase login

# Link to your project (if not already linked)
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy send-push-notification
```

## Step 5: Configure Xcode Project

### Enable Push Notifications Capability

1. Open `SharedTodoList.xcodeproj` in Xcode
2. Select the project in the navigator
3. Select the **SharedTodoList** target
4. Go to **Signing & Capabilities**
5. Click **+ Capability**
6. Add **Push Notifications**
7. Add **Background Modes** and check:
   - Background fetch
   - Remote notifications

### Set Development Team

1. In **Signing & Capabilities**
2. Select your Team from the dropdown
3. Xcode will automatically manage provisioning profiles

### Update Entitlements for Production

When ready for App Store:

1. Open `SharedTodoList.entitlements`
2. Change `aps-environment` from `development` to `production`

```xml
<key>aps-environment</key>
<string>production</string>
```

## Step 6: Test Push Notifications

### Simulator Limitations

Push notifications don't work in the iOS Simulator. You must test on a physical device.

### Using the Test Script

Create a test script to send a notification:

```bash
#!/bin/bash

# test-push.sh
DEVICE_TOKEN="your-device-token-here"
BUNDLE_ID="com.yourcompany.sharedtodolist"
APNS_KEY_ID="XXXXXXXXXX"
APNS_TEAM_ID="XXXXXXXXXX"
APNS_KEY_FILE="AuthKey_XXXXXXXXXX.p8"

# Generate JWT token
JWT_HEADER=$(echo -n '{"alg":"ES256","kid":"'$APNS_KEY_ID'"}' | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
JWT_CLAIMS=$(echo -n '{"iss":"'$APNS_TEAM_ID'","iat":'$(date +%s)'}' | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
JWT_SIGNATURE=$(echo -n "$JWT_HEADER.$JWT_CLAIMS" | openssl dgst -sha256 -sign $APNS_KEY_FILE | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
JWT="$JWT_HEADER.$JWT_CLAIMS.$JWT_SIGNATURE"

# Send notification (development)
curl -v \
  --header "authorization: bearer $JWT" \
  --header "apns-topic: $BUNDLE_ID" \
  --header "apns-push-type: alert" \
  --header "apns-priority: 10" \
  --data '{"aps":{"alert":{"title":"Test","body":"Hello from APNs!"},"sound":"default"}}' \
  --http2 \
  "https://api.sandbox.push.apple.com/3/device/$DEVICE_TOKEN"
```

### Get Device Token

The device token is logged when the app registers for notifications. Run the app on a device and check the Xcode console for:

```
[Notifications] Device token: abc123...
```

## Troubleshooting

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `BadDeviceToken` | Invalid or expired token | Re-register the device, ensure correct environment |
| `DeviceTokenNotForTopic` | Token doesn't match bundle ID | Check bundle ID matches between app and APNs |
| `InvalidProviderToken` | JWT issue | Check Key ID, Team ID, and private key format |
| `TopicDisallowed` | Push not enabled for app | Enable Push Notifications in App ID |
| `Unregistered` | Device uninstalled app | Remove token from database |

### Development vs Production

| Environment | APNs Host | Use When |
|-------------|-----------|----------|
| Development | `api.sandbox.push.apple.com` | Testing, debug builds |
| Production | `api.push.apple.com` | App Store, TestFlight |

## Database Trigger for Automatic Notifications

The Edge Function can be called from a database trigger when a task is assigned:

```sql
-- This is already included in the migration, but here's how it works:

CREATE OR REPLACE FUNCTION notify_on_task_assigned()
RETURNS TRIGGER AS $$
BEGIN
  -- Call Edge Function when task is assigned
  IF NEW.assigned_to IS NOT NULL AND
     (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN

    PERFORM net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/send-push-notification',
      headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}',
      body := json_build_object(
        'type', 'task_assigned',
        'payload', json_build_object(
          'taskId', NEW.id,
          'taskText', NEW.text,
          'assignedBy', NEW.updated_by
        ),
        'userIds', ARRAY[(SELECT id FROM users WHERE name = NEW.assigned_to)]
      )::text
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Security Notes

1. **Never commit your .p8 key file** to version control
2. **Rotate keys periodically** in the Apple Developer Portal
3. **Use environment variables** for all sensitive values
4. **Validate device tokens** before sending notifications
5. **Handle token expiration** by removing invalid tokens from database
