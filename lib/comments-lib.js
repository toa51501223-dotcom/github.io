// Shared helpers for the comments API (Cloudflare Pages Functions + KV).
export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra }
  });

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export const GAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const clean = (s, max) =>
  String(s ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, max);

export async function readApproved(kv, game) {
  try { return JSON.parse((await kv.get("approved:" + game)) || "[]"); } catch (_) { return []; }
}

// The owner proves themselves with the same GitHub token the admin page uses:
// it must have push access to the repository named in quveris.config.json.
export async function isOwner(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  let repo = "";
  try {
    const res = await env.ASSETS.fetch(new URL("/quveris.config.json", request.url));
    if (res.ok) repo = (await res.json()).repo || "";
  } catch (_) {}
  if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repo)) return false;
  const gh = await fetch(`${env.GITHUB_API || "https://api.github.com"}/repos/${repo}`, {
    headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "User-Agent": "quveris-comments" }
  });
  if (!gh.ok) return false;
  const info = await gh.json();
  return !!(info.permissions && info.permissions.push);
}
