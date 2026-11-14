// Owner-only moderation.
// GET  /api/admin/comments                         → { pending: [...], published: [...] }
// POST /api/admin/comments { action, id, game? }   → action: publish | unpublish | delete | publishMany (ids: [])
import { json, CORS, readApproved, isOwner } from "../../../lib/comments-lib.js";

export async function onRequestOptions() { return new Response(null, { status: 204, headers: CORS }); }

async function listPending(kv) {
  const out = [];
  let cursor;
  do {
    const page = await kv.list({ prefix: "p:", cursor });
    for (const k of page.keys) {
      const v = await kv.get(k.name);
      if (v) { try { out.push(JSON.parse(v)); } catch (_) {} }
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out;
}
async function listPublished(kv) {
  const out = [];
  let cursor;
  do {
    const page = await kv.list({ prefix: "approved:", cursor });
    for (const k of page.keys) {
      const game = k.name.slice("approved:".length);
      (await readApproved(kv, game)).forEach((c) => out.push({ ...c, game }));
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out;
}

export async function onRequestGet({ request, env }) {
  if (!env.COMMENTS) return json({ error: "not-configured" }, 503, CORS);
  if (!(await isOwner(request, env))) return json({ error: "forbidden" }, 403, CORS);
  return json({ pending: await listPending(env.COMMENTS), published: await listPublished(env.COMMENTS) }, 200, CORS);
}

export async function onRequestPost({ request, env }) {
  const kv = env.COMMENTS;
  if (!kv) return json({ error: "not-configured" }, 503, CORS);
  if (!(await isOwner(request, env))) return json({ error: "forbidden" }, 403, CORS);
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "bad-request" }, 400, CORS); }
  const { action } = body;

  const publish = async (id) => {
    const raw = await kv.get("p:" + id);
    if (!raw) return;
    const item = JSON.parse(raw);
    const list = await readApproved(kv, item.game);
    if (!list.some((c) => c.id === id)) list.push(item);
    await kv.put("approved:" + item.game, JSON.stringify(list));
    await kv.delete("p:" + id);
  };

  if (action === "publish") await publish(String(body.id));
  else if (action === "publishMany") { for (const id of (body.ids || []).slice(0, 200)) await publish(String(id)); }
  else if (action === "unpublish" || action === "delete") {
    const id = String(body.id);
    const game = String(body.game || "");
    if (game) {
      const list = await readApproved(kv, game);
      const item = list.find((c) => c.id === id);
      const rest = list.filter((c) => c.id !== id);
      if (item) {
        await kv.put("approved:" + game, JSON.stringify(rest));
        if (action === "unpublish") await kv.put("p:" + id, JSON.stringify({ ...item, game }));
      }
    }
    if (action === "delete") await kv.delete("p:" + id);
  } else return json({ error: "bad-request" }, 400, CORS);

  return json({ ok: true }, 200, CORS);
}
