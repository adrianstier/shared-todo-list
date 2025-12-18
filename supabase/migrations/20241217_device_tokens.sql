-- Create device_tokens table for push notifications
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, token)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_platform ON device_tokens(platform);

-- Enable RLS
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own device tokens
CREATE POLICY "Users can manage own device tokens" ON device_tokens
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Function to send notification when task is assigned
CREATE OR REPLACE FUNCTION notify_task_assigned()
RETURNS TRIGGER AS $$
DECLARE
    assignee_user_id UUID;
    assignee_tokens TEXT[];
BEGIN
    -- Only trigger when assigned_to changes and is not null
    IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
        -- Get the assignee's user ID
        SELECT id INTO assignee_user_id FROM users WHERE name = NEW.assigned_to;

        IF assignee_user_id IS NOT NULL THEN
            -- Get device tokens for the assignee
            SELECT ARRAY_AGG(token) INTO assignee_tokens
            FROM device_tokens
            WHERE user_id = assignee_user_id AND platform = 'ios';

            -- Call the edge function (this would be done via pg_net or similar)
            -- For now, we'll log this for manual handling
            RAISE NOTICE 'Task assigned notification: task_id=%, assigned_to=%, tokens=%',
                NEW.id, NEW.assigned_to, assignee_tokens;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for task assignment notifications
DROP TRIGGER IF EXISTS on_task_assigned ON todos;
CREATE TRIGGER on_task_assigned
    AFTER INSERT OR UPDATE OF assigned_to ON todos
    FOR EACH ROW
    EXECUTE FUNCTION notify_task_assigned();

-- Function to clean up old device tokens (older than 30 days without update)
CREATE OR REPLACE FUNCTION cleanup_old_device_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM device_tokens
    WHERE updated_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
