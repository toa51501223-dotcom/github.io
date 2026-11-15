/* =====================================================================
 * エルディア館 ゲームエンジン
 *   データ(ELD.ROOMS) と 描画(ELD.buildBG / PAINT) を受け取り、
 *   部屋構築・衝突判定・移動・扉/階段・照明・調査・地図・セーブを担当
 * ===================================================================== */
(function () {
  'use strict';
  const ELD = window.ELD;
  const T = ELD.T;
  const { css, mix, mul } = ELD.util;
  const Game = (ELD.Game = {});

  /* ---------------- 状態 ---------------- */
  const SAVE_VER = 1;
  const BASE_MIN = 18 * 60; // 内部時刻は18:00からの経過分
  const T_STOP = 350, T_MAX = 630, T_DAWN = 690; // 23:50 / 4:30 / 5:30
  let S = null;            // セーブ対象の状態
  let rt = null;           // 現在の部屋（実行時データ）
  const settings = { markers: true, textSpeed: 45 };
  const view = { w: 320, h: 180, scale: 3, camX: 0, camY: 0 };
  const input = { keys: new Set(), steer: null, path: null, pathT: 0, pendingAct: null, armed: null, analog: null };
  let doorAnim = {}; // 扉の開き具合 0〜1（主人公が近づくと開く）
  let anim = { t: 0, frame: 0, ft: 0, moving: false };
  let mode = 'title';      // title | play | dialog | overlay | trans | ending
  let trans = null;        // {a, phase, cb}
  let bump = { tile: -1, t: 0, shown: false };
  let lastTile = -1;
  let canvas, ctx, lcv, lctx;
  let started = false;

  function newState() {
    return {
      v: SAVE_VER, room: ELD.START.room, x: ELD.START.x * T, y: ELD.START.y * T + 11, dir: ELD.START.dir,
      name: '', inv: (ELD.START.inv || ['sealed_letter', 'locket']).slice(), used: [], flags: {}, opened: {}, visited: {}, examined: {},
      time: ELD.START.clock != null ? toT(ELD.START.clock) : T_STOP, play: 0,
      notes: {}, newNotes: {}, chapter: 1, trust: Object.assign({}, ELD.START.trust || {}), unity: ELD.START.unity != null ? ELD.START.unity : 5,
      met: {}, face: {}, choices: {}, victims: [], endings: [], clears: [],
    };
  }

  // 'HH:MM' → 内部時刻（18:00 からの経過分。18時より前は負の値）
  function toT(hm) { const [h, m] = String(hm).split(':').map(Number); let t = h * 60 + m - BASE_MIN; if (t < -360) t += 1440; return t; }

  /* ---------------- 主人公の名前（プレイヤー入力） ---------------- */
  const NAME_MAX = 10; // 書記素（見た目の1文字）単位
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('ja', { granularity: 'grapheme' }) : null;
  const graphemes = (str) => (seg ? Array.from(seg.segment(str), (x) => x.segment) : Array.from(str));
  function cleanName(raw) {
    let n = String(raw == null ? '' : raw).normalize('NFC');
    n = n.replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, '').replace(/[\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '');
    return n.replace(/[\s\u3000]+/g, ' ').trim();
  }
  function nameError(n) {
    if (!n) return '名前を入力してください。';
    if (graphemes(n).length > NAME_MAX) return NAME_MAX + '文字以内で入力してください。';
    return '';
  }
  // 文中の {name} を主人公の名前に置き換える（1回だけ置換し、名前の中身は再解釈しない）
  const fmt = (line) => (typeof line === 'string' ? line.replace(/\{name\}/g, () => (S && S.name) || '') : line);
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /* ---------------- 条件 ---------------- */
  const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
  const has = (i) => S.inv.includes(i);
  let curUsing = null; // 持ち物から「使う」で選んだアイテム（調べる対象に突きつける）
  const flag = (f) => !!S.flags[f];
  function cond(c) {
    if (!c) return true;
    if (!arr(c.has).every(has)) return false;
    if (arr(c.lacks).some(has)) return false;
    if (!arr(c.flag).every(flag)) return false;
    if (arr(c.noflag).some(flag)) return false;
    if (c.using && c.using !== curUsing) return false;
    if (c.room && arr(c.room).indexOf(S.room) < 0) return false;
    if (c.anyflag && Array.isArray(c.anyflag) && !c.anyflag.some(flag)) return false;
    if (c.anyflag && typeof c.anyflag === 'string' && !flag(c.anyflag)) return false;
    if (c.anyHas && !arr(c.anyHas).some(has)) return false;
    if (c.anyCond && !(ELD.COND_FN && ELD.COND_FN[c.anyCond] && ELD.COND_FN[c.anyCond](S))) return false;
    if (c.visited && !arr(c.visited).every((r) => S.visited[r])) return false;
    if (c.examined && !arr(c.examined).every((r) => S.examined[r])) return false;
    if (c.unityMax != null && (S.unity == null ? 5 : S.unity) > c.unityMax) return false;
    if (c.trustMin) for (const k in c.trustMin) if ((S.trust[k] || 0) < c.trustMin[k]) return false;
    if (c.trustMax) for (const k in c.trustMax) if ((S.trust[k] || 0) > c.trustMax[k]) return false;
    return true;
  }
  const visibleBy = (o) => !(o.hideIf && flag(o.hideIf)) && !(o.showIf && !flag(o.showIf)) && (!o.vis || cond(o.vis));

  /* ---------------- 出口 ---------------- */
  const pairKey = (roomId, ex) => [roomId + ':' + ex.id, ex.to].sort().join('|');
  function exitState(roomId, ex) {
    const visible = !ex.hidden || flag(ex.hidden);
    let open = visible;
    if (visible && ex.lock) {
      if (ex.lock.item) open = !!S.opened[pairKey(roomId, ex)];
      else if (ex.lock.flag) open = flag(ex.lock.flag);
    }
    return { visible, open };
  }
  function exitTiles(d, ex) {
    const out = [];
    const w = ex.w || 1;
    if (ex.side === 'N') for (let i = 0; i < w; i++) out.push([ex.at + i, 1, true], [ex.at + i, 0, false]);
    else if (ex.side === 'S') for (let i = 0; i < w; i++) out.push([ex.at + i, d.H - 1, true]);
    else if (ex.side === 'W') for (let i = 0; i < w; i++) out.push([0, ex.at + i, true]);
    else if (ex.side === 'E') for (let i = 0; i < w; i++) out.push([d.W - 1, ex.at + i, true]);
    else for (let yy = 0; yy < ex.h; yy++) for (let xx = 0; xx < ex.w; xx++) out.push([ex.x + xx, ex.y + yy, true]);
    return out;
  }
  function arrival(d, ex) {
    const w = ex.w || 1;
    switch (ex.side) {
      case 'N': return { x: (ex.at + w / 2) * T, y: 2 * T + 11, dir: 'down' };
      case 'S': return { x: (ex.at + w / 2) * T, y: (d.H - 2) * T + 11, dir: 'up' };
      case 'W': return { x: T + 8, y: ex.at * T + (w * T) / 2 + 3, dir: 'right' };
      case 'E': return { x: (d.W - 2) * T + 8, y: ex.at * T + (w * T) / 2 + 3, dir: 'left' };
      default: return { x: ex.spawn[0] * T + 8, y: ex.spawn[1] * T + 11, dir: 'down' };
    }
  }

  /* ---------------- 部屋構築 ---------------- */
  function buildRoom(id) {
    const d = ELD.ROOMS[id];
    const W = d.W, H = d.H;
    const solid = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (y <= 1 || y === H - 1 || x === 0 || x === W - 1) solid[y * W + x] = 1;
    for (const v of d.voids || []) for (let y = v.y; y < v.y + v.h; y++) for (let x = v.x; x < v.x + v.w; x++) solid[y * W + x] = 1;
    const es = {}, trig = new Map(), exT = new Map();
    // 家具（足元を固体化）
    const furn = [];
    for (const f0 of d.furn || []) {
      if (!visibleBy(f0)) continue;
      const def = ELD.FD[f0.t] || {};
      const f = Object.assign({}, f0);
      f.w = f.w || def.w || 1; f.h = f.h || def.h || 1;
      if (f.openIf) f._open = flag(f.openIf);
      if (f.onIf) f._on = flag(f.onIf);
      if (f.brokenIf) f._broken = flag(f.brokenIf);
      if (f.t === 'workbench') f._card = !flag('got_card');
      if (f.t === 'person' && S.face && S.face[f.who]) f.dir = S.face[f.who];
      const o = { f, def, wall: !!def.wall, over: !!def.over, anim: !!def.anim, sprite: null };
      if (!def.wall && !def.over && !def.nosolid) for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) if (x >= 0 && y >= 0 && x < W && y < H) solid[y * W + x] = 1;
      furn.push(o);
    }
    // 出口（家具より後に処理し、通路を確保）
    for (const ex of d.exits) {
      const st = exitState(id, ex);
      es[ex.id] = st;
      if (!st.visible) continue;
      for (const [tx, ty, walk] of exitTiles(d, ex)) {
        const k = ty * W + tx;
        exT.set(k, ex);
        if (walk && st.open) { solid[k] = 0; trig.set(k, ex); }
        else solid[k] = 1;
      }
    }
    const SS = stateForPaint();
    for (const o of furn) if (!o.anim) o.sprite = ELD.spriteFor(o.f, SS);
    // 光源
    const lights = [];
    for (const o of furn) {
      const L = o.def.light; if (!L) continue;
      const f = o.f;
      if (f.t === 'fireplace' && f.cold) continue;
      if (f.t === 'core' && f._broken) { lights.push({ x: f.x * T + 16, y: f.y * T, r: 90, c: [255, 220, 240], fl: 0.1 }); continue; }
      if (L.wide) { for (let i = 0; i < f.w; i++) lights.push({ x: (f.x + i) * T + 8, y: f.y * T + L.dy, r: L.r * 0.7, c: L.c, fl: L.fl || 0 }); continue; }
      lights.push({ x: f.x * T + (L.dx === 16 && f.w > 2 ? (f.w * T) / 2 : L.dx), y: f.y * T + L.dy, r: L.r, c: L.c, fl: L.fl || 0, seed: f.x * 3 + f.y });
    }
    for (const o of furn) if (o.f.t === 'pedestal' && o.f._on) lights.push({ x: o.f.x * T + 8, y: o.f.y * T - 8, r: 42, c: o.f.v === 'sun' ? [255, 200, 90] : [150, 180, 255], fl: 0.2 });
    for (const l of d.lights || []) lights.push({ x: l.x * T, y: l.y * T, r: l.r, c: l.c, fl: 0 });
    if (d.ground === 'ritual') lights.push({ x: (W * T) / 2, y: (H * T) / 2 + 8, r: 120, c: [120, 80, 200], fl: 0.15 });
    const windows = furn.filter((o) => o.f.t === 'window').map((o) => ({ x: o.f.x * T + 3, w: o.f.w * T - 6 }));
    const ins = (d.ins || []).filter(visibleBy).map((i) => Object.assign({ w: 1, h: 1 }, i));
    const bg = ELD.buildBG(d, es);
    rt = { id, d, W, H, solid, trig, exT, es, furn, lights, windows, ins, bg };
    for (const k of Object.keys(doorAnim)) if (!es[k] || !es[k].open) delete doorAnim[k];
    return rt;
  }
  function stateForPaint() {
    return { time: clockMin(), running: flag('tower_running') || flag('clock_moving'), dawn: dawnK() };
  }
  const rebuild = () => {
    const x = S.x, y = S.y; buildRoom(S.room); S.x = x; S.y = y;
    if (blocked(S.x, S.y)) unstick();
    lastTile = tileIdx(S.x, S.y - 3);
  };
  // 状態変化で足元に家具が現れた場合などに、最寄りの空き床へ退避
  function unstick() {
    const sx = Math.floor(S.x / T), sy = Math.floor((S.y - 3) / T);
    let best = null, bd = 1e9;
    for (let y = 1; y < rt.H - 1; y++) for (let x = 1; x < rt.W - 1; x++) {
      const k = y * rt.W + x; if (rt.solid[k] || rt.trig.has(k)) continue;
      const d = Math.abs(x - sx) + Math.abs(y - sy); if (d < bd) { bd = d; best = [x, y]; }
    }
    if (best) { S.x = best[0] * T + 8; S.y = best[1] * T + 11; }
  }

  /* ---------------- 衝突判定 ---------------- */
  function solidTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= rt.W || ty >= rt.H) return true;
    return rt.solid[ty * rt.W + tx] === 1;
  }
  // 足元の当たり判定矩形: 幅10 × 高さ6
  function blocked(x, y) {
    const l = Math.floor((x - 5) / T), r = Math.floor((x + 4) / T), t = Math.floor((y - 5) / T), b = Math.floor(y / T);
    for (let ty = t; ty <= b; ty++) for (let tx = l; tx <= r; tx++) if (solidTile(tx, ty)) return true;
    return false;
  }
  const tileIdx = (x, y) => Math.floor(y / T) * rt.W + Math.floor(x / T);

  function moveBy(dx, dy) {
    let moved = false;
    if (dx) {
      const nx = S.x + dx;
      if (!blocked(nx, S.y)) { S.x = nx; moved = true; }
      else if (!dy) {
        for (let k = 1; k <= 5; k++) {
          if (!blocked(nx, S.y - k) && !blocked(S.x, S.y - k)) { S.y -= Math.min(1, k); moved = true; break; }
          if (!blocked(nx, S.y + k) && !blocked(S.x, S.y + k)) { S.y += Math.min(1, k); moved = true; break; }
        }
      }
    }
    if (dy) {
      const ny = S.y + dy;
      if (!blocked(S.x, ny)) { S.y = ny; moved = true; }
      else if (!dx) {
        for (let k = 1; k <= 5; k++) {
          if (!blocked(S.x - k, ny) && !blocked(S.x - k, S.y)) { S.x -= Math.min(1, k); moved = true; break; }
          if (!blocked(S.x + k, ny) && !blocked(S.x + k, S.y)) { S.x += Math.min(1, k); moved = true; break; }
        }
      }
    }
    return moved;
  }

  /* ---------------- 経路探索（BFS） ---------------- */
  function bfs(sx, sy, goalFn) {
    const W = rt.W, H = rt.H, N = W * H;
    const prev = new Int32Array(N).fill(-2);
    const q = [sy * W + sx]; prev[q[0]] = -1;
    let head = 0;
    while (head < q.length) {
      const k = q[head++], x = k % W, y = (k / W) | 0;
      if (goalFn(x, y)) {
        const path = []; let c = k;
        while (c !== -1) { path.push([c % W, (c / W) | 0]); c = prev[c]; }
        return path.reverse();
      }
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ax, ny = y + ay;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nk = ny * W + nx;
        if (prev[nk] !== -2 || rt.solid[nk]) continue;
        if (rt.trig.has(nk) && !goalFn(nx, ny)) continue; // 途中の出口は踏まない
        prev[nk] = k; q.push(nk);
      }
    }
    return null;
  }
  const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  function targetsAt(tx, ty) {
    const res = [];
    for (const i of rt.ins) if (tx >= i.x && tx < i.x + i.w && ty >= i.y && ty < i.y + i.h) res.push({ kind: 'ins', o: i });
    const ex = rt.exT.get(ty * rt.W + tx);
    if (ex) res.push({ kind: 'exit', o: ex });
    return res;
  }
  // 画面タップ / テスト用: 指定タイルへ移動（対象があれば調べる）
  function planTo(tx, ty, opts) {
    const sx = Math.floor(S.x / T), sy = Math.floor((S.y - 3) / T);
    const tg = targetsAt(tx, ty).concat(ty + 1 < rt.H ? targetsAt(tx, ty + 1).filter((t) => t.kind === 'ins' && (t.o.y <= 1)) : []);
    let path = null, act = null;
    const ins = tg.find((t) => t.kind === 'ins');
    const ex = tg.find((t) => t.kind === 'exit');
    if (ex && rt.es[ex.o.id].open) {
      const k = rt.W;
      path = bfs(sx, sy, (x, y) => rt.trig.get(y * k + x) === ex.o);
    } else if (ins || ex) {
      const inside = (x, y) => (ins ? x >= ins.o.x && x < ins.o.x + ins.o.w && y >= ins.o.y && y < ins.o.y + ins.o.h : rt.exT.get(y * rt.W + x) === ex.o);
      path = bfs(sx, sy, (x, y) => Object.keys(DIRV).some((d) => inside(x + DIRV[d][0], y + DIRV[d][1])));
      if (path) {
        const [lx, ly] = path[path.length - 1];
        const dir = Object.keys(DIRV).find((d) => inside(lx + DIRV[d][0], ly + DIRV[d][1]));
        act = { dir };
      }
    } else if (!solidTile(tx, ty)) {
      path = bfs(sx, sy, (x, y) => x === tx && y === ty);
    } else {
      path = bfs(sx, sy, (x, y) => Math.abs(x - tx) + Math.abs(y - ty) <= 1);
    }
    if (!path) return false;
    input.path = path.slice(1).map(([x, y]) => [x * T + 8, y * T + 11]);
    input.pathT = 0; input.pendingAct = act;
    if (!input.path.length && act) { S.dir = act.dir; input.pendingAct = null; interact(); }
    return true;
  }

  /* ---------------- 時刻・雰囲気 ---------------- */
  const clockMin = () => (BASE_MIN + S.time) % 1440;
  const dawnK = () => Math.max(0, Math.min(1, (S.time - 640) / 50));
  function fmtTime() { const m = Math.floor(clockMin()); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  function ambient() {
    const a = rt.d.amb || [60, 60, 80];
    const t = S.time;
    let k = 1;
    if (t > T_STOP) k = 1 - Math.sin(Math.min(1, (t - T_STOP) / (T_MAX - T_STOP)) * Math.PI) * 0.12;
    let c = mul(a, k);
    const dk = dawnK();
    if (dk > 0) c = mix(c, [Math.min(255, a[0] * 1.9 + 40), Math.min(255, a[1] * 1.6 + 30), Math.min(255, a[2] * 1.4 + 20)], dk);
    return c;
  }

  /* ---------------- 入力 → 移動 ---------------- */
  function update(dt) {
    anim.t += dt;
    if (S && (mode === 'play' || mode === 'dialog' || mode === 'overlay')) S.play += dt;
    if (S && mode === 'play') {
      if (flag('truth_known')) S.time = Math.min(T_DAWN, Math.max(S.time, T_MAX - 20) + dt * 4);
      else if (flag('tower_running')) S.time = Math.min(T_MAX, S.time + dt * 0.5);
    }
    if (trans) {
      trans.a += dt * (trans.phase === 'out' ? 5 : -4);
      if (trans.phase === 'out' && trans.a >= 1) { trans.a = 1; trans.cb(); trans.phase = 'in'; }
      else if (trans.phase === 'in' && trans.a <= 0) { trans = null; if (mode === 'trans') mode = 'play'; }
      return;
    }
    if (rt && S) tickDoors(dt, false);
    if (mode !== 'play') { anim.moving = false; return; }
    let vx = 0, vy = 0;
    const K = input.keys;
    if (K.has('ArrowLeft') || K.has('KeyA')) vx -= 1;
    if (K.has('ArrowRight') || K.has('KeyD')) vx += 1;
    if (K.has('ArrowUp') || K.has('KeyW')) vy -= 1;
    if (K.has('ArrowDown') || K.has('KeyS')) vy += 1;
    let spMul = 1;
    if (vx || vy) { input.path = null; input.pendingAct = null; }
    else if (input.analog && input.analog.m > 0) {
      // バーチャルスティック：360度・傾きに応じた速度
      vx = input.analog.x; vy = input.analog.y; spMul = 0.35 + 0.65 * input.analog.m; input.path = null;
    } else if (input.steer) {
      const px = S.x - view.camX, py = S.y - 10 - view.camY;
      const dx = input.steer.x - px, dy = input.steer.y - py, dl = Math.hypot(dx, dy);
      if (dl > 6) { vx = dx / dl; vy = dy / dl; }
    } else if (input.path) {
      const nd = input.path[0];
      if (!nd) { input.path = null; }
      else {
        const dx = nd[0] - S.x, dy = nd[1] - S.y, dl = Math.hypot(dx, dy);
        if (dl < 1.6) { S.x = nd[0]; S.y = nd[1]; input.path.shift(); input.pathT = 0; if (!input.path.length) { input.path = null; if (input.pendingAct) { S.dir = input.pendingAct.dir; input.pendingAct = null; interact(); } } }
        else { vx = dx / dl; vy = dy / dl; input.pathT += dt; if (input.pathT > 1.2) { input.path = null; input.pendingAct = null; } }
      }
    }
    const run = K.has('ShiftLeft') || K.has('ShiftRight');
    const sp = 74 * (run ? 1.55 : 1) * spMul * dt;
    if (vx || vy) {
      const l = Math.hypot(vx, vy); vx /= l; vy /= l;
      if (Math.abs(vx) > Math.abs(vy) + 0.01) S.dir = vx < 0 ? 'left' : 'right'; else S.dir = vy < 0 ? 'up' : 'down';
      let mx = vx * sp, my = vy * sp;
      if (input.path) { const nd = input.path[0]; if (nd) { const rem = Math.hypot(nd[0] - S.x, nd[1] - S.y); if (rem < sp) { mx = nd[0] - S.x; my = nd[1] - S.y; } } }
      const steps = Math.ceil(Math.max(Math.abs(mx), Math.abs(my)) / 2);
      let any = false;
      for (let i = 0; i < steps; i++) any = moveBy(mx / steps, my / steps) || any;
      anim.moving = any;
      if (any) { anim.ft += dt * (run ? 1.5 : 1); if (anim.ft > 0.13) { anim.ft = 0; anim.frame++; if (anim.frame % 2 === 0) Audio.step(); } }
      // 鍵付き扉への体当たり
      const fx = S.x + DIRV[S.dir][0] * 8, fy = S.y - 3 + DIRV[S.dir][1] * 8;
      const fk = tileIdx(fx, fy), ex = rt.exT.get(fk);
      if (!any && ex && !rt.es[ex.id].open) {
        if (bump.tile !== fk) { bump.tile = fk; bump.t = 0; bump.shown = false; }
        bump.t += dt;
        if (bump.t > 0.25 && !bump.shown) { bump.shown = true; input.path = null; lockInteract(ex); }
      } else if (any) { bump.tile = -1; }
    } else anim.moving = false;
    // 出口判定
    const k = tileIdx(S.x, S.y - 3);
    if (k !== lastTile) {
      const ex = rt.trig.get(k);
      lastTile = k;
      if (ex) useExit(ex);
    }
  }

  /* ---------------- 部屋移動 ---------------- */
  function useExit(ex) {
    input.path = null; input.steer = null; input.pendingAct = null;
    if (ex.to !== '@none') tickDanger();
    S.opened[pairKey(rt.id, ex)] = true;
    if (ex.to === '@outside') { Audio.sfx('door'); startEnding(); return; }
    if (ex.to === '@none') { mode = 'play'; return; }
    if (ex.to === '@start') { arriveYard(false); return; }
    const [rid, eid] = ex.to.split(':');
    const d = ELD.ROOMS[rid];
    const tex = d.exits.find((e) => e.id === eid);
    if (tex.hidden && !flag(tex.hidden)) S.flags[tex.hidden] = true; // 反対側から隠し通路を発見
    Audio.sfx(ex.side === 'U' || ex.side === 'D' ? 'stairs' : 'door');
    mode = 'trans';
    trans = { a: 0, phase: 'out', cb: () => enterRoom(rid, arrival(d, tex)) };
  }
  function enterRoom(rid, pos) {
    const first = !S.visited[rid];
    const prevArea = rt ? rt.d.area : null;
    S.room = rid; S.visited[rid] = true;
    if (!ELD.STORY) S.chapter = Math.max(S.chapter || 1, (ELD.CHAPTERS && ELD.CHAPTERS[ELD.ROOMS[rid].area]) || 1);
    buildRoom(rid);
    S.x = pos.x; S.y = pos.y; S.dir = pos.dir;
    lastTile = tileIdx(S.x, S.y - 3);
    snapCam();
    doorAnim = {}; tickDoors(0, true);
    UI.hud();
    if ((first || prevArea !== rt.d.area) && !S.noBanner) UI.banner(ELD.AREAS[rt.d.area].name, rt.d.name, first);
    Audio.area(bgmKey());
    afterChange();
    if (rid === (ELD.RETRY_ROOM || 'final_hall') && !S.flags.truth_known) saveRetry();
  }

  /* ---------------- 調べる ---------------- */
  function frontTile() {
    const v = DIRV[S.dir];
    return [Math.floor((S.x + v[0] * 12) / T), Math.floor((S.y - 3 + v[1] * 12) / T)];
  }
  function frontTarget() {
    if (!rt) return null;
    const [tx, ty] = frontTile();
    const ins = rt.ins.find((i) => tx >= i.x && tx < i.x + i.w && ty >= i.y && ty < i.y + i.h);
    if (ins) return { kind: 'ins', o: ins };
    const ex = rt.exT.get(ty * rt.W + tx);
    if (ex && !rt.es[ex.id].open) return { kind: 'exit', o: ex };
    return null;
  }
  function interact() {
    if (mode !== 'play') return false;
    const t = frontTarget();
    if (!t) {
      if (input.armed) { Audio.sfx('fail'); say(['ここには使えそうなものがない。']); }
      return false;
    }
    const using = input.armed;
    if (using) disarm();
    if (t.kind === 'ins') runInspect(t.o, using); else lockInteract(t.o, using);
    return true;
  }
  function arm(id) { if (!has(id)) return false; input.armed = id; UI.armed(); return true; }
  function disarm() { input.armed = null; UI.armed(); }
  function lockInteract(ex, using) {
    const L = ex.lock || {};
    if (using && using !== L.item) { Audio.sfx('fail'); say(['【' + ELD.ITEMS[using].name + '】は、この扉には合わない。']); return; }
    if (L.item && has(L.item)) {
      S.opened[pairKey(rt.id, ex)] = true;
      Audio.sfx('unlock');
      doorAnim[ex.id] = 0;
      rebuild();
      say(['【' + ELD.ITEMS[L.item].name + '】を使った。', '鍵が開いた！']);
      return;
    }
    Audio.sfx('locked');
    say(L.msg || ['開かない。']);
  }
  function runInspect(ins, using) {
    curUsing = using || null;
    // 「使う」時は using 指定の行動だけ、通常の調査では using 指定の行動を除外
    const act = (ins.acts || []).find((a) => (using ? a.if && a.if.using === using : !(a.if && a.if.using)) && cond(a.if));
    curUsing = null;
    S.examined[ins.id] = true;
    if (!act) {
      if (using) { Audio.sfx('fail'); say(['【' + ELD.ITEMS[using].name + '】を使ってみたが、何も起こらない。'], afterChange); }
      else afterChange();
      return;
    }
    if (!act.code && !ins.rescue) tickDanger();
    if (ins.npc) { S.met[ins.npc] = true; const opp = { up: 'down', down: 'up', left: 'right', right: 'left' }; S.face[ins.npc] = opp[S.dir] || 'down'; }
    if (act.code) { openCode(act); return; }
    const lines = (act.sayFn ? act.sayFn(S) : act.say || []).slice();
    talkingNpc = ins.npc || null;
    effects(act);
    for (const tk of arr(act.take)) takeItem(tk);
    for (const gv of arr(act.give)) if (gv && !has(gv) && !S.used.includes(gv)) { giveItem(gv); lines.push({ item: gv }); }
    const before = JSON.stringify(S.flags);
    for (const f of arr(act.set)) S.flags[f] = true;
    if (act.event === 'piano') Audio.piano(); else if (act.event === 'plink') Audio.plink();
    if (act.event === 'finale') { Audio.sfx('bell'); }
    if (act.sfx) Audio.sfx(act.sfx);
    if (act.give) setTimeout(() => Audio.sfx(arr(act.give).some((g) => ELD.ITEMS[g] && ELD.ITEMS[g].important) ? 'important' : 'item'), act.sfx ? 350 : 0);
    const changed = before !== JSON.stringify(S.flags) || act.take || ins.npc;
    say(lines, () => { if (act.heroDeath) Death.dead(act.heroDeath); else if (act.ending) startEnding(); else if (act.chapterEnd) chapterEnd(act.chapterEnd); else applyRules(); });
    if (changed) rebuild();
  }
  // 信頼度・結束・時刻・章などの共通効果（調査の行動とルールの両方で使う）
  function effects(o) {
    if (o.trust) for (const k in o.trust) { S.trust[k] = Math.max(0, Math.min(5, (S.trust[k] || 0) + o.trust[k])); }
    if (o.unity) S.unity = Math.max(0, Math.min(10, (S.unity == null ? 5 : S.unity) + o.unity));
    if (o.clock) S.time = toT(o.clock);
    if (o.chapter) S.chapter = o.chapter;
    if (o.face) Object.assign(S.face, o.face);
    for (const m of arr(o.meet)) S.met[m] = true;
    for (const f of arr(o.unset)) delete S.flags[f];
    for (const it of arr(o.burn)) { const k = S.inv.indexOf(it); if (k >= 0) { S.inv.splice(k, 1); S.flags['burned_' + it] = true; } }
    if (o.checkpoint) saveCheckpoint();
    if (o.kill) { // 犠牲者：名前・章・死因を記録し、結束を下げる。倒れた姿を残し、死亡の演出を出す
      const k = o.kill, info = (ELD.CAST_INFO || []).find((p) => p.id === k.id);
      if (!(S.victims || []).some((v) => v.id === k.id)) {
        S.victims.push({ id: k.id, name: info ? info.name : k.id, ch: k.ch || S.chapter, cause: k.cause || '' }); S.flags['dead_' + k.id] = true; S.unity = Math.max(0, (S.unity == null ? 5 : S.unity) - 2);
        if (k.at) { S.bodies = S.bodies || []; S.bodies.push({ who: k.id, room: k.at[0], x: k.at[1], y: k.at[2] }); }
        const args = [k.id, info ? info.name : k.id, k.cause || '', k.ch || S.chapter];
        if (k.cue) pendingCard = { m: k.cue, a: args, fx: k.fx }; else Death.card(...args); // cue：その台詞が出た瞬間に名札を出す
      }
    }
    if (o.danger) { saveCheckpoint(); S.danger = { id: o.danger.id, left: o.danger.moves, fail: o.danger.fail, label: o.danger.label || '' }; UI.toast('危険：' + (o.danger.label || '') + '　残り ' + o.danger.moves + ' 手'); }
    if (o.endDanger) S.danger = null;
    if (o.danger || o.endDanger) setTimeout(() => Audio.area(bgmKey()), 0);
    if (o.fx) FX.play(o.fx);
    if (o.retryPoint) setTimeout(saveRetry, 0);
  }
  /* やり直し地点：危険の直前や命に関わる選択の直前に保存し、死んだら戻れるようにする */
  let pendingCard = null;
  const CP_KEY = 'eldia_checkpoint';
  function saveCheckpoint(pending) { if (!S || !S.name) return; const snap = JSON.parse(JSON.stringify(snapshot())); snap.danger = S.danger ? Object.assign({}, S.danger) : null; snap.pending = pending || null; store.set(CP_KEY, JSON.stringify(snap)); }
  function restoreCheckpoint() {
    let o = null; try { o = JSON.parse(store.get(CP_KEY) || 'null'); } catch (e) {}
    if (!o) return false;
    Death.hide(); dlg = null; UI.dialog(null);
    const pend = o.pending; delete o.pending;
    loadData(o); delete S.pending; mode = 'play'; rebuild();
    UI.toast('死ぬ直前からやり直します');
    Audio.area(bgmKey());
    if (pend && pend.length) say(pend, applyRules); else applyRules();
    return true;
  }
  const Death = {
    // 犠牲者の名札（目を閉じた顔・名前・死因）。画面を揺らし、音を止めてから鐘をひとつ
    card(id, name, cause, ch) {
      const el = $('deathCard'); if (!el) return;
      const cv = $('deathFace'); const M = ELD.FACE_META;
      if (VN.ok && M) VN.draw(cv, id, 0); // 胸から上の通常の顔（白黒）
      $('deathName').textContent = name; $('deathCause').textContent = '第' + ch + '章　' + cause;
      el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
      document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake');
      Audio.silence(3.5); setTimeout(() => Audio.sfx('bell'), 900);
      clearTimeout(this.t); this.t = setTimeout(() => el.classList.remove('show'), 4200);
    },
    // 主人公の死：DEAD END 画面（直前からやり直せる）
    dead(o) {
      mode = 'overlay';
      const cv = $('deadFace'); if (VN.ok) VN.draw(cv, 'hero', 0);
      $('deadTitle').textContent = o.title || 'DEAD END'; $('deadCause').textContent = fmt(o.cause || '');
      $('deadEnd').classList.add('show'); document.body.classList.add('shake');
      Audio.silence(6); setTimeout(() => Audio.sfx('fail'), 300);
      S.flags.dead_end_seen = true;
      try { const r = JSON.parse(store.get('eldia_deadends') || '{}'); r[o.id || 'x'] = (r[o.id || 'x'] || 0) + 1; store.set('eldia_deadends', JSON.stringify(r)); } catch (e) {}
    },
    hide() { $('deadEnd') && $('deadEnd').classList.remove('show'); },
  };
  // 危険イベントの行動回数：部屋の移動・調べる操作のたびに1手減る。0になると fail のフラグが立つ
  function tickDanger() {
    if (!S.danger) return;
    S.danger.left--;
    if (S.danger.left <= 0) { const f = S.danger.fail; S.danger = null; S.flags[f] = true; setTimeout(() => Audio.area(bgmKey()), 0); }
    else UI.toast(S.danger.label + '　残り ' + S.danger.left + ' 手');
  }
  // 画面全体の演出（犠牲者の場面など）
  const FX = {
    play(kind) {
      const el = $('fxOv'); if (!el) return;
      el.className = ''; void el.offsetWidth; el.className = 'show fx-' + kind;
      const snd = { gas: 'fail', tea: 'paper', bell: 'bell', fire: 'fail', flash: 'secret', dark: 'door', quake: 'fail' }[kind];
      if (snd) Audio.sfx(snd);
      clearTimeout(this.t); this.t = setTimeout(() => { el.className = ''; }, 3200);
    },
  };
  // 四桁などの番号入力（キーボックス等）
  function openCode(act) {
    const c = act.code;
    mode = 'overlay';
    Code.open(c, (val) => {
      mode = 'play';
      if (val == null) { afterChange(); return; }
      if (val === c.answer) { Audio.sfx('secret'); const ok = c.ok || {}; const lines = (ok.say || []).slice(); effects(ok); for (const f of arr(ok.set)) S.flags[f] = true; for (const gv of arr(ok.give)) if (!has(gv)) { giveItem(gv); lines.push({ item: gv }); } rebuild(); say(lines, () => { if (ok.chapterEnd) chapterEnd(ok.chapterEnd); else applyRules(); }); }
      else { Audio.sfx('fail'); S.codeMiss = (S.codeMiss || 0) + 1; say((c.ng || ['違うようだ。']).concat(S.codeMiss >= 5 && c.reveal ? [c.reveal] : []), afterChange); }
    });
  }
  const Code = {
    open(c, cb) {
      this.cb = cb; this.len = c.answer.length; this.val = Array(this.len).fill(0); this.pos = 0;
      $('codeTitle').textContent = c.title || '番号を入力'; $('codeDesc').textContent = fmt(c.desc || '');
      this.render(); $('codeOv').classList.add('show');
    },
    render() {
      const box = $('codeDigits'); box.innerHTML = '';
      this.val.forEach((v, i) => {
        const d = document.createElement('div'); d.className = 'cdig' + (i === this.pos ? ' on' : '');
        d.innerHTML = '<button data-d="1" aria-label="上げる">▲</button><b>' + v + '</b><button data-d="-1" aria-label="下げる">▼</button>';
        d.querySelectorAll('button').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.pos = i; this.bump(+b.dataset.d); }));
        box.appendChild(d);
      });
    },
    bump(d) { this.val[this.pos] = (this.val[this.pos] + d + 10) % 10; Audio.blip(); this.render(); },
    key(code, key) {
      if (/^[0-9]$/.test(key)) { this.val[this.pos] = +key; this.pos = Math.min(this.len - 1, this.pos + 1); Audio.blip(); this.render(); return; }
      if (code === 'ArrowUp' || code === 'KeyW') this.bump(1);
      else if (code === 'ArrowDown' || code === 'KeyS') this.bump(-1);
      else if (code === 'ArrowLeft' || code === 'KeyA') { this.pos = Math.max(0, this.pos - 1); this.render(); }
      else if (code === 'ArrowRight' || code === 'KeyD') { this.pos = Math.min(this.len - 1, this.pos + 1); this.render(); }
      else if (code === 'Enter' || code === 'Space' || code === 'KeyZ') this.done(this.val.join(''));
      else if (code === 'Escape' || code === 'KeyX') this.done(null);
    },
    done(v) { $('codeOv').classList.remove('show'); const cb = this.cb; this.cb = null; cb && cb(v); },
    get isOpen() { return $('codeOv').classList.contains('show'); },
  };
  // 章の終わり：章名を出してオートセーブ
  function chapterEnd(o) {
    saveSlot('auto');
    $('chEndTitle').textContent = o.title || ''; $('chEndSub').textContent = o.sub || ''; $('chEndNext').textContent = o.next || '';
    $('chEnd').classList.add('show'); mode = 'overlay';
    Audio.sfx('bell');
  }
  function giveItem(id) {
    S.inv.push(id);
    S.notes['item:' + id] = S.notes['item:' + id] || { ch: S.chapter, t: Date.now() };
    S.newNotes['item:' + id] = true;
  }
  function takeItem(id) {
    if (!has(id)) return;
    S.inv = S.inv.filter((i) => i !== id);
    if (!S.used.includes(id)) S.used.push(id);
  }
  // 組み合わせ（順不同）。結果は会話で知らせ、手帳を更新する
  function combine(a, b) {
    if (!has(a) || !has(b) || a === b) return false;
    const c = (ELD.COMBOS || []).find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    if (!c) { Audio.sfx('fail'); say(ELD.COMBO_FAIL, afterChange); return false; }
    if (c.set && flag(c.set)) { say(['もう確かめた。'], afterChange); return true; }
    for (const f of arr(c.set)) S.flags[f] = true;
    for (const tk of arr(c.take)) takeItem(tk);
    const lines = (c.say || []).slice();
    for (const gv of arr(c.give)) if (!has(gv)) { giveItem(gv); lines.push({ item: gv }); }
    Audio.sfx('success');
    say(lines, () => { applyRules(); });
    rebuild();
    return true;
  }
  // 手帳：条件を満たした項目を記録（解決は表示側で判定）
  function noteUnlocked(n) {
    const u = n.unlock || {};
    if (u.start) return true;
    if (u.flag && flag(u.flag)) return true;
    if (u.item && (has(u.item) || S.used.includes(u.item))) return true;
    if (u.examined && S.examined[u.examined]) return true;
    return false;
  }
  function checkNotes() {
    const added = [];
    for (const n of ELD.NOTES || []) {
      if (!S.notes[n.id] && noteUnlocked(n)) { S.notes[n.id] = { ch: S.chapter, t: Date.now() }; S.newNotes[n.id] = true; added.push(n); }
      if (n.resolve && S.notes[n.id] && flag(n.resolve) && !S.notes[n.id].done) { S.notes[n.id].done = S.chapter; S.newNotes[n.id] = true; added.push(n); }
    }
    if (added.length && mode !== 'title') { UI.toast('推理手帳に記録：' + fmt(added[0].title) + (added.length > 1 ? ' ほか' + (added.length - 1) + '件' : '')); Audio.sfx('paper'); }
    return added;
  }
  function afterChange() { checkNotes(); autosave(); updateObjective(); }
  // 画面左上の「次にやること」
  function updateObjective() {
    const el = $('hudObj'); if (!el) return;
    const o = S && (ELD.OBJECTIVES || []).find((x) => cond(x.if));
    const txt = o ? fmt(typeof o.text === 'function' ? o.text(S) : o.text) : '';
    if (el.textContent !== txt) { el.textContent = txt; el.classList.toggle('show', !!txt); el.classList.remove('pulse'); void el.offsetWidth; if (txt) el.classList.add('pulse'); }
  }
  let talkingNpc = null;
  function applyRules() {
    for (const r of ELD.RULES || []) {
      if (cond(r.if)) {
        for (const f of arr(r.set)) S.flags[f] = true;
        effects(r);
        for (const gv of arr(r.give)) if (!has(gv)) giveItem(gv);
        if (r.sfx) Audio.sfx(r.sfx);
        rebuild();
        let lines = r.say ? r.say.slice() : null;
        if (lines) { say(lines, r.heroDeath ? () => Death.dead(r.heroDeath) : r.ending ? () => startEnding() : r.chapterEnd ? () => chapterEnd(r.chapterEnd) : applyRules); return; }
        if (r.heroDeath) { Death.dead(r.heroDeath); return; }
        if (r.ending) { startEnding(); return; }
        if (r.chapterEnd) { chapterEnd(r.chapterEnd); return; }
      }
    }
    afterChange();
  }

  /* ---------------- 会話 ---------------- */
  let dlg = null;
  // 死んだ人物の台詞：「湊|悠：」のように代わりの話し手を書けば生きている人が話す。代わりがなければその行は出さない
  let SHORT = null;
  function liveLines(lines) {
    if (!SHORT) { SHORT = {}; for (const c of ELD.CAST_INFO || []) { const n = c.name.split(/\s+/).pop(); SHORT[n] = c.id; SHORT[c.name.replace(/\s+/g, '')] = c.id; } }
    const out = [];
    for (const l of lines || []) {
      if (typeof l !== 'string') { out.push(l); continue; }
      const m = /^([^：「」]{1,12}?)：/.exec(l);
      if (!m) { out.push(l); continue; }
      const names = m[1].split('|'), body = l.slice(m[0].length);
      const alive = names.find((n) => !SHORT[n] || !S.flags['dead_' + SHORT[n]]);
      if (alive) out.push(alive + '：' + body);
    }
    return out;
  }
  function say(lines, done) {
    lines = liveLines(lines);
    { const ci = (lines || []).findIndex((l) => l && l.choice && l.choice.checkpoint); if (ci >= 0) saveCheckpoint(JSON.parse(JSON.stringify(lines.slice(ci)))); }
    if (!lines || !lines.length) { done && done(); return; }
    dlg = { lines: lines.map(fmt), i: 0, shown: 0, done };
    dlg.sel = choiceDef(dlg.lines[0]);
    mode = 'dialog';
    input.steer = null; input.path = null;
    UI.dialog(dlg);
  }
  // 選択肢 {choice:{id, q, opts:[{label, set, value}]}}
  const isChoice = (l) => l && typeof l === 'object' && l.choice;
  // 選択肢の初期位置（choice.def）。重い選択は安全な側を初期位置にする
  const choiceDef = (l) => (isChoice(l) && l.choice.def != null ? l.choice.def : 0);
  // opts[i].confirm = {q, yes, no}：選ぶと一度だけ確認を出す（初期位置は「いいえ」）
  function choose(i) {
    if (!dlg) return;
    const cur = dlg.lines[dlg.i]; if (!isChoice(cur)) return;
    const o = cur.choice.opts[i]; if (!o) return;
    if (cur.choice.confirmOf) { // 確認の画面
      const orig = cur.choice.confirmOf;
      dlg.lines[dlg.i] = orig.line;
      if (!o.yes) { dlg.sel = choiceDef(orig.line); Audio.blip(); UI.dialog(dlg); return; }
      return commit(orig.line, orig.i);
    }
    if (o.confirm) {
      const c = o.confirm;
      dlg.lines[dlg.i] = { choice: { id: '_confirm', q: c.q || '本当によろしいですか。', def: 0, confirmOf: { line: cur, i },
        opts: [{ label: c.no || 'いいえ（選び直す）' }, { label: c.yes || 'はい', yes: true }] } };
      dlg.sel = 0; Audio.sfx('paper'); UI.dialog(dlg); return;
    }
    commit(cur, i);
  }
  function commit(cur, i) {
    const o = cur.choice.opts[i];
    if (o.if && !cond(o.if)) { // 条件を満たさない選択肢：理由だけ伝えて先へ
      dlg.lines.splice(dlg.i + 1, 0, ...(o.failSay || ['……まだ、何かが足りない。']).map(fmt));
      Audio.sfx('fail'); dlg.i++; dlg.shown = 0; dlg.sel = choiceDef(dlg.lines[dlg.i]); UI.dialog(dlg); return;
    }
    if (o.restore) { restoreCheckpoint(); return; }
    S.choices[cur.choice.id] = o.value != null ? o.value : i;
    for (const f of arr(o.set)) S.flags[f] = true;
    effects(o);
    if (o.heroDeath) { const hd = o.heroDeath; dlg.lines.splice(dlg.i + 1); dlg.done = () => Death.dead(hd); }
    const extra = arr(o.say).slice();
    for (const gv of arr(o.give)) if (!has(gv)) { giveItem(gv); extra.push({ item: gv }); }
    if (extra.length) dlg.lines.splice(dlg.i + 1, 0, ...liveLines(extra).map(fmt));
    if (o.give || o.set || o.unset) rebuild();
    Audio.sfx('paper');
    dlg.i++; dlg.shown = 0; dlg.sel = choiceDef(dlg.lines[dlg.i]);
    if (dlg.i >= dlg.lines.length) { const d = dlg; dlg = null; talkingNpc = null; UI.dialog(null); mode = 'play'; d.done && d.done(); updateObjective(); return; }
    UI.dialog(dlg);
  }
  function choiceMove(dy) { if (dlg && isChoice(dlg.lines[dlg.i])) { const n = dlg.lines[dlg.i].choice.opts.length; dlg.sel = ((dlg.sel || 0) + dy + n) % n; Audio.blip(); UI.dialog(dlg); return true; } return false; }
  function advance() {
    if (!dlg) return;
    const cur = dlg.lines[dlg.i], len = typeof cur === 'string' ? cur.length : 0;
    if (isChoice(cur)) { choose(dlg.sel || 0); return; }
    if (dlg.shown < len) { dlg.shown = len; UI.dialog(dlg); return; }
    dlg.i++; dlg.shown = 0; dlg.sel = choiceDef(dlg.lines[dlg.i]);
    if (pendingCard && (dlg.i >= dlg.lines.length || (typeof dlg.lines[dlg.i] === 'string' && dlg.lines[dlg.i].includes(pendingCard.m)))) { const pc = pendingCard; pendingCard = null;
      if (ELD.DeathScene && !Game.fast) { // 死亡ムービー → 名札
        const back = mode; mode = 'overlay'; Audio.silence(12);
        ELD.DeathScene.play(pc.a[0], () => { mode = back; if (dlg) UI.dialog(dlg); Death.card(...pc.a); }, { img: SPR.img, cell: (w) => charCell(w, 'down', 1, false), sfx: (n) => Audio.sfx(n) });
      } else { if (pc.fx) FX.play(pc.fx); Death.card(...pc.a); } }
    if (dlg.i >= dlg.lines.length) {
      const d = dlg; dlg = null; talkingNpc = null; UI.dialog(null); mode = 'play';
      d.done && d.done(); updateObjective();
      return;
    }
    Audio.blip();
    UI.dialog(dlg);
  }

  /* ---------------- セーブ / ロード ---------------- */
  const mem = {};
  const store = {
    get(k) { try { const v = localStorage.getItem(k); return v != null ? v : mem[k]; } catch (e) { return mem[k]; } },
    set(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const slotKey = (s) => 'eldia_save_' + s;
  function snapshot() { return Object.assign({}, S, { date: Date.now() }); }
  function saveSlot(s) { store.set(slotKey(s), JSON.stringify(snapshot())); }
  function autosave() { if (S && mode !== 'title') saveSlot('auto'); }
  function readSlot(s) {
    try {
      const o = JSON.parse(store.get(slotKey(s)) || 'null');
      if (!o || o.v !== SAVE_VER || !ELD.ROOMS[o.room]) return null;
      return o;
    } catch (e) { return null; }
  }
  function loadData(o) {
    S = Object.assign(newState(), JSON.parse(JSON.stringify(o)));
    delete S.date;
    S.inv = S.inv.filter((i) => ELD.ITEMS[i]);
    S.used = (S.used || []).filter((i) => ELD.ITEMS[i]);
    for (const k of ['notes', 'newNotes', 'trust', 'choices']) if (!S[k] || typeof S[k] !== 'object') S[k] = {};
    if (!Array.isArray(S.victims)) S.victims = [];
    if (!Array.isArray(S.endings)) S.endings = [];
    if (!Array.isArray(S.clears)) S.clears = [];
    S.endings = S.endings.filter((id) => ELD.ENDINGS[id]); S.clears = S.clears.filter((c) => c && ELD.ENDINGS[c.id]);
    ELD.Ending.Records.merge(S.clears);
    input.armed = null;
    S.name = cleanName(S.name);
    if (nameError(S.name)) S.name = '';
    rt = null;
    buildRoom(S.room);
    if (blocked(S.x, S.y)) { // 整合性: 壁の中なら最寄りの床へ
      const p = bfs(Math.max(1, Math.min(rt.W - 2, Math.floor(S.x / T))), Math.max(2, Math.min(rt.H - 2, Math.floor(S.y / T))), (x, y) => !rt.trig.has(y * rt.W + x));
      const last = p ? p[p.length - 1] : [Math.floor(rt.W / 2), rt.H - 3];
      S.x = last[0] * T + 8; S.y = last[1] * T + 11;
    }
    lastTile = tileIdx(S.x, S.y - 3);
    snapCam();
    mode = 'play';
    UI.hud();
    // 名前のない古いセーブ：続きを遊ぶ前に名前を決めてもらう
    if (!S.name) NameUI.open((n) => { S.name = n; mode = 'play'; saveSlot('auto'); UI.hud(); }, null);
    checkNotes();
    Audio.area(bgmKey());
  }

  /* ---------------- 開始・エンディング ---------------- */
  function newGame(name) {
    S = newState();
    S.name = name;
    rt = null;
    buildRoom(S.room);
    S.visited[S.room] = true;
    lastTile = tileIdx(S.x, S.y - 3);
    snapCam();
    mode = 'play';
    UI.hud();
    S.chapter = 1;
    checkNotes(); S.newNotes = {};
    const r0 = ELD.ROOMS[S.room];
    Audio.area(bgmKey(r0));
    // プロローグ：雨の独白（全画面）→ バスの車内を操作。降りた瞬間に第1章のタイトル
    if (S.room === 'm_bus' && Game.fast) { // 自動テスト用：車内を飛ばして前庭から
      ['bus_intro', 'bus_read', 'bus_arrive'].forEach((f) => (S.flags[f] = true));
      arriveYard(true); return;
    }
    if (ELD.PROLOGUE && S.room === 'm_bus') Opening.play({ lines: ELD.PROLOGUE.lines, noTitle: true }, () => { UI.banner(ELD.AREAS[r0.area].name, r0.name, true); applyRules(); });
    else say(ELD.INTRO, () => { UI.banner(ELD.AREAS[r0.area].name, r0.name, true); applyRules(); });
  }
  // バスを降りる：暗転 → 前庭 → 章タイトル → 館の正面から主人公までカメラが降りる
  function arriveYard(instant) {
    const Y = ELD.YARD_START || ELD.START;
    const go = () => {
      S.noBanner = true; enterRoom(Y.room, { x: Y.x * T, y: Y.y * T + 11, dir: Y.dir }); delete S.noBanner;
      Audio.sfx('door');
      if (instant || Game.fast) { mode = 'play'; applyRules(); return; }
      mode = 'overlay';
      Opening.play(ELD.CH1_CARD || { no: '第1章', title: '招かれた者たち' }, () => {
        UI.banner(ELD.AREAS[rt.d.area].name, rt.d.name, true); applyRules();
      });
    };
    if (instant || Game.fast) { go(); return; }
    mode = 'trans'; trans = { a: 0, phase: 'out', cb: go };
  }
  /* 章の幕開け（全画面）：台詞を一行ずつ浮かべ、章タイトルを出す。タップで送る／スキップできる */
  const Opening = {
    play(o, done) {
      const el = $('opening'); if (!el || Game.fast) { done(); return; }
      mode = 'overlay'; this.done = done; this.lines = (o.lines || []).map(fmt); this.i = -1; this.o = o;
      $('opLines').innerHTML = ''; $('opTitle').classList.remove('show');
      $('opNo').textContent = o.no || ''; $('opName').textContent = o.title || ''; $('opSub').textContent = o.sub || '';
      el.classList.toggle('short', !this.lines.length);
      el.classList.add('show'); Audio.silence(this.lines.length ? 30 : 6); if (this.lines.length) Audio.sfx('rain');
      this.next();
    },
    next() {
      clearTimeout(this.t);
      if (this.phase === 'title') { this.end(); return; }
      this.i++;
      if (this.i < this.lines.length) {
        const box = $('opLines'); [...box.children].forEach((c) => c.classList.add('old'));
        const d = document.createElement('p'); d.textContent = this.lines[this.i]; box.appendChild(d);
        if (this.i === 1) Audio.sfx('rumble');
        this.t = setTimeout(() => this.next(), 2600 + this.lines[this.i].length * 70);
        return;
      }
      if (this.o.noTitle) { this.end(); return; }
      this.phase = 'title'; $('opLines').innerHTML = ''; $('opTitle').classList.add('show'); Audio.sfx('bell');
      this.t = setTimeout(() => this.end(), this.lines.length ? 3600 : 2600);
    },
    end() {
      clearTimeout(this.t); this.phase = null;
      const el = $('opening'); el.classList.add('fade');
      setTimeout(() => { el.classList.remove('show', 'fade'); $('opTitle').classList.remove('show'); mode = 'play'; Audio.area(bgmKey()); const d = this.done; this.done = null; d && d(); }, 900);
    },
    skip() { this.lines = []; this.i = 0; if (this.phase === 'title') this.end(); else { this.phase = null; this.next(); } },
    get open() { const el = $('opening'); return !!(el && el.classList.contains('show')); },
  };
  // エンディング判定（設計書の順：BAD → SECRET → TRUE → NORMAL）
  function judgeEnding() { return ELD.Ending.judge(S); }
  function startEnding(forceId) {
    const id = forceId || judgeEnding();
    UI.dialog(null); UI.close(); disarm();
    mode = 'ending';
    const play = S.play, at = Date.now();
    if (!S.endings.includes(id)) S.endings.push(id);
    S.clears.push({ id, at, play });
    const res = ELD.Ending.Records.add(id, play, at);
    S.flags['ending_' + id] = true;
    saveSlot('auto');
    ELD.Ending.play(id, { play, first: res.first, newSecret: res.newSecret, newComplete: res.newComplete, rec: res.rec });
    return id;
  }
  // 最終局面の直前を「再挑戦ポイント」として残す
  const RETRY_KEY = 'eldia_retry';
  function saveRetry() { if (S && S.name) store.set(RETRY_KEY, JSON.stringify(snapshot())); }
  function hasRetry() { try { const o = JSON.parse(store.get(RETRY_KEY) || 'null'); return !!(o && o.v === SAVE_VER && ELD.ROOMS[o.room]); } catch (e) { return false; } }
  function retry() {
    let o = null; try { o = JSON.parse(store.get(RETRY_KEY) || 'null'); } catch (e) {}
    if (!o || o.v !== SAVE_VER) o = latestSave();
    ELD.Ending.Seq.hide();
    if (!o) { toTitle(); return; }
    $('title').classList.remove('show');
    loadData(o);
    UI.banner(ELD.AREAS[rt.d.area].name, rt.d.name, false);
    UI.toast('最終局面の前から再挑戦します');
  }
  function bindStoryUI() {
    $('deadRetry') && $('deadRetry').addEventListener('click', () => { if (!restoreCheckpoint()) toTitle(); });
    $('deadTitleBtn') && $('deadTitleBtn').addEventListener('click', () => { Death.hide(); toTitle(); });
    $('codeOk').addEventListener('click', () => Code.done(Code.val.join('')));
    $('codeNo').addEventListener('click', () => Code.done(null));
    $('chEndOk').addEventListener('click', closeChEnd);
    if ($('deathScene')) $('deathScene').addEventListener('click', () => ELD.DeathScene && ELD.DeathScene.skip());
    if ($('opening')) { $('opening').addEventListener('click', (e) => { if (e.target.id === 'opSkip') Opening.skip(); else Opening.next(); }); }
  }
  function closeChEnd() {
    $('chEnd').classList.remove('show'); mode = 'play'; afterChange();
    const m = /第(\d)章「(.+?)」/.exec($('chEndNext').textContent || '');
    if (m) Opening.play({ lines: [], no: '第' + m[1] + '章', title: m[2], sub: '' }, applyRules); else applyRules();
  }
  function newGameFlow() {
    toTitle();
    NameUI.open((n) => { $('title').classList.remove('show'); newGame(n); }, () => { mode = 'title'; });
  }

  /* ---------------- 描画 ---------------- */
  function snapCam() { const c = camTarget(); view.camX = c.x; view.camY = c.y; }
  function camTarget() {
    const RW = rt.W * T, RH = rt.H * T;
    let x = S.x - view.w / 2, y = S.y - 12 - view.h / 2;
    x = RW <= view.w ? (RW - view.w) / 2 : Math.max(0, Math.min(RW - view.w, x));
    y = RH <= view.h ? (RH - view.h) / 2 : Math.max(0, Math.min(RH - view.h, y));
    return { x, y };
  }
  const pcv = document.createElement('canvas'); pcv.width = 16; pcv.height = 24;
  const pctx = pcv.getContext('2d');

  /* 人物スプライト（assets/chars.png）。読み込めていなければ従来の描き方に戻す。
     スプライト1ドットを画面の整数画素で描く：p = round(sc×32/48)。足元 (fx, fy) を基準に置く */
  const SPR = { img: null, ok: false };
  function loadSprites() {
    const M = ELD.SPRITE_META; if (!M) return;
    const im = new Image(); im.onload = () => { SPR.ok = true; }; im.onerror = () => { SPR.ok = false; }; im.src = M.src; SPR.img = im;
  }
  function charCell(who, dir, frame, moving) {
    const M = ELD.SPRITE_META, m = M && M.chars[who]; if (!m) return null;
    const d = m.dirs[dir] != null ? m.dirs[dir] : 0;
    const col = m.frames > 1 ? (moving ? (frame & 3) : 1) : 0;
    return { sx: col * M.cell[0], sy: (m.row + d) * M.cell[1], w: M.cell[0], h: M.cell[1] };
  }
  function drawChar(c, who, dir, frame, moving, fx, fy) {
    if (!SPR.ok) return false;
    const cell = charCell(who, dir, frame, moving); if (!cell) return false;
    const sc = view.scale || 3, p = Math.max(1, Math.round(sc * 32 / 48)), k = p / sc;
    const w = cell.w * k, h = cell.h * k;
    const x = Math.round((fx - w / 2) * sc) / sc, y = Math.round((fy - h) * sc) / sc;
    c.drawImage(SPR.img, cell.sx, cell.sy, cell.w, cell.h, x, y, w, h);
    return true;
  }
  function charH() { if (!SPR.ok) return 24; const sc = view.scale || 3; return 48 * Math.max(1, Math.round(sc * 32 / 48)) / sc; }
  ELD.drawCharPortrait = (cv, who, head) => { // 手帳の人物アイコン／会話の顔（head=true で胸から上）
    if (!SPR.ok) return false; const cell = charCell(who, 'down', 1, false); if (!cell) return false;
    // 顔：絵の上端（頭頂）から18ドット、中央20ドット幅を切り出す
    const top = head ? (ELD.SPRITE_META.chars[who].top || 0) : 0;
    const w = head ? 20 : cell.w, h = head ? 18 : cell.h, x0 = head ? 6 : 0, y0 = head ? top : 0;
    cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, w, h);
    g.drawImage(SPR.img, cell.sx + x0, cell.sy + y0, w, h, 0, 0, w, h); return true;
  };

  function render() {
    const c = ctx;
    c.setTransform(view.scale, 0, 0, view.scale, 0, 0); c.imageSmoothingEnabled = false;
    c.fillStyle = '#05040a'; c.fillRect(0, 0, view.w, view.h);
    if (!rt) return;
    const tc = camTarget();
    if (view.pan) { // 幕開けのカメラ：館の正面から主人公までゆっくり降りる
      const k = Math.min(1, (performance.now() - view.pan.t0) / view.pan.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      view.camX = tc.x; view.camY = view.pan.y0 + (tc.y - view.pan.y0) * e; if (k >= 1) view.pan = null;
    } else { view.camX += (tc.x - view.camX) * 0.18; view.camY += (tc.y - view.camY) * 0.18; }
    if (Math.abs(tc.x - view.camX) < 0.3) view.camX = tc.x;
    if (Math.abs(tc.y - view.camY) < 0.3) view.camY = tc.y;
    const ox = -Math.round(view.camX), oy = -Math.round(view.camY);
    c.drawImage(rt.bg, ox, oy);
    drawDoors(c, ox, oy);
    const SS = stateForPaint();
    const t = anim.t;
    const drawF = (o) => {
      const f = o.f;
      if (f.t === 'person') {
        // 待機中の動き：呼吸の上下と、ときどき左右へ体重を移す
        const ph = (f.x * 7 + f.y * 13) % 10, sway = Math.sin(t * 0.6 + ph) > 0.85 ? 1 : Math.sin(t * 0.6 + ph) < -0.85 ? -1 : 0;
        const bob = Math.sin(t * 2.2 + ph) > 0.3 ? 0.34 : 0;
        if (drawChar(c, f.who, (S.face && S.face[f.who]) || f.dir || 'down', 1, false, ox + f.x * T + 8 + sway * 0.67, oy + f.y * T + 15 + bob)) {
          if (talkingNpc === f.who && mode === 'dialog') { const bx = Math.round(ox + f.x * T + 8), by = Math.round(oy + f.y * T + 15 - charH() - 4 + Math.sin(t * 6)); c.fillStyle = '#ffe08a'; c.fillRect(bx - 3, by, 7, 2); c.fillRect(bx - 2, by + 2, 5, 1); c.fillRect(bx - 1, by + 3, 3, 1); c.fillRect(bx, by + 4, 1, 1); }
          return;
        }
      }
      if (o.sprite) { c.drawImage(o.sprite, ox + f.x * T - ELD.SPR_PAD.x, oy + f.y * T - ELD.SPR_PAD.y); return; }
      c.save(); c.translate(ox + f.x * T, oy + f.y * T); ELD.setCtx(c);
      try { ELD.PAINT[f.t](f, t, SS); } catch (e) {}
      c.restore();
    };
    for (const o of rt.furn) if (o.wall) drawF(o);
    // Yソート
    const list = [];
    for (const o of rt.furn) if (!o.wall && !o.over) list.push({ y: (o.f.y + o.f.h) * T - 0.5, o });
    if (mode !== 'title' && mode !== 'ending') list.push({ y: S.y, p: 1 });
    for (const bd of (S.bodies || [])) if (bd.room === rt.id) list.push({ y: (bd.y + 0.6) * T, body: bd });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.body) { // 倒れた姿（横たわり、色を落とす）
        const bd = it.body; c.fillStyle = 'rgba(40,0,0,0.45)'; c.beginPath(); c.ellipse(ox + bd.x * T + 8, oy + bd.y * T + 12, 15, 5, 0, 0, Math.PI * 2); c.fill(); c.save(); c.translate(ox + bd.x * T + 8, oy + bd.y * T + 10); c.rotate(-Math.PI / 2); c.filter = 'grayscale(0.7) brightness(0.75)';
        drawChar(c, bd.who, 'down', 1, false, 0, 8); c.restore(); continue;
      }
      if (it.p) {
        if (drawChar(c, 'hero', S.dir, anim.frame, anim.moving, ox + Math.round(S.x), oy + Math.round(S.y) + 1)) continue;
        pctx.clearRect(0, 0, 16, 24);
        ELD.drawPlayer(pctx, S.dir, anim.frame, anim.moving);
        if (S.dir === 'right') { c.save(); c.translate(ox + Math.round(S.x) + 8, 0); c.scale(-1, 1); c.drawImage(pcv, 0, oy + Math.round(S.y) - 23); c.restore(); }
        else c.drawImage(pcv, ox + Math.round(S.x) - 8, oy + Math.round(S.y) - 23);
      } else drawF(it.o);
    }
    for (const o of rt.furn) if (o.over) drawF(o);
    drawLight(c, ox, oy, t);
    // 調査マーカー
    if (mode !== 'title') drawMarkers(c, ox, oy, t);
    // フェード
    if (trans) { c.fillStyle = 'rgba(0,0,0,' + Math.min(1, trans.a) + ')'; c.fillRect(0, 0, view.w, view.h); }
  }

  // 扉の開閉アニメーション（近づくと開き、離れると閉じる）
  const ANIM_KINDS = { wood: 1, metal: 1 };
  function doorCenter(ex) {
    const w = (ex.w || 1) * T;
    if (ex.side === 'N') return [ex.at * T + w / 2, 2 * T];
    if (ex.side === 'S') return [ex.at * T + w / 2, (rt.H - 1) * T];
    if (ex.side === 'W') return [T, ex.at * T + w / 2];
    return [(rt.W - 1) * T, ex.at * T + w / 2];
  }
  function tickDoors(dt, silent) {
    for (const ex of rt.d.exits) {
      if (!'NSWE'.includes(ex.side) || !ANIM_KINDS[ex.kind || 'wood'] || !rt.es[ex.id] || !rt.es[ex.id].open) continue;
      const [dx, dy] = doorCenter(ex), near = Math.hypot(S.x - dx, S.y - 6 - dy) < 30 && mode !== 'title';
      const cur = doorAnim[ex.id] == null ? (silent && near ? 1 : 0) : doorAnim[ex.id];
      const nxt = near ? Math.min(1, cur + dt * 5) : Math.max(0, cur - dt * 3.5);
      if (!silent && cur === 0 && nxt > 0) Audio.sfx('doorOpen');
      if (!silent && cur > 0.3 && nxt <= 0.3 && !near) Audio.sfx('doorClose');
      doorAnim[ex.id] = nxt;
    }
  }
  function drawDoors(c, ox, oy) {
    if (!ELD.drawDoorLeaf) return;
    for (const ex of rt.d.exits) {
      if (doorAnim[ex.id] == null && !(rt.es[ex.id] && rt.es[ex.id].open && 'NSWE'.includes(ex.side) && ANIM_KINDS[ex.kind || 'wood'])) continue;
      if (!rt.es[ex.id] || !rt.es[ex.id].open) continue;
      if (!ANIM_KINDS[ex.kind || 'wood'] || !'NSWE'.includes(ex.side)) continue;
      ELD.drawDoorLeaf(c, rt.d, ex, doorAnim[ex.id] || 0, ox, oy);
    }
  }

  function drawLight(c, ox, oy, t) {
    const L = lctx;
    const amb = ambient();
    L.globalCompositeOperation = 'source-over';
    L.fillStyle = css(amb); L.fillRect(0, 0, view.w, view.h);
    L.globalCompositeOperation = 'lighter';
    const dk = dawnK();
    // 月明かり（窓）
    const prog = Math.max(0, Math.min(1, (S.time - T_STOP) / (T_DAWN - T_STOP)));
    const skew = -26 + prog * 52;
    const mc = dk > 0 ? mix([110, 130, 190], [255, 180, 120], dk) : [110, 130, 190];
    for (const w of rt.windows) {
      const x0 = ox + w.x, y0 = oy + 28, len = 70;
      const gr = L.createLinearGradient(0, y0, 0, y0 + len);
      gr.addColorStop(0, 'rgba(' + mc[0] + ',' + mc[1] + ',' + mc[2] + ',0.75)');
      gr.addColorStop(1, 'rgba(' + mc[0] + ',' + mc[1] + ',' + mc[2] + ',0)');
      L.fillStyle = gr; L.beginPath();
      L.moveTo(x0, y0); L.lineTo(x0 + w.w, y0); L.lineTo(x0 + w.w + skew, y0 + len); L.lineTo(x0 + skew, y0 + len); L.closePath(); L.fill();
      L.globalCompositeOperation = 'source-over';
      L.strokeStyle = css(amb); L.lineWidth = 2; L.beginPath();
      L.moveTo(x0 + w.w / 2, y0); L.lineTo(x0 + w.w / 2 + skew, y0 + len);
      L.moveTo(x0 + skew * 0.25, y0 + len * 0.25); L.lineTo(x0 + w.w + skew * 0.25, y0 + len * 0.25); L.stroke();
      L.globalCompositeOperation = 'lighter';
      const g2 = L.createRadialGradient(x0 + w.w / 2, y0 - 12, 0, x0 + w.w / 2, y0 - 12, 28);
      g2.addColorStop(0, 'rgba(' + mc[0] + ',' + mc[1] + ',' + mc[2] + ',0.6)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
      L.fillStyle = g2; L.fillRect(x0 - 30, y0 - 40, w.w + 60, 60);
    }
    for (const l of rt.lights) {
      const x = ox + l.x, y = oy + l.y;
      if (x + l.r < 0 || y + l.r < 0 || x - l.r > view.w || y - l.r > view.h) continue;
      const fl = l.fl ? 1 - l.fl * 0.12 + Math.sin(t * 11 + (l.seed || 0)) * 0.05 * l.fl + Math.sin(t * 23.7 + (l.seed || 0) * 2) * 0.04 * l.fl : 1;
      const r = l.r * fl;
      const gr = L.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(' + l.c[0] + ',' + l.c[1] + ',' + l.c[2] + ',' + (0.95 * fl) + ')');
      gr.addColorStop(0.45, 'rgba(' + l.c[0] + ',' + l.c[1] + ',' + l.c[2] + ',' + (0.38 * fl) + ')');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      L.fillStyle = gr; L.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // 主人公の周囲（手元の灯り）
    if (mode !== 'title') {
      const px = ox + S.x, py = oy + S.y - 10;
      const gr = L.createRadialGradient(px, py, 0, px, py, 46);
      gr.addColorStop(0, 'rgba(120,105,90,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      L.fillStyle = gr; L.fillRect(px - 46, py - 46, 92, 92);
    }
    c.globalCompositeOperation = 'multiply';
    c.drawImage(lcv, 0, 0);
    // 光のにじみ
    c.globalCompositeOperation = 'lighter';
    for (const l of rt.lights) {
      const x = ox + l.x, y = oy + l.y, r = l.r * 0.28;
      if (x + r < 0 || y + r < 0 || x - r > view.w || y - r > view.h) continue;
      const gr = c.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(' + l.c[0] + ',' + l.c[1] + ',' + l.c[2] + ',0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    c.globalCompositeOperation = 'source-over';
    // 周辺減光
    const vg = c.createRadialGradient(view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.35, view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,8,0.55)');
    c.fillStyle = vg; c.fillRect(0, 0, view.w, view.h);
  }

  function drawMarkers(c, ox, oy, t) {
    if (settings.markers) {
      for (const i of rt.ins) {
        if (S.examined[i.id]) continue;
        if (i.npc) { // 話していない人物：頭上に吹き出し（人物の絵の位置に出す）
          const pf = rt.furn.find((o) => o.f.t === 'person' && o.f.who === i.npc), px = pf ? pf.f.x : i.x, py = pf ? pf.f.y : i.y;
          const bx = Math.round(ox + (px + 0.5) * T), by = Math.round(oy + py * T + 15 - charH() - 5 + Math.sin(t * 3 + i.x) * 1.2);
          c.fillStyle = 'rgba(20,16,28,0.85)'; c.fillRect(bx - 6, by - 4, 12, 8); c.fillRect(bx - 1, by + 4, 2, 2);
          c.fillStyle = '#ffe9b0'; c.fillRect(bx - 5, by - 3, 10, 6); c.fillStyle = '#3a2a1a'; for (let k = -3; k <= 3; k += 3) c.fillRect(bx + k - 0, by, 1, 1);
          continue;
        }
        // 調べられる所：控えめなきらめき（枠や札は出さず、雰囲気を壊さない）
        const w = (i.w || 1), h = (i.h || 1), ph = t * 2.2 + i.x * 1.7 + i.y;
        const a = Math.max(0, Math.sin(ph)) * 0.85 + 0.15;
        const x = Math.round(ox + (i.x + w / 2) * T), y = Math.round(oy + (i.y + (i.y <= 1 ? h - 0.3 : h / 2)) * T - 4);
        const gl = c.createRadialGradient(x, y, 0, x, y, 9); gl.addColorStop(0, 'rgba(255,236,180,' + 0.35 * a + ')'); gl.addColorStop(1, 'rgba(255,236,180,0)');
        c.fillStyle = gl; c.fillRect(x - 9, y - 9, 18, 18);
        const L = 2 + Math.round(a * 3);
        c.fillStyle = 'rgba(255,246,214,' + a + ')'; c.fillRect(x, y - L, 1, L * 2 + 1); c.fillRect(x - L, y, L * 2 + 1, 1);
        c.fillStyle = 'rgba(255,255,255,' + a + ')'; c.fillRect(x, y, 1, 1);
      }
    }
    // 出口の案内矢印（バスの前扉など、見落としやすい出口）
    if (rt.d.exitHint) for (const ex of rt.d.exits) {
      if (!exitState(rt.id, ex).open) continue;
      const tl = exitTiles(rt.d, ex)[0]; if (!tl) continue;
      const ax = Math.round(ox + (tl[0] + 0.5) * T), ay = Math.round(oy + tl[1] * T - 6 + Math.sin(t * 5) * 2);
      c.fillStyle = 'rgba(255,200,150,' + (0.45 + Math.sin(t * 4) * 0.3) + ')'; for (let k = 0; k < 5; k++) c.fillRect(ax - 4 + k, ay - 5 + k, 9 - k * 2, 1);
    }
    if (mode === 'play' && !trans) {
      const ft = frontTarget();
      if (ft) {
        const bx = ox + Math.round(S.x), by = oy + Math.round(S.y) - Math.max(34, Math.round(charH()) + 10) + Math.round(Math.sin(t * 6));
        c.fillStyle = '#1a1420'; c.fillRect(bx - 5, by - 6, 11, 10); c.fillRect(bx - 1, by + 4, 3, 2);
        c.fillStyle = ft.kind === 'exit' ? '#ff8a6a' : '#ffe08a'; c.fillRect(bx - 4, by - 5, 9, 8);
        c.fillStyle = '#1a1420';
        if (ft.kind === 'exit') { c.fillRect(bx - 2, by - 2, 5, 4); c.fillRect(bx - 1, by - 4, 3, 2); c.fillStyle = '#ff8a6a'; c.fillRect(bx, by - 3, 1, 1); }
        else { c.fillRect(bx, by - 4, 1, 4); c.fillRect(bx, by + 1, 1, 1); }
      }
    }
  }

  /* ---------------- 地図データ（UIが利用） ---------------- */
  function mapInfo() {
    const known = new Set(), visited = new Set(Object.keys(S.visited));
    for (const r of ELD.ROOM_LIST) {
      if (flag('mapReveal') && !r.secret) known.add(r.id);
      if (!visited.has(r.id)) continue;
      known.add(r.id);
      for (const ex of r.exits) {
        if (ex.to === '@outside' || ex.to === '@none') continue;
        if (ex.hidden && !flag(ex.hidden)) continue;
        known.add(ex.to.split(':')[0]);
      }
    }
    return { known, visited, cur: S.room, px: S.x / (rt.W * T), py: S.y / (rt.H * T), es: (rid, ex) => exitState(rid, ex) };
  }

  /* ---------------- オーディオ ---------------- */
  /* 話している人：行頭の「名前：」を名札に出し、顔を添える */
  const SPEAKERS = { '蓮': 'ren', '朝倉蓮': 'ren', '美月': 'mizuki', '黒瀬': 'kurose', '冬子': 'fuyuko', '湊': 'minato', '玲奈': 'reina', '宗一郎': 'soichiro', '悠': 'yu', '琴音': 'kotone', '灰原': 'haibara', '怜司': 'haibara' };
  function speaker(line) {
    const nm = $('dlgName'), fc = $('dlgFace'); if (!nm) return;
    let who = null, label = '';
    if (line) {
      const m = /^([^：「」\s]{1,14})：/.exec(line);
      if (m) {
        label = m[1]; const base = label.replace(/（.*?）/g, '');
        who = SPEAKERS[base] || (S && (base === '〈' + S.name + '〉' || base === S.name) ? 'hero' : null);
        if (!who && /^〈.*〉$/.test(base)) who = 'hero';
      }
    }
    nm.textContent = label.replace(/^〈(.*)〉$/, '$1'); nm.classList.toggle('show', !!label);
    nm.classList.toggle('right', !!who && who !== 'hero' && VN.ok);
    const vn = VN.show(who, line || '');
    if (!vn && who && ELD.drawCharPortrait && ELD.drawCharPortrait(fc, who, true)) fc.classList.add('show'); else fc.classList.remove('show');
    $('dialog').classList.toggle('talk', !!label);
  }
  /* 会話の立ち絵：主人公は左、話している相手は右。話していない側は暗くする */
  const VN = {
    img: null, ok: false, L: null, R: null,
    load() { const M = ELD.FACE_META; if (!M) return; const im = new Image(); im.onload = () => { this.ok = true; }; im.src = M.bustSrc || M.src; this.img = im; },
    expr(who, line) {
      const e = (ELD.FACE_META.expr[who] || [1, 2, 3, 4]);
      const body = line.replace(/^[^：]*：/, '');
      if (/[！!]/.test(body)) return e[3];
      if (/^「?……/.test(body) || /……」$/.test(body)) return e[2];
      if (/[？?]/.test(body)) return e[1];
      return e[0];
    },
    // 高解像度の胸像（assets/busts.png、256px）を使う。表情差分は形が崩れるため使わない
    draw(cv, who) {
      const M = ELD.FACE_META, row = M.order.indexOf(who); if (row < 0) return false;
      const B = M.bust || 256, g = cv.getContext('2d'); cv.width = B; cv.height = B;
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.clearRect(0, 0, B, B);
      g.drawImage(this.img, 0, row * B, B, B, 0, 0, B, B); return true;
    },
    show(who, line) {
      if (!this.ok) return false;
      const L = $('vnL'), R = $('vnR');
      if (!who && !this.R && !talkingNpc) { this.clear(); return false; }
      if (talkingNpc && !this.R) this.R = talkingNpc;
      if (who && who !== 'hero') this.R = who;
      // 左：主人公（相手がいるときは常に出す）
      if (this.R) { this.draw(L, 'hero', who === 'hero' ? this.expr('hero', line) : 1); L.classList.add('show'); }
      if (this.R) { this.draw(R, this.R, who === this.R ? this.expr(this.R, line) : 1); R.classList.add('show'); }
      L.classList.toggle('dim', who !== 'hero'); R.classList.toggle('dim', !!this.R && who !== this.R);
      return !!this.R;
    },
    clear() { this.R = null; $('vnL').classList.remove('show'); $('vnR').classList.remove('show'); },
  };
  // 今いる部屋のBGM。危険イベント中は専用曲
  function bgmKey(d) { d = d || (rt && rt.d); if (!d) return null; if (S && S.danger) return 'danger'; return d.bgm || d.area; }
  const Audio = (() => {
    let ac = null, master = null, muted = false, bgmOff = false, bgm = null, pendingArea;
    const ensure = () => {
      if (ac) return ac;
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.35; master.connect(ac.destination); } catch (e) { ac = null; }
      return ac;
    };
    const tone = (f, d, type, v, when, slide) => {
      if (!ac || muted) return;
      const t0 = ac.currentTime + (when || 0);
      const o = ac.createOscillator(), gn = ac.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + d);
      gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(v || 0.3, t0 + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(gn); gn.connect(master); o.start(t0); o.stop(t0 + d + 0.05);
    };
    const noise = (d, v, lp) => {
      if (!ac || muted) return;
      const b = ac.createBuffer(1, ac.sampleRate * d, ac.sampleRate), ch = b.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
      const s = ac.createBufferSource(); s.buffer = b; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 800;
      const gn = ac.createGain(); gn.gain.value = v || 0.3; s.connect(f); f.connect(gn); gn.connect(master); s.start();
    };
    const SFX = {
      door: () => { noise(0.25, 0.25, 500); tone(110, 0.2, 'triangle', 0.15); },
      stairs: () => { for (let i = 0; i < 4; i++) setTimeout(() => noise(0.06, 0.2, 900), i * 90); },
      unlock: () => { tone(1200, 0.05, 'square', 0.08); tone(900, 0.08, 'square', 0.08, 0.07); noise(0.15, 0.2, 2000); },
      locked: () => { tone(160, 0.12, 'square', 0.1); tone(140, 0.12, 'square', 0.1, 0.1); },
      item: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.25, 'triangle', 0.18, i * 0.07)); },
      chime: () => { [1046, 1318, 1568].forEach((f, i) => tone(f, 0.6, 'sine', 0.2, i * 0.1)); },
      secret: () => { noise(0.8, 0.3, 300); [392, 466, 587].forEach((f, i) => tone(f, 0.5, 'triangle', 0.15, 0.3 + i * 0.12)); },
      rumble: () => { noise(1.4, 0.45, 200); tone(55, 1.2, 'sawtooth', 0.12); },
      bell: () => { [220, 440, 554, 660].forEach((f, i) => tone(f, 2.5, 'sine', 0.22 / (i + 1))); },
      drawer: () => { noise(0.35, 0.22, 700); tone(90, 0.12, 'triangle', 0.12, 0.3); },
      rain: () => { for (let i = 0; i < 10; i++) setTimeout(() => noise(3, 0.06, 2200), i * 2300); },
      shatter: () => { noise(0.3, 0.35, 6000); [2400, 3100, 2700].forEach((f, i) => tone(f, 0.08, 'triangle', 0.08, 0.02 + i * 0.05)); },
      alarm: () => { tone(880, 0.35, 'square', 0.06); tone(660, 0.35, 'square', 0.06, 0.4); },
      tick: () => { tone(1800, 0.03, 'square', 0.05); },
      paper: () => { noise(0.12, 0.12, 4000); noise(0.08, 0.08, 3000); },
      success: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.16, i * 0.08)); },
      fail: () => { tone(220, 0.18, 'square', 0.08); tone(165, 0.25, 'square', 0.08, 0.15); },
      doorOpen: () => { tone(190, 0.45, 'sawtooth', 0.04, 0, 120); noise(0.3, 0.12, 400); },
      doorClose: () => { noise(0.15, 0.2, 300); tone(80, 0.12, 'triangle', 0.12); },
      important: () => { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.9, 'sine', 0.14, i * 0.09)); [1568, 2093].forEach((f, i) => tone(f, 1.2, 'triangle', 0.05, 0.5 + i * 0.12)); },
    };
    // 区画ごとの環境音と簡易BGM（和音の持続音＋風＋オルゴール風の単音）
    const CHORD = { yard: [130.8, 196, 261.6, 311.1], entrance: [146.8, 220, 293.7, 349.2], east: [174.6, 261.6, 349.2, 440], west: [110, 164.8, 220, 261.6], tower: [164.8, 246.9, 329.6, 392], basement: [55, 82.4, 110], admin: [98, 146.8, 174.6], deep: [73.4, 103.8, 138.6, 155.6],
      // エンディング専用
      end_normal: [110, 164.8, 220, 261.6], end_bad: [55, 77.8, 110, 116.5], end_true: [146.8, 220, 293.7, 370], end_secret: [130.8, 196, 261.6, 329.6, 392] };
    const BELLS = { entrance: [587, 659, 784, 880, 988], east: [523, 587, 698, 784, 880], west: [440, 523, 587, 659, 784], tower: [659, 784, 988, 1175], deep: [415, 466, 554, 622],
      end_normal: [440, 523, 659], end_true: [587, 740, 880, 988, 1175], end_secret: [784, 988, 1175, 1568] };
    // 夜想曲（館の旋律）。BAD は6番目の音が半音下がる
    const NOCT = [[659, 0], [587, 0.35], [523, 0.7], [587, 1.05], [659, 1.4], [784, 1.75], [659, 2.3], [523, 2.65], [440, 3.0], [494, 3.5], [523, 3.85]];
    const MEL = { end_true: { k: 1, every: 8, sp: 1 }, end_secret: { k: 2, every: 7, sp: 1.15, box: true }, end_bad: { k: 0.5, every: 9, sp: 1.6, flat6: true } };
    function melody(g, m) {
      const t0 = ac.currentTime + 0.05;
      NOCT.forEach(([f, w], i) => {
        let fr = f * m.k; if (m.flat6 && i === 5) fr *= Math.pow(2, -1 / 12);
        const o = ac.createOscillator(), gn = ac.createGain(), at = t0 + w * m.sp;
        o.type = m.box ? 'sine' : 'triangle'; o.frequency.value = fr;
        gn.gain.setValueAtTime(0.0001, at); gn.gain.exponentialRampToValueAtTime(m.box ? 0.07 : 0.09, at + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, at + (m.box ? 1.6 : 1.3));
        o.connect(gn); gn.connect(g); o.start(at); o.stop(at + 1.7);
      });
    }
    /* ---- 部屋ごとのBGM（簡易シーケンサー）。音はすべてプログラムで鳴らす ----
       prog: 1小節ごとの和音（MIDI番号の配列）、bpm、beats（拍子）、arp: 分散和音の型、lead: 旋律（[MIDI, 拍]）、pad/bass の有無 */
    const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const TR = {
      manor:   { bpm: 66, beats: 3, wave: 'triangle', prog: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]], arp: [0, 1, 2, 1, 2, 1], bass: 1, pad: 0.05, vol: 0.09 },
      dinner:  { bpm: 76, beats: 4, wave: 'sine', prog: [[53, 57, 60, 64], [50, 53, 57, 60], [55, 58, 62, 65], [48, 52, 55, 58]], arp: [0, 2, 1, 3, 2, 1, 3, 2], bass: 1, pad: 0.06, vol: 0.09 },
      quiet:   { bpm: 58, beats: 4, wave: 'sine', prog: [[52, 55, 59], [48, 52, 55], [50, 53, 57], [47, 50, 54]], arp: [0, -1, 2, -1, 1, -1, -1, -1], bass: 0, pad: 0.05, vol: 0.08 },
      office:  { bpm: 92, beats: 4, wave: 'triangle', prog: [[50, 53, 57], [50, 53, 57], [48, 52, 55], [46, 50, 53]], arp: [0, -1, 1, -1, 2, -1, 1, -1], bass: 1, tick: 1, vol: 0.07 },
      study:   { bpm: 70, beats: 4, wave: 'triangle', prog: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]], arp: [0, 1, 2, 1, 0, 1, 2, 1], bass: 1, pad: 0.05, vol: 0.08 },
      gallery: { bpm: 84, beats: 4, wave: 'square', prog: [[57, 60, 64], [52, 55, 59], [53, 57, 60], [52, 56, 59]], arp: [0, 1, 2, 3, 2, 1, 2, 1], soft: 1, bass: 1, vol: 0.05 },
      nocturne:{ bpm: 60, beats: 4, wave: 'triangle', prog: [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]], arp: [0, -1, 1, -1, 2, -1, 1, -1], bass: 1, lead: 'noct', vol: 0.09 },
      musicbox:{ bpm: 64, beats: 3, wave: 'sine', prog: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], arp: [2, 1, 0, 1, 2, 1], box: 1, lead: 'noct', vol: 0.08 },
      clock:   { bpm: 96, beats: 4, wave: 'triangle', prog: [[52, 55, 59], [52, 55, 60], [50, 53, 57], [47, 50, 55]], arp: [0, 1, 2, 1, 0, 2, 1, 2], bass: 1, tick: 2, vol: 0.07 },
      belfry:  { bpm: 50, beats: 4, wave: 'sine', prog: [[45, 52, 57], [43, 50, 55], [41, 48, 53], [40, 47, 52]], arp: [0, -1, -1, -1, 2, -1, -1, -1], pad: 0.06, bell: 1, vol: 0.08 },
      under:   { bpm: 48, beats: 4, wave: 'sine', prog: [[38, 41, 45], [37, 41, 44], [38, 41, 45], [36, 40, 43]], arp: [0, -1, -1, 2, -1, -1, 1, -1], pad: 0.08, bass: 1, drip: 1, vol: 0.09 },
      clinic:  { bpm: 54, beats: 4, wave: 'sine', prog: [[45, 48, 52], [44, 48, 51], [45, 48, 52], [41, 45, 48]], arp: [2, -1, 1, -1, 0, -1, 1, -1], pad: 0.05, beep: 1, vol: 0.07 },
      cold:    { bpm: 40, beats: 4, wave: 'sine', prog: [[57, 64], [56, 63], [57, 64], [55, 62]], arp: [-1, -1, -1, -1, 1, -1, -1, -1], pad: 0.04, vol: 0.06 },
      tech:    { bpm: 110, beats: 4, wave: 'square', prog: [[45, 52], [45, 52], [43, 50], [41, 48]], arp: [0, 1, 0, 1, 0, 1, 0, 1], soft: 1, bass: 1, vol: 0.04 },
      kitchen: { bpm: 88, beats: 3, wave: 'triangle', prog: [[55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 54, 57]], arp: [0, 1, 2, 1, 2, 1], bass: 1, vol: 0.07 },
      reiji:   { bpm: 56, beats: 4, wave: 'triangle', prog: [[40, 43, 47], [41, 44, 48], [40, 43, 47], [39, 43, 46]], arp: [0, -1, 2, -1, 1, -1, 2, -1], pad: 0.08, bass: 1, lead: 'noctflat', vol: 0.09 },
      danger:  { bpm: 132, beats: 4, wave: 'square', prog: [[40, 43, 46], [40, 43, 46], [41, 44, 47], [39, 42, 45]], arp: [0, 1, 2, 1, 0, 1, 2, 1], soft: 1, bass: 1, heart: 1, tick: 2, vol: 0.05 },
    };
    const NOCTM = [[76, 0], [74, 0.5], [72, 1], [74, 1.5], [76, 2], [79, 2.5], [76, 3.5], [72, 4], [69, 4.5], [71, 5.5], [72, 6]];
    let seq = null;
    function note(dest, f, at, dur, wave, vol, soft) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = wave; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + (soft ? 0.03 : 0.008)); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      if (soft) { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; o.connect(lp); lp.connect(g); } else o.connect(g);
      g.connect(dest); o.start(at); o.stop(at + dur + 0.05);
    }
    function startTrack(key) {
      const t = TR[key]; if (!t || !ac || bgmOff || muted) return false;
      const g = ac.createGain(); g.gain.value = 0.0001; g.connect(master); g.gain.setTargetAtTime(1, ac.currentTime, 0.8);
      const spb = 60 / t.bpm, steps = t.arp.length, stepDur = (spb * t.beats) / steps;
      let bar = 0, step = 0, next = ac.currentTime + 0.1, leadT = null;
      const tick = () => {
        if (!bgm || bgm.key !== key || !ac) return;
        while (next < ac.currentTime + 0.25) {
          const ch = t.prog[bar % t.prog.length];
          if (step === 0) {
            if (t.pad) ch.forEach((m) => note(g, mf(m), next, spb * t.beats * 1.05, 'sine', t.pad / ch.length * 2, true));
            if (t.bass) note(g, mf(ch[0] - 12), next, spb * t.beats * 0.9, 'triangle', t.vol * 0.9, true);
            if (t.bell && bar % 2 === 0) note(g, mf(ch[0] + 24), next, 3.5, 'sine', t.vol * 0.8);
            if (t.lead && bar % 4 === 0) {
              NOCTM.forEach(([m, b], i) => { let mm = m - (t.box ? 0 : 12); if (t.lead === 'noctflat') mm -= 12; if (t.lead === 'noctflat' && i === 5) mm -= 1; note(g, mf(mm), next + b * spb, spb * 1.6, t.box ? 'sine' : 'triangle', t.vol * 1.1); });
            }
          }
          const a = t.arp[step];
          if (a >= 0 && ch[a % ch.length] != null) note(g, mf(ch[a % ch.length] + (t.box ? 12 : 0) + (a >= ch.length ? 12 : 0)), next, stepDur * (t.box ? 3 : 1.6), t.wave, t.vol, t.soft);
          if (t.tick && step % (t.tick === 2 ? 1 : 2) === 0) note(g, 2600, next, 0.03, 'square', 0.012);
          if (t.heart && (step === 0 || step === 1)) note(g, 55, next, 0.18, 'sine', 0.22);
          if (t.drip && step === 5 && Math.random() < 0.5) note(g, 1800 + Math.random() * 600, next, 0.12, 'sine', 0.04);
          if (t.beep && step === 0) note(g, 1320, next, 0.08, 'sine', 0.03);
          next += stepDur; step++; if (step >= steps) { step = 0; bar++; }
        }
      };
      const timer = setInterval(tick, 60); tick();
      bgm = { area: key, key, g, nodes: [], timer };
      return true;
    }
    function stopBgm(fast) {
      if (!bgm) return; const old = bgm; bgm = null;
      clearInterval(old.timer);
      try { old.g.gain.setTargetAtTime(0.0001, ac.currentTime, fast ? 0.1 : 0.8); } catch (e) {}
      setTimeout(() => old.nodes.forEach((n) => { try { n.stop(); } catch (e) {} }), fast ? 400 : 3500);
    }
    function startBgm(a) {
      if (TR[a]) { startTrack(a); return; }
      if (!ac || !a || !CHORD[a] || bgmOff || muted) return;
      const g = ac.createGain(); g.gain.value = 0.0001; g.connect(master); g.gain.setTargetAtTime(0.1, ac.currentTime, 1.5);
      const nodes = [];
      CHORD[a].forEach((f, i) => {
        const o = ac.createOscillator(), og = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain();
        o.type = i % 2 ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = (i - 1.5) * 5;
        og.gain.value = 0.22 / (i + 1); l.frequency.value = 0.04 + i * 0.027; lg.gain.value = 0.1 / (i + 1);
        l.connect(lg); lg.connect(og.gain); o.connect(og); og.connect(g); o.start(); l.start(); nodes.push(o, l);
      });
      const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      const ns = ac.createBufferSource(); ns.buffer = buf; ns.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = a === 'basement' || a === 'deep' ? 180 : 350; bp.Q.value = 0.6;
      const ng = ac.createGain(); ng.gain.value = 0.18; ns.connect(bp); bp.connect(ng); ng.connect(g); ns.start(); nodes.push(ns);
      const scale = BELLS[a];
      let tick = 0;
      const timer = setInterval(() => {
        if (!bgm || muted || bgmOff || !ac) return;
        if (MEL[a] && tick++ % MEL[a].every === 0) melody(g, MEL[a]);
        if (scale && Math.random() < 0.45) { const f = scale[Math.floor(Math.random() * scale.length)]; const t0 = ac.currentTime, o = ac.createOscillator(), gn = ac.createGain(); o.type = 'sine'; o.frequency.value = f; gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(0.05, t0 + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2); o.connect(gn); gn.connect(g); o.start(t0); o.stop(t0 + 2.3); }
        if ((a === 'entrance' || a === 'tower') && S && S.flags.tower_running) { tone(2400, 0.02, 'square', 0.015); }
      }, 1300);
      bgm = { area: a, g, nodes, timer };
    }
    return {
      unlock() { ensure(); if (ac && ac.state === 'suspended') ac.resume(); if (pendingArea !== undefined && !bgm) { const a = pendingArea; pendingArea = undefined; startBgm(a); } },
      area(a) { if (!ac) { pendingArea = a; return; } if (bgm && bgm.area === a) return; stopBgm(); startBgm(a); },
      toggleBgm() { bgmOff = !bgmOff; if (bgmOff) stopBgm(true); else if (rt) startBgm(bgmKey()); return bgmOff; },
      get bgmOff() { return bgmOff; },
      // エンディング専用BGM
      ending(key) { stopBgm(true); if (!ac) { pendingArea = key; return; } setTimeout(() => { if (!bgm) startBgm(key); }, 450); },
      // 録音再生（オルゴールの子守歌）
      lullaby() { ensure(); if (!ac || muted) return; const g = ac.createGain(); g.gain.value = 1; g.connect(master); melody(g, { k: 2, sp: 1.3, box: true }); },
      sfx(n) { ensure(); SFX[n] && SFX[n](); },
      // 音を止めて間を置く（死亡の場面）
      silence(sec) { stopBgm(true); clearTimeout(this._st); this._st = setTimeout(() => { if (rt && mode !== 'ending') startBgm(bgmKey()); }, sec * 1000); },
      step() { if (ac && !muted) noise(0.03, 0.05, 600); },
      blip() { tone(660, 0.03, 'square', 0.03); },
      plink() { ensure(); tone(523, 0.6, 'triangle', 0.25); tone(659, 0.6, 'triangle', 0.15, 0.25); },
      piano() {
        ensure();
        const mel = [[659, 0], [587, 0.35], [523, 0.7], [587, 1.05], [659, 1.4], [784, 1.75], [659, 2.3], [523, 2.65], [440, 3.0], [494, 3.5], [523, 3.85]];
        mel.forEach(([f, w]) => { tone(f, 1.2, 'triangle', 0.22, w); tone(f / 2, 1.4, 'sine', 0.1, w); });
      },
      toggle() { muted = !muted; if (muted) stopBgm(true); else if (rt) startBgm(bgmKey()); return muted; },
      get muted() { return muted; },
    };
  })();
  Game.Audio = Audio;

  /* =====================================================================
   * UI（DOM）
   * ===================================================================== */
  const $ = (id) => document.getElementById(id);
  const UI = {
    hud() {
      if (!S || !rt) return;
      const a = ELD.AREAS[rt.d.area];
      $('hudArea').textContent = a.name;
      $('hudArea').style.setProperty('--ac', a.color);
      $('hudRoom').textContent = rt.d.name;
      $('hudTime').textContent = fmtTime();
    },
    banner(area, name, first) {
      const b = $('banner');
      b.innerHTML = '<small>' + area + '</small><b>' + name + '</b>' + (first ? '<i>新しい場所を発見</i>' : '');
      b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    },
    dialog(d) {
      const box = $('dialog');
      if (!d) VN.clear();
      if (!d || isChoice(d.lines[d.i])) speaker(null);
      if (!d) { box.classList.remove('show'); $('reveal').classList.remove('show'); $('reveal').dataset.item = ''; return; }
      box.classList.add('show');
      const cur = d.lines[d.i];
      const txt = $('dlgText');
      box.classList.toggle('choosing', !!isChoice(cur));
      if (isChoice(cur)) {
        txt.classList.remove('get'); txt.innerHTML = '';
        const q = document.createElement('div'); q.className = 'cq'; q.textContent = fmt(cur.choice.q); txt.appendChild(q);
        const list = document.createElement('div'); list.className = 'copts'; list.setAttribute('role', 'listbox');
        cur.choice.opts.forEach((o, i) => {
          const b = document.createElement('button'); b.className = 'copt' + ((d.sel || 0) === i ? ' on' : ''); b.textContent = fmt(o.label);
          b.setAttribute('role', 'option'); b.setAttribute('aria-selected', (d.sel || 0) === i);
          // 確認つきの重い選択肢は、タッチでは1回目で選択、2回目で決定（誤タップ防止）
          b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (o.confirm && (d.sel || 0) !== i) { d.sel = i; Audio.blip(); UI.dialog(d); return; } choose(i); });
          b.addEventListener('click', (e) => { e.stopPropagation(); if (e.detail === 0) choose(i); });
          list.appendChild(b);
        });
        txt.appendChild(list);
        $('dlgMore').style.visibility = 'hidden';
        $('reveal').classList.remove('show');
        return;
      }
      speaker(typeof cur === 'string' ? cur : null);
      if (typeof cur === 'string') { const mm = /^([^：「」\s]{1,14})：\s*/.exec(cur), off = mm ? mm[0].length : 0; txt.textContent = cur.slice(off, Math.max(off, Math.floor(d.shown))); txt.classList.remove('get'); }
      else {
        const it = ELD.ITEMS[cur.item];
        txt.innerHTML = '';
        const cv = ELD.itemCanvas(cur.item, 32); cv.classList.add('ico');
        txt.appendChild(cv);
        txt.appendChild(document.createTextNode('【' + it.name + '】を手に入れた！'));
        txt.classList.add('get');
      }
      // 重要アイテムの発見演出
      const rv = $('reveal');
      if (typeof cur !== 'string' && ELD.ITEMS[cur.item].important) {
        if (rv.dataset.item !== cur.item) {
          rv.dataset.item = cur.item; const holder = $('revealArt'); holder.innerHTML = ''; holder.appendChild(ELD.itemCanvas(cur.item, 160));
          $('revealName').textContent = ELD.ITEMS[cur.item].name; rv.classList.remove('show'); void rv.offsetWidth; rv.classList.add('show');
        }
      } else if (rv.classList.contains('show')) { rv.classList.remove('show'); rv.dataset.item = ''; }
      $('dlgMore').style.visibility = typeof cur !== 'string' || d.shown >= cur.length ? 'visible' : 'hidden';
    },
    open(id) {
      if (ELD.ItemUI && $('exOv').classList.contains('show')) ELD.ItemUI.closeExamine();
      for (const o of document.querySelectorAll('.ov')) if (o.id !== 'nameOv') o.classList.toggle('show', o.id === id);
      mode = id ? 'overlay' : 'play';
      input.keys.clear(); input.steer = null; input.path = null; input.analog = null;
      if (id === 'mapOv') MapUI.open();
      if (id === 'invOv') ELD.ItemUI.openInventory();
      if (id === 'noteOv') ELD.ItemUI.openNotebook();
      if (id === 'menuOv') { UI.menu('main'); $('menuName').textContent = S.name ? S.name : ''; }
    },
    close() { UI.open(null); },
    armed() {
      const b = $('armed');
      if (input.armed) { b.textContent = '【' + ELD.ITEMS[input.armed].name + '】を使う：使いたい場所の前で「調べる」（キャンセルで中止）'; b.classList.add('show'); }
      else b.classList.remove('show');
      UI.buttons();
    },
    // タッチ用の右側ボタンの表示を状況に合わせる
    buttons() {
      const A = $('btnA'); if (!A) return;
      if (document.body.dataset.mode !== mode) document.body.dataset.mode = mode;
      const ft = mode === 'play' ? frontTarget() : null;
      A.textContent = input.armed ? '使う' : ft && ft.kind === 'ins' && ft.o.npc ? '話す' : '調べる';
      A.classList.toggle('hot', !!ft);
      $('btnOk').disabled = !(mode === 'dialog' || mode === 'overlay' || mode === 'naming' || (mode === 'play' && ft));
      $('btnCancel').disabled = !(input.armed || mode === 'overlay' || mode === 'dialog' || mode === 'naming');
    },
    menu(page) {
      const box = $('menuBody');
      const fmtPlay = (s) => { s = Math.floor(s); return Math.floor(s / 3600) + ':' + String(Math.floor((s % 3600) / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
      const slotHTML = (s, label, act) => {
        const o = readSlot(s);
        const info = o ? '<span>' + (o.name ? esc(o.name) + ' ・ ' : '') + ELD.ROOMS[o.room].name + ' ・ ' + fmtT(o.time) + ' ・ プレイ ' + fmtPlay(o.play) + '</span>' : '<span>— 空き —</span>';
        return '<button class="slot" data-act="' + act + '" data-slot="' + s + '"' + (act === 'load' && !o ? ' disabled' : '') + '><b>' + label + '</b>' + info + '</button>';
      };
      if (page === 'main') {
        box.innerHTML = '<button data-act="inv">持ち物</button><button data-act="note">推理手帳</button><button data-act="map">地図</button><button data-act="save">セーブ</button><button data-act="loadp">ロード</button>' +
          '<button data-act="endlist">END LIST</button><button data-act="help">操作説明・キー設定</button><button data-act="mk">調査マーカー：' + (settings.markers ? 'ON' : 'OFF') + '</button><button data-act="snd">音：' + (Audio.muted ? 'OFF' : 'ON') + '</button><button data-act="bgm">BGM・環境音：' + (Audio.bgmOff ? 'OFF' : 'ON') + '</button><button data-act="title" class="sub">タイトルへ戻る</button>';
      } else if (page === 'save') {
        box.innerHTML = '<h3>セーブ先を選択</h3>' + [1, 2, 3].map((s) => slotHTML(s, 'スロット ' + s, 'save')).join('') + '<button data-act="back" class="sub">もどる</button>';
      } else if (page === 'load') {
        box.innerHTML = '<h3>ロードするデータ</h3>' + slotHTML('auto', 'オートセーブ', 'load') + [1, 2, 3].map((s) => slotHTML(s, 'スロット ' + s, 'load')).join('') + '<button data-act="back" class="sub">もどる</button>';
      }
    },
    toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); },
  };
  const fmtT = (tm) => { const m = Math.floor((BASE_MIN + tm) % 1440); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

  /* ---------------- 地図UI ---------------- */
  const MapUI = {
    floor: null,
    open() {
      const cur = ELD.ROOMS[S.room].level;
      this.floor = cur;
      this.tabs(); this.draw();
    },
    tabs() {
      const info = mapInfo();
      const box = $('mapTabs'); box.innerHTML = '';
      for (const f of ELD.FLOORS) {
        const any = ELD.ROOM_LIST.some((r) => r.level === f.id && info.known.has(r.id));
        const b = document.createElement('button');
        b.textContent = f.name + (ELD.ROOMS[S.room].level === f.id ? ' ●' : '');
        b.className = this.floor === f.id ? 'on' : '';
        b.disabled = !any;
        b.onclick = () => { this.floor = f.id; this.tabs(); this.draw(); };
        box.appendChild(b);
      }
      const v = Object.keys(S.visited).length, tot = ELD.ROOM_LIST.length;
      $('mapStat').textContent = '探索率 ' + Math.round((v / tot) * 100) + '%（' + v + ' / ' + tot + ' 部屋）';
    },
    draw() {
      const cv = $('mapCv'), box = cv.parentElement;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = box.clientWidth, H = box.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
      const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      const info = mapInfo();
      const rooms = ELD.ROOM_LIST.filter((r) => r.level === this.floor && info.known.has(r.id));
      if (!rooms.length) return;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const r of rooms) { const [x, y, w, h] = r.map; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h); }
      const pad = 18, sc = Math.min(16, (W - pad * 2) / (x1 - x0), (H - pad * 2) / (y1 - y0));
      const ox = (W - (x1 - x0) * sc) / 2 - x0 * sc, oy = (H - (y1 - y0) * sc) / 2 - y0 * sc;
      const rect = (r) => { const [x, y, w, h] = r.map; return [ox + x * sc, oy + y * sc, w * sc, h * sc]; };
      const doorPos = (r, ex) => {
        const [x, y, w, h] = rect(r), wd = ex.w || 1;
        if (ex.side === 'N') return [x + ((ex.at + wd / 2) / r.W) * w, y];
        if (ex.side === 'S') return [x + ((ex.at + wd / 2) / r.W) * w, y + h];
        if (ex.side === 'W') return [x, y + ((ex.at + wd / 2) / r.H) * h];
        if (ex.side === 'E') return [x + w, y + ((ex.at + wd / 2) / r.H) * h];
        return [x + ((ex.x + ex.w / 2) / r.W) * w, y + ((ex.y + ex.h / 2) / r.H) * h];
      };
      // 接続線
      c.lineWidth = 2;
      for (const r of rooms) for (const ex of r.exits) {
        if (ex.to === '@outside' || ex.to === '@none' || ex.side === 'U' || ex.side === 'D') continue;
        const st = info.es(r.id, ex); if (!st.visible) continue;
        const tr = ELD.ROOMS[ex.to.split(':')[0]];
        if (tr.level !== this.floor || !info.known.has(tr.id)) continue;
        const te = tr.exits.find((e) => e.id === ex.to.split(':')[1]);
        const a = doorPos(r, ex), b = doorPos(tr, te);
        c.strokeStyle = st.open ? 'rgba(230,210,160,0.55)' : 'rgba(220,90,80,0.6)';
        c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      }
      // 部屋
      c.font = 'bold ' + Math.max(10, Math.min(13, sc * 1.6)) + 'px "DotGothic16", sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      for (const r of rooms) {
        const [x, y, w, h] = rect(r), vis = info.visited.has(r.id), ac = ELD.AREAS[r.area].color;
        c.fillStyle = vis ? ac + 'cc' : 'rgba(40,36,52,0.6)';
        c.fillRect(x + 1, y + 1, w - 2, h - 2);
        if (vis) { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x + 1, y + h - 4, w - 2, 3); }
        c.setLineDash(vis ? [] : [4, 3]);
        c.strokeStyle = r.id === S.room ? '#fff4c8' : vis ? 'rgba(20,14,24,0.9)' : 'rgba(200,190,220,0.55)';
        c.lineWidth = r.id === S.room ? 2.5 : 1.5;
        c.strokeRect(x + 1, y + 1, w - 2, h - 2);
        c.setLineDash([]);
        c.fillStyle = vis ? '#140e18' : 'rgba(220,210,240,0.7)';
        const label = vis ? r.name.replace(/^(東館|西館) /, '') : '？';
        if (w > 26 && h > 14) c.fillText(label, x + w / 2, y + h / 2, w - 6);
        // 扉・階段アイコン
        for (const ex of r.exits) {
          const st = info.es(r.id, ex); if (!st.visible || (ex.to === '@outside' || ex.to === '@none') && !vis) continue;
          const [dx, dy] = doorPos(r, ex);
          if (ex.side === 'U' || ex.side === 'D') {
            c.fillStyle = st.open ? '#f4e2a0' : '#e06050';
            c.beginPath();
            if (ex.side === 'U') { c.moveTo(dx, dy - 4); c.lineTo(dx + 4, dy + 3); c.lineTo(dx - 4, dy + 3); }
            else { c.moveTo(dx, dy + 4); c.lineTo(dx + 4, dy - 3); c.lineTo(dx - 4, dy - 3); }
            c.fill();
          } else if (!st.open) {
            c.fillStyle = '#e06050'; c.fillRect(dx - 3, dy - 3, 6, 6);
            c.fillStyle = '#300'; c.fillRect(dx - 1, dy - 1, 2, 2);
          } else { c.fillStyle = '#f4e2a0'; c.fillRect(dx - 2, dy - 2, 4, 4); }
        }
      }
      // 現在地
      const cr = ELD.ROOMS[S.room];
      if (cr.level === this.floor) {
        const [x, y, w, h] = rect(cr);
        const px = x + info.px * w, py = y + info.py * h;
        c.fillStyle = '#ff5a5a'; c.beginPath(); c.arc(px, py, 4.5, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
        c.strokeStyle = 'rgba(255,90,90,0.5)'; c.beginPath(); c.arc(px, py, 9, 0, Math.PI * 2); c.stroke();
      }
    },
  };

  /* ---------------- 名前入力画面 ---------------- */
  const NameUI = {
    composing: false, onOk: null, onBack: null, prevMode: null,
    open(onOk, onBack) {
      this.onOk = onOk; this.onBack = onBack; this.prevMode = mode;
      mode = 'naming';
      input.keys.clear(); input.steer = null; input.path = null;
      const inp = $('nameIn');
      inp.value = '';
      $('nameBack').hidden = !onBack;
      $('nameOv').classList.add('show');
      this.update();
      setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); } }, 50);
    },
    close() { $('nameOv').classList.remove('show'); $('nameIn').blur(); },
    // 入力の検査。変換中は文字数を切り詰めない（IMEを壊さないため）
    update(fromInput) {
      const inp = $('nameIn');
      if (fromInput && !this.composing) {
        const g = graphemes(inp.value);
        if (g.length > NAME_MAX) inp.value = g.slice(0, NAME_MAX).join('');
      }
      const n = cleanName(inp.value), err = nameError(n), len = graphemes(n).length;
      $('nameCnt').textContent = len + ' / ' + NAME_MAX;
      $('nameOk').disabled = !!err || this.composing;
      $('nameMsg').textContent = inp.value && err && !this.composing ? err : '';
      $('namePrev').textContent = n ? '招待状の宛名：「' + n + ' 様」' : '';
    },
    submit() {
      if (this.composing) return;
      const n = cleanName($('nameIn').value), err = nameError(n);
      if (err) { $('nameMsg').textContent = err; return; }
      this.close();
      const cb = this.onOk; this.onOk = null;
      cb && cb(n);
    },
    back() {
      this.close();
      const cb = this.onBack; this.onBack = null;
      if (cb) cb(); else mode = this.prevMode;
    },
    bind() {
      const inp = $('nameIn');
      inp.addEventListener('compositionstart', () => { this.composing = true; this.update(); });
      inp.addEventListener('compositionend', () => { this.composing = false; this.update(true); });
      inp.addEventListener('input', (e) => { if (e.isComposing) this.composing = true; this.update(true); });
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        if (e.isComposing || e.keyCode === 229 || this.composing) return; // 変換確定のEnterでは決定しない
        e.preventDefault(); this.submit();
      });
      $('nameOk').addEventListener('click', () => this.submit());
      $('nameBack').addEventListener('click', () => this.back());
    },
  };

  /* =====================================================================
   * 入力
   * ===================================================================== */
  function resize() {
    const W = window.innerWidth, H = window.innerHeight;
    const sc = Math.max(2, Math.round(Math.min(W / (T * 24), H / (T * 14))));
    view.scale = sc;
    view.w = Math.ceil(W / sc); view.h = Math.ceil(H / sc);
    // 画面は実画素で描く（人物スプライトをドットの細かさのまま表示するため）。部屋は sc 倍の整数拡大
    canvas.width = view.w * sc; canvas.height = view.h * sc;
    canvas.style.width = view.w * sc + 'px'; canvas.style.height = view.h * sc + 'px';
    lcv.width = view.w; lcv.height = view.h;
    ctx.imageSmoothingEnabled = false;
    if (rt) snapCam();
    if (mode === 'overlay' && $('mapOv').classList.contains('show')) MapUI.draw();
  }

  // 調べる・話す・決定
  function actionKey() {
    if (mode === 'dialog') advance();
    else if (mode === 'play') interact();
  }
  // 決定ボタン（タッチ）：会話送り / 画面内のボタン決定 / 調べる
  function okKey() {
    if (mode === 'dialog') return advance();
    if (mode === 'naming') return NameUI.submit();
    if (mode === 'overlay') { const a = document.activeElement; if (a && a.tagName === 'BUTTON' && a.closest('.ov.show')) a.click(); return; }
    if (mode === 'play') interact();
  }
  // キャンセル：使用中のアイテムを取り消す / 画面を閉じる / 会話を送る
  function cancelKey(fromKeyboard) {
    if (mode === 'naming') return NameUI.back();
    if (mode === 'dialog') return advance();
    if (mode === 'overlay') { if (ELD.Ending.closeTop()) return; if (!ELD.ItemUI.closeExamine()) UI.close(); return; }
    if (mode === 'play') { if (input.armed) { disarm(); return; } if (fromKeyboard) UI.open('menuOv'); }
  }
  function bindInput() {
    window.addEventListener('keydown', (e) => {
      const tg = e.target && e.target.tagName;
      if (tg === 'INPUT' || tg === 'TEXTAREA' || mode === 'naming') return; // 名前入力中はゲーム操作を止める
      Audio.unlock();
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (Code.isOpen) { e.preventDefault(); Code.key(e.code, e.key); return; }
      if (ELD.DeathScene && ELD.DeathScene.open) { e.preventDefault(); ELD.DeathScene.skip(); return; }
      if (Opening.open) { e.preventDefault(); if (e.code === 'Escape') Opening.skip(); else if (['Enter', 'Space', 'KeyZ', 'KeyE'].includes(e.code)) Opening.next(); return; }
      if ($('deadEnd') && $('deadEnd').classList.contains('show')) { e.preventDefault(); if (['Enter', 'Space', 'KeyZ'].includes(e.code)) $('deadRetry').click(); else if (e.code === 'Escape') $('deadTitleBtn').click(); return; }
      if ($('chEnd').classList.contains('show')) { if (['Enter', 'Space', 'KeyZ', 'Escape'].includes(e.code)) { e.preventDefault(); closeChEnd(); } return; }
      if (ELD.Ending.key(e.code)) { if (['Space', 'Enter', 'Escape'].includes(e.code) && ELD.Ending.Seq.phase !== 'clear') e.preventDefault(); return; }
      if (mode === 'title' || mode === 'ending') return;
      if (mode === 'dialog' && ['ArrowUp', 'KeyW', 'ArrowLeft', 'KeyA'].includes(e.code) && choiceMove(-1)) return;
      if (mode === 'dialog' && ['ArrowDown', 'KeyS', 'ArrowRight', 'KeyD'].includes(e.code) && choiceMove(1)) return;
      if (e.repeat && ['Space', 'Enter', 'KeyE', 'KeyZ'].includes(e.code)) return;
      if (['Space', 'Enter', 'KeyE', 'KeyZ'].includes(e.code)) { actionKey(); return; }
      const toggleOv = (id) => { if (mode === 'play') UI.open(id); else if (mode === 'overlay' && $(id).classList.contains('show')) { if (!ELD.ItemUI.closeExamine()) UI.close(); } };
      if (e.code === 'KeyM' || e.code === 'Tab') { e.preventDefault(); toggleOv('mapOv'); return; }
      if (e.code === 'KeyI') { toggleOv('invOv'); return; }
      if (e.code === 'KeyN') { toggleOv('noteOv'); return; }
      if (e.code === 'KeyH' || e.code === 'F1') { e.preventDefault(); toggleOv('helpOv'); return; }
      if (e.code === 'Escape' || e.code === 'KeyX') { cancelKey(true); return; }
      input.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => input.keys.delete(e.code));
    window.addEventListener('blur', () => input.keys.clear());
    // タッチ / マウス
    let pd = null;
    const toView = (e) => { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * view.w, y: ((e.clientY - r.top) / r.height) * view.h }; };
    canvas.addEventListener('pointerdown', (e) => {
      Audio.unlock();
      if (mode === 'dialog') { advance(); return; }
      if (mode !== 'play' || e.pointerType !== 'mouse') return; // タッチはスティックで移動する
      canvas.setPointerCapture(e.pointerId);
      const p = toView(e);
      pd = { id: e.pointerId, x: p.x, y: p.y, t: performance.now(), steer: false };
      pd.timer = setTimeout(() => { if (pd && !pd.steer) { pd.steer = true; input.path = null; input.steer = pd.cur || { x: pd.x, y: pd.y }; } }, 280);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!pd || e.pointerId !== pd.id) return;
      const p = toView(e); pd.cur = p;
      if (!pd.steer && Math.hypot(p.x - pd.x, p.y - pd.y) > 8) { pd.steer = true; input.path = null; }
      if (pd.steer) input.steer = p;
    });
    const up = (e) => {
      if (!pd || e.pointerId !== pd.id) return;
      clearTimeout(pd.timer);
      if (!pd.steer && mode === 'play') {
        const wx = pd.x + view.camX, wy = pd.y + view.camY;
        const tx = Math.floor(wx / T), ty = Math.floor(wy / T);
        // 足元タイルをタップ → その場で調べる
        const ptx = Math.floor(S.x / T), pty = Math.floor((S.y - 3) / T);
        if (tx === ptx && ty === pty) interact();
        else planTo(tx, ty);
      }
      input.steer = null; pd = null;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    $('btnA').addEventListener('pointerdown', (e) => { e.preventDefault(); Audio.unlock(); actionKey(); });
    $('btnOk').addEventListener('pointerdown', (e) => { e.preventDefault(); Audio.unlock(); okKey(); });
    $('btnCancel').addEventListener('pointerdown', (e) => { e.preventDefault(); Audio.unlock(); cancelKey(false); });
    $('btnNote').onclick = () => { if (mode === 'play') UI.open('noteOv'); };
    // 固定式バーチャルアナログスティック（左下）
    const stick = $('stick'), knob = $('stickKnob');
    let sp = null;
    const setKnob = (dx, dy) => { knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; };
    const stickMove = (e) => {
      const r = stick.getBoundingClientRect(), R = r.width / 2, cx = r.left + R, cy = r.top + R;
      let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy), lim = R * 0.62;
      if (d > lim) { dx = (dx / d) * lim; dy = (dy / d) * lim; }
      setKnob(dx, dy);
      const m = Math.min(1, d / lim);
      input.analog = m < 0.14 ? null : { x: dx / (Math.hypot(dx, dy) || 1), y: dy / (Math.hypot(dx, dy) || 1), m: (m - 0.14) / 0.86 };
    };
    const stickEnd = (e) => { if (!sp || e.pointerId !== sp) return; sp = null; input.analog = null; setKnob(0, 0); stick.classList.remove('act'); };
    stick.addEventListener('pointerdown', (e) => { e.preventDefault(); Audio.unlock(); if (mode === 'dialog') { advance(); return; } sp = e.pointerId; stick.setPointerCapture(e.pointerId); stick.classList.add('act'); stickMove(e); });
    stick.addEventListener('pointermove', (e) => { if (sp === e.pointerId) stickMove(e); });
    stick.addEventListener('pointerup', stickEnd); stick.addEventListener('pointercancel', stickEnd); stick.addEventListener('lostpointercapture', stickEnd);
    $('dialog').addEventListener('pointerdown', (e) => { e.preventDefault(); if (dlg && isChoice(dlg.lines[dlg.i])) return; advance(); });
    $('btnMap').onclick = () => { if (mode === 'play') UI.open('mapOv'); };
    $('btnInv').onclick = () => { if (mode === 'play') UI.open('invOv'); };
    $('btnMenu').onclick = () => { if (mode === 'play') UI.open('menuOv'); };
    for (const b of document.querySelectorAll('[data-close]')) b.onclick = () => UI.close();
    $('menuBody').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const a = b.dataset.act;
      if (a === 'inv') UI.open('invOv');
      else if (a === 'map') UI.open('mapOv');
      else if (a === 'save') { if (b.dataset.slot) { saveSlot(b.dataset.slot); UI.menu('save'); UI.toast('スロット ' + b.dataset.slot + ' にセーブしました'); } else UI.menu('save'); }
      else if (a === 'loadp') UI.menu('load');
      else if (a === 'load') { const o = readSlot(b.dataset.slot); if (o) { UI.close(); mode = 'trans'; trans = { a: 0, phase: 'out', cb: () => { loadData(o); if (mode !== 'naming') mode = 'trans'; UI.toast('ロードしました'); } }; } }
      else if (a === 'back') UI.menu('main');
      else if (a === 'mk') { settings.markers = !settings.markers; UI.menu('main'); }
      else if (a === 'snd') { Audio.toggle(); UI.menu('main'); }
      else if (a === 'bgm') { Audio.toggleBgm(); UI.menu('main'); }
      else if (a === 'note') UI.open('noteOv');
      else if (a === 'help') UI.open('helpOv');
      else if (a === 'endlist') { UI.close(); ELD.Ending.EndList.open(); }
      else if (a === 'title') { UI.close(); toTitle(); }
    });
    $('btnNew').onclick = () => {
      Audio.unlock();
      NameUI.open((n) => { $('title').classList.remove('show'); newGame(n); }, () => { mode = 'title'; });
    };
    $('btnCont').onclick = () => { Audio.unlock(); const o = latestSave(); if (o) { $('title').classList.remove('show'); loadData(o); UI.banner(ELD.AREAS[rt.d.area].name, rt.d.name, false); } };
    $('btnEndList').onclick = () => { Audio.unlock(); ELD.Ending.EndList.open(); };
    window.addEventListener('resize', resize);
  }
  function latestSave() {
    let best = null;
    for (const s of ['auto', 1, 2, 3]) { const o = readSlot(s); if (o && (!best || o.date > best.date)) best = o; }
    return best;
  }
  function toTitle() {
    ELD.Ending.Seq.hide();
    mode = 'title';
    UI.dialog(null);
    const TR = ELD.TITLE_ROOM || { room: 'hall', x: 12.5, y: 10 };
    S = newState(); buildRoom(TR.room); S.x = TR.x * T; S.y = TR.y * T;
    snapCam();
    $('title').classList.add('show');
    $('btnCont').disabled = !latestSave();
  }

  /* ---------------- メインループ ---------------- */
  let last = 0, hudT = 0;
  function loop(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    if (!Game.paused) {
      update(dt);
      if (dlg && dlg.shown < (typeof dlg.lines[dlg.i] === 'string' ? dlg.lines[dlg.i].length : 0)) { dlg.shown += dt * settings.textSpeed; UI.dialog(dlg); }
      if (mode === 'title') { S.x = 12.5 * T + Math.sin(ts / 4000) * 60; S.y = 10 * T + Math.cos(ts / 5000) * 30; }
      render();
      hudT += dt; if (hudT > 0.5) { hudT = 0; UI.hud(); }
      UI.buttons();
    }
    requestAnimationFrame(loop);
  }

  Game.start = function () {
    if (started) return; started = true;
    canvas = $('game'); ctx = canvas.getContext('2d');
    lcv = document.createElement('canvas'); lctx = lcv.getContext('2d');
    resize();
    bindInput();
    NameUI.bind();
    ELD.ItemUI.init(Game.core); bindStoryUI(); loadSprites(); VN.load();
    ELD.Ending.init(Game.core);
    toTitle();
    requestAnimationFrame(loop);
  };

  /* ---------------- 検証・テスト用API ---------------- */
  // アイテム・手帳UI（items.js）へ渡す内部機能
  Game.core = {
    get S() { return S; }, get mode() { return mode; }, set mode(m) { mode = m; },
    has, flag, say, combine, arm, disarm, fmt, esc, checkNotes, afterChange, frontTarget,
    get Audio() { return Audio; }, get UI() { return UI; }, input,
    toTitle: () => toTitle(), retry: () => retry(), hasRetry: () => hasRetry(), newGameFlow: () => newGameFlow(),
  };
  Game.api = {
    get state() { return S; }, get room() { return rt; }, get mode() { return mode; }, get view() { return view; },
    newGame, loadData, combine, arm, disarm, checkNotes, cleanName, nameError, graphemes, NameUI, fmt, saveSlot, readSlot, buildRoom, blocked, solidTile, planTo, interact, advance, frontTarget, exitState, arrival, exitTiles, mapInfo,
    get input() { return input; }, okKey, cancelKey, startEnding, judgeEnding, hasRetry, retry, saveRetry, newGameFlow, toTitle: () => toTitle(), choose, get doorAnim() { return doorAnim; },
    step(dt) { update(dt); if (dlg && dlg.shown < 999) dlg.shown += dt * settings.textSpeed; },
    Opening, render, enterRoom, useExit, cond, UI, MapUI, Audio, bgmKey, Death, restoreCheckpoint, applyRules: () => applyRules(), setMode: (m) => (mode = m), skipTrans() { while (trans) update(0.05); }, fmtTime, dlgState: () => { const l = dlg && dlg.lines[dlg.i]; return l && l.choice ? { choice: l.choice.id } : null; },
  };
  window.addEventListener('DOMContentLoaded', Game.start);
})();
