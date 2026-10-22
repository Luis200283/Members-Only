import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app.js";
import pool from "../db/pg.js";

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const userA = { username: `test_a_${suffix}`, password: "secret123" };
const userB = { username: `test_b_${suffix}`, password: "secret123" };

describe("chat privado", () => {
  const agentA = request.agent(app);
  const agentB = request.agent(app);
  let userAId;
  let userBId;
  let directId;
  let messageId;
  let groupId;
  const groupTitle = `Equipo QA ${suffix}`;

  beforeAll(async () => {
    const registerA = await agentA.post("/api/auth/register").send(userA);
    const registerB = await agentB.post("/api/auth/register").send(userB);

    expect(registerA.status).toBe(201);
    expect(registerB.status).toBe(201);

    userAId = registerA.body.id;
    userBId = registerB.body.id;
  });

  afterAll(async () => {
    await pool.query("DELETE FROM conversations WHERE id = $1", [groupId]);
    await pool.query("DELETE FROM users WHERE username = ANY($1::text[])", [
      [userA.username, userB.username],
    ]);
    await pool.end();
  });

  it("busca usuarios por nombre", async () => {
    const res = await agentA.get(`/api/chat/users?q=${suffix}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(userBId);
  });

  it("crea un DM y reutiliza el existente", async () => {
    const created = await agentA
      .post("/api/chat/conversations")
      .send({ type: "direct", targetUserId: userBId });

    expect(created.status).toBe(201);
    expect(created.body.title).toBe(userB.username);
    expect(created.body.members).toHaveLength(2);
    directId = created.body.id;

    const again = await agentA
      .post("/api/chat/conversations")
      .send({ type: "direct", targetUserId: userBId });

    expect(again.status).toBe(200);
    expect(again.body.id).toBe(directId);
  });

  it("envía un mensaje y calcula el no leído", async () => {
    const sent = await agentA
      .post(`/api/chat/conversations/${directId}/messages`)
      .send({ body: "  hola desde A  " });

    expect(sent.status).toBe(201);
    expect(sent.body.body).toBe("hola desde A");
    messageId = sent.body.id;

    const list = await agentB.get("/api/chat/conversations");
    const conversation = list.body.find((item) => item.id === directId);

    expect(conversation).toBeTruthy();
    expect(conversation.title).toBe(userA.username);
    expect(conversation.unread_count).toBe(1);
    expect(conversation.last_message.id).toBe(messageId);
  });

  it("devuelve el historial paginado", async () => {
    const res = await agentB.get(
      `/api/chat/conversations/${directId}/messages`,
    );

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0].id).toBe(messageId);
    expect(res.body.nextCursor).toBeNull();
  });

  it("marca la conversación como leída", async () => {
    const read = await agentB
      .post(`/api/chat/conversations/${directId}/read`)
      .send({ messageId });

    expect(read.status).toBe(200);
    expect(read.body.lastReadMessageId).toBe(messageId);

    const list = await agentB.get("/api/chat/conversations");
    const conversation = list.body.find((item) => item.id === directId);

    expect(conversation.unread_count).toBe(0);
  });

  it("crea un grupo y notifica a sus miembros", async () => {
    const group = await agentA.post("/api/chat/conversations").send({
      type: "group",
      title: groupTitle,
      memberIds: [userBId, userBId],
    });

    expect(group.status).toBe(201);
    expect(group.body.title).toBe(groupTitle);
    expect(group.body.members).toHaveLength(2);
    groupId = group.body.id;

    const sent = await agentB
      .post(`/api/chat/conversations/${groupId}/messages`)
      .send({ body: "mensaje de B en grupo" });

    expect(sent.status).toBe(201);

    const list = await agentA.get("/api/chat/conversations");
    const conversation = list.body.find((item) => item.id === groupId);

    expect(conversation).toBeTruthy();
    expect(conversation.unread_count).toBe(1);
  });

  it("rechaza conversaciones y mensajes inválidos", async () => {
    const selfDm = await agentA
      .post("/api/chat/conversations")
      .send({ type: "direct", targetUserId: userAId });

    expect(selfDm.status).toBe(400);

    const emptyMessage = await agentA
      .post(`/api/chat/conversations/${directId}/messages`)
      .send({ body: "   " });

    expect(emptyMessage.status).toBe(400);

    const badRead = await agentA
      .post(`/api/chat/conversations/${directId}/read`)
      .send({ messageId: 999999999 });

    expect(badRead.status).toBe(404);
  });

  it("abre el stream SSE autenticado", async () => {
    const server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));

    try {
      const port = server.address().port;
      const login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userA),
      });
      const cookie = login.headers.getSetCookie()[0].split(";")[0];
      const controller = new AbortController();

      const stream = await fetch(`http://127.0.0.1:${port}/api/chat/stream`, {
        headers: { cookie },
        signal: controller.signal,
      });

      const reader = stream.body.getReader();
      const chunk = await reader.read();
      const text = new TextDecoder().decode(chunk.value);

      expect(stream.headers.get("content-type")).toContain(
        "text/event-stream",
      );
      expect(text).toContain("event: ready");

      controller.abort();
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
