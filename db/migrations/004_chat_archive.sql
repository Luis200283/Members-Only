-- Archivar y eliminar chats por usuario (por membresía, no afecta a los demás).

ALTER TABLE conversation_members
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE conversation_members
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conversation_members_hidden
  ON conversation_members (user_id)
  WHERE hidden_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_members_archived
  ON conversation_members (user_id)
  WHERE archived = true;

CREATE INDEX IF NOT EXISTS idx_messages_thread_active
  ON messages (parent_id, id)
  WHERE deleted_at IS NULL;
