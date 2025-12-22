-- Enhanced messages table for advanced chat features
-- MIGRATION: 2024-12-22
-- Features: replies, editing, deletion, pinning, mentions, reactions, read receipts

-- Add recipient column for DM support (if not exists)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS recipient TEXT;

-- Add reactions column (JSONB array of {user, reaction, created_at})
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb;

-- Add read_by column (array of usernames who have read the message)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_by TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add reply support columns
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_text TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_user TEXT;

-- Add message editing support
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE;

-- Add soft delete support
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add pinning support
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS pinned_by TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMP WITH TIME ZONE;

-- Add mentions support (array of usernames mentioned in the message)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS mentions TEXT[];

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON public.messages(recipient);
CREATE INDEX IF NOT EXISTS idx_messages_read_by ON public.messages USING GIN(read_by);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages(reply_to_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_pinned ON public.messages(is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at ON public.messages(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_mentions ON public.messages USING GIN(mentions);

-- Add comment for documentation
COMMENT ON TABLE public.messages IS 'Team and direct messages with support for replies, reactions, read receipts, pinning, and mentions';
COMMENT ON COLUMN public.messages.recipient IS 'NULL for team chat, username for DM';
COMMENT ON COLUMN public.messages.reactions IS 'Array of {user, reaction, created_at} objects';
COMMENT ON COLUMN public.messages.read_by IS 'Array of usernames who have read this message';
COMMENT ON COLUMN public.messages.reply_to_id IS 'ID of the message being replied to';
COMMENT ON COLUMN public.messages.deleted_at IS 'Soft delete timestamp - NULL means not deleted';
COMMENT ON COLUMN public.messages.is_pinned IS 'Whether message is pinned to conversation';
COMMENT ON COLUMN public.messages.mentions IS 'Array of usernames mentioned in this message';
