-- Activity Log table
-- Tracks all task mutations for audit trail and team visibility

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL CHECK (action IN (
    'task_created',
    'task_updated',
    'task_deleted',
    'task_completed',
    'task_reopened',
    'status_changed',
    'priority_changed',
    'assigned_to_changed',
    'due_date_changed',
    'subtask_added',
    'subtask_completed',
    'subtask_deleted',
    'notes_updated',
    'template_created',
    'template_used'
  )),
  todo_id UUID,
  todo_text TEXT,
  user_name TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Permissive policy for authenticated users
CREATE POLICY "Allow all operations on activity_log" ON activity_log
  FOR ALL USING (true) WITH CHECK (true);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;

-- Indexes for faster queries
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_user_name ON activity_log(user_name);
CREATE INDEX idx_activity_log_todo_id ON activity_log(todo_id);
CREATE INDEX idx_activity_log_action ON activity_log(action);
