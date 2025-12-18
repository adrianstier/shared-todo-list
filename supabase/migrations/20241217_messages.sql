-- Create messages table for team chat
-- APPLIED: 2024-12-18
-- Database: postgresql://postgres@db.bzjssogezdnybbenqygq.supabase.co:5432/postgres
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Optional: link message to a specific todo for task-related discussions
    related_todo_id UUID REFERENCES todos(id) ON DELETE SET NULL
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_created_by ON messages(created_by);
CREATE INDEX IF NOT EXISTS idx_messages_related_todo ON messages(related_todo_id);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations (matches existing todos pattern)
CREATE POLICY "Allow all operations on messages" ON messages
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Enable real-time for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
