CREATE INDEX IF NOT EXISTS idx_messages_quoted_id ON messages (quoted_id);

CREATE INDEX IF NOT EXISTS idx_conversations_pinned_message_id ON conversations (pinned_message_id);

CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions (user_id);

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS idx_messages_body_trgm ON messages USING GIN (body gin_trgm_ops);
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_trgm no disponible; se omite el índice de búsqueda: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM conversations
    WHERE type = 'group'
    GROUP BY lower(title)
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_group_title_unique
      ON conversations (lower(title))
      WHERE type = 'group';
  ELSE
    RAISE NOTICE 'Hay salas con nombre duplicado; no se crea el índice único';
  END IF;
END $$;
