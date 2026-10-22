import pool from "../db/pg.js";

export const ALLOWED_EMOJIS = ["👍", "❤️", "😂", "🎉", "👏", "🍷", "🙏", "👀"];

export async function loadMessageRefs(ids) {
  const { rows } = await pool.query(
    "SELECT id, conversation_id, parent_id FROM messages WHERE id = ANY($1::bigint[])",
    [ids],
  );
  return rows;
}

export async function loadThreadStats(parentIds) {
  if (parentIds.length === 0) return new Map();

  const { rows } = await pool.query(
    `
      SELECT parent_id,
             count(*)::int AS reply_count,
             max(created_at) AS last_reply_at,
             array_agg(DISTINCT sender_id) AS reply_user_ids
      FROM messages
      WHERE parent_id = ANY($1::bigint[]) AND deleted_at IS NULL
      GROUP BY parent_id
    `,
    [parentIds],
  );

  return new Map(rows.map((row) => [row.parent_id, row]));
}

export async function loadReactions(messageIds) {
  const map = new Map();
  if (messageIds.length === 0) return map;

  const { rows } = await pool.query(
    `
      SELECT message_id, emoji,
             count(*)::int AS count,
             array_agg(user_id ORDER BY user_id) AS user_ids
      FROM message_reactions
      WHERE message_id = ANY($1::bigint[])
      GROUP BY message_id, emoji
      ORDER BY min(created_at), emoji
    `,
    [messageIds],
  );

  for (const row of rows) {
    const list = map.get(row.message_id) || [];
    list.push({ emoji: row.emoji, count: row.count, user_ids: row.user_ids });
    map.set(row.message_id, list);
  }

  return map;
}

export function formatReactions(list, viewerId = null) {
  return list.map((reaction) => ({
    emoji: reaction.emoji,
    count: reaction.count,
    reacted: viewerId !== null && reaction.user_ids.includes(viewerId),
    user_ids: reaction.user_ids,
  }));
}

export async function buildMessages(messageIds, viewerId = null) {
  if (messageIds.length === 0) return [];

  const { rows } = await pool.query(
    `
      SELECT m.id, m.conversation_id, m.sender_id, u.username,
             u."isAdmin" AS sender_is_admin, m.body, m.created_at, m.parent_id,
             q.id AS quoted_message_id,
             qu.username AS quoted_username,
             LEFT(q.body, 200) AS quoted_body
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      LEFT JOIN messages q ON q.id = m.quoted_id AND q.deleted_at IS NULL
      LEFT JOIN users qu ON qu.id = q.sender_id
      WHERE m.id = ANY($1::bigint[])
      ORDER BY m.id ASC
    `,
    [messageIds],
  );

  const [reactions, stats] = await Promise.all([
    loadReactions(messageIds),
    loadThreadStats(messageIds),
  ]);

  return rows.map((row) => {
    const stat = stats.get(row.id);

    return {
      id: row.id,
      conversation_id: row.conversation_id,
      sender_id: row.sender_id,
      username: row.username,
      sender_is_admin: row.sender_is_admin,
      body: row.body,
      created_at: row.created_at,
      parent_id: row.parent_id,
      quoted:
        row.quoted_message_id === null
          ? null
          : {
              id: row.quoted_message_id,
              username: row.quoted_username,
              body: row.quoted_body,
            },
      reactions: formatReactions(reactions.get(row.id) || [], viewerId),
      reply_count: stat?.reply_count ?? 0,
      last_reply_at: stat?.last_reply_at ?? null,
      reply_user_ids: stat?.reply_user_ids ?? [],
    };
  });
}
