/* =====================================================================
 * アイテムUI：インベントリ / 拡大調査 / 組み合わせ / 推理手帳 / 操作説明
 *   データは js/data/items.js、状態操作は engine.js の Game.core 経由
 * ===================================================================== */
(function () {
  'use strict';
  const ELD = window.ELD;
  const { css, mix, hash } = ELD.util;
  const $ = (id) => document.getElementById(id);
  let C = null; // Game.core

  /* ---------------- 64×64 のアイテム絵 ---------------- */
  let g = null;
  const R = (x, y, w, h, c) => { g.fillStyle = typeof c === 'string' ? c : css(c); g.fillRect(x, y, w, h); };
  const K = (c, k) => css(c, k);
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  function box(x, y, w, h, c) { R(x, y, w, h, c); R(x, y, w, 1, K(c, 1.35)); R(x, y, 1, h, K(c, 1.2)); R(x, y + h - 1, w, 1, K(c, 0.6)); R(x + w - 1, y, 1, h, K(c, 0.7)); }
  function oval(cx, cy, rx, ry, c) { g.fillStyle = typeof c === 'string' ? c : css(c); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
  function lines(x, y, w, n, step, c, seed) { for (let i = 0; i < n; i++) R(x, y + i * step, Math.round(w * (0.55 + hash(i, seed || 1, 3) * 0.45)), 1, c); }
  function keyShape(c, bow) {
    const k = hex(c);
    if (bow === 'gear') { g.save(); g.translate(16, 32); g.fillStyle = css(k); for (let i = 0; i < 8; i++) { g.save(); g.rotate((i / 8) * Math.PI * 2); g.fillRect(-2, -14, 4, 6); g.restore(); } g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.fill(); g.fillStyle = '#1a1410'; g.beginPath(); g.arc(0, 0, 4, 0, Math.PI * 2); g.fill(); g.restore(); }
    else { oval(16, 32, 11, 11, k); oval(16, 32, 5, 5, '#120c16'); R(9, 25, 3, 2, K(k, 1.5)); }
    R(26, 30, 30, 5, k); R(26, 30, 30, 1, K(k, 1.4)); R(26, 34, 30, 1, K(k, 0.6));
    R(46, 35, 4, 7, k); R(52, 35, 4, 5, k); R(42, 35, 2, 4, k);
  }
  const ART = {
    letter(side, st) {
      box(4, 12, 56, 40, [232, 222, 196]);
      if (side === 'front') {
        lines(14, 22, 34, 1, 0, '#3a3040'); R(14, 24, 30, 2, '#3a3040'); lines(14, 30, 24, 2, 4, '#7a7080', 4);
        R(46, 16, 10, 12, [170, 60, 60]); R(47, 17, 8, 10, [200, 90, 80]);
        if (st.light) { g.globalAlpha = 0.35; for (let i = 0; i < 6; i++) R(8 + i * 8, 44, 5, 5, '#ffffff'); g.globalAlpha = 1; }
      } else {
        g.fillStyle = css([210, 198, 170]); g.beginPath(); g.moveTo(4, 12); g.lineTo(32, 36); g.lineTo(60, 12); g.fill();
        oval(32, 32, 8, 8, [150, 30, 40]); oval(32, 32, 6, 6, [180, 45, 55]);
        R(29, 29, 2, 2, '#ffd'); R(33, 30, 2, 4, '#ffd'); R(30, 34, 4, 1, '#ffd');
      }
    },
    locket(side, st) {
      R(30, 0, 4, 6, [190, 190, 200]);
      if (side === 'front' || !st.flags.locket_open) {
        oval(32, 34, 22, 26, [170, 170, 184]); oval(32, 34, 19, 23, [206, 206, 218]);
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; R(32 + Math.cos(a) * 15 - 1, 34 + Math.sin(a) * 18 - 1, 3, 3, [160, 140, 80]); }
        oval(32, 34, 6, 7, [216, 178, 90]); R(28, 4, 8, 6, [150, 120, 90]);
        if (side === 'back') { lines(18, 28, 28, 3, 5, '#8a8a96', 9); }
      } else {
        oval(32, 34, 22, 26, [170, 170, 184]); oval(32, 34, 19, 23, [236, 232, 220]);
        R(20, 12, 24, 20, [120, 100, 80]); oval(28, 24, 4, 5, [200, 180, 160]); oval(36, 22, 3, 3, [210, 190, 170]); oval(36, 28, 4, 4, [90, 80, 110]);
        for (let i = 0; i < 4; i++) { const x = 16 + i * 9, y = 44 - [2, 1, 0, 1][i] * 3; oval(x, y, 2, 2, '#302830'); R(x + 1, y - 7, 1, 7, '#302830'); }
        R(12, 46, 40, 1, '#8a8090');
      }
    },
    keyring(side) {
      g.strokeStyle = css([190, 170, 90]); g.lineWidth = 3; g.beginPath(); g.arc(22, 20, 12, 0, Math.PI * 2); g.stroke();
      [[18, 36, '#d8c070'], [26, 38, '#c8b060'], [12, 40, '#e0cc80'], [32, 34, '#b8a050']].forEach(([x, y, c], i) => { g.save(); g.translate(x, y); g.rotate(-0.4 + i * 0.25); R(-2, -6, 4, 22, c); R(-4, 12, 8, 4, c); g.restore(); });
      g.save(); g.translate(46, 40); g.rotate(0.5); R(-1, -3, 3, 12, '#e8d8a0'); R(-3, 7, 6, 3, '#e8d8a0'); g.restore();
      box(38, 30, 14, 10, [230, 220, 190]); R(41, 34, 8, 1, '#555');
    },
    key(side, st, it) { keyShape(it.c); if (side === 'back') { R(8, 30, 2, 4, '#20202a'); R(12, 28, 2, 2, '#20202a'); R(14, 34, 4, 1, '#20202a'); } },
    gearkey(side, st, it) { keyShape(it.c, 'gear'); if (side === 'back') { for (let i = 0; i < 4; i++) R(36 + i * 5, 31, 3, 3, K(hex(it.c), 0.5)); } },
    card(side) {
      box(4, 14, 56, 36, [70, 140, 200]);
      if (side === 'front') { R(8, 18, 14, 14, [230, 240, 250]); R(11, 21, 8, 8, [70, 140, 200]); lines(26, 20, 28, 3, 4, '#e8f0f8', 2); R(48, 40, 8, 6, [216, 178, 90]); }
      else { R(4, 22, 56, 7, '#16161c'); lines(8, 36, 40, 2, 4, '#f0f0f0', 7); }
    },
    gear(side) {
      g.save(); g.translate(32, 32); g.fillStyle = css([200, 150, 60]);
      for (let i = 0; i < 12; i++) { g.save(); g.rotate((i / 12) * Math.PI * 2); g.fillRect(-3, -30, 6, 9); g.restore(); }
      g.beginPath(); g.arc(0, 0, 23, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2a2018'; for (let i = 0; i < 5; i++) { g.save(); g.rotate((i / 5) * Math.PI * 2); g.beginPath(); g.arc(0, -13, 5, 0, Math.PI * 2); g.fill(); g.restore(); }
      g.fillStyle = css([230, 190, 90]); g.beginPath(); g.arc(0, 0, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = '#1a1410'; g.fillRect(-2, -2, 4, 4); g.restore();
      g.globalAlpha = 0.35; oval(24, 22, 8, 4, '#3a3020'); oval(40, 40, 6, 3, '#3a3020'); g.globalAlpha = 0.5; R(18, 14, 6, 2, '#fff8e0'); g.globalAlpha = 1;
    },
    glove(side) {
      [[8, [130, 90, 60]], [34, [120, 82, 54]]].forEach(([x, c]) => {
        box(x, 26, 22, 30, c);
        for (let i = 0; i < 4; i++) box(x + i * 5 + 1, 8 + (i === 0 || i === 3 ? 6 : 0), 4, 20 - (i === 0 || i === 3 ? 6 : 0), c);
        box(x + (x < 20 ? 18 : -4), 30, 8, 12, c);
        R(x + 2, 50, 18, 4, K(c, 0.7));
      });
      if (side === 'front') { R(9, 8, 4, 4, '#d8c0a0'); R(14, 8, 4, 4, '#d8c0a0'); }
      g.globalAlpha = 0.3; oval(20, 40, 6, 5, '#201810'); oval(46, 44, 5, 4, '#201810'); g.globalAlpha = 1;
    },
    book(side, st) {
      if (side === 'front') { box(10, 4, 44, 56, [44, 36, 42]); R(12, 4, 3, 56, '#1a141a'); R(26, 20, 18, 12, [70, 60, 66]); R(52, 28, 6, 8, [180, 160, 110]); }
      else {
        box(4, 6, 56, 52, [234, 226, 206]); R(31, 6, 2, 52, '#b8ac90');
        lines(8, 12, 20, 4, 4, '#4a4048', 3); R(8, 30, 18, 14, [214, 204, 180]); g.strokeStyle = '#9a8a70'; g.setLineDash([2, 2]); g.strokeRect(8.5, 30.5, 18, 14); g.setLineDash([]);
        lines(36, 12, 20, 8, 4, '#4a4048', 5);
        if (st.light) { g.globalAlpha = 0.6; R(8, 46, 46, 2, '#5a3a80'); g.globalAlpha = 1; }
      }
    },
    blueprint(side) {
      if (side === 'front') {
        box(2, 4, 60, 56, [40, 80, 150]);
        g.strokeStyle = '#d8e8ff'; g.lineWidth = 1;
        [[6, 8, 14, 14], [22, 10, 16, 12], [40, 10, 16, 12], [8, 30, 48, 8], [10, 42, 12, 12], [26, 42, 12, 12], [42, 42, 12, 12]].forEach(([x, y, w, h]) => g.strokeRect(x + 0.5, y + 0.5, w, h));
        g.strokeStyle = '#ff6a6a'; g.lineWidth = 2; g.beginPath(); g.moveTo(46, 12); g.lineTo(54, 20); g.moveTo(54, 12); g.lineTo(46, 20); g.stroke();
      } else { box(2, 4, 60, 56, [220, 214, 196]); oval(32, 48, 9, 6, [200, 60, 60]); oval(32, 48, 7, 4, [220, 214, 196]); lines(10, 12, 40, 4, 5, '#7a7080', 6); }
    },
    record(side) {
      box(6, 4, 52, 56, [236, 230, 212]);
      R(10, 8, 30, 3, '#3a3040');
      for (let i = 0; i < 6; i++) { R(10, 16 + i * 5, 10, 1, '#7a7080'); R(24, 16 + i * 5, 26, 1, '#9a90a0'); }
      R(10, 36, 44, 3, [200, 60, 60]);
      if (side === 'front') { g.save(); g.translate(32, 54); g.rotate(Math.PI); lines(-22, -1, 40, 2, 3, '#5a4a70', 11); g.restore(); }
      else lines(10, 46, 40, 2, 4, '#9a90a0', 12);
    },
    score(side) {
      box(4, 6, 56, 52, [238, 230, 206]);
      if (side === 'front') {
        for (let s = 0; s < 3; s++) for (let l = 0; l < 5; l++) R(8, 14 + s * 14 + l * 2, 48, 1, '#6a6070');
        [[10, 16], [15, 15], [20, 14], [25, 15], [32, 20], [38, 30], [44, 28], [50, 44]].forEach(([x, y]) => { oval(x, y + 2, 2, 1.5, '#201820'); R(x + 1, y - 4, 1, 6, '#201820'); });
        g.strokeStyle = '#c03030'; g.beginPath(); g.ellipse(17, 17, 11, 6, 0, 0, Math.PI * 2); g.stroke();
      } else { R(14, 20, 36, 3, '#3a3040'); lines(14, 30, 30, 3, 5, '#8a8090', 8); }
    },
    photo(side) {
      if (side === 'front') {
        box(6, 6, 52, 52, [180, 150, 110]);
        R(10, 10, 44, 44, [150, 120, 86]);
        oval(20, 26, 5, 6, [90, 70, 50]); R(13, 32, 14, 22, [60, 50, 44]); R(18, 34, 2, 2, [216, 178, 90]);
        oval(40, 34, 4, 5, [110, 86, 60]); R(35, 39, 10, 15, [120, 100, 120]);
        g.fillStyle = '#1a120c'; g.beginPath(); g.moveTo(58, 6); g.lineTo(58, 40); g.quadraticCurveTo(46, 36, 42, 26); g.quadraticCurveTo(44, 14, 34, 6); g.fill();
        g.fillStyle = '#3a2414'; g.beginPath(); g.moveTo(34, 6); g.quadraticCurveTo(44, 14, 42, 26); g.quadraticCurveTo(46, 36, 58, 40); g.lineTo(58, 44); g.quadraticCurveTo(44, 40, 40, 28); g.quadraticCurveTo(40, 14, 30, 6); g.fill();
      } else {
        box(6, 6, 52, 52, [220, 206, 180]);
        lines(12, 20, 36, 3, 6, '#3a3040', 13);
        g.fillStyle = '#1a120c'; g.beginPath(); g.moveTo(6, 6); g.lineTo(6, 40); g.quadraticCurveTo(18, 36, 22, 26); g.quadraticCurveTo(20, 14, 30, 6); g.fill();
      }
    },
    watch(side) {
      R(30, 2, 4, 8, [180, 180, 190]); oval(32, 6, 4, 4, [200, 200, 210]);
      oval(32, 36, 24, 24, [170, 170, 182]); oval(32, 36, 21, 21, [210, 210, 220]);
      if (side === 'front') {
        oval(32, 36, 18, 18, [240, 236, 222]);
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; R(32 + Math.sin(a) * 15 - 1, 36 - Math.cos(a) * 15 - 1, 2, 2, '#302830'); }
        g.strokeStyle = '#201820'; g.lineWidth = 2; g.beginPath(); g.moveTo(32, 36); g.lineTo(32 - Math.sin(Math.PI / 6) * 9, 36 - Math.cos(Math.PI / 6) * 9); g.stroke();
        g.lineWidth = 1; g.beginPath(); g.moveTo(32, 36); g.lineTo(32 - Math.sin(Math.PI / 3) * 14, 36 - Math.cos(Math.PI / 3) * 14); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.moveTo(20, 22); g.lineTo(30, 34); g.lineTo(28, 44); g.moveTo(30, 34); g.lineTo(42, 30); g.stroke();
      } else { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; R(32 + Math.cos(a) * 12, 36 + Math.sin(a) * 12, 3, 3, [150, 150, 160]); } lines(22, 32, 20, 2, 4, '#6a6a76', 14); }
    },
    tape(side) {
      if (side === 'front') {
        oval(32, 28, 24, 24, [60, 60, 66]); oval(32, 28, 20, 20, [40, 34, 30]);
        for (let i = 0; i < 3; i++) { g.save(); g.translate(32, 28); g.rotate((i / 3) * Math.PI * 2); R(-3, -18, 6, 10, '#7a7a84'); g.restore(); }
        oval(32, 28, 5, 5, '#b0b0b8'); box(8, 44, 48, 12, [230, 222, 196]); R(12, 48, 34, 1, '#3a3040'); R(12, 51, 22, 1, '#3a3040');
      } else { box(6, 6, 52, 52, [180, 160, 120]); R(10, 10, 44, 10, [230, 222, 196]); lines(14, 13, 30, 2, 3, '#3a3040', 15); }
    },
    shard(side) {
      g.fillStyle = side === 'front' ? css([120, 80, 60]) : css([200, 184, 150]);
      g.beginPath(); g.moveTo(8, 14); g.lineTo(40, 6); g.lineTo(58, 22); g.lineTo(50, 54); g.lineTo(20, 58); g.lineTo(4, 34); g.closePath(); g.fill();
      if (side === 'front') {
        g.save(); g.clip(); R(0, 0, 64, 64, [200, 160, 130]); oval(22, 30, 7, 4, '#f4ece0'); oval(42, 30, 7, 4, '#f4ece0'); oval(22, 30, 3, 3, [70, 110, 180]); oval(42, 30, 3, 3, [70, 110, 180]); R(14, 20, 16, 2, '#6a4a30'); R(34, 20, 16, 2, '#6a4a30'); R(0, 0, 64, 12, [220, 190, 110]); g.restore();
      } else { g.save(); g.clip(); for (let y = 0; y < 64; y += 2) R(0, y, 64, 1, 'rgba(0,0,0,0.08)'); R(12, 42, 40, 8, [230, 220, 190]); R(16, 45, 24, 1, '#3a3040'); g.restore(); }
    },
    emblem(side, st, it) {
      if (side === 'front') ELD.drawIcon(g, it.icon, 4, 4, 3.5, it.c);
      else { oval(32, 32, 24, 24, [140, 140, 160]); oval(32, 32, 20, 20, [170, 170, 190]); R(26, 30, 12, 3, '#3a3a48'); }
    },
  };
  const ARTMAP = { letter: 'letter', locket: 'locket', keyring: 'keyring', key: 'key', gearkey: 'gearkey', card: 'card', gear: 'gear', glove: 'glove', book: 'book', blueprint: 'blueprint', record: 'record', score: 'score', photo: 'photo', watch: 'watch', tape: 'tape', shard: 'shard', star: 'emblem', moon: 'emblem', sun: 'emblem' };
  function drawItemArt(ctx, id, side, st) {
    const it = ELD.ITEMS[id]; const old = g; g = ctx;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    try { (ART[ARTMAP[it.icon]] || ART.key)(side || 'front', st || { flags: C ? C.S.flags : {} }, it); } catch (e) { console.error(e); }
    ctx.restore(); g = old;
  }
  function itemCanvas(id, size, side) {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    drawItemArt(cv.getContext('2d'), id, side || 'front', { flags: C.S.flags });
    cv.style.width = cv.style.height = (size || 48) + 'px'; cv.className = 'iart';
    return cv;
  }
  ELD.drawItemArt = drawItemArt;
  ELD.itemCanvas = (id, size, side) => itemCanvas(id, size, side);

  /* ---------------- インベントリ ---------------- */
  const Inv = {
    cat: 'key', sel: null, combineFrom: null,
    open() { this.combineFrom = null; const s = C.S; if (this.sel && !s.inv.includes(this.sel)) this.sel = null; if (!this.sel) { const f = s.inv.find((i) => ELD.ITEMS[i].cat === this.cat) || s.inv[0]; this.sel = f || null; if (f) this.cat = ELD.ITEMS[f].cat; } this.render(); },
    render() {
      const S = C.S;
      const tabs = $('invTabs'); tabs.innerHTML = '';
      for (const cdef of ELD.ITEM_CATS.concat([{ id: 'used', name: '使用済み' }])) {
        const n = cdef.id === 'used' ? S.used.length : S.inv.filter((i) => ELD.ITEMS[i].cat === cdef.id).length;
        const b = document.createElement('button'); b.className = this.cat === cdef.id ? 'on' : ''; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', this.cat === cdef.id);
        b.innerHTML = C.esc(cdef.name) + ' <small>' + n + '</small>';
        b.onclick = () => { this.cat = cdef.id; this.sel = null; const f = (cdef.id === 'used' ? S.used : S.inv.filter((i) => ELD.ITEMS[i].cat === cdef.id))[0]; this.sel = f || null; this.render(); };
        tabs.appendChild(b);
      }
      const list = this.cat === 'used' ? S.used : S.inv.filter((i) => ELD.ITEMS[i].cat === this.cat);
      const grid = $('invGrid'); grid.innerHTML = '';
      if (!list.length) grid.innerHTML = '<p class="empty">' + (this.cat === 'used' ? '使ったアイテムはまだない。' : 'このカテゴリのアイテムはまだない。') + '</p>';
      for (const id of list) {
        const it = ELD.ITEMS[id];
        const b = document.createElement('button'); b.className = 'cell' + (this.sel === id ? ' on' : '') + (this.combineFrom === id ? ' from' : '') + (S.newNotes['item:' + id] ? ' new' : '');
        b.appendChild(itemCanvas(id, 44)); const sp = document.createElement('span'); sp.textContent = it.name; b.appendChild(sp);
        b.onclick = () => {
          if (this.combineFrom && this.cat !== 'used' && this.combineFrom !== id) { const a = this.combineFrom; this.combineFrom = null; C.UI.close(); C.combine(a, id); return; }
          this.sel = id; delete S.newNotes['item:' + id]; this.render();
        };
        grid.appendChild(b);
      }
      this.detail();
    },
    detail() {
      const S = C.S, box = $('invDetail'), id = this.sel; box.innerHTML = '';
      if (!id) { box.innerHTML = '<p class="empty">アイテムを選んでください。</p>'; return; }
      const it = ELD.ITEMS[id], used = S.used.includes(id) && !S.inv.includes(id);
      const art = itemCanvas(id, 128); art.classList.add('big'); box.appendChild(art);
      const hs = (it.hotspots || []).length, found = (it.hotspots || []).filter((h) => S.examined['item:' + id + ':' + h.id]).length;
      const d = document.createElement('div'); d.className = 'dtext';
      d.innerHTML = '<h3>' + C.esc(it.name) + (it.important ? ' <em>重要</em>' : '') + (used ? ' <em class="u">使用済み</em>' : '') + '</h3>' +
        '<p>' + C.esc(C.fmt(it.desc)) + '</p>' +
        '<dl><dt>見つけた場所</dt><dd>' + C.esc(it.found || '—') + '</dd>' + (hs ? '<dt>調べた箇所</dt><dd>' + found + ' / ' + hs + '</dd>' : '') + '</dl>';
      box.appendChild(d);
      const rel = (it.links || []).filter((n) => S.notes[n]);
      if (rel.length) {
        const r = document.createElement('div'); r.className = 'rel'; r.innerHTML = '<b>関連する手帳</b>';
        for (const n of rel) { const nd = ELD.NOTES.find((x) => x.id === n); const a = document.createElement('button'); a.className = 'link'; a.textContent = C.fmt(nd.title); a.onclick = () => Note.open(n); r.appendChild(a); }
        box.appendChild(r);
      }
      const acts = document.createElement('div'); acts.className = 'acts';
      const mk = (label, fn, dis, cls) => { const b = document.createElement('button'); b.textContent = label; b.disabled = !!dis; if (cls) b.className = cls; b.onclick = fn; acts.appendChild(b); return b; };
      mk('調べる', () => Ex.open(id), false, 'pri');
      mk('使う', () => { C.UI.close(); C.arm(id); }, used);
      mk(this.combineFrom === id ? '組み合わせ中…' : '組み合わせる', () => { this.combineFrom = this.combineFrom === id ? null : id; this.render(); $('invHint').textContent = this.combineFrom ? '組み合わせる相手のアイテムを選んでください。' : ''; }, used || S.inv.length < 2);
      box.appendChild(acts);
      $('invHint').textContent = this.combineFrom ? '組み合わせる相手のアイテムを選んでください。' : '';
    },
  };

  /* ---------------- 拡大調査 ---------------- */
  const Ex = {
    id: null, side: 'front', rot: 0, zoom: 1, panX: 0, panY: 0, light: false, ptrs: new Map(), pinch: null, t: 0, raf: 0, prevMode: null, msg: '',
    open(id) {
      this.id = id; this.side = 'front'; this.rot = 0; this.zoom = 1; this.panX = this.panY = 0; this.light = false; this.msg = '';
      $('exOv').classList.add('show'); $('exName').textContent = ELD.ITEMS[id].name;
      $('exCap').textContent = 'タップ／クリックで細部を調べる。裏返す・回す・拡大・光にかざすで、隠れたものが見つかることがある。';
      this.prevMode = C.mode; C.mode = 'overlay';
      this.sync(); cancelAnimationFrame(this.raf); const loop = () => { this.t += 1 / 60; this.draw(); this.raf = requestAnimationFrame(loop); }; loop();
      C.Audio.sfx('paper');
    },
    close() { $('exOv').classList.remove('show'); cancelAnimationFrame(this.raf); Inv.render(); },
    sync() {
      $('exSide').textContent = this.side === 'front' ? '裏返す' : '表に戻す';
      $('exLight').setAttribute('aria-pressed', this.light); $('exLight').classList.toggle('on', this.light);
      $('exZoom').textContent = '×' + this.zoom.toFixed(1);
      const it = ELD.ITEMS[this.id], hs = it.hotspots || [];
      $('exCount').textContent = hs.length ? '発見 ' + hs.filter((h) => C.S.examined['item:' + this.id + ':' + h.id]).length + ' / ' + hs.length : '';
    },
    layout() {
      const cv = $('exCv'), r = cv.parentElement.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
      const base = Math.floor(Math.min(cv.width, cv.height) / 64 * 0.86);
      return { cv, dpr, s: Math.max(1, base) * this.zoom, cx: cv.width / 2 + this.panX * dpr, cy: cv.height / 2 + this.panY * dpr };
    },
    needMet(h) {
      if (h.side !== this.side) return false;
      if (h.need === 'light' && !this.light) return false;
      if (h.need === 'rot180' && this.rot !== 180) return false;
      if (h.need === 'zoom' && this.zoom < 2) return false;
      if (h.requireFlag && !C.S.flags[h.requireFlag]) return false;
      if (this.id === 'locket' && h.side === 'back' && !C.S.flags.locket_open) return false;
      return true;
    },
    draw() {
      const { cv, s, cx, cy } = this.layout(), c = cv.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
      if (this.light) { const gr = c.createRadialGradient(cv.width / 2, cv.height / 2, 0, cv.width / 2, cv.height / 2, cv.width * 0.6); gr.addColorStop(0, 'rgba(255,240,200,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, cv.width, cv.height); }
      c.save(); c.translate(cx, cy); c.rotate((this.rot * Math.PI) / 180); c.scale(s, s); c.translate(-32, -32);
      c.imageSmoothingEnabled = false;
      const off = document.createElement('canvas'); off.width = 64; off.height = 64;
      drawItemArt(off.getContext('2d'), this.id, this.side, { flags: C.S.flags, light: this.light });
      c.drawImage(off, 0, 0);
      if (this.light) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.18; c.drawImage(off, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
      for (const h of ELD.ITEMS[this.id].hotspots || []) {
        if (!this.needMet(h)) continue;
        const found = C.S.examined['item:' + this.id + ':' + h.id];
        c.lineWidth = 1 / s * 2;
        if (found) { c.strokeStyle = 'rgba(216,178,90,0.7)'; c.strokeRect(h.x, h.y, h.w, h.h); }
        else { const a = 0.25 + Math.sin(this.t * 4 + h.x) * 0.2; c.fillStyle = 'rgba(255,240,180,' + a + ')'; const px = h.x + h.w / 2, py = h.y + h.h / 2; c.fillRect(px - 0.5, py - 2, 1, 4); c.fillRect(px - 2, py - 0.5, 4, 1); }
      }
      c.restore();
    },
    hit(clientX, clientY) {
      const { cv, dpr, s, cx, cy } = this.layout(), r = cv.getBoundingClientRect();
      let x = (clientX - r.left) * dpr - cx, y = (clientY - r.top) * dpr - cy;
      const a = (-this.rot * Math.PI) / 180, rx = x * Math.cos(a) - y * Math.sin(a), ry = x * Math.sin(a) + y * Math.cos(a);
      const ix = rx / s + 32, iy = ry / s + 32;
      const it = ELD.ITEMS[this.id];
      const h = (it.hotspots || []).find((q) => this.needMet(q) && ix >= q.x - 2 && ix <= q.x + q.w + 2 && iy >= q.y - 2 && iy <= q.y + q.h + 2);
      if (h) {
        const key = 'item:' + this.id + ':' + h.id, first = !C.S.examined[key];
        C.S.examined[key] = true;
        if (h.set) for (const f of [].concat(h.set)) C.S.flags[f] = true;
        $('exCap').textContent = C.fmt(h.text);
        C.Audio.sfx(first ? 'success' : 'paper');
        this.sync(); C.afterChange();
      } else if (ix >= 0 && ix <= 64 && iy >= 0 && iy <= 64) {
        $('exCap').textContent = C.fmt(ELD.ITEMS[this.id].desc);
      }
    },
    bind() {
      const cv = $('exCv');
      cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false }); if (this.ptrs.size === 2) { const [p, q] = [...this.ptrs.values()]; this.pinch = { d: Math.hypot(p.x - q.x, p.y - q.y), z: this.zoom }; } });
      cv.addEventListener('pointermove', (e) => {
        const p = this.ptrs.get(e.pointerId); if (!p) return;
        const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
        if (Math.hypot(p.x - p.sx, p.y - p.sy) > 6) p.moved = true;
        if (this.ptrs.size === 2 && this.pinch) { const [a, b] = [...this.ptrs.values()]; this.zoom = Math.max(1, Math.min(4, this.pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / this.pinch.d)); this.sync(); }
        else if (this.zoom > 1) { this.panX += dx; this.panY += dy; }
      });
      const up = (e) => { const p = this.ptrs.get(e.pointerId); this.ptrs.delete(e.pointerId); if (this.ptrs.size < 2) this.pinch = null; if (p && !p.moved && this.ptrs.size === 0) this.hit(e.clientX, e.clientY); };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', (e) => { this.ptrs.delete(e.pointerId); this.pinch = null; });
      cv.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom = Math.max(1, Math.min(4, this.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2))); if (this.zoom === 1) this.panX = this.panY = 0; this.sync(); }, { passive: false });
      $('exSide').onclick = () => { this.side = this.side === 'front' ? 'back' : 'front'; C.Audio.sfx('paper'); this.sync(); };
      $('exRotL').onclick = () => { this.rot = (this.rot + 270) % 360; this.sync(); };
      $('exRotR').onclick = () => { this.rot = (this.rot + 90) % 360; this.sync(); };
      $('exIn').onclick = () => { this.zoom = Math.min(4, this.zoom + 0.5); this.sync(); };
      $('exOut').onclick = () => { this.zoom = Math.max(1, this.zoom - 0.5); if (this.zoom === 1) this.panX = this.panY = 0; this.sync(); };
      $('exLight').onclick = () => { this.light = !this.light; this.sync(); };
      $('exClose').onclick = () => this.close();
    },
  };

  /* ---------------- 推理手帳 ---------------- */
  const NOTE_TABS = [
    { id: 'evidence', name: '各章の証拠' }, { id: 'testimony', name: '証言' }, { id: 'timeline', name: '時系列' },
    { id: 'mystery', name: '未解決の謎' }, { id: 'question', name: '未解決の疑問' }, { id: 'fact', name: '解決済みの事実' },
  ];
  const Note = {
    tab: 'evidence', focus: null,
    open(focusId) {
      if (focusId) { const n = ELD.NOTES.find((x) => x.id === focusId); const done = C.S.notes[focusId] && C.S.notes[focusId].done; this.tab = done ? 'fact' : n.cat; this.focus = focusId; }
      C.UI.open('noteOv');
    },
    entries(tab) {
      const S = C.S, out = [];
      if (tab === 'evidence') {
        const ids = Object.keys(S.notes).filter((k) => k.startsWith('item:')).map((k) => k.slice(5)).filter((i) => ELD.ITEMS[i]);
        ids.sort((a, b) => S.notes['item:' + a].t - S.notes['item:' + b].t);
        const list = ids.map((i) => ({ id: 'item:' + i, item: i, ch: S.notes['item:' + i].ch, t: S.notes['item:' + i].t }));
        for (const n of ELD.NOTES) if (n.evidence && S.notes[n.id]) list.push({ id: n.id, n, st: S.notes[n.id], ch: S.notes[n.id].ch, t: S.notes[n.id].t });
        return list.sort((a, b) => a.ch - b.ch || a.t - b.t);
      }
      for (const n of ELD.NOTES) {
        const st = S.notes[n.id]; if (!st) continue;
        const done = !!st.done;
        if (tab === 'fact') { if (n.cat === 'fact' || ((n.cat === 'mystery' || n.cat === 'question') && done)) out.push({ n, st }); }
        else if (n.cat === tab && !((tab === 'mystery' || tab === 'question') && done)) out.push({ n, st });
      }
      return out;
    },
    people() {
      const S = C.S, info = ELD.CAST_INFO || [];
      return info.filter((p) => S.met && S.met[p.id]);
    },
    render() {
      const S = C.S, tabs = $('noteTabs'); tabs.innerHTML = '';
      const tabsAll = (ELD.CAST_INFO ? [{ id: 'people', name: '人物' }] : []).concat(NOTE_TABS);
      for (const t of tabsAll) {
        if (t.id === 'people') {
          const b = document.createElement('button'); b.className = this.tab === 'people' ? 'on' : ''; b.innerHTML = '人物 <small>' + this.people().length + '</small>';
          b.onclick = () => { this.tab = 'people'; this.render(); }; tabs.appendChild(b); continue;
        }
        const list = this.entries(t.id), nw = list.some((e) => S.newNotes[e.id || e.n.id]);
        const b = document.createElement('button'); b.className = (this.tab === t.id ? 'on' : '') + (nw ? ' new' : ''); b.innerHTML = C.esc(t.name) + ' <small>' + list.length + '</small>';
        b.onclick = () => { this.tab = t.id; this.focus = null; this.render(); }; tabs.appendChild(b);
      }
      const body = $('noteBody'); body.innerHTML = '';
      if (this.tab === 'people') {
        const u = S.unity == null ? 5 : S.unity;
        const top = document.createElement('div'); top.className = 'unity'; top.textContent = '結束 ' + '■'.repeat(u) + '□'.repeat(10 - u) + '（' + u + ' / 10）'; body.appendChild(top);
        const ppl = this.people();
        if (!ppl.length) { body.insertAdjacentHTML('beforeend', '<p class="empty">まだ誰とも話していない。</p>'); return; }
        for (const p of ppl) {
          const row = document.createElement('div'); row.className = 'ppl';
          const cv = document.createElement('canvas'); if (!ELD.drawCharPortrait(cv, p.id)) { cv.width = 16; cv.height = 24; ELD.drawPerson(cv.getContext('2d'), 'down', 0, false, ELD.LOOKS[p.id]); } row.appendChild(cv);
          const t = (S.trust[p.id] || 0), dead = (S.victims || []).some((v) => (v.id || v.name) === p.id || v.name === p.name);
          const d = document.createElement('div'); d.innerHTML = '<b>' + C.esc(p.name) + '</b><span>' + C.esc(p.role) + (p.memo && p.memo(S) ? '　' + C.esc(C.fmt(p.memo(S))) : '') + '</span>'; row.appendChild(d);
          const tr = document.createElement('span'); tr.className = 'tr'; tr.textContent = p.noTrust ? '' : dead ? '死亡' : '●'.repeat(t) + '○'.repeat(5 - t); tr.title = '信頼度 ' + t + ' / 5'; row.appendChild(tr);
          body.appendChild(row);
        }
        return;
      }
      const list = this.entries(this.tab);
      if (!list.length) { body.innerHTML = '<p class="empty">まだ記録はない。館を調べよう。</p>'; return; }
      if (this.tab === 'evidence') {
        let ch = -1;
        for (const e of list) {
          if (e.ch !== ch) { ch = e.ch; const h = document.createElement('h4'); h.textContent = ELD.CHAPTER_NAMES[ch] || ('第' + ch + '章'); body.appendChild(h); }
          if (e.n) {
            const row = document.createElement('div'); row.className = 'nrowi' + (S.newNotes[e.id] ? ' new' : '');
            row.innerHTML = '<div><b>' + C.esc(C.fmt(e.n.title)) + '</b><span>' + C.esc(e.n.who || '') + '：' + C.esc(C.fmt(e.n.text)) + '</span></div>';
            body.appendChild(row); delete S.newNotes[e.id]; continue;
          }
          const it = ELD.ITEMS[e.item], row = document.createElement('div'); row.className = 'nrowi' + (S.newNotes[e.id] ? ' new' : '');
          row.appendChild(itemCanvas(e.item, 36));
          const t = document.createElement('div'); t.innerHTML = '<b>' + C.esc(it.name) + (S.used.includes(e.item) && !S.inv.includes(e.item) ? ' <em class="u">使用済み</em>' : '') + '</b><span>' + C.esc(it.found || '') + '</span>'; row.appendChild(t);
          if (S.inv.includes(e.item)) { const b = document.createElement('button'); b.className = 'link'; b.textContent = '調べる'; b.onclick = () => Ex.open(e.item); row.appendChild(b); }
          body.appendChild(row); delete S.newNotes[e.id];
        }
        return;
      }
      for (const { n, st } of list) {
        const row = document.createElement('div'); row.className = 'nent' + (S.newNotes[n.id] ? ' new' : '') + (this.focus === n.id ? ' focus' : '');
        const solved = (n.cat === 'mystery' || n.cat === 'question') && st.done;
        row.innerHTML = (n.time ? '<span class="time">' + C.esc(n.time) + '</span>' : '') + '<b>' + C.esc(C.fmt(n.title)) + '</b>' + (n.who ? '<span class="who">' + C.esc(n.who) + '</span>' : '') +
          '<p>' + C.esc(C.fmt(solved ? n.resolvedText : n.text)) + '</p>' + (solved ? '<span class="sv">解決</span>' : '') + '<span class="chp">' + C.esc(ELD.CHAPTER_NAMES[solved ? st.done : st.ch] || '') + '</span>';
        body.appendChild(row); delete S.newNotes[n.id];
        if (this.focus === n.id) setTimeout(() => row.scrollIntoView({ block: 'center' }), 30);
      }
    },
  };

  ELD.ItemUI = {
    init(core) { C = core; Ex.bind(); },
    openInventory() { Inv.open(); }, renderInventory() { Inv.render(); },
    openNotebook() { Note.render(); }, Note, Inv, Ex, drawItemArt,
    closeExamine() { if ($('exOv').classList.contains('show')) { Ex.close(); return true; } return false; },
  };
})();
