ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS topic TEXT CHECK (char_length(topic) <= 160),
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_message_id BIGINT NULL REFERENCES messages(id) ON DELETE SET NULL;

ALTER TABLE conversation_members
  ADD COLUMN IF NOT EXISTS muted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS parent_id BIGINT NULL REFERENCES messages(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS quoted_id BIGINT NULL REFERENCES messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_parent_id_id ON messages (parent_id, id);

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

DO $$
DECLARE
  general_id INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM conversations WHERE type = 'group' AND is_public = true) THEN
    INSERT INTO conversations (type, title, topic, is_public)
    VALUES ('group', 'general', 'Conversación abierta del club', true)
    RETURNING id INTO general_id;

    INSERT INTO conversation_members (conversation_id, user_id, role)
    SELECT general_id, id, 'member' FROM users
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
