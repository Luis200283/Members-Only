import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app.js";
import pool from "../db/pg.js";

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const users = {
  owner: { username: `hd_o_${suffix}`, password: "secret123" },
  second: { username: `hd_m_${suffix}`, password: "secret123" },
  third: { username: `hd_n_${suffix}`, password: "secret123" },
};

describe("endurecimiento del chat", () => {
  const agentOwner = request.agent(app);
  const agentSecond = request.agent(app);
  const agentThird = request.agent(app);
  const roomTitle = `Sala dura ${suffix}`;
  let roomId;
  let dmId;
  let firstRootId;
  let secondRootId;

  beforeAll(async () => {
    const o = await agentOwner.post("/api/auth/register").send(users.owner);
    const m = await agentSecond.post("/api/auth/register").send(users.second);
    const n = await agentThird.post("/api/auth/register").send(users.third);

    expect(o.status).toBe(201);
    expect(m.status).toBe(201);
    expect(n.status).toBe(201);
  });

  afterAll(async () => {
    await pool.query("DELETE FROM conversations WHERE id = ANY($1::int[])", [
      [roomId, dmId].filter(Boolean),
    ]);
    await pool.query("DELETE FROM users WHERE username = ANY($1::text[])", [
      Object.values(users).map((user) => user.username),
    ]);
    await pool.end();
  });

  it("acepta is_public enviado como cadena \"true\"", async () => {
    const room = await agentOwner.post("/api/chat/rooms").send({
      title: roomTitle,
      topic: "Prueba de booleanos",
      is_public: "true",
    });

    expect(room.status).toBe(201);
    expect(room.body.is_public).toBe(true);
    roomId = room.body.id;

    const duplicated = await agentOwner.post("/api/chat/rooms").send({
      title: roomTitle.toUpperCase(),
      is_public: "true",
    });

    expect(duplicated.status).toBe(409);
    expect(duplicated.body.error).toBe("Ya existe una sala con ese nombre");
  });

  it("al unirse marca como leída la última respuesta de la sala y no cuenta hilos", async () => {
    const first = await agentOwner
      .post(`/api/chat/conversations/${roomId}/messages`)
      .send({ body: "primer mensaje anterior" });

    firstRootId = first.body.id;

    const joined = await agentSecond.post(`/api/chat/rooms/${roomId}/join`);

    expect(joined.status).toBe(200);
    expect(joined.body.unread_count).toBe(0);

    const reply = await agentOwner
      .post(`/api/chat/conversations/${roomId}/messages`)
      .send({ body: "respuesta de hilo", parentId: firstRootId });

    expect(reply.status).toBe(201);

    const afterReply = await agentSecond.get(
      `/api/chat/conversations/${roomId}`,
    );

    expect(afterReply.body.unread_count).toBe(0);

    const root = await agentOwner
      .post(`/api/chat/conversations/${roomId}/messages`)
      .send({ body: "mensaje raíz nuevo" });

    secondRootId = root.body.id;

    const afterRoot = await agentSecond.get(
      `/api/chat/conversations/${roomId}`,
    );

    expect(afterRoot.body.unread_count).toBe(1);
  });

  it("devuelve 404 a quien no es miembro, incluso en un chat directo", async () => {
    const created = await agentOwner
      .post("/api/chat/conversations")
      .send({ type: "direct", targetUserId: await getUserId(users.second) });

    expect(created.status).toBe(201);

    dmId = created.body.id;

    const outsider = await agentThird.post(
      `/api/chat/conversations/${dmId}/leave`,
    );

    expect(outsider.status).toBe(404);
  });

  it("al salir el último owner transfiere el rol al miembro más antiguo", async () => {
    const third = await agentThird.post(`/api/chat/rooms/${roomId}/join`);

    expect(third.status).toBe(200);

    const left = await agentOwner.post(`/api/chat/conversations/${roomId}/leave`);

    expect(left.status).toBe(200);
    expect(left.body).toEqual({ ok: true });

    const room = await agentSecond.get(`/api/chat/conversations/${roomId}`);
    const owners = room.body.members.filter((member) => member.role === "owner");

    expect(room.body.member_count).toBe(2);
    expect(owners).toHaveLength(1);
    expect(owners[0].id).toBe(await getUserId(users.second));
  });
});

async function getUserId(user) {
  const { rows } = await pool.query("SELECT id FROM users WHERE username = $1", [
    user.username,
  ]);
  return rows[0].id;
}
