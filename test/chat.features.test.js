import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app.js";
import pool from "../db/pg.js";

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const owner = { username: `feat_o_${suffix}`, password: "secret123" };
const member = { username: `feat_m_${suffix}`, password: "secret123" };
const roomTitle = `Sala ${suffix}`;

describe("funciones de chat (Tinta)", () => {
  const agentOwner = request.agent(app);
  const agentMember = request.agent(app);
  let ownerId;
  let memberId;
  let roomId;
  let otherId;
  let rootId;
  let otherMessageId;

  beforeAll(async () => {
    const registeredOwner = await agentOwner
      .post("/api/auth/register")
      .send(owner);
    const registeredMember = await agentMember
      .post("/api/auth/register")
      .send(member);

    expect(registeredOwner.status).toBe(201);
    expect(registeredMember.status).toBe(201);

    ownerId = registeredOwner.body.id;
    memberId = registeredMember.body.id;

    const room = await agentOwner.post("/api/chat/rooms").send({
      title: roomTitle,
      topic: "Prueba",
      is_public: true,
    });

    expect(room.status).toBe(201);
    roomId = room.body.id;

    const dm = await agentOwner
      .post("/api/chat/conversations")
      .send({ type: "direct", targetUserId: memberId });

    otherId = dm.body.id;

    const otherMessage = await agentOwner
      .post(`/api/chat/conversations/${otherId}/messages`)
      .send({ body: "mensaje de otra conversación" });

    otherMessageId = otherMessage.body.id;
  });

  afterAll(async () => {
    await pool.query("DELETE FROM conversations WHERE id = $1", [roomId]);
    await pool.query("DELETE FROM users WHERE username = ANY($1::text[])", [
      [owner.username, member.username],
    ]);
    await pool.end();
  });

  it("se une a una sala pública", async () => {
    const joined = await agentMember.post(`/api/chat/rooms/${roomId}/join`);

    expect(joined.status).toBe(200);
    expect(joined.body.id).toBe(roomId);
    expect(joined.body.member_count).toBe(2);

    const rooms = await agentMember.get("/api/chat/rooms");
    const listed = rooms.body.find((room) => room.id === roomId);

    expect(listed.joined).toBe(true);
  });

  it("el registro une al usuario a general", async () => {
    const list = await agentMember.get("/api/chat/conversations");
    const general = list.body.find((item) => item.title === "general");

    expect(general).toBeTruthy();
    expect(general.is_public).toBe(true);
  });

  it("crea una respuesta en hilo y actualiza reply_count", async () => {
    const root = await agentOwner
      .post(`/api/chat/conversations/${roomId}/messages`)
      .send({ body: "mensaje raíz" });

    rootId = root.body.id;

    const reply = await agentMember
      .post(`/api/chat/conversations/${roomId}/messages`)
      .send({ body: "respuesta en hilo", parentId: rootId });

    expect(reply.status).toBe(201);
    expect(reply.body.parent_id).toBe(rootId);

    const messages = await agentOwner.get(
      `/api/chat/conversations/${roomId}/messages`,
    );
    const parent = messages.body.messages.find((m) => m.id === rootId);
    const replyInRoot = messages.body.messages.find(
      (m) => m.id === reply.body.id,
    );

    expect(parent.reply_count).toBe(1);
    expect(parent.reply_user_ids).toContain(memberId);
    expect(replyInRoot).toBeUndefined();

    const thread = await agentOwner.get(`/api/chat/messages/${rootId}/replies`);

    expect(thread.status).toBe(200);
    expect(thread.body.parent.id).toBe(rootId);
    expect(thread.body.replies).toHaveLength(1);
    expect(thread.body.replies[0].body).toBe("respuesta en hilo");
  });

  it("alterna una reacción", async () => {
    const added = await agentMember
      .post(`/api/chat/messages/${rootId}/reactions`)
      .send({ emoji: "🍷" });

    expect(added.status).toBe(200);
    expect(added.body.reactions).toEqual([
      expect.objectContaining({ emoji: "🍷", count: 1, reacted: true }),
    ]);

    const removed = await agentMember
      .post(`/api/chat/messages/${rootId}/reactions`)
      .send({ emoji: "🍷" });

    expect(removed.body.reactions).toEqual([]);

    const invalid = await agentMember
      .post(`/api/chat/messages/${rootId}/reactions`)
      .send({ emoji: "🦄" });

    expect(invalid.status).toBe(400);
  });

  it("rechaza citar un mensaje de otra conversación", async () => {
    const res = await agentOwner
      .post(`/api/chat/conversations/${roomId}/messages`)
      .send({ body: "cita ajena", quotedId: otherMessageId });

    expect([400, 404]).toContain(res.status);
  });

  it("cita un mensaje de la misma conversación", async () => {
    const res = await agentMember
      .post(`/api/chat/conversations/${roomId}/messages`)
      .send({ body: "con cita", quotedId: rootId });

    expect(res.status).toBe(201);
    expect(res.body.quoted).toEqual({
      id: rootId,
      username: owner.username,
      body: "mensaje raíz",
    });
  });

  it("no permite fijar a un miembro sin permiso", async () => {
    const res = await agentMember
      .post(`/api/chat/conversations/${roomId}/pin`)
      .send({ messageId: rootId });

    expect(res.status).toBe(403);
  });

  it("el propietario fija un mensaje", async () => {
    const res = await agentOwner
      .post(`/api/chat/conversations/${roomId}/pin`)
      .send({ messageId: rootId });

    expect(res.status).toBe(200);
    expect(res.body.pinned_message.id).toBe(rootId);
  });

  it("busca mensajes por texto", async () => {
    const res = await agentOwner.get(
      `/api/chat/conversations/${roomId}/search?q=hilo`,
    );

    expect(res.status).toBe(200);
    expect(res.body.map((m) => m.body)).toContain("respuesta en hilo");
  });

  it("lista los enlaces de los mensajes", async () => {
    await agentOwner
      .post(`/api/chat/conversations/${roomId}/messages`)
      .send({ body: `mira https://example.com/${suffix}` });

    const res = await agentMember.get(
      `/api/chat/conversations/${roomId}/links`,
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({ url: `https://example.com/${suffix}` }),
    ]);
  });

  it("silencia la conversación y expone la presencia", async () => {
    const muted = await agentMember
      .post(`/api/chat/conversations/${roomId}/mute`)
      .send({ muted: true });

    expect(muted.body).toEqual({ muted: true });

    const presence = await agentMember.get("/api/chat/presence");

    expect(presence.status).toBe(200);
    expect(Array.isArray(presence.body.online)).toBe(true);
  });
});
