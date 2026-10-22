import pool from "../db/pg.js";
import {
  broadcastToUser,
  broadcastToUsers,
  getMemberIds,
  isMember,
  loadConversations,
  loadConversationsForMembers,
  streamClients,
} from "./chatController.js";
import {
  buildMessages,
  formatReactions,
  loadReactions,
} from "./chatMessages.js";
const notFound = (res) =>
  res.status(404).json({ error: "Conversación no encontrada" });

async function getMembership(conversationId, userId) {
  const { rows } = await pool.query(
    "SELECT role FROM conversation_members WHERE conversation_id = $1 AND user_id = $2",
    [conversationId, userId],
  );
  return rows[0] || null;
}

async function emitConversationUpdated(conversationId) {
  const conversations = await loadConversationsForMembers(conversationId);
  for (const [memberId, conversation] of conversations) {
    broadcastToUser(memberId, "conversation.updated", { conversation });
  }
}

export async function listRooms(req, res, next) {
  try {
    const { rows } = await pool.query(
      `
        SELECT c.id, c.title, c.topic, c.is_public,
               (SELECT count(*)::int FROM conversation_members m WHERE m.conversation_id = c.id) AS member_count,
               EXISTS (
                 SELECT 1 FROM conversation_members me
                 WHERE me.conversation_id = c.id AND me.user_id = $1
               ) AS joined
        FROM conversations c
        WHERE c.type = 'group' AND c.is_public = true
        ORDER BY c.title ASC
      `,
      [req.user.id],
    );

    return res.json(rows);
  } catch (err) {
    return next(err);
  }
}

export async function createRoom(req, res, next) {
  const userId = req.user.id;
  const title = String(req.body.title || "").trim();
  const topic = req.body.topic ? String(req.body.topic).trim() : null;
  const isPublic = req.body.is_public === true;

  try {
    const existing = await pool.query(
      "SELECT 1 FROM conversations WHERE type = 'group' AND lower(title) = lower($1)",
      [title],
    );

    if (existing.rowCount > 0) {
      return res.status(409).json({ error: "Ya existe una sala con ese nombre" });
    }

    const client = await pool.connect();
    let conversationId;

    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `
          INSERT INTO conversations (type, title, topic, is_public, created_by)
          VALUES ('group', $1, $2, $3, $4)
          RETURNING id
        `,
        [title, topic, isPublic, userId],
      );
      conversationId = inserted.rows[0].id;
      await client.query(
        "INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, 'owner')",
        [conversationId, userId],
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    const [conversation] = await loadConversations(userId, conversationId);
    broadcastToUser(userId, "conversation.created", { conversationId });

    return res.status(201).json(conversation);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Ya existe una sala con ese nombre" });
    }
    return next(err);
  }
}

export async function joinRoom(req, res, next) {
  const conversationId = Number(req.params.id);
  const userId = req.user.id;

  try {
    const room = await pool.query(
      "SELECT 1 FROM conversations WHERE id = $1 AND type = 'group' AND is_public = true",
      [conversationId],
    );

    if (room.rowCount === 0) return notFound(res);

    await pool.query(
      `
        INSERT INTO conversation_members (conversation_id, user_id, role, last_read_message_id)
        VALUES (
          $1, $2, 'member',
          COALESCE((SELECT max(id) FROM messages WHERE conversation_id = $1), 0)
        )
        ON CONFLICT DO NOTHING
      `,
      [conversationId, userId],
    );

    const [conversation] = await loadConversations(userId, conversationId);
    broadcastToUser(userId, "conversation.created", { conversationId });

    return res.json(conversation);
  } catch (err) {
    return next(err);
  }
}

