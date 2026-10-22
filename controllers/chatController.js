import pool from "../db/pg.js";
import {
  buildMessages,
  formatReactions,
  loadReactions,
  loadThreadStats,
} from "./chatMessages.js";

export const streamClients = new Set();

export const MAX_STREAMS_PER_USER = 5;

export function writeEvent(client, event, data) {
  client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function broadcastToUsers(userIds, event, data) {
  const recipients = new Set(userIds.map(Number));
  for (const client of streamClients) {
    if (recipients.has(client.userId)) writeEvent(client, event, data);
  }
}

export function broadcastToUser(userId, event, data) {
  for (const client of streamClients) {
    if (client.userId === Number(userId)) writeEvent(client, event, data);
  }
}

export function broadcastToAll(event, data) {
  for (const client of streamClients) writeEvent(client, event, data);
}

export function isUserOnline(userId) {
  for (const client of streamClients) {
    if (client.userId === Number(userId)) return true;
  }
  return false;
}

export function closeStream(client) {
  streamClients.delete(client);
  clearInterval(client.heartbeat);
  client.res.end();
}

export function closeStreamsForSession(sessionID) {
  for (const client of [...streamClients]) {
    if (client.sessionID === sessionID) closeStream(client);
  }
}

export async function getMemberIds(conversationId) {
  const { rows } = await pool.query(
    "SELECT user_id FROM conversation_members WHERE conversation_id = $1",
    [conversationId],
  );
  return rows.map((row) => row.user_id);
}

export async function isMember(conversationId, userId) {
  const { rowCount } = await pool.query(
    "SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2",
    [conversationId, userId],
  );
  return rowCount > 0;
}

async function loadConversationViews(where, params) {
  const { rows } = await pool.query(
    `
      SELECT
        cm.user_id AS viewer_id,
        c.id,
        c.type,
        c.title,
        c.topic,
        c.is_public,
        c.pinned_message_id,
        c.created_at,
        c.updated_at,
        cm.last_read_message_id,
        cm.muted,
        cm.archived,
        pm.id AS pinned_id,
        pm.body AS pinned_body,
        pm.created_at AS pinned_created_at,
        pu.username AS pinned_username,
        lm.id AS last_message_id,
        lm.body AS last_message_body,
        lm.created_at AS last_message_created_at,
        lm.sender_id AS last_message_sender_id,
        lu.username AS last_message_username,
        COALESCE(unread.count, 0) AS unread_count
      FROM conversation_members cm
      JOIN conversations c ON c.id = cm.conversation_id
      LEFT JOIN LATERAL (
        SELECT m.id, m.body, m.created_at, m.sender_id
        FROM messages m
        WHERE m.conversation_id = c.id AND m.deleted_at IS NULL
        ORDER BY m.id DESC
        LIMIT 1
      ) lm ON true
      LEFT JOIN users lu ON lu.id = lm.sender_id
      LEFT JOIN messages pm ON pm.id = c.pinned_message_id AND pm.deleted_at IS NULL
      LEFT JOIN users pu ON pu.id = pm.sender_id
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS count
        FROM messages m
        WHERE m.conversation_id = c.id
          AND m.id > cm.last_read_message_id
          AND m.sender_id <> cm.user_id
          AND m.parent_id IS NULL
          AND m.deleted_at IS NULL
      ) unread ON true
      WHERE ${where}
      ORDER BY COALESCE(lm.created_at, c.updated_at, c.created_at) DESC, c.id DESC
    `,
    params,
  );

  if (rows.length === 0) return [];

  const conversationIds = [...new Set(rows.map((row) => row.id))];
  const membersResult = await pool.query(
    `
      SELECT cm.conversation_id, u.id, u.username, cm.role
      FROM conversation_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.conversation_id = ANY($1::int[])
      ORDER BY u.username ASC, u.id ASC
    `,
    [conversationIds],
  );

  const membersByConversation = new Map();
  for (const member of membersResult.rows) {
    const list = membersByConversation.get(member.conversation_id) || [];
    list.push({
      id: member.id,
      username: member.username,
      role: member.role,
    });
    membersByConversation.set(member.conversation_id, list);
  }

  return rows.map((row) => {
    const members = membersByConversation.get(row.id) || [];
    const title =
      row.type === "direct"
        ? members.find((member) => member.id !== row.viewer_id)?.username ||
          "Chat"
        : row.title;

    return {
      viewerId: row.viewer_id,
      conversation: {
        id: row.id,
        type: row.type,
        title,
        topic: row.topic,
        is_public: row.is_public,
        muted: row.muted,
        archived: row.archived,
        member_count: members.length,
        pinned_message:
          row.pinned_id === null || row.pinned_id === undefined
            ? null
            : {
                id: row.pinned_id,
                username: row.pinned_username,
                body: row.pinned_body,
                created_at: row.pinned_created_at,
              },
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_read_message_id: row.last_read_message_id,
        unread_count: row.unread_count,
        last_message:
          row.last_message_id === null
            ? null
            : {
                id: row.last_message_id,
                body: row.last_message_body,
                created_at: row.last_message_created_at,
                sender_id: row.last_message_sender_id,
                username: row.last_message_username,
              },
        members,
      },
    };
  });
}

export async function loadConversations(userId, conversationId = null) {
  const params = [userId];
  let filter = "AND cm.hidden_at IS NULL";

  if (conversationId) {
    params.push(conversationId);
    filter += " AND c.id = $2";
  }

  const views = await loadConversationViews(
    `cm.user_id = $1 ${filter}`,
    params,
  );
  return views.map((view) => view.conversation);
}

export async function loadConversationsForMembers(conversationId) {
  const views = await loadConversationViews("cm.conversation_id = $1", [
    conversationId,
  ]);
  return new Map(views.map((view) => [view.viewerId, view.conversation]));
}

export async function searchUsers(req, res, next) {
  const query = String(req.query.q || "").trim();

  if (query.length < 2) return res.json([]);

  try {
    const { rows } = await pool.query(
      `
        SELECT id, username
        FROM users
        WHERE id <> $1 AND POSITION(lower($2) IN lower(username)) > 0
        ORDER BY username ASC
        LIMIT 20
      `,
      [req.user.id, query],
    );

    return res.json(rows);
  } catch (err) {
    return next(err);
  }
}

export async function listConversations(req, res, next) {
  try {
    const conversations = await loadConversations(req.user.id);
    return res.json(conversations);
  } catch (err) {
    return next(err);
  }
}

export async function getConversation(req, res, next) {
  const conversationId = Number(req.params.id);

  try {
    const [conversation] = await loadConversations(
      req.user.id,
      conversationId,
    );

    if (!conversation) {
      return res.status(404).json({ error: "Conversación no encontrada" });
    }

    return res.json(conversation);
  } catch (err) {
    return next(err);
  }
}

export async function createConversation(req, res, next) {
  const userId = req.user.id;
  const { type } = req.body;

  try {
    if (type === "direct") {
      const targetUserId = Number(req.body.targetUserId);

      if (targetUserId === userId) {
        return res
          .status(400)
          .json({ error: "No puedes crear un chat contigo mismo" });
      }

      const target = await pool.query("SELECT id FROM users WHERE id = $1", [
        targetUserId,
      ]);

      if (target.rowCount === 0) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      const dmKey = [userId, targetUserId].sort((a, b) => a - b).join(":");
      const existing = await pool.query(
        "SELECT id FROM conversations WHERE dm_key = $1",
        [dmKey],
      );

      if (existing.rowCount > 0) {
        const [conversation] = await loadConversations(
          userId,
          existing.rows[0].id,
        );
        return res.json(conversation);
      }

      const client = await pool.connect();
      let conversationId;
      let created = false;

      try {
        await client.query("BEGIN");

        const inserted = await client.query(
          `
            INSERT INTO conversations (type, dm_key, created_by)
            VALUES ('direct', $1, $2)
            ON CONFLICT (dm_key) DO NOTHING
            RETURNING id
          `,
          [dmKey, userId],
        );

        if (inserted.rowCount > 0) {
          conversationId = inserted.rows[0].id;
          await client.query(
            `
              INSERT INTO conversation_members (conversation_id, user_id, role)
              VALUES ($1, $2, 'owner'), ($1, $3, 'member')
            `,
            [conversationId, userId, targetUserId],
          );
          created = true;
        } else {
          const found = await client.query(
            "SELECT id FROM conversations WHERE dm_key = $1",
            [dmKey],
          );
          conversationId = found.rows[0].id;
        }

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }

      const [conversation] = await loadConversations(userId, conversationId);

      if (created) {
        const memberIds = await getMemberIds(conversationId);
        broadcastToUsers(memberIds, "conversation.created", {
          conversationId,
        });
      }

      return res.status(created ? 201 : 200).json(conversation);
    }

    const title = String(req.body.title || "").trim();
    const memberIds = [
      ...new Set(
        (req.body.memberIds || [])
          .map(Number)
          .filter(
            (id) => Number.isInteger(id) && id > 0 && id !== userId,
          ),
      ),
    ];

    if (memberIds.length === 0) {
      return res
        .status(400)
        .json({ error: "Selecciona al menos un miembro para el grupo" });
    }

    const existingUsers = await pool.query(
      "SELECT id FROM users WHERE id = ANY($1::int[])",
      [memberIds],
    );

    if (existingUsers.rowCount !== memberIds.length) {
      return res
        .status(400)
        .json({ error: "Alguno de los miembros no existe" });
    }

    const allMemberIds = [userId, ...memberIds];
    const client = await pool.connect();
    let conversationId;

    try {
      await client.query("BEGIN");

      const inserted = await client.query(
        `
          INSERT INTO conversations (type, title, created_by)
          VALUES ('group', $1, $2)
          RETURNING id
        `,
        [title, userId],
      );

      conversationId = inserted.rows[0].id;

      await client.query(
        `
          INSERT INTO conversation_members (conversation_id, user_id, role)
          SELECT $1, member_id, CASE WHEN member_id = $2 THEN 'owner' ELSE 'member' END
          FROM unnest($3::int[]) AS member_id
        `,
        [conversationId, userId, allMemberIds],
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    const [conversation] = await loadConversations(userId, conversationId);
    broadcastToUsers(allMemberIds, "conversation.created", {
      conversationId,
    });

    return res.status(201).json(conversation);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Ya existe una sala con ese nombre" });
    }
    return next(err);
  }
}

export async function listMessages(req, res, next) {
  const conversationId = Number(req.params.id);
  const requestedLimit = Number(req.query.limit);
  const limit =
    Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 30;
  const before = req.query.before ? Number(req.query.before) : null;

  try {
    if (!(await isMember(conversationId, req.user.id))) {
      return res
        .status(404)
        .json({ error: "Conversación no encontrada" });
    }

    const params = [conversationId, limit];
    let beforeFilter = "";

    if (before) {
      params.push(before);
      beforeFilter = "AND m.id < $3";
    }

    const { rows } = await pool.query(
      `
        SELECT m.id
        FROM messages m
        WHERE m.conversation_id = $1
          AND m.deleted_at IS NULL
          AND m.parent_id IS NULL
          ${beforeFilter}
        ORDER BY m.id DESC
        LIMIT $2
      `,
      params,
    );

    const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;
    const messages = await buildMessages(
      rows.map((row) => row.id),
      req.user.id,
    );

    return res.json({
      messages,
      nextCursor,
    });
  } catch (err) {
    return next(err);
  }
}

export async function sendMessage(req, res, next) {
  const conversationId = Number(req.params.id);
  const body = String(req.body.body || "").trim();
  const parentId = req.body.parentId ? Number(req.body.parentId) : null;
  const quotedId = req.body.quotedId ? Number(req.body.quotedId) : null;

  try {
    if (!(await isMember(conversationId, req.user.id))) {
      return res
        .status(404)
        .json({ error: "Conversación no encontrada" });
    }

    if (parentId !== null) {
      const parent = await pool.query(
        "SELECT conversation_id, parent_id FROM messages WHERE id = $1 AND deleted_at IS NULL",
        [parentId],
      );
      if (
        parent.rowCount === 0 ||
        parent.rows[0].conversation_id !== conversationId ||
        parent.rows[0].parent_id !== null
      ) {
        return res
          .status(400)
          .json({ error: "El mensaje padre no es válido para este hilo" });
      }
    }

    if (quotedId !== null) {
      const quoted = await pool.query(
        "SELECT conversation_id FROM messages WHERE id = $1 AND deleted_at IS NULL",
        [quotedId],
      );
      if (
        quoted.rowCount === 0 ||
        quoted.rows[0].conversation_id !== conversationId
      ) {
        return res
          .status(400)
          .json({ error: "El mensaje citado no pertenece a esta conversación" });
      }
    }

    const inserted = await pool.query(
      `
        INSERT INTO messages (conversation_id, sender_id, body, parent_id, quoted_id)
        SELECT $1::int, $2::int, $3::text, $4::bigint, $5::bigint
        WHERE EXISTS (
          SELECT 1 FROM conversation_members
          WHERE conversation_id = $1 AND user_id = $2
        )
        RETURNING id
      `,
      [conversationId, req.user.id, body, parentId, quotedId],
    );

    if (inserted.rowCount === 0) {
      return res
        .status(404)
        .json({ error: "Conversación no encontrada" });
    }

    const [message] = await buildMessages([inserted.rows[0].id], req.user.id);

    await pool.query(
      "UPDATE conversations SET updated_at = now() WHERE id = $1",
      [conversationId],
    );

    await pool.query(
      `
        UPDATE conversation_members
        SET last_read_message_id = GREATEST(last_read_message_id, $3)
        WHERE conversation_id = $1 AND user_id = $2
      `,
      [conversationId, req.user.id, message.id],
    );

    await pool.query(
      "UPDATE conversation_members SET hidden_at = NULL WHERE conversation_id = $1 AND hidden_at IS NOT NULL",
      [conversationId],
    );

    const memberIds = await getMemberIds(conversationId);
    broadcastToUsers(memberIds, "message.created", {
      conversationId,
      message,
    });

    if (parentId !== null) {
      const stat = (await loadThreadStats([parentId])).get(parentId);
      broadcastToUsers(memberIds, "thread.updated", {
        conversationId,
        parentId,
        reply_count: stat?.reply_count ?? 0,
        last_reply_at: stat?.last_reply_at ?? null,
        reply_user_ids: stat?.reply_user_ids ?? [],
      });
    }

    return res.status(201).json(message);
  } catch (err) {
    return next(err);
  }
}

export async function deleteMessage(req, res, next) {
  const messageId = Number(req.params.id);

  try {
    const { rows } = await pool.query(
      `
        SELECT m.id, m.conversation_id, m.sender_id, m.parent_id, m.deleted_at,
               cm.role AS viewer_role
        FROM messages m
        JOIN conversation_members cm
          ON cm.conversation_id = m.conversation_id AND cm.user_id = $2
        WHERE m.id = $1
      `,
      [messageId, req.user.id],
    );

    const message = rows[0];

    if (!message || message.deleted_at) {
      return res.status(404).json({ error: "Mensaje no encontrado" });
    }

    const canModerate =
      Boolean(req.user.isAdmin) ||
      message.viewer_role === "owner" ||
      message.viewer_role === "admin";

    if (message.sender_id !== req.user.id && !canModerate) {
      return res
        .status(403)
        .json({ error: "No puedes eliminar este mensaje" });
    }

    await pool.query(
      `
        UPDATE messages
        SET deleted_at = now()
        WHERE (id = $1 OR parent_id = $1) AND deleted_at IS NULL
      `,
      [messageId],
    );

    await pool.query(
      `
        UPDATE conversations c
        SET pinned_message_id = NULL, updated_at = now()
        WHERE c.id = $1
          AND c.pinned_message_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM messages m
            WHERE m.id = c.pinned_message_id AND m.deleted_at IS NULL
          )
      `,
      [message.conversation_id],
    );

    const memberIds = await getMemberIds(message.conversation_id);

    broadcastToUsers(memberIds, "message.deleted", {
      conversationId: message.conversation_id,
      messageId: message.id,
      parentId: message.parent_id,
    });

    if (message.parent_id !== null) {
      const stat = (await loadThreadStats([message.parent_id])).get(
        message.parent_id,
      );
      broadcastToUsers(memberIds, "thread.updated", {
        conversationId: message.conversation_id,
        parentId: message.parent_id,
        reply_count: stat?.reply_count ?? 0,
        last_reply_at: stat?.last_reply_at ?? null,
        reply_user_ids: stat?.reply_user_ids ?? [],
      });
    }

    return res.json({
      ok: true,
      messageId: message.id,
      parentId: message.parent_id,
    });
  } catch (err) {
    return next(err);
  }
}

export async function markConversationRead(req, res, next) {  const conversationId = Number(req.params.id);
  const messageId = Number(req.body.messageId);

  try {
    const updated = await pool.query(
      `
        UPDATE conversation_members cm
        SET last_read_message_id = GREATEST(cm.last_read_message_id, $3)
        WHERE cm.conversation_id = $1
          AND cm.user_id = $2
          AND EXISTS (
            SELECT 1 FROM messages m
            WHERE m.id = $3 AND m.conversation_id = $1
          )
        RETURNING cm.last_read_message_id
      `,
      [conversationId, req.user.id, messageId],
    );

    if (updated.rowCount === 0) {
      return res.status(404).json({ error: "Mensaje no encontrado" });
    }

    const lastReadMessageId = updated.rows[0].last_read_message_id;

    broadcastToUser(req.user.id, "read.updated", {
      conversationId,
      lastReadMessageId,
    });

    return res.json({ ok: true, lastReadMessageId });
  } catch (err) {
    return next(err);
  }
}

export function streamChat(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  const client = { res, userId: req.user.id, sessionID: req.sessionID };
  const wasOnline = isUserOnline(req.user.id);
  streamClients.add(client);

  client.heartbeat = setInterval(() => res.write(": ping\n\n"), 30000);

  const ownStreams = [...streamClients].filter(
    (item) => item.userId === client.userId,
  );
  for (const oldest of ownStreams.slice(0, -MAX_STREAMS_PER_USER)) {
    closeStream(oldest);
  }

  writeEvent(client, "ready", { userId: req.user.id });

  if (!wasOnline) {
    broadcastToAll("presence", { userId: req.user.id, online: true });
  }

  res.on("close", () => {
    clearInterval(client.heartbeat);
    streamClients.delete(client);
    if (!isUserOnline(req.user.id)) {
      broadcastToAll("presence", { userId: req.user.id, online: false });
    }
  });
}
