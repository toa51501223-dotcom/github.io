// GET  /api/comments?game=<id>   → published comments for a game
// POST /api/comments             → submit a comment (stored as pending until the owner publishes it)
import { json, CORS, GAME_RE, clean, readApproved } from "../../lib/comments-lib.js";

export async function onRequestOptions() { return new Response(null, { status: 204, headers: CORS }); }

export async function onRequestGet({ request, env }) {
  if (!env.COMMENTS) return json({ error: "not-configured" }, 503);
  const game = new URL(request.url).searchParams.get("game") || "";
  if (!GAME_RE.test(game)) return json({ comments: [] });
  const list = await readApproved(env.COMMENTS, game);
  return json({ comments: list.map(({ id, name, text, date }) => ({ id, name, text, date })) });
}

export async function onRequestPost({ request, env }) {
  if (!env.COMMENTS) return json({ error: "not-configured" }, 503);
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "bad-request" }, 400); }
  if (body["bot-field"]) return json({ ok: true }); // honeypot: pretend success
  const game = clean(body.game, 64);
  const text = clean(body.comment, 300);
  const name = clean(body.name, 20);
  if (!GAME_RE.test(game) || !text) return json({ error: "bad-request" }, 400);

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const rlKey = "rl:" + ip;
  if (await env.COMMENTS.get(rlKey)) return json({ error: "too-fast" }, 429);
  await env.COMMENTS.put(rlKey, "1", { expirationTtl: 60 });

  const id = Date.now().toString(36) + "-" + crypto.randomUUID().slice(0, 8);
  const item = { id, game, gameTitle: clean(body["game-title"], 60), name, text, date: new Date().toISOString() };
  await env.COMMENTS.put("p:" + id, JSON.stringify(item));
  return json({ ok: true });
}
