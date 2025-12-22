-- Task Templates table
-- Allows users to save and reuse common task patterns

CREATE TABLE IF NOT EXISTS task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  default_priority TEXT DEFAULT 'medium' CHECK (default_priority IN ('low', 'medium', 'high', 'urgent')),
  default_assigned_to TEXT,
  subtasks JSONB DEFAULT '[]'::jsonb,
  created_by TEXT NOT NULL,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

-- Permissive policy for authenticated users
CREATE POLICY "Allow all operations on task_templates" ON task_templates
  FOR ALL USING (true) WITH CHECK (true);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE task_templates;

-- Index for faster lookups
CREATE INDEX idx_task_templates_created_by ON task_templates(created_by);
CREATE INDEX idx_task_templates_is_shared ON task_templates(is_shared);
