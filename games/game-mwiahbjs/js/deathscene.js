/*
 * 死亡ムービー：犠牲者ごとの短い場面（約8秒）。320×180 のドット絵を全画面で再生する。
 * ELD.DeathScene.play(who, done, api)  api = { cell(who), img, sfx(name) }
 * 美月：食堂の毒の紅茶／湊：監視室の消火ガス／黒瀬：鐘楼からの転落／冬子：使用人部屋の紅茶／宗一郎：旧実験室の火災
 */
(function () {
  const ELD = (window.ELD = window.ELD || {});
  const W = 320, H = 180, DUR = 8.4;
  const SC = {
    mizuki: { kind: 'tea', cap: [[0, '非常灯の緑の中で——'], [3.6, '美月の手から、カップが落ちた。']] },
    minato: { kind: 'gas', cap: [[0, '消火ガスが、部屋を満たしていく——'], [4.2, '湊の指は、最後までキーボードに伸びていた。']] },
    kurose: { kind: 'fall', cap: [[0, '鐘楼。入退室ロールを抱えた黒瀬の足元で——'], [3.2, '床板が、音もなく外れた。']] },
    fuyuko: { kind: 'chair', cap: [[0, '使用人の部屋。時計の音だけが聞こえる——'], [3.4, '冬子の膝の上には、渡せなかった手紙が残っていた。']] },
    soichiro: { kind: 'fire', cap: [[0, '鎖の巻かれた扉の向こうで、炎が上がる——'], [5.6, '炎の音が、ふいに止んだ。']] },
  };
  let el, cv, g, capEl, state = null;
  const rnd = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
  const seg = (t, a, b) => ease((t - a) / (b - a));

  function sprite(who, x, y, s, rot, gray, alpha, clipH) {
    const A = state.api, cell = A.cell(who); if (!cell || !A.img) return;
    g.save(); g.globalAlpha = alpha == null ? 1 : alpha;
    if (gray) g.filter = 'grayscale(' + gray + ')';
    g.translate(Math.round(x), Math.round(y)); if (rot) g.rotate(rot);
    const w = cell.w * s, h = (clipH || cell.h) * s;
    g.drawImage(A.img, cell.sx, cell.sy, cell.w, clipH || cell.h, -w / 2, -cell.h * s, w, h);
    g.restore();
  }
  function rain(t, a) { for (let i = 0; i < 40; i++) { const x = (rnd(i, 1) * W + t * 40) % W, y = (rnd(i, 2) * H + t * 260) % H; R(x, y, 1, 5, 'rgba(170,190,220,' + a + ')'); } }

  /* ---- 美月：食堂 ---- */
  function tea(t, who) {
    R(0, 0, W, 112, '#2a141c'); for (let x = 0; x < W; x += 16) R(x, 0, 1, 112, '#33192299');
    R(40, 14, 44, 56, '#0c1424'); R(236, 14, 44, 56, '#0c1424'); R(61, 14, 2, 56, '#3a2418'); R(257, 14, 2, 56, '#3a2418');
    g.save(); g.beginPath(); g.rect(40, 14, 44, 56); g.rect(236, 14, 44, 56); g.clip(); rain(t, 0.5); g.restore();
    R(0, 112, W, 68, '#3a2414'); for (let x = 0; x < W; x += 24) R(x, 112, 1, 68, '#2a180c');
    const slump = seg(t, 3.0, 4.4), shake = t > 1.8 && t < 3.0 ? Math.sin(t * 60) * 1.2 : 0;
    if (slump < 0.35) sprite(who, 160 + shake, 132, 2, slump * 1.25, 0);
    R(30, 116, 260, 40, '#e8e2d4'); R(30, 116, 260, 3, '#a02030'); R(30, 156, 260, 6, '#bdb6a6');
    if (slump >= 0.35) { // テーブルに突っ伏す
      g.save(); g.beginPath(); g.rect(0, 0, W, 150); g.clip();
      sprite(who, 150 + slump * 20, 150, 2, 1.45 * slump, seg(t, 4.5, 7.5)); g.restore();
    }
    for (let i = 0; i < 6; i++) R(46 + i * 44, 126, 12, 3, '#cfc8b8');
    // カップ：テーブルの端から落ちて割れる
    const fall = seg(t, 3.5, 4.1), cx = 196 + fall * 14, cy = 112 + fall * 56;
    if (t < 4.1) { g.save(); g.translate(cx, cy); g.rotate(fall * 2.4); R(-4, -6, 8, 7, '#f4f0e6'); R(-3, -5, 6, 2, '#7a4a20'); g.restore(); }
    else {
      const k = seg(t, 4.1, 4.6);
      for (let i = 0; i < 7; i++) R(cx + (rnd(i, 3) - 0.5) * 30 * k, 168 + (rnd(i, 4) - 0.8) * 10 * k, 2, 2, '#f4f0e6');
      g.fillStyle = 'rgba(110,60,20,0.85)'; g.beginPath(); g.ellipse(cx, 171, 4 + seg(t, 4.1, 7) * 26, 2 + seg(t, 4.1, 7) * 5, 0, 0, 7); g.fill();
    }
    const fl = 0.07 + (Math.sin(t * 23) > 0.6 ? 0.04 : 0) + (rnd(Math.floor(t * 8), 9) > 0.9 ? 0.12 : 0);
    R(0, 0, W, H, 'rgba(40,255,140,' + fl + ')');
  }
  /* ---- 湊：監視室 ---- */
  function gas(t, who) {
    R(0, 0, W, H, '#0a0e14');
    const rows = ['庭の赤外線', 'バックアップ', 'USB'];
    for (let m = 0; m < 3; m++) {
      const x = 52 + m * 76; R(x - 2, 22, 64, 48, '#1c222a'); R(x, 24, 60, 44, '#0c3a48');
      for (let y = 24; y < 68; y += 3) R(x, y, 60, 1, 'rgba(0,0,0,0.25)');
      if (m === 1) {
        g.fillStyle = '#9ff0ff'; g.font = '8px sans-serif'; const n = Math.floor(seg(t, 0.8, 4.6) * 12); let c = 0;
        rows.forEach((r, i) => { const s = r.slice(0, Math.max(0, n - c)); c += r.length; g.fillText(s, x + 4, 36 + i * 11); });
      }
    }
    R(30, 112, 260, 10, '#3a3e46'); R(30, 122, 260, 58, '#22262c'); R(132, 106, 56, 6, '#555a64');
    const fall = seg(t, 3.6, 4.6), shake = t > 2.4 && t < 3.6 ? Math.sin(t * 50) * 1.4 : 0;
    sprite(who, 160 + shake - fall * 6, 112 + fall * 20, 2, -fall * 1.3, seg(t, 4.6, 7.5));
    R(30, 112, 260, 10, '#3a3e46');
    // 警報の赤
    if (Math.sin(t * 9) > 0) R(0, 0, W, 6, 'rgba(255,40,40,0.8)');
    // 白いガスが下から満ちる
    const lvl = seg(t, 0, 5.2);
    for (let i = 0; i < 26; i++) {
      const x = rnd(i, 5) * W + Math.sin(t * 0.7 + i) * 18, y = H - lvl * (H * 0.9) * rnd(i, 6) - 10;
      g.fillStyle = 'rgba(236,240,244,' + (0.18 + lvl * 0.25) + ')'; g.beginPath(); g.ellipse(x, y, 30 + rnd(i, 7) * 30, 14 + rnd(i, 8) * 10, 0, 0, 7); g.fill();
    }
    R(0, H - lvl * H, W, lvl * H, 'rgba(230,234,240,' + lvl * 0.35 + ')');
  }
  /* ---- 黒瀬：鐘楼 ---- */
  function fall(t, who) {
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#05060e'); sky.addColorStop(1, '#1a2238'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 30; i++) R(rnd(i, 1) * W, rnd(i, 2) * 90, 1, 1, 'rgba(255,255,255,' + (0.3 + 0.4 * rnd(i, 3)) + ')');
    R(20, 0, 14, H, '#2a2018'); R(286, 0, 14, H, '#2a2018'); R(20, 0, 280, 10, '#2a2018');
    // 鐘
    const sw = Math.sin(t * 2.2) * (0.08 + seg(t, 3, 3.6) * 0.35);
    g.save(); g.translate(160, 10); g.rotate(sw);
    g.fillStyle = '#6a4a20'; g.beginPath(); g.moveTo(-14, 6); g.quadraticCurveTo(-18, 40, -32, 50); g.lineTo(32, 50); g.quadraticCurveTo(18, 40, 14, 6); g.closePath(); g.fill();
    R(-32, 48, 64, 4, '#8a6a30'); R(-2, 50, 4, 6, '#3a2a10'); g.restore();
    // 床板：割れて落ちる
    const br = seg(t, 3.0, 3.6);
    for (let i = 0; i < 9; i++) {
      const x = 34 + i * 28, mid = i >= 3 && i <= 5;
      if (!mid) { R(x, 128, 27, 8, '#5a3a20'); R(x, 128, 27, 1, '#7a5a34'); continue; }
      g.save(); g.translate(x + 13, 132 + br * br * 80); g.rotate((i - 4) * br * 0.9); R(-13, -4, 27, 8, '#5a3a20'); g.restore();
    }
    const fy = t < 3.1 ? 0 : Math.pow(t - 3.1, 2) * 160;
    if (fy < 260) sprite(who, 160, 128 + fy, 2, (t > 3.1 ? (t - 3.1) * 2.2 : 0), 0);
    if (t > 3.0) for (let i = 0; i < 14; i++) { const k = seg(t, 3, 5); R(110 + rnd(i, 4) * 100, 130 + k * 60 * rnd(i, 5), 2, 2, 'rgba(150,120,90,' + (1 - k) + ')'); }
    if (t > 3.0 && t < 3.4) R(0, 0, W, H, 'rgba(255,255,255,' + (0.4 - (t - 3) ) + ')');
  }
  /* ---- 冬子：使用人の部屋 ---- */
  function chair(t, who) {
    R(0, 0, W, 120, '#2a2420'); R(0, 120, W, 60, '#3a2e24');
    const lamp = 1 - seg(t, 4.2, 7.6) * 0.75;
    const lg = g.createRadialGradient(232, 70, 4, 232, 70, 140); lg.addColorStop(0, 'rgba(255,200,120,' + 0.35 * lamp + ')'); lg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = lg; g.fillRect(0, 0, W, H);
    // 壁の時計と振り子
    R(66, 18, 28, 70, '#4a3020'); g.fillStyle = '#e8dcc0'; g.beginPath(); g.arc(80, 32, 9, 0, 7); g.fill(); R(79, 26, 2, 7, '#222'); R(80, 31, 5, 2, '#222');
    const pa = Math.sin(t * Math.PI) * 0.35; g.save(); g.translate(80, 44); g.rotate(pa); R(-1, 0, 2, 32, '#b08a40'); g.beginPath(); g.fillStyle = '#c8a050'; g.arc(0, 34, 4, 0, 7); g.fill(); g.restore();
    R(226, 50, 12, 20, '#8a6a40'); R(222, 46, 20, 6, '#e8d0a0');
    // 椅子と冬子
    R(130, 82, 60, 50, '#5a3a24'); R(126, 126, 68, 10, '#4a3020');
    const tilt = seg(t, 3.6, 6.2) * 0.22;
    sprite(who, 160, 138, 2, tilt, seg(t, 4.5, 7.8), 1, 40);
    R(150, 120, 20, 12, '#f2ecdc'); R(150, 120, 20, 1, '#c8b890'); // 膝の上の手紙
    R(196, 118, 40, 6, '#4a3020'); R(206, 124, 4, 30, '#4a3020'); R(222, 124, 4, 30, '#4a3020');
    const cf = seg(t, 3.0, 3.4);
    if (t < 3.4) { R(212, 110, 8, 7, '#f4f0e6'); R(213, 111, 6, 2, '#5a3a18'); }
    else { g.save(); g.translate(214 + cf * 10, 117 + 50); g.rotate(1.4); R(-4, -3, 8, 7, '#f4f0e6'); g.restore(); g.fillStyle = 'rgba(90,50,20,0.7)'; g.beginPath(); g.ellipse(222, 168, 4 + seg(t, 3.4, 7) * 16, 2 + seg(t, 3.4, 7) * 3, 0, 0, 7); g.fill(); }
    R(206, 116, 20, 2, '#d8d0c0');
  }
  /* ---- 宗一郎：旧実験室 ---- */
  function fire(t, who) {
    R(0, 0, W, H, '#1a1c20'); for (let x = 0; x < W; x += 32) R(x, 0, 1, 130, '#2a2e34');
    R(0, 130, W, 50, '#2a2a2c');
    // 鎖の巻かれた扉
    R(250, 40, 50, 92, '#3a3e44'); R(254, 44, 42, 84, '#2c3036');
    for (let i = 0; i < 10; i++) { R(252 + i * 4.5, 70 + i * 3, 4, 3, '#9a9aa0'); R(252 + i * 4.5, 100 - i * 3, 4, 3, '#9a9aa0'); }
    const quiet = seg(t, 5.4, 5.9), fallk = seg(t, 3.8, 5.0);
    sprite(who, 140, 140 + fallk * 6, 2, fallk * 1.2, seg(t, 5.4, 7.8), 1, 36 + Math.round(fallk * 12));
    R(150, 118 - fallk * 4, 8, 6, '#f2ecdc');
    // 炎
    const n = 80, hgt = seg(t, 0, 3.2);
    for (let i = 0; i < n; i++) {
      const x = rnd(i, 1) * W, ph = (t * (1.6 + rnd(i, 2)) + rnd(i, 3)) % 1, hh = (40 + rnd(i, 4) * 120) * hgt * (1 - quiet);
      const y = 178 - ph * hh, s = (1 - ph) * (6 + rnd(i, 5) * 8) * (1 - quiet);
      if (s <= 0.3) continue;
      g.fillStyle = ph < 0.3 ? '#fff0a0' : ph < 0.6 ? '#ffa030' : '#d03010'; g.globalAlpha = 0.85;
      g.beginPath(); g.ellipse(x, y, s * 0.6, s, 0, 0, 7); g.fill(); g.globalAlpha = 1;
    }
    R(0, 0, W, H, 'rgba(255,90,20,' + (0.12 + Math.sin(t * 20) * 0.04) * (1 - quiet) + ')');
    // 煙が上から降りてくる
    const sm = seg(t, 1, 6.5); R(0, 0, W, sm * 120, 'rgba(20,18,18,' + (0.5 + quiet * 0.3) + ')');
  }
  const KIND = { tea, gas, fall, chair, fire };

  function frame(now) {
    if (!state) return;
    const t = (now - state.t0) / 1000, sc = SC[state.who] || SC.mizuki;
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.filter = 'none'; g.globalAlpha = 1;
    R(0, 0, W, H, '#000');
    try { KIND[sc.kind](t, state.who); } catch (e) { console.error(e); }
    // 白黒へ・周辺を暗く・最後は暗転
    const dk = seg(t, 6.4, DUR); if (dk > 0) R(0, 0, W, H, 'rgba(0,0,0,' + dk + ')');
    const fi = 1 - seg(t, 0, 0.6); if (fi > 0) R(0, 0, W, H, 'rgba(0,0,0,' + fi + ')');
    let cap = ''; for (const [at, s] of sc.cap) if (t >= at) cap = s;
    if (capEl.textContent !== cap) { capEl.textContent = cap; capEl.classList.remove('in'); void capEl.offsetWidth; capEl.classList.add('in'); }
    for (const ev of state.events) if (!ev.done && t >= ev.at) { ev.done = true; state.api.sfx(ev.s); }
    if (t >= DUR) { end(); return; }
    state.raf = requestAnimationFrame(frame);
  }
  function end() {
    if (!state) return; cancelAnimationFrame(state.raf);
    const d = state.done; state = null;
    el.classList.add('fade'); setTimeout(() => { el.classList.remove('show', 'fade'); }, 500);
    d && d();
  }
  const SND = { mizuki: [[3.9, 'shatter'], [4.2, 'fail']], minato: [[0.2, 'alarm'], [1.6, 'alarm'], [3.0, 'alarm'], [4.5, 'fail']], kurose: [[3.0, 'rumble'], [3.3, 'bell']], fuyuko: [[0.5, 'tick'], [1.5, 'tick'], [2.5, 'tick'], [3.2, 'shatter'], [4.5, 'tick'], [6, 'tick']], soichiro: [[0.2, 'rumble'], [2.5, 'rumble'], [5.4, 'fail']] };
  ELD.DeathScene = {
    get open() { return !!state; },
    play(who, done, api) {
      el = document.getElementById('deathScene'); if (!el || !SC[who]) { done && done(); return; }
      cv = document.getElementById('dsCanvas'); capEl = document.getElementById('dsCap');
      cv.width = W; cv.height = H; g = cv.getContext('2d');
      state = { who, done, api, t0: performance.now(), events: (SND[who] || []).map(([at, s]) => ({ at, s })) };
      capEl.textContent = '';
      el.classList.remove('fade'); el.classList.add('show');
      state.raf = requestAnimationFrame(frame);
    },
    skip() { if (state && performance.now() - state.t0 > 800) end(); },
  };
})();
