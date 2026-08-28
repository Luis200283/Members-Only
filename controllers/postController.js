import sql from "../db/neon.js";

export async function getPosts(req, res) {
  try {
    const rows = await sql`
            SELECT posts.id, posts.title, posts.body, posts.created_at,
            users.id AS user_id, users.username
            FROM posts
            JOIN users ON posts.user_id = users.id
            ORDER BY posts.created_at DESC
        `;
    if (!req.user) {
      return res.json(rows.map(({ user_id, username, ...post }) => post));
    }
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "Error al obtener el post" });
  }
}

export async function getPost(req, res) {
  const { id } = req.params;
  try {
    const rows = await sql`
            SELECT posts.id, posts.title, posts.body, posts.created_at,
            users.id AS user_id, users.username
            FROM posts
            JOIN users ON posts.user_id = users.id
            WHERE posts.id = ${id}
        `;
    if (rows.length === 0)
      return res.status(404).json({ error: "Post no encontrado" });
    const post = rows[0];
    if (!req.user) {
      const { user_id, username, ...rest } = post;
      return res.json(rest);
    }
    return res.json(post);
  } catch (err) {
    return res.status(500).json({ error: "Error al obtener el post" });
  }
}

export async function createPost(req, res) {
  const { title, body } = req.body;
  try {
    const rows = await sql`
             INSERT INTO posts (user_id, title, body)
             VALUES (${req.user.id}, ${title}, ${body})
             RETURNING id, title, body, created_at
        `;
    return res.status(201).json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: "Error al crear el post" });
  }
}

export async function updatePost(req, res) {
  const { id } = req.params;
  const { title, body } = req.body;
  try {
    const rows = await sql`
        UPDATE posts 
        SET title = ${title}, body = ${body}
        WHERE id = ${id} AND user_id = ${req.user.id}
        RETURNING id, title, body, created_at
    `;
    if (rows.length === 0)
      return res
        .status(404)
        .json({ error: "No tienes permiso o el post no existe" });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: "Error al actualizar el post" });
  }
}

export async function deletePost(req, res) {
  const { id } = req.params;
  try {
    const rows = await sql`
        DELETE FROM posts 
        WHERE id = ${id} AND (user_id = ${req.user.id} OR ${req.user.isAdmin})
        RETURNING id
    `;
    if (rows.length === 0)
      return res.status(404).json({ error: "No tienes permiso o el post no existe" });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Error al eliminar el post" });
  }
}