async function removeMemberFromRoom(conversationId, userId, role) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId],
    );

    if (role === "owner") {
      const remainingOwner = await client.query(
        "SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND role = 'owner' LIMIT 1",
        [conversationId],
      );

      if (remainingOwner.rowCount === 0) {
        await client.query(
          `
            UPDATE conversation_members
            SET role = 'owner'
            WHERE (conversation_id, user_id) = (
              SELECT conversation_id, user_id
              FROM conversation_members
              WHERE conversation_id = $1
              ORDER BY joined_at ASC, user_id ASC
              LIMIT 1
            )
          `,
          [conversationId],
        );
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function leaveConversation(req, res, next) {
  const conversationId = Number(req.params.id);
  const userId = req.user.id;

  try {
    const membership = await getMembership(conversationId, userId);

    if (!membership) return notFound(res);

    const conversation = await pool.query(
      "SELECT type FROM conversations WHERE id = $1",
      [conversationId],
    );

    if (conversation.rows[0]?.type === "direct") {
      return res
        .status(400)
        .json({ error: "No puedes salir de un chat directo" });
    }

    await removeMemberFromRoom(conversationId, userId, membership.role);

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

export async function setArchived(req, res, next) {
  const conversationId = Number(req.params.id);
  const archived = req.body.archived === true;

  try {
    const updated = await pool.query(
      `
        UPDATE conversation_members
        SET archived = $3
        WHERE conversation_id = $1 AND user_id = $2
      `,
      [conversationId, req.user.id, archived],
    );

    if (updated.rowCount === 0) return notFound(res);

    const [conversation] = await loadConversations(req.user.id, conversationId);

    return res.json({ archived, conversation: conversation || null });
  } catch (err) {
    return next(err);
  }
}

export async function deleteConversation(req, res, next) {
  const conversationId = Number(req.params.id);
  const userId = req.user.id;

  try {
    const membership = await getMembership(conversationId, userId);

    if (!membership) return notFound(res);

    const conversation = await pool.query(
      "SELECT type FROM conversations WHERE id = $1",
      [conversationId],
    );

    if (conversation.rows[0]?.type === "direct") {
      await pool.query(
        `
          UPDATE conversation_members
          SET hidden_at = now(), archived = false
          WHERE conversation_id = $1 AND user_id = $2
        `,
        [conversationId, userId],
      );

      broadcastToUser(userId, "conversation.updated", { conversationId });
      return res.json({ ok: true, left_room: false });
    }

    await removeMemberFromRoom(conversationId, userId, membership.role);

    const remaining = await getMemberIds(conversationId);
    if (remaining.length > 0) {
      broadcastToUsers(remaining, "conversation.updated", { conversationId });
    }
    broadcastToUser(userId, "conversation.updated", { conversationId });

    return res.json({ ok: true, left_room: true });
  } catch (err) {
    return next(err);
  }
}

export async function getReplies(req, res, next) {
  const messageId = Number(req.params.id);

  try {
    const { rows } = await pool.query(
      "SELECT id, conversation_id FROM messages WHERE id = $1 AND deleted_at IS NULL",
      [messageId],
    );

    if (rows.length === 0 || !(await isMember(rows[0].conversation_id, req.user.id))) {
      return res.status(404).json({ error: "Mensaje no encontrado" });
    }

    const replies = await pool.query(
      "SELECT id FROM messages WHERE parent_id = $1 AND deleted_at IS NULL ORDER BY id ASC",
      [messageId],
    );

    const messages = await buildMessages(
      [messageId, ...replies.rows.map((row) => row.id)],
      req.user.id,
    );

    return res.json({
      parent: messages.find((message) => message.id === messageId),
      replies: messages.filter((message) => message.id !== messageId),
    });
  } catch (err) {
    return next(err);
  }
}

export async function toggleReaction(req, res, next) {
  const messageId = Number(req.params.id);
  const userId = req.user.id;
  const emoji = String(req.body.emoji);

  try {
    const { rows } = await pool.query(
      "SELECT conversation_id FROM messages WHERE id = $1 AND deleted_at IS NULL",
      [messageId],
    );

    if (rows.length === 0 || !(await isMember(rows[0].conversation_id, userId))) {
      return res.status(404).json({ error: "Mensaje no encontrado" });
    }

    const conversationId = rows[0].conversation_id;

    await pool.query(
      `
        WITH removed AS (
          DELETE FROM message_reactions
          WHERE message_id = $1 AND user_id = $2 AND emoji = $3
          RETURNING 1
        )
        INSERT INTO message_reactions (message_id, user_id, emoji)
        SELECT $1, $2, $3
        WHERE NOT EXISTS (SELECT 1 FROM removed)
        ON CONFLICT DO NOTHING
      `,
      [messageId, userId, emoji],
    );

    const raw = (await loadReactions([messageId])).get(messageId) || [];
    const memberIds = await getMemberIds(conversationId);

    broadcastToUsers(memberIds, "reaction.updated", {
      conversationId,
      messageId,
      reactions: raw.map((reaction) => ({
        emoji: reaction.emoji,
        count: reaction.count,
        user_ids: reaction.user_ids,
      })),
    });

    return res.json({
      messageId,
      reactions: formatReactions(raw, userId),
    });
  } catch (err) {
    return next(err);
  }
}

export async function pinMessage(req, res, next) {
  const conversationId = Number(req.params.id);
  const messageId =
    req.body.messageId === null || req.body.messageId === undefined
      ? null
      : Number(req.body.messageId);

  try {
    const membership = await getMembership(conversationId, req.user.id);

    if (!membership) return notFound(res);

    const canPin =
      req.user.isAdmin === true ||
      membership.role === "owner" ||
      membership.role === "admin";

    if (!canPin) {
      return res
        .status(403)
        .json({ error: "Solo el propietario o un admin puede fijar mensajes" });
    }

    if (messageId !== null) {
      const message = await pool.query(
        "SELECT 1 FROM messages WHERE id = $1 AND conversation_id = $2 AND deleted_at IS NULL",
        [messageId, conversationId],
      );

      if (message.rowCount === 0) {
        return res.status(404).json({ error: "Mensaje no encontrado" });
      }
    }

    await pool.query(
      "UPDATE conversations SET pinned_message_id = $2 WHERE id = $1",
      [conversationId, messageId],
    );

    await emitConversationUpdated(conversationId);

    const [conversation] = await loadConversations(req.user.id, conversationId);
    return res.json(conversation);
  } catch (err) {
    return next(err);
  }
}

export async function setMuted(req, res, next) {
  const conversationId = Number(req.params.id);
  const muted = req.body.muted === true;

  try {
    const updated = await pool.query(
      `
        UPDATE conversation_members
        SET muted = $3
        WHERE conversation_id = $1 AND user_id = $2
      `,
      [conversationId, req.user.id, muted],
    );

    if (updated.rowCount === 0) return notFound(res);

    return res.json({ muted });
  } catch (err) {
    return next(err);
  }
}

export async function sendTyping(req, res, next) {
  const conversationId = Number(req.params.id);

  try {
    if (!(await isMember(conversationId, req.user.id))) return notFound(res);

    const memberIds = await getMemberIds(conversationId);
    broadcastToUsers(
      memberIds.filter((id) => id !== req.user.id),
      "typing",
      { conversationId, userId: req.user.id, username: req.user.username },
    );

    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
}

export async function searchMessages(req, res, next) {
  const conversationId = Number(req.params.id);
  const query = String(req.query.q || "").trim();
  const pattern = `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

  try {
    if (!(await isMember(conversationId, req.user.id))) return notFound(res);

    const { rows } = await pool.query(
      `
        SELECT id FROM messages
        WHERE conversation_id = $1
          AND deleted_at IS NULL
          AND body ILIKE $2
        ORDER BY id DESC
        LIMIT 30
      `,
      [conversationId, pattern],
    );

    const messages = await buildMessages(
      rows.map((row) => row.id),
      req.user.id,
    );

    return res.json(messages.reverse());
  } catch (err) {
    return next(err);
  }
}

export async function listLinks(req, res, next) {
  const conversationId = Number(req.params.id);

  try {
    if (!(await isMember(conversationId, req.user.id))) return notFound(res);

    const { rows } = await pool.query(
      `
        SELECT m.id AS message_id, m.body, m.created_at, u.username
        FROM messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = $1
          AND m.deleted_at IS NULL
          AND m.body ~* 'https?://'
        ORDER BY m.id DESC
        LIMIT 200
      `,
      [conversationId],
    );

    const links = [];
    for (const row of rows) {
      const urls = row.body.match(/https?:\/\/[^\s<>"']+/gi) || [];
      for (const url of urls) {
        links.push({
          url,
          message_id: row.message_id,
          username: row.username,
          created_at: row.created_at,
        });
      }
    }

    return res.json(links);
  } catch (err) {
    return next(err);
  }
}

export function getPresence(req, res) {
  const online = [...new Set([...streamClients].map((client) => client.userId))];
  return res.json({ online });
}
