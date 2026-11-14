/* =====================================================================
   QUVERIS ADMIN (GitHub Pages edition)
   Adds / updates / deletes games by committing files to the site's GitHub
   repository with the owner's personal access token. GitHub Pages then
   publishes the new commit. Works on the live site and also when this
   file is opened locally (double-click), which is how the site is first
   installed into an empty repository.
   ===================================================================== */
(function () {
  "use strict";

  const API = window.QUVERIS_API_BASE || "https://api.github.com";
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MAX_TOTAL = 90 * 1024 * 1024;
  const SKIP_RE = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|\.git)(\/|$)/i;

  /* ------------------------------------------------------------ state */
  const S = {
    token: null,
    repo: null,          // { full, branch, pagesUrl }
    registry: null,      // { site, games }
    busy: false
  };
  const store = {
    get(k) { try { return localStorage.getItem("quveris.admin." + k) || sessionStorage.getItem("quveris.admin." + k); } catch (_) { return null; } },
    set(k, v, persist = true) {
      try {
        (persist ? localStorage : sessionStorage).setItem("quveris.admin." + k, v);
        (persist ? sessionStorage : localStorage).removeItem("quveris.admin." + k);
      } catch (_) {}
    },
    clear() { try { ["token", "repo", "siteurl"].forEach((k) => { localStorage.removeItem("quveris.admin." + k); sessionStorage.removeItem("quveris.admin." + k); }); } catch (_) {} }
  };

  /* ------------------------------------------------------------ views */
  function view(name) {
    document.querySelectorAll("[data-view]").forEach((el) => (el.hidden = el.dataset.view !== name));
  }

  /* ------------------------------------------------------------ modal */
  const modal = {
    el: $("[data-modal]"),
    open(title) {
      $("[data-modal-title]").textContent = title;
      $("[data-modal-body]").innerHTML = "";
      $("[data-modal-log]").textContent = "";
      $("[data-modal-btns]").innerHTML = "";
      $("[data-progress]").hidden = true;
      this.el.hidden = false;
    },
    close() { this.el.hidden = true; },
    progress(pct, msg) {
      $("[data-progress]").hidden = false;
      $("[data-progress-bar]").style.width = Math.max(2, Math.min(100, pct)) + "%";
      if (msg) $("[data-modal-log]").textContent = msg;
    },
    body(html) { $("[data-modal-body]").innerHTML = html; },
    buttons(list) {
      const box = $("[data-modal-btns]");
      box.innerHTML = "";
      list.forEach((b) => {
        const el = document.createElement(b.href ? "a" : "button");
        el.className = "btn btn--sm " + (b.cls || "");
        el.textContent = b.label;
        if (b.href) { el.href = b.href; el.target = "_blank"; el.rel = "noopener"; } else el.type = "button";
        el.addEventListener("click", () => b.onClick && b.onClick());
        box.appendChild(el);
      });
    },
    confirm(title, html, okLabel, okCls) {
      return new Promise((resolve) => {
        this.open(title);
        this.body(html);
        this.buttons([
          { label: "やめる", cls: "btn--ghost", onClick: () => { this.close(); resolve(false); } },
          { label: okLabel, cls: okCls || "", onClick: () => { this.close(); resolve(true); } }
        ]);
      });
    },
    error(msg) {
      this.open("エラー");
      this.body(`<p>${esc(msg)}</p>`);
      this.buttons([{ label: "とじる", onClick: () => this.close() }]);
    }
  };

  /* ------------------------------------------------------------ GitHub API */
  class ApiError extends Error { constructor(msg, status) { super(msg); this.status = status; } }
  async function api(path, opts = {}) {
    const headers = { Authorization: "Bearer " + S.token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    let body;
    if (opts.json !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(opts.json); }
    let res;
    try { res = await fetch(API + path, { method: opts.method || "GET", headers, body, cache: "no-store" }); }
    catch (_) { throw new ApiError("GitHub と通信できませんでした。電波の状態を確認してもう一度お試しください。", 0); }
    if (opts.allow && opts.allow.includes(res.status)) return { __status: res.status };
    if (res.status === 401) throw new ApiError("トークンが正しくないか、期限切れです。もう一度ログインしてください。", 401);
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).message || ""; } catch (_) {}
      if (res.status === 403 && /rate limit/i.test(detail)) throw new ApiError("GitHub の利用回数の上限に達しました。しばらく待ってからお試しください。", 429);
      if (res.status === 403) throw new ApiError("トークンの権限が足りません。トークンの「Contents」を Read and write にしてください。", 403);
      if (res.status === 404) throw new ApiError("リポジトリが見つかりません。名前が合っているか、トークンでそのリポジトリを選んだか確認してください。", 404);
      throw new ApiError(`GitHub でエラーが起きました（${res.status}）${detail ? "：" + detail : ""}`, res.status);
    }
    if (res.status === 204) return null;
    return res.json();
  }
  const R = (p) => `/repos/${S.repo.full}${p}`;
  const encPath = (p) => p.split("/").map(encodeURIComponent).join("/");

  async function b64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  const utf8b64 = (text) => b64(new Blob([text]));
  function fromB64utf8(s) {
    const bin = atob(String(s).replace(/\s/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }

  async function headCommit() {
    const ref = await api(R(`/git/ref/heads/${encodeURIComponent(S.repo.branch)}`), { allow: [404, 409] });
    if (ref && ref.__status) {
      // empty repository: create the first commit so the branch exists
      await api(R(`/contents/.nojekyll`), { method: "PUT", json: { message: "Initialize QUVERIS site", content: "", branch: S.repo.branch } });
      return headCommit();
    }
    return ref.object.sha;
  }

  /**
   * One commit = current files − removed + added. Paths start with "/".
   * keep(path) → false removes that existing file.
   */
  async function deploy({ add = [], removePrefixes = [], keep = null }, onStep, message) {
    onStep(5, "サイトの今の状態を確認しています…");
    const head = await headCommit();
    const commit = await api(R(`/git/commits/${head}`));
    const addPaths = new Set(add.map((a) => a.path.replace(/^\//, "")));
    const deletions = [];
    if (removePrefixes.length || keep) {
      const tree = await api(R(`/git/trees/${commit.tree.sha}?recursive=1`));
      for (const t of tree.tree || []) {
        if (t.type !== "blob") continue;
        const p = "/" + t.path;
        if (addPaths.has(t.path)) continue;
        if (removePrefixes.some((x) => p.startsWith(x)) || (keep && !keep(p))) deletions.push(t.path);
      }
    }
    const items = [];
    let i = 0;
    for (const a of add) {
      onStep(10 + (60 * i) / Math.max(1, add.length), `アップロード中… ${i + 1} / ${add.length}`);
      const blob = await api(R("/git/blobs"), { method: "POST", json: { content: await b64(a.blob), encoding: "base64" } });
      items.push({ path: a.path.replace(/^\//, ""), mode: "100644", type: "blob", sha: blob.sha });
      i++;
    }
    deletions.forEach((p) => items.push({ path: p, mode: "100644", type: "blob", sha: null }));
    if (!items.length) { onStep(100, "変更はありませんでした。"); return; }
    onStep(75, "変更を保存しています…");
    const tree = await api(R("/git/trees"), { method: "POST", json: { base_tree: commit.tree.sha, tree: items } });
    const next = await api(R("/git/commits"), { method: "POST", json: { message: message || "Update from QUVERIS admin", tree: tree.sha, parents: [head] } });
    await api(R(`/git/refs/heads/${encodeURIComponent(S.repo.branch)}`), { method: "PATCH", json: { sha: next.sha } });
    onStep(85, "サイトに反映されるのを待っています…（1〜2分）");
    const started = Date.now();
    while (Date.now() - started < 240000) {
      await new Promise((r) => setTimeout(r, 4000));
      const b = await api(R("/pages/builds/latest"), { allow: [403, 404] });
      if (b && b.__status) { onStep(100, "保存しました！ サイトへの反映には1〜2分かかります。"); return; }
      if (b && b.commit === next.sha) {
        if (b.status === "built") { onStep(100, "完了しました！"); return; }
        if (b.status === "errored") throw new ApiError("GitHub Pages での公開に失敗しました。少し待ってからもう一度お試しください。", 0);
      }
    }
    onStep(100, "保存しました！ サイトへの反映に少し時間がかかっています。");
  }

  /* ------------------------------------------------------------ registry */
  function onSite() {
    return !!(S.repo && S.repo.pagesUrl && location.protocol.startsWith("http") && location.href.startsWith(S.repo.pagesUrl));
  }
  const siteBase = () => (onSite() ? "" : (S.repo && S.repo.pagesUrl) || "");
  const assetBase = () => (onSite() ? "" : `https://raw.githubusercontent.com/${S.repo.full}/${encodeURIComponent(S.repo.branch)}/`);

  async function loadRegistry() {
    const f = await api(R(`/contents/games.js?ref=${encodeURIComponent(S.repo.branch)}`), { allow: [404] });
    if (f && f.__status) { S.registry = null; return; }
    let text = f.content ? fromB64utf8(f.content) : "";
    if (!text && f.download_url) text = await (await fetch(f.download_url, { cache: "no-store" })).text();
    const win = {};
    new Function("window", text)(win);
    if (!Array.isArray(win.QUVERIS_GAMES)) throw new ApiError("games.js の形式が読み取れませんでした。", 0);
    S.registry = { site: win.QUVERIS_SITE || {}, games: win.QUVERIS_GAMES };
  }
  function requireRegistry() {
    if (!S.registry) throw new ApiError("まだサイトが入っていません。いちばん下の「サイト本体を更新」から、サイトの zip を入れてください。", 0);
  }

  function registryText(reg) {
    return `/* =====================================================================
 * QUVERIS GAME REGISTRY
 * ---------------------------------------------------------------------
 * このファイルは管理ページ（admin.html）からも自動で書き換えられます。
 *
 * status: "released"（公開中） / "development"（開発中）
 * entry : ゲーム本体の相対パス（games/<id>/index.html）
 * video : PV（games/<id>/pv.mp4 または YouTube / TikTok の URL）
 * links : 外部公開先 [{ label: "itch.io", url: "https://..." }]
 * 最終更新: ${new Date().toISOString()}
 * ===================================================================== */

window.QUVERIS_SITE = ${JSON.stringify(reg.site, null, 2)};

window.QUVERIS_GAMES = ${JSON.stringify(reg.games, null, 2)};
`;
  }
  const registryBlob = (reg) => new Blob([registryText(reg)], { type: "application/javascript" });

  /* ------------------------------------------------------------ login */
  function parseRepo(v) {
    v = String(v || "").trim().replace(/\.git$/, "").replace(/\/+$/, "");
    const m = v.match(/(?:github\.com\/)?([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/);
    return m ? `${m[1]}/${m[2]}` : null;
  }
  function guessRepo() {
    const h = location.hostname;
    if (/\.github\.io$/i.test(h)) {
      const owner = h.split(".")[0];
      const seg = location.pathname.split("/").filter(Boolean)[0];
      return seg && !/\.html?$/i.test(seg) ? `${owner}/${seg}` : `${owner}/${owner}.github.io`;
    }
    return "";
  }
  function normSiteUrl(v) {
    v = String(v || "").trim();
    if (!v) return "";
    if (!/^https?:\/\//i.test(v)) v = "https://" + v;
    try { const u = new URL(v); return u.origin + u.pathname.replace(/[^/]*$/, ""); } catch (_) { return ""; }
  }
  // When this page is served from the live site, the site URL is simply where we are.
  function hereSiteUrl() {
    if (!location.protocol.startsWith("http") || /(^|\.)github\.com$/i.test(location.hostname)) return "";
    return location.origin + location.pathname.replace(/[^/]*$/, "");
  }
  async function login(token, repo, remember, siteUrl) {
    S.token = token;
    const full = parseRepo(repo);
    if (!full) throw new ApiError("リポジトリは「ユーザー名/リポジトリ名」の形で入力してください。", 0);
    const info = await api(`/repos/${full}`);
    if (info.permissions && info.permissions.push === false) throw new ApiError("このトークンでは、このリポジトリに書き込めません。トークンの「Contents」を Read and write にしてください。", 403);
    store.set("token", token, remember);
    store.set("repo", full, remember);
    store.set("siteurl", normSiteUrl(siteUrl), remember);
    await useRepo(info);
  }
  async function useRepo(info) {
    const [owner, name] = info.full_name.split("/");
    const guess = name.toLowerCase() === `${owner.toLowerCase()}.github.io` ? `https://${owner.toLowerCase()}.github.io/` : `https://${owner.toLowerCase()}.github.io/${name}/`;
    const custom = hereSiteUrl() || store.get("siteurl") || "";
    S.repo = { full: info.full_name, branch: info.default_branch || "main", pagesUrl: custom || guess, pagesOn: null };
    if (!custom || /\.github\.io\//i.test(custom)) {
      const pages = await api(R("/pages"), { allow: [403, 404] });
      if (pages && pages.__status === 404) S.repo.pagesOn = false;
      else if (pages && !pages.__status) { S.repo.pagesOn = true; if (pages.html_url && !custom) S.repo.pagesUrl = pages.html_url.replace(/\/?$/, "/"); }
    }
    $("[data-site-name]").textContent = S.repo.full;
    $("[data-site-link]").href = S.repo.pagesUrl;
    const note = $("[data-pages-note]");
    if (S.repo.pagesOn === false) {
      note.hidden = false;
      note.innerHTML = `<b style="color:var(--yellow)">⚠ GitHub Pages がまだオンになっていません。</b><ol><li>GitHub でこのリポジトリを開く</li><li>「Settings」→ 左の「Pages」</li><li>「Branch」で <b>${esc(S.repo.branch)}</b> と <b>/(root)</b> を選んで「Save」</li></ol>オンにすると ${esc(S.repo.pagesUrl)} で公開されます。`;
    } else note.hidden = true;
    view("main");
    await refresh();
  }
  async function refresh() {
    $("[data-games]").innerHTML = '<p class="muted">読み込み中…</p>';
    await loadRegistry();
    renderGames();
  }

  /* ------------------------------------------------------------ list */
  function renderGames() {
    const box = $("[data-games]");
    if (!S.registry) { box.innerHTML = '<p class="muted">まだサイトが入っていません。いちばん下の「サイト本体を更新」から、サイトの zip を入れてください。</p>'; return; }
    const games = S.registry.games;
    if (!games.length) { box.innerHTML = '<p class="muted">まだゲームがありません。上のフォームから追加できます。</p>'; return; }
    const base = siteBase();
    const abase = assetBase();
    box.innerHTML = games.map((g) => {
      const playable = g.status === "released" && g.entry;
      return `
      <div class="admin-game" data-id="${esc(g.id)}">
        <div class="admin-game__thumb">${g.thumbnail ? `<img src="${esc(abase + g.thumbnail)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'thumb-fallback',textContent:'NO IMAGE'}))">` : '<div class="thumb-fallback">NO IMAGE</div>'}</div>
        <div>
          <p class="admin-game__title">${esc(g.title)}</p>
          <div class="admin-game__meta">
            <span class="status status--${g.status === "released" ? "released" : "development"}">${g.status === "released" ? "公開中" : "開発中"}</span>
            <span>${esc(g.genre || "")}</span>${g.video ? '<span class="pv-badge" style="position:static">▶ PV</span>' : ""}
          </div>
        </div>
        <div class="admin-game__btns">
          ${playable ? `<a class="btn btn--sm btn--ghost" href="${esc(base)}play.html?id=${encodeURIComponent(g.id)}" target="_blank" rel="noopener">あそぶ</a>` : ""}
          <button class="btn btn--sm" type="button" data-act="edit">更新・編集</button>
          <button class="btn btn--sm btn--ghost" type="button" data-act="video">${g.video ? "PVを変更" : "PVを追加"}</button>
          <button class="btn btn--sm btn--ghost" type="button" data-act="toggle">${g.status === "released" ? "開発中にする" : "公開中にする"}</button>
          <button class="btn btn--sm btn--danger" type="button" data-act="delete">削除</button>
        </div>
      </div>`;
    }).join("");
  }

  $("[data-games]").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn || S.busy || !S.registry) return;
    const id = btn.closest("[data-id]").dataset.id;
    const g = S.registry.games.find((x) => x.id === id);
    if (!g) return;
    if (btn.dataset.act === "delete") removeGame(g).catch(handleError);
    if (btn.dataset.act === "toggle") toggleGame(g).catch(handleError);
    if (btn.dataset.act === "video") editVideo(g);
    if (btn.dataset.act === "edit") editGame(g);
  });

  async function runDeploy(title, change, regAfter) {
    S.busy = true;
    modal.open(title);
    try {
      await deploy({ ...change, add: (change.add || []).concat([{ path: "/games.js", blob: registryBlob(regAfter) }]) }, (p, m) => modal.progress(p, m), title);
      S.registry = regAfter;
      renderGames();
    } finally {
      S.busy = false;
    }
  }

  async function removeGame(g) {
    const ok = await modal.confirm("ゲームを削除", `<p><b>${esc(g.title)}</b> をサイトから削除しますか？<br><span class="muted">ゲームのファイルも一緒に消えます。</span></p>`, "削除する", "btn--danger");
    if (!ok) return;
    const reg = { site: S.registry.site, games: S.registry.games.filter((x) => x.id !== g.id) };
    await runDeploy("削除しています", { removePrefixes: [`/games/${g.id}/`] }, reg);
    modal.body(`<p><b>${esc(g.title)}</b> を削除しました。</p>`);
    modal.buttons([{ label: "OK", onClick: () => modal.close() }]);
  }

  async function toggleGame(g) {
    const toReleased = g.status !== "released";
    if (toReleased && !g.entry) { modal.error("このゲームには本体のファイルがないため、公開中にできません。"); return; }
    const ok = await modal.confirm(toReleased ? "公開中にする" : "開発中にする",
      `<p><b>${esc(g.title)}</b> を${toReleased ? "公開中（誰でも遊べる状態）" : "開発中（遊べない状態）"}にしますか？</p>`, "変更する");
    if (!ok) return;
    const reg = { site: S.registry.site, games: S.registry.games.map((x) => (x.id === g.id ? { ...x, status: toReleased ? "released" : "development", updated: today() } : x)) };
    await runDeploy("反映しています", {}, reg);
    modal.body(`<p>${esc(g.title)} を${toReleased ? "公開中" : "開発中"}にしました。</p>`);
    modal.buttons([{ label: "OK", onClick: () => modal.close() }]);
  }

  /* ------------------------------------------------------------ PV helpers */
  const MAX_VIDEO = 40 * 1024 * 1024;
  function normalizeVideoUrl(v) {
    v = String(v || "").trim();
    if (!v) return "";
    if (/^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)[\w-]{11}/.test(v)) return v;
    if (/^https:\/\/(?:www\.|m\.)?tiktok\.com\/@[\w.-]+\/video\/\d{6,25}/.test(v)) return v.split("?")[0];
    throw new ApiError("PV の URL は YouTube か TikTok の動画ページの URL を入れてください（TikTok は「…/video/数字」の形のもの）。", 0);
  }
  function videoFileEntry(file, dir) {
    if (!file || !file.size) return null;
    if (file.size > MAX_VIDEO) throw new ApiError("PV動画が大きすぎます（40MBまで）。YouTube や TikTok に上げて URL で設定してください。", 0);
    let ext = (file.name.split(".").pop() || "mp4").toLowerCase();
    if (!["mp4", "webm", "mov", "m4v"].includes(ext)) throw new ApiError("PV動画は mp4 / webm / mov を選んでください。", 0);
    return { path: `/${dir}pv.${ext}`, blob: file, rel: `${dir}pv.${ext}` };
  }
  const isLocalVideo = (v) => typeof v === "string" && /^games\//.test(v);

  async function editVideo(g) {
    const has = !!g.video;
    modal.open("PV を設定：" + g.title);
    modal.body(`
      <p class="muted" style="font-size:14px">${has ? "今のPV：" + esc(isLocalVideo(g.video) ? "動画ファイル（" + g.video.split("/").pop() + "）" : g.video) : "まだPVはありません。"}</p>
      <form class="admin-form" data-pv-form onsubmit="return false">
        <label>PV動画ファイル<input type="file" name="video" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"></label>
        <label>または YouTube / TikTok の URL<input type="text" name="videoUrl" inputmode="url" placeholder="https://…"></label>
      </form>`);
    const done = (msg) => { modal.body(`<p>${msg}</p>`); modal.buttons([{ label: "OK", onClick: () => modal.close() }]); };
    const save = async (remove) => {
      try {
        const form = $("[data-pv-form]");
        const dir = `games/${g.id}/`;
        let add = [], removePrefixes = [], video = "";
        if (!remove) {
          const fileEntry = videoFileEntry(form.video.files[0], dir);
          const url = normalizeVideoUrl(form.videoUrl.value);
          if (!fileEntry && !url) { modal.error("動画ファイルを選ぶか、URL を入れてください。"); return; }
          if (fileEntry) { add.push(fileEntry); video = fileEntry.rel; } else video = url;
        }
        if (isLocalVideo(g.video) && g.video !== video) removePrefixes.push("/" + g.video);
        const reg = { site: S.registry.site, games: S.registry.games.map((x) => (x.id === g.id ? Object.assign({}, x, { video: video || undefined, updated: today() }) : x)) };
        reg.games.forEach((x) => { if (!x.video) delete x.video; });
        await runDeploy(remove ? "PVを外しています" : "PVを設定しています", { add, removePrefixes }, reg);
        done(remove ? `${esc(g.title)} のPVを外しました。` : `${esc(g.title)} にPVを設定しました！`);
      } catch (err) { S.busy = false; handleError(err); }
    };
    modal.buttons([
      { label: "やめる", cls: "btn--ghost", onClick: () => modal.close() },
      ...(has ? [{ label: "PVを外す", cls: "btn--danger", onClick: () => save(true) }] : []),
      { label: "保存", onClick: () => save(false) }
    ]);
  }

  /* ------------------------------------------------------------ update / edit a game */
  const bumpVersion = (v) => {
    const m = String(v || "").match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);
    return m ? `${m[1]}.${m[2]}.${(+(m[3] || 0)) + 1}` : (v || "1.0.1");
  };
  function editGame(g) {
    const f = (k) => esc(g[k] || "");
    modal.open("更新・編集：" + g.title);
    modal.body(`
      <form class="admin-form" data-edit-form onsubmit="return false">
        <label>新しい版のゲームファイル（差し替えるときだけ）
          <input type="file" name="file" accept=".zip,.html,.htm,application/zip,text/html">
          <small>選ばなければ、ゲーム本体はそのままです。PV・感想・URLは変わりません。</small>
        </label>
        <label>新しいサムネイル（変えるときだけ）<input type="file" name="thumb" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"></label>
        <label>バージョン<input type="text" name="version" maxlength="20" value="${f("version")}" data-ver></label>
        <label>タイトル<input type="text" name="title" maxlength="40" required value="${f("title")}"></label>
        <label>ジャンル<input type="text" name="genre" maxlength="20" list="genre-list" value="${f("genre")}"></label>
        <label>ひとこと紹介<input type="text" name="summary" maxlength="80" value="${f("summary")}"></label>
        <label>くわしい紹介<textarea name="description" rows="4" maxlength="600">${f("description")}</textarea></label>
        <label>PCの操作<input type="text" name="pc" maxlength="120" value="${esc((g.controls || {}).pc || "")}"></label>
        <label>スマホの操作<input type="text" name="mobile" maxlength="120" value="${esc((g.controls || {}).mobile || "")}"></label>
      </form>`);
    const form = $("[data-edit-form]");
    form.file.addEventListener("change", () => {
      const ver = form.querySelector("[data-ver]");
      if (form.file.files.length && ver.value === (g.version || "")) ver.value = bumpVersion(g.version);
    });
    modal.buttons([
      { label: "やめる", cls: "btn--ghost", onClick: () => modal.close() },
      { label: "保存して反映", onClick: () => saveEdit(g, form).catch((err) => { S.busy = false; handleError(err); }) }
    ]);
  }
  async function saveEdit(g, form) {
    const val = (n) => String(form.elements.namedItem(n).value || "").trim();
    const title = val("title");
    if (!title) { modal.error("タイトルを入力してください。"); return; }
    const gameFile = form.file.files[0];
    const thumbFile = form.thumb.files[0];
    const dir = `games/${g.id}/`;
    const add = [];
    let keep = null;
    let entry = g.entry;
    let thumbnail = g.thumbnail || "";
    if (gameFile && gameFile.size) {
      const { files, entry: rel } = await readGameFiles(gameFile);
      const total = files.reduce((n, x) => n + x.blob.size, 0);
      if (total > MAX_TOTAL) throw new ApiError("ゲームのファイルが大きすぎます。", 0);
      files.forEach((x) => add.push({ path: "/" + dir + x.rel, blob: x.blob }));
      entry = dir + rel;
      // remove the old version's files, but keep the PV and the current thumbnail
      const keepPaths = new Set();
      if (isLocalVideo(g.video)) keepPaths.add("/" + g.video);
      if (thumbnail.startsWith(dir)) keepPaths.add("/" + thumbnail);
      keep = (p) => !p.startsWith("/" + dir) || keepPaths.has(p);
      if (!thumbFile) {
        const t = files.find((x) => /^(thumb|thumbnail|cover)\.(png|jpe?g|webp|gif|svg)$/i.test(x.rel));
        if (t && !thumbnail) thumbnail = dir + t.rel;
      }
    }
    if (thumbFile && thumbFile.size) {
      const ext = (thumbFile.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const name = `thumb-${Date.now().toString(36)}.${ext}`; // new name so browsers don't show the old image
      add.push({ path: `/${dir}${name}`, blob: thumbFile });
      if (thumbnail.startsWith(dir)) {
        const old = "/" + thumbnail;
        const prevKeep = keep;
        keep = (p) => p !== old && (prevKeep ? prevKeep(p) : true);
      }
      thumbnail = dir + name;
    }
    const updated = Object.assign({}, g, {
      title,
      genre: val("genre") || "その他",
      summary: val("summary"),
      description: val("description") || val("summary"),
      controls: { pc: val("pc") || "-", mobile: val("mobile") || "-" },
      version: val("version") || g.version,
      entry,
      thumbnail,
      updated: today()
    });
    const reg = { site: S.registry.site, games: S.registry.games.map((x) => (x.id === g.id ? updated : x)) };
    await runDeploy(gameFile ? "ゲームを更新しています" : "情報を更新しています", { add, keep }, reg);
    const base = siteBase();
    modal.body(`<p><b>${esc(title)}</b> を${gameFile ? "新しい版に更新" : "更新"}しました！</p>`);
    modal.buttons([
      ...(updated.status === "released" ? [{ label: "あそんでみる", href: `${base}play.html?id=${encodeURIComponent(g.id)}` }] : []),
      { label: "OK", cls: "btn--ghost", onClick: () => modal.close() }
    ]);
  }

  /* ------------------------------------------------------------ add */
  const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  function makeId(title, taken) {
    let base = String(title).toLowerCase().normalize("NFKC").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
    if (base.length < 3) base = "game-" + Date.now().toString(36);
    let id = base, n = 2;
    while (taken.has(id)) id = `${base}-${n++}`;
    return id;
  }
  const safeRel = (p) => {
    const parts = p.replace(/\\/g, "/").split("/").filter((x) => x && x !== ".");
    if (parts.some((x) => x === "..")) return null;
    return parts.join("/");
  };

  async function readGameFiles(file) {
    const name = file.name.toLowerCase();
    if (/\.html?$/.test(name)) return { files: [{ rel: "index.html", blob: file }], entry: "index.html" };
    if (!/\.zip$/.test(name)) throw new ApiError("ゲームのファイルは .html か .zip を選んでください。", 0);
    if (!window.JSZip) throw new ApiError("zip を開く部品を読み込めませんでした。通信を確認してページを再読み込みしてください。", 0);
    let zip;
    try { zip = await window.JSZip.loadAsync(file); } catch (_) { throw new ApiError("zip ファイルを開けませんでした。壊れていないか確認してください。", 0); }
    let entries = [];
    zip.forEach((path, entry) => { if (!entry.dir && !SKIP_RE.test(path)) entries.push({ path, entry }); });
    if (!entries.length) throw new ApiError("zip の中にファイルがありません。", 0);
    // strip a single common top folder (e.g. my-game/index.html)
    const firsts = new Set(entries.map((e) => e.path.split("/")[0]));
    const hasRootIndex = entries.some((e) => e.path.toLowerCase() === "index.html");
    if (!hasRootIndex && firsts.size === 1 && entries.every((e) => e.path.includes("/"))) {
      const top = [...firsts][0] + "/";
      entries = entries.map((e) => ({ ...e, path: e.path.slice(top.length) }));
    }
    const files = [];
    for (const e of entries) {
      const rel = safeRel(e.path);
      if (!rel) continue;
      const blob = await e.entry.async("blob");
      files.push({ rel, blob });
    }
    let entry = files.find((f) => f.rel.toLowerCase() === "index.html");
    if (!entry) {
      const htmls = files.filter((f) => /\.html?$/i.test(f.rel));
      if (htmls.length === 1) entry = htmls[0];
      else throw new ApiError("zip の中に index.html が見つかりませんでした。ゲームの入口のファイル名を index.html にしてください。", 0);
    }
    return { files, entry: entry.rel };
  }

  $("[data-add-form]").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (S.busy) return;
    const f = e.target;
    const fd = new FormData(f);
    const gameFile = fd.get("file");
    const thumbFile = fd.get("thumb");
    const title = String(fd.get("title") || "").trim();
    const status = fd.get("status");
    if (!gameFile || !gameFile.size) return modal.error("ゲームのファイルを選んでください。");
    if (!title) return modal.error("タイトルを入力してください。");
    if (!status) return modal.error("公開状態を選んでください。");
    try {
      S.busy = true;
      modal.open("ゲームを追加しています");
      modal.progress(2, "ファイルを確認しています…");
      await loadRegistry();
      requireRegistry();
      const { files, entry } = await readGameFiles(gameFile);
      const vf = fd.get("video");
      const total = files.reduce((n, x) => n + x.blob.size, 0) + (thumbFile && thumbFile.size ? thumbFile.size : 0) + (vf && vf.size ? vf.size : 0);
      if (total > MAX_TOTAL) throw new ApiError("ゲームとPVのファイルが大きすぎます（合計90MBまで）。画像や音声を圧縮してください。", 0);

      const id = makeId(title, new Set(S.registry.games.map((g) => g.id)));
      const dir = `games/${id}/`;
      const add = files.map((x) => ({ path: "/" + dir + x.rel, blob: x.blob }));
      let thumbnail = "";
      if (thumbFile && thumbFile.size) {
        const ext = (thumbFile.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
        add.push({ path: `/${dir}thumb.${ext}`, blob: thumbFile });
        thumbnail = `${dir}thumb.${ext}`;
      } else {
        const t = files.find((x) => /^(thumb|thumbnail|cover)\.(png|jpe?g|webp|gif|svg)$/i.test(x.rel));
        if (t) thumbnail = dir + t.rel;
      }
      const vEntry = videoFileEntry(fd.get("video"), dir);
      const vUrl = vEntry ? "" : normalizeVideoUrl(fd.get("videoUrl"));
      if (vEntry) add.push({ path: vEntry.path, blob: vEntry.blob });
      const summary = String(fd.get("summary") || "").trim();
      const game = {
        id,
        title,
        genre: String(fd.get("genre") || "").trim() || "その他",
        summary,
        description: String(fd.get("description") || "").trim() || summary,
        status: status === "released" ? "released" : "development",
        entry: dir + entry,
        thumbnail,
        accent: S.registry.games.length % 2 ? "mint" : "purple",
        orientation: "any",
        controls: { pc: String(fd.get("pc") || "").trim() || "-", mobile: String(fd.get("mobile") || "").trim() || "-" },
        tags: [],
        version: "1.0.0",
        updated: today(),
        links: []
      };
      if (vEntry) game.video = vEntry.rel; else if (vUrl) game.video = vUrl;
      const reg = { site: S.registry.site, games: [game].concat(S.registry.games) };
      S.busy = false;
      await runDeploy("ゲームを追加しています", { add }, reg);
      const base = siteBase();
      modal.body(`<p><b>${esc(title)}</b> を追加しました！${game.status === "released" ? "" : "<br><span class=\"muted\">開発中として登録したので、まだ遊べません。</span>"}</p>`);
      modal.buttons([
        ...(game.status === "released" ? [{ label: "あそんでみる", href: `${base}play.html?id=${encodeURIComponent(id)}` }] : []),
        { label: "OK", cls: "btn--ghost", onClick: () => modal.close() }
      ]);
      f.reset();
    } catch (err) {
      S.busy = false;
      handleError(err);
    }
  });


  /* ------------------------------------------------------------ site update / first install */
  async function readSiteZip(file, install) {
    if (!/\.zip$/i.test(file.name)) throw new ApiError("サイトのファイルは .zip を選んでください。", 0);
    if (!window.JSZip) throw new ApiError("zip を開く部品を読み込めませんでした。通信を確認してページを再読み込みしてください。", 0);
    let zip;
    try { zip = await window.JSZip.loadAsync(file); } catch (_) { throw new ApiError("zip ファイルを開けませんでした。", 0); }
    let entries = [];
    zip.forEach((path, entry) => { if (!entry.dir && !SKIP_RE.test(path)) entries.push({ path, entry }); });
    const hasRootIndex = entries.some((e) => e.path === "index.html");
    const firsts = new Set(entries.map((e) => e.path.split("/")[0]));
    if (!hasRootIndex && firsts.size === 1 && entries.every((e) => e.path.includes("/"))) {
      const top = [...firsts][0] + "/";
      entries = entries.map((e) => ({ ...e, path: e.path.slice(top.length) }));
    }
    const files = [];
    for (const e of entries) {
      const rel = safeRel(e.path);
      if (!rel) continue;
      if (!install && (rel === "games.js" || rel.startsWith("games/"))) continue; // keep the live games untouched
      files.push({ path: "/" + rel, blob: await e.entry.async("blob") });
    }
    const names = new Set(files.map((f) => f.path));
    if (!names.has("/index.html")) throw new ApiError("zip の中に index.html がありません。サイト用の zip か確認してください。", 0);
    if (!names.has("/admin.html") || !names.has("/assets/js/admin.js"))
      throw new ApiError("この zip には管理ページが入っていません。このまま更新すると管理ページが消えてしまうため、中止しました。", 0);
    if (!names.has("/.nojekyll")) files.push({ path: "/.nojekyll", blob: new Blob([""]) });
    return files;
  }

  $("[data-site-form]").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (S.busy) return;
    const file = new FormData(e.target).get("site");
    if (!file || !file.size) return modal.error("サイトの zip を選んでください。");
    try {
      S.busy = true;
      modal.open("サイトを確認しています");
      modal.progress(2, "zip を確認しています…");
      await loadRegistry();
      const install = !S.registry;
      const files = await readSiteZip(file, install);
      S.busy = false;
      const ok = await modal.confirm(install ? "サイトをはじめて入れる" : "サイト本体を更新",
        install
          ? `<p>${files.length} 個のファイルで、サイトをリポジトリに入れます。</p>`
          : `<p>${files.length} 個のファイルでサイトを更新します。<br><span class="muted">登録中のゲーム（${S.registry.games.length} 本）はそのまま残ります。</span></p>`,
        install ? "入れる" : "更新する");
      if (!ok) return;
      S.busy = true;
      modal.open(install ? "サイトを入れています" : "サイトを更新しています");
      await deploy(install ? { add: files } : { add: files, keep: (p) => p.startsWith("/games/") || p === "/games.js" },
        (p, m) => modal.progress(p, m), install ? "Install QUVERIS site" : "Update site");
      S.busy = false;
      e.target.reset();
      await loadRegistry();
      renderGames();
      const url = S.repo.pagesUrl;
      modal.body(`<p>${install ? "サイトを入れました！" : "サイトを更新しました！"}</p>
        <p class="muted" style="font-size:14px">サイト：<a href="${esc(url)}" target="_blank" rel="noopener" style="color:var(--mint)">${esc(url)}</a><br>
        管理ページ：<a href="${esc(url)}admin.html" target="_blank" rel="noopener" style="color:var(--mint)">${esc(url)}admin.html</a><br>
        反映まで1〜2分かかることがあります。${S.repo.pagesOn === false ? "<br><b style='color:var(--yellow)'>GitHub Pages をオンにするのを忘れずに！</b>" : ""}</p>`);
      modal.buttons([{ label: "OK", onClick: () => modal.close() }]);
    } catch (err) {
      S.busy = false;
      handleError(err);
    }
  });

  /* ------------------------------------------------------------ errors / boot */
  function handleError(err) {
    console.error(err);
    if (err && err.status === 401) { store.clear(); S.token = null; S.repo = null; view("login"); }
    else if (!S.repo) view("login");
    modal.error(err && err.message ? err.message : "予期しないエラーが起きました。");
  }

  const repoInput = $("[data-repo-input]");
  repoInput.value = store.get("repo") || guessRepo();
  $("[data-siteurl-input]").value = store.get("siteurl") || hereSiteUrl() || "";

  $("[data-login-form]").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const token = String(fd.get("token") || "").trim();
    if (!token) return;
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    login(token, fd.get("repo"), !!fd.get("remember"), fd.get("siteUrl")).catch(handleError).finally(() => {
      btn.disabled = false;
      e.target.querySelector("[name=token]").value = "";
    });
  });
  $("[data-logout]").addEventListener("click", () => { store.clear(); S.token = null; S.repo = null; view("login"); repoInput.value = guessRepo(); });

  const saved = store.get("token");
  const savedRepo = store.get("repo");
  if (saved && savedRepo) {
    S.token = saved;
    api(`/repos/${savedRepo}`).then(useRepo).catch(handleError);
  } else view("login");
})();
