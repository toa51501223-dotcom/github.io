/* =====================================================================
   QUVERIS PORTAL — shared runtime
   Pages declare <body data-page="home|list|detail|play|about">.
   Game data comes from ../games.js (window.QUVERIS_GAMES).
   ===================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------ utils */
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
  // only relative paths inside games/ are allowed as playable entries
  const ENTRY_RE = /^games\/[a-z0-9][a-z0-9-]*\/[A-Za-z0-9._\/-]*\.html$/;

  // PV: a video file inside games/<id>/, or a YouTube / TikTok URL
  function parseVideo(v) {
    if (typeof v !== "string" || !v.trim()) return null;
    v = v.trim();
    let m = v.match(/^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
    if (m) return { kind: "youtube", id: m[1], vertical: /\/shorts\//.test(v) };
    m = v.match(/^https:\/\/(?:www\.|m\.)?tiktok\.com\/@[\w.-]+\/video\/(\d{6,25})/);
    if (m) return { kind: "tiktok", id: m[1], vertical: true };
    if (/^games\/[a-z0-9][a-z0-9-]*\/[A-Za-z0-9._\/-]+\.(mp4|webm|m4v|mov)$/i.test(v) && !v.includes("..")) return { kind: "file", src: v, vertical: false };
    return null;
  }

  const ICON = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg>',
    fs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    fsExit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
    reload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v7h14v-7"/></svg>'
  };

  /* ------------------------------------------------------------ data */
  function loadGames() {
    const raw = Array.isArray(window.QUVERIS_GAMES) ? window.QUVERIS_GAMES : null;
    if (!raw) return null;
    const seen = new Set();
    const list = [];
    raw.forEach((g, i) => {
      if (!g || typeof g !== "object") return;
      if (!ID_RE.test(g.id || "") || seen.has(g.id)) {
        console.warn("[QUVERIS] games.js: invalid or duplicated id at index " + i, g && g.id);
        return;
      }
      seen.add(g.id);
      let status = g.status === "released" ? "released" : "development";
      const entry = typeof g.entry === "string" && ENTRY_RE.test(g.entry) && !g.entry.includes("..") ? g.entry : null;
      if (status === "released" && !entry) {
        console.warn("[QUVERIS] '" + g.id + "' is marked released but has no valid entry. Shown as development.");
        status = "development";
      }
      list.push({
        id: g.id,
        title: g.title || g.id,
        genre: g.genre || "その他",
        summary: g.summary || "",
        description: g.description || g.summary || "",
        status,
        entry,
        thumbnail: typeof g.thumbnail === "string" && !/^\s*javascript:/i.test(g.thumbnail) ? g.thumbnail : "",
        accent: g.accent === "purple" ? "purple" : "mint",
        orientation: ["portrait", "landscape"].includes(g.orientation) ? g.orientation : "any",
        controls: g.controls || {},
        tags: Array.isArray(g.tags) ? g.tags : [],
        version: g.version || "",
        updated: g.updated || "",
        links: (Array.isArray(g.links) ? g.links : []).filter((l) => l && /^https:\/\//i.test(l.url || "")),
        video: parseVideo(g.video),
        order: i
      });
    });
    return list;
  }
  // version query so an updated game is picked up even while the host caches files
  const entryUrl = (g) => g.entry + "?v=" + encodeURIComponent(g.version || g.updated || "1");
  const isPlayable = (g) => g && g.status === "released" && !!g.entry;
  const STATUS_LABEL = { released: "公開中", development: "開発中" };
  const statusChip = (g) => `<span class="status status--${g.status}">${STATUS_LABEL[g.status]}</span>`;
  const qs = (name) => new URLSearchParams(location.search).get(name);

  /* ------------------------------------------------------------ images */
  function thumbHTML(g, extra = "") {
    if (!g.thumbnail) return `<div class="thumb-fallback">${esc(g.title)}</div>`;
    return `<img src="${esc(g.thumbnail)}" alt="${esc(g.title)} のサムネイル" loading="lazy" decoding="async" data-fallback="${esc(g.title)}" ${extra}>`;
  }
  // Replace any broken <img data-fallback> with a styled placeholder.
  document.addEventListener(
    "error",
    (e) => {
      const el = e.target;
      if (!(el instanceof HTMLImageElement) || !el.dataset.fallback || el.dataset.failed) return;
      el.dataset.failed = "1";
      const div = document.createElement("div");
      div.className = "thumb-fallback";
      div.textContent = el.dataset.fallback;
      el.replaceWith(div);
    },
    true
  );

  /* ------------------------------------------------------------ layout */
  const NAV = [
    { href: "./", label: "TOP", key: "home" },
    { href: "games.html", label: "GAMES", key: "list" }
  ];
  function renderChrome(page) {
    const header = $("[data-site-header]");
    if (header) {
      const active = page === "detail" ? "list" : page;
      header.className = "site-header";
      header.innerHTML = `
        <div class="wrap">
          <a class="brand" href="./" aria-label="QUVERIS トップへ">
            <span class="brand__icon"><img src="assets/img/favicon.png" alt="" width="36" height="36"></span>
            <span class="brand__name">QUVER<span>I</span>S</span>
          </a>
          <nav class="nav" aria-label="メイン">
            ${NAV.map((n, i) => `<a href="${n.href}" ${n.key === active ? 'aria-current="page"' : ""}><span class="idx">${pad(i + 1)}</span>${n.label}</a>`).join("")}
          </nav>
        </div>`;
    }
    const footer = $("[data-site-footer]");
    if (footer) {
      const social = ((window.QUVERIS_SITE || {}).social || []).filter((s) => /^https:\/\//.test(s.url || ""));
      footer.className = "site-footer";
      footer.innerHTML = `
        <div class="wrap">
          <div>
            <a class="brand" href="./"><span class="brand__name">QUVER<span>I</span>S</span></a>
            <p style="margin:10px 0 18px;max-width:420px">趣味で作ったゲームを、ブラウザでそのまま無料で。</p>
            <div class="footer-links">
              ${NAV.map((n) => `<a href="${n.href}">${n.label}</a>`).join("")}
              ${social.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} ↗</a>`).join("")}
            </div>
          </div>
          <div class="footer-copy">© ${new Date().getFullYear()} QUVERIS<br>A HOBBY PROJECT / FREE TO PLAY</div>
        </div>`;
    }
  }

  function card(g, i) {
    const playable = isPlayable(g);
    return `
      <article class="card card--${g.accent} reveal">
        <div class="card__inner">
          <div class="card__thumb">
            ${thumbHTML(g)}
            ${statusChip(g)}
            ${g.video ? '<span class="pv-badge">▶ PV</span>' : ""}
            <span class="card__index">${pad(i + 1)}</span>
          </div>
          <div class="card__body">
            <span class="card__genre">${esc(g.genre)}</span>
            <h3 class="card__title"><a class="card__link" href="game.html?id=${encodeURIComponent(g.id)}">${esc(g.title)}</a></h3>
            <p class="card__summary">${esc(g.summary)}</p>
            <div class="card__actions">
              ${
                playable
                  ? `<a class="btn btn--sm" href="play.html?id=${encodeURIComponent(g.id)}">▶ あそぶ</a>`
                  : `<span class="btn btn--sm" aria-disabled="true">じゅんび中</span>`
              }
              <a class="btn btn--sm btn--ghost" href="game.html?id=${encodeURIComponent(g.id)}">くわしく</a>
            </div>
          </div>
        </div>
      </article>`;
  }

  function mediaHTML(g) {
    const v = g.video;
    if (!v) return thumbHTML(g, 'loading="eager"');
    if (v.kind === "file") {
      return `<video class="pv" controls playsinline preload="metadata" src="${esc(v.src)}?v=${encodeURIComponent(g.updated || "1")}#t=0.1" data-pv-file></video>`;
    }
    const bg = v.kind === "youtube" ? `style="background-image:url('https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg')"` : "";
    return `<button type="button" class="pv-lite" data-pv-embed="${v.kind}:${esc(v.id)}" ${bg} aria-label="${esc(g.title)} のPVを再生"><span class="pv-lite__btn">▶ PVを見る</span><span class="pv-lite__src">${v.kind === "youtube" ? "YouTube" : "TikTok"}</span></button>`;
  }
  function wirePlayer(root, g) {
    if (!root) return; // no PV for this game
    const vid = root.querySelector("[data-pv-file]");
    if (vid) {
      vid.addEventListener("error", () => {
        root.innerHTML = '<div class="thumb-fallback">PVを読み込めませんでした</div>';
      }, { once: true });
    }
    const lite = root.querySelector("[data-pv-embed]");
    if (lite) {
      lite.addEventListener("click", () => {
        const [kind, id] = lite.dataset.pvEmbed.split(":");
        const src = kind === "youtube"
          ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&playsinline=1&rel=0`
          : `https://www.tiktok.com/player/v1/${encodeURIComponent(id)}?autoplay=1&music_info=0&description=0`;
        const f = document.createElement("iframe");
        f.className = "pv-embed";
        f.src = src;
        f.title = g.title + " PV";
        f.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture; fullscreen");
        f.setAttribute("allowfullscreen", "");
        lite.replaceWith(f);
      });
    }
  }

  /* ------------------------------------------------------------ comments */
  // Returns null when the comments API isn't available on this host (section is then hidden).
  async function loadComments(game) {
    try {
      const res = await fetch("api/comments?game=" + encodeURIComponent(game), { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data.comments) ? data.comments : null;
    } catch (_) { return null; }
  }
  const fmtDate = (d) => { try { const t = new Date(d); return `${t.getFullYear()}.${pad(t.getMonth() + 1)}.${pad(t.getDate())}`; } catch (_) { return ""; } };
  function commentItem(c) {
    return `<li class="cmt"><div class="cmt__head"><b>${esc(c.name || "名無しのプレイヤー")}</b><span>${esc(fmtDate(c.date))}</span></div><p>${esc(c.text)}</p></li>`;
  }
  function mountComments(root, g) {
    const sec = document.createElement("section");
    sec.className = "comments";
    sec.innerHTML = `
      <div class="section__head" style="margin-bottom:18px"><div><span class="eyebrow">COMMENTS</span><h2 class="section__title jp">プレイの感想</h2></div></div>
      <div class="comments__grid">
        <div>
          <ul class="cmt-list" data-cmt-list><li class="muted">読み込み中…</li></ul>
        </div>
        <form class="pxwin cmt-form" data-cmt-form novalidate>
          <p class="cmt-form__lead">遊んでみてどうでしたか？ ひとことでも大歓迎です。</p>
          <label>なまえ（なくてもOK）<input type="text" name="name" maxlength="20" autocomplete="nickname" placeholder="名無しのプレイヤー"></label>
          <label>感想<textarea name="comment" rows="4" maxlength="300" required placeholder="例：BGMがすごく好き！ 3回目でクリアできた"></textarea></label>
          <p class="hp" aria-hidden="true"><label>空欄のまま<input type="text" name="bot-field" tabindex="-1" autocomplete="off"></label></p>
          <div class="cmt-form__foot"><small data-cmt-count>0 / 300</small><button class="btn btn--sm" type="submit">感想を送る</button></div>
          <p class="cmt-form__rule">誹謗中傷・ほかの人への悪口・個人情報（名前や住所、SNSのIDなど）は書かないでください。内容によっては公開しないことがあります。</p>
          <p class="cmt-form__note">送った感想は、管理人が確認してからここに表示されます。</p>
          <p class="cmt-form__msg" data-cmt-msg role="status"></p>
        </form>
      </div>`;
    sec.hidden = true;
    root.appendChild(sec);
    const list = sec.querySelector("[data-cmt-list]");
    loadComments(g.id).then((mine) => {
      if (!mine) return; // comments not available here
      sec.hidden = false;
      mine.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      list.innerHTML = mine.length ? mine.map(commentItem).join("") : '<li class="cmt cmt--empty">まだ感想はありません。最初の感想を書いてみませんか？</li>';
    });
    const form = sec.querySelector("[data-cmt-form]");
    const msg = sec.querySelector("[data-cmt-msg]");
    const ta = form.elements.namedItem("comment");
    ta.addEventListener("input", () => { sec.querySelector("[data-cmt-count]").textContent = `${ta.value.length} / 300`; });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = ta.value.trim();
      if (!text) { msg.textContent = "感想を入力してください。"; return; }
      let last = 0;
      try { last = +localStorage.getItem("quveris.lastComment") || 0; } catch (_) {}
      if (Date.now() - last < 60000) { msg.textContent = "続けて送るときは、1分ほど待ってからお願いします。"; return; }
      const btn = form.querySelector("button");
      btn.disabled = true; msg.textContent = "送信中…";
      try {
        const res = await fetch("api/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            game: g.id, "game-title": g.title,
            name: form.elements.namedItem("name").value.trim().slice(0, 20), comment: text.slice(0, 300), "bot-field": form.elements.namedItem("bot-field").value
          })
        });
        if (res.status === 429) { msg.textContent = "続けて送るときは、1分ほど待ってからお願いします。"; return; }
        if (!res.ok) throw new Error(String(res.status));
        try { localStorage.setItem("quveris.lastComment", String(Date.now())); } catch (_) {}
        form.reset(); sec.querySelector("[data-cmt-count]").textContent = "0 / 300";
        msg.textContent = "送信しました！ ありがとうございます。管理人が確認したら表示されます。";
      } catch (err) {
        msg.textContent = "送信できませんでした。時間をおいてもう一度お試しください。";
      } finally { btn.disabled = false; }
    });
  }

  const dataError = () => `
    <div class="notice"><strong>ゲーム情報を読み込めませんでした</strong>
    通信状況を確認して、ページを再読み込みしてください。
    <div><button class="btn btn--sm" onclick="location.reload()">${ICON.reload}RELOAD</button></div></div>`;

  function observeReveal() {
    const els = document.querySelectorAll(".reveal:not(.is-in)");
    if (!("IntersectionObserver" in window)) return els.forEach((e) => e.classList.add("is-in"));
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } }),
      { rootMargin: "0px 0px -6% 0px" }
    );
    els.forEach((e) => io.observe(e));
  }

  // sort: released first, then registry order
  const sortGames = (list) => list.slice().sort((a, b) => (a.status === b.status ? a.order - b.order : a.status === "released" ? -1 : 1));

  /* ------------------------------------------------------------ pages */
  const pages = {
    home(games) {
      const featured = $("[data-featured]");
      const stats = $("[data-stats]");
      if (!games) { if (featured) featured.innerHTML = dataError(); return; }
      const sorted = sortGames(games);
      if (featured) {
        featured.innerHTML = sorted.length ? sorted.slice(0, 3).map(card).join("") : `<div class="notice"><strong>NO GAME</strong>最初のゲームを準備中です。</div>`;
      }
      if (stats) {
        const released = games.filter(isPlayable).length;
        stats.innerHTML = `
          <div><dt>RELEASED</dt><dd>${pad(released)}<small>タイトル</small></dd></div>
          <div><dt>IN DEVELOPMENT</dt><dd>${pad(games.length - released)}<small>タイトル</small></dd></div>
          <div><dt>PRICE</dt><dd>¥0<small>すべて無料</small></dd></div>`;
      }
      const latest = $("[data-latest]");
      const firstPlayable = sorted.find(isPlayable);
      if (latest && firstPlayable) latest.href = "play.html?id=" + encodeURIComponent(firstPlayable.id);
    },

    list(games) {
      const grid = $("[data-grid]");
      if (!games) { grid.innerHTML = dataError(); return; }
      const state = { status: qs("status") || "all", genre: "all", q: "" };
      if (!["all", "released", "development"].includes(state.status)) state.status = "all";
      const genreSel = $("[data-genre]");
      [...new Set(games.map((g) => g.genre))].forEach((gn) => {
        const o = document.createElement("option");
        o.value = gn; o.textContent = gn; genreSel.appendChild(o);
      });
      const segBtns = document.querySelectorAll("[data-status-filter] button");
      const draw = () => {
        segBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === state.status)));
        const q = state.q.trim().toLowerCase();
        const out = sortGames(games).filter((g) =>
          (state.status === "all" || g.status === state.status) &&
          (state.genre === "all" || g.genre === state.genre) &&
          (!q || [g.title, g.genre, g.summary, ...g.tags].join(" ").toLowerCase().includes(q))
        );
        $("[data-count]").textContent = `${pad(out.length)} / ${pad(games.length)} TITLES`;
        grid.innerHTML = out.length
          ? out.map(card).join("")
          : `<div class="notice" style="grid-column:1/-1"><strong>NO SIGNAL</strong>条件に合うゲームが見つかりませんでした。</div>`;
        observeReveal();
      };
      segBtns.forEach((b) => b.addEventListener("click", () => {
        state.status = b.dataset.value;
        const u = new URL(location.href);
        state.status === "all" ? u.searchParams.delete("status") : u.searchParams.set("status", state.status);
        history.replaceState(null, "", u);
        draw();
      }));
      genreSel.addEventListener("change", () => { state.genre = genreSel.value; draw(); });
      $("[data-search]").addEventListener("input", (e) => { state.q = e.target.value; draw(); });
      draw();
    },

    detail(games) {
      const root = $("[data-detail]");
      if (!games) { root.innerHTML = dataError(); return; }
      const id = qs("id");
      const g = games.find((x) => x.id === id);
      if (!g) {
        root.innerHTML = `<div class="notice"><strong>GAME NOT FOUND</strong>指定されたゲームは見つかりませんでした。<div><a class="btn btn--sm" href="games.html">ゲーム一覧へ</a></div></div>`;
        document.title = "ゲームが見つかりません | QUVERIS";
        return;
      }
      document.title = `${g.title} | QUVERIS GAMES`;
      const crumb = $("[data-crumb]");
      if (crumb) crumb.textContent = g.title;
      const playable = isPlayable(g);
      const linksHTML = g.links.length
        ? `<div class="ext-links">${g.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label || "LINK")} ${ICON.ext}</a>`).join("")}</div>`
        : `<span class="muted">現在は QUVERIS 公式サイトのみで公開しています</span>`;
      root.innerHTML = `
        <div class="detail">
          <div>
            <div class="detail__media"><div>${thumbHTML(g, 'loading="eager"')}</div></div>
            ${g.video ? `<div class="pv-block">
              <span class="eyebrow">PV</span>
              <div class="detail__media detail__media--pv${g.video.vertical ? " detail__media--vertical" : ""}"><div data-media>${mediaHTML(g)}</div></div>
            </div>` : ""}
          </div>
          <div>
            <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
              ${statusChip(g)}<span class="card__genre" style="color:var(--${g.accent === "purple" ? "purple-2" : "mint"})">${esc(g.genre)}</span>
            </div>
            <h1 class="detail__title">${esc(g.title)}</h1>
            <p class="detail__desc">${esc(g.description)}</p>
            ${
              playable
                ? `<div class="detail__actions">
                    <a class="btn btn--main" href="play.html?id=${encodeURIComponent(g.id)}">▶ あそぶ</a>
                    <a class="btn btn--ghost" href="${esc(entryUrl(g))}" target="_blank" rel="noopener">${ICON.ext}単独ページ</a>
                    <button class="btn btn--ghost" type="button" data-share>${ICON.share}シェア</button>
                  </div>`
                : `<div class="dev-banner"><b>NOW LOADING...</b>このゲームは現在開発中のため、まだプレイできません。</div>`
            }
            <dl class="spec">
              <div><dt>PC</dt><dd>${esc(g.controls.pc || "-")}</dd></div>
              <div><dt>SMARTPHONE</dt><dd>${esc(g.controls.mobile || "-")}</dd></div>
              ${g.tags.length ? `<div><dt>TAGS</dt><dd>${g.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</dd></div>` : ""}
              <div><dt>VERSION</dt><dd class="mono">${esc(g.version || "-")}${g.updated ? ` <span class="muted">/ ${esc(g.updated)}</span>` : ""}</dd></div>
              <div><dt>DISTRIBUTION</dt><dd>${linksHTML}</dd></div>
            </dl>
          </div>
        </div>`;
      wirePlayer($("[data-media]"), g);
      mountComments(root, g);
      const shareBtn = $("[data-share]");
      if (shareBtn) {
        shareBtn.addEventListener("click", async () => {
          const url = new URL("play.html?id=" + encodeURIComponent(g.id), location.href).href;
          try {
            if (navigator.share) { await navigator.share({ title: g.title + " | QUVERIS", url }); return; }
            await navigator.clipboard.writeText(url);
            shareBtn.lastChild.textContent = "コピーしました";
          } catch (_) { /* user cancelled or clipboard blocked */ }
        });
      }
      // more games
      const more = $("[data-more]");
      if (more) {
        const others = sortGames(games.filter((x) => x.id !== g.id)).slice(0, 3);
        more.innerHTML = others.map(card).join("");
        if (!others.length) more.closest("section").hidden = true;
      }
    },

    play(games) {
      const stage = $("[data-stage]");
      const overlay = $("[data-overlay]");
      const titleEl = $("[data-title]");
      const showOverlay = (html) => { overlay.innerHTML = `<div class="box">${html}</div>`; overlay.hidden = false; };
      if (!games) { showOverlay(`<h2>LOAD ERROR</h2><p>ゲーム情報を読み込めませんでした。</p><div class="row"><button class="btn btn--sm" onclick="location.reload()">再読み込み</button></div>`); return; }

      const g = games.find((x) => x.id === qs("id"));
      if (!g) {
        titleEl.innerHTML = "<b>NOT FOUND</b><small>QUVERIS GAMES</small>";
        showOverlay(`<h2>GAME NOT FOUND</h2><p>指定されたゲームは見つかりませんでした。</p><div class="row"><a class="btn btn--sm" href="games.html">ゲーム一覧へ</a></div>`);
        return;
      }
      document.title = `${g.title} - PLAY | QUVERIS`;
      titleEl.innerHTML = `<b>${esc(g.title)}</b><small>${esc(g.genre)} / QUVERIS GAMES</small>`;
      $("[data-back]").href = "game.html?id=" + encodeURIComponent(g.id);
      stage.dataset.orientation = g.orientation;

      if (!isPlayable(g)) {
        $("[data-tools]").hidden = true;
        showOverlay(`<span class="status status--development">開発中</span><h2>${esc(g.title)}</h2><p>このゲームは現在開発中のため、まだプレイできません。</p><div class="row"><a class="btn btn--sm" href="game.html?id=${encodeURIComponent(g.id)}">詳細を見る</a><a class="btn btn--sm btn--ghost" href="games.html">ゲーム一覧</a></div>`);
        return;
      }

      const standalone = $("[data-standalone]");
      standalone.href = entryUrl(g);

      const loadingHTML = `<div class="loader"><i></i><i></i><i></i><i></i></div><h2>LOADING</h2><p>${esc(g.title)} を起動しています</p>`;
      const errorHTML = (msg) => `<h2>LOAD ERROR</h2><p>${msg}</p><div class="row"><button class="btn btn--sm" type="button" data-retry>${ICON.reload}もう一度読み込む</button><a class="btn btn--sm btn--ghost" href="${esc(entryUrl(g))}" target="_blank" rel="noopener">単独ページで開く</a></div>`;
      let iframe = null;
      let timer = 0;

      const mount = async () => {
        showOverlay(loadingHTML);
        if (iframe) iframe.remove();
        clearTimeout(timer);
        // Check that the game file actually exists (skipped on file:// where fetch is blocked)
        if (location.protocol.startsWith("http")) {
          try {
            const res = await fetch(entryUrl(g), { method: "GET", cache: "no-cache" });
            if (!res.ok) throw new Error(String(res.status));
          } catch (err) {
            if (!navigator.onLine) { showOverlay(errorHTML("オフラインのようです。通信状況を確認してください。")); return; }
            showOverlay(errorHTML("ゲームファイルを読み込めませんでした（" + esc(err.message) + "）。")); return;
          }
        }
        iframe = document.createElement("iframe");
        iframe.title = g.title;
        iframe.src = entryUrl(g);
        iframe.setAttribute("allow", "fullscreen; autoplay; gamepad; screen-wake-lock");
        iframe.setAttribute("allowfullscreen", "");
        iframe.setAttribute("tabindex", "0");
        timer = setTimeout(() => showOverlay(errorHTML("読み込みに時間がかかっています。")), 20000);
        iframe.addEventListener("load", () => {
          clearTimeout(timer);
          overlay.hidden = true;
          try { iframe.contentWindow.focus(); } catch (_) {}
          iframe.focus({ preventScroll: true });
        });
        stage.insertBefore(iframe, stage.firstChild);
      };
      overlay.addEventListener("click", (e) => { if (e.target.closest("[data-retry]")) mount(); });
      // Keep keyboard focus in the game after interacting with the page chrome
      stage.addEventListener("pointerdown", () => iframe && iframe.focus({ preventScroll: true }));

      $("[data-reload]").addEventListener("click", mount);

      /* ---- fullscreen (native where supported, CSS fallback for iPhone) */
      const fsBtn = $("[data-fs]");
      const nativeFS = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
      const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
      const setFsUI = (on) => {
        fsBtn.innerHTML = (on ? ICON.fsExit : ICON.fs) + `<span class="lbl">${on ? "EXIT" : "FULLSCREEN"}</span>`;
        fsBtn.setAttribute("aria-pressed", String(on));
      };
      const enterFS = async () => {
        if (nativeFS) {
          try {
            await (stage.requestFullscreen ? stage.requestFullscreen({ navigationUI: "hide" }) : stage.webkitRequestFullscreen());
            if (g.orientation !== "any" && screen.orientation && screen.orientation.lock) screen.orientation.lock(g.orientation).catch(() => {});
            return;
          } catch (_) { /* fall through to pseudo */ }
        }
        stage.classList.add("is-pseudo-fs");
        document.documentElement.style.overflow = "hidden";
        window.scrollTo(0, 1);
        setFsUI(true);
      };
      const exitFS = () => {
        if (fsElement()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
        stage.classList.remove("is-pseudo-fs");
        document.documentElement.style.overflow = "";
        setFsUI(false);
      };
      const toggleFS = () => (fsElement() || stage.classList.contains("is-pseudo-fs") ? exitFS() : enterFS());
      fsBtn.addEventListener("click", toggleFS);
      $("[data-fs-exit]").addEventListener("click", exitFS);
      ["fullscreenchange", "webkitfullscreenchange"].forEach((ev) =>
        document.addEventListener(ev, () => { setFsUI(!!fsElement()); setTimeout(() => iframe && iframe.focus(), 50); })
      );
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && stage.classList.contains("is-pseudo-fs")) exitFS(); });
      // games can ask the portal to toggle fullscreen: parent.postMessage({type:"quveris:fullscreen"}, "*")
      window.addEventListener("message", (e) => {
        if (e.origin !== location.origin && location.protocol !== "file:") return;
        if (e.data && e.data.type === "quveris:fullscreen") toggleFS();
      });
      setFsUI(false);
      mount();
    },

    about(games) {
      const n = $("[data-about-count]");
      if (n && games) n.textContent = pad(games.filter(isPlayable).length);
      const social = ((window.QUVERIS_SITE || {}).social || []).filter((s) => /^https:\/\//.test(s.url || ""));
      const row = $("[data-social]");
      if (row) {
        row.innerHTML = social.length
          ? social.map((s) => `<a class="btn btn--sm btn--ghost" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} ${ICON.ext}</a>`).join("")
          : `<span class="muted" style="font-size:14px">公式SNSは準備中です。</span>`;
      }
    }
  };

  /* ------------------------------------------------------------ typewriter (RPG dialog) */
  function typewriter() {
    document.querySelectorAll("[data-typewriter]").forEach((el) => {
      const full = el.textContent.trim();
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      el.setAttribute("aria-label", full);
      el.textContent = "";
      let i = 0;
      const step = () => {
        i++;
        el.textContent = full.slice(0, i);
        if (i < full.length) setTimeout(step, /[、。！？]/.test(full[i - 1]) ? 180 : 45);
      };
      setTimeout(step, 400);
      // tap the window to show everything at once
      const box = el.closest(".dialog");
      if (box) box.addEventListener("click", () => { i = full.length; el.textContent = full; });
    });
  }

  /* ------------------------------------------------------------ boot */
  function loadRegistryScript() {
    return new Promise((resolve) => {
      if (Array.isArray(window.QUVERIS_GAMES)) return resolve();
      const s = document.createElement("script");
      s.src = "games.js?t=" + Math.floor(Date.now() / 60000);
      s.onload = s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }
  async function boot() {
    await loadRegistryScript();
    const page = document.body.dataset.page;
    renderChrome(page);
    let games = null;
    try { games = loadGames(); } catch (e) { console.error(e); }
    try { pages[page] && pages[page](games); } catch (e) { console.error("[QUVERIS] page error", e); }
    observeReveal();
    typewriter();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
