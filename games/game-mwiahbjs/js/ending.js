/* =====================================================================
 * エンディング：判定・記録・演出・クリア画面・END LIST・全達成
 * データは js/data/endings.js。ゲーム本体とは ELD.Ending.init(core) でつなぐ
 * ===================================================================== */
(function () {
  const ELD = (window.ELD = window.ELD || {});
  const $ = (id) => document.getElementById(id);
  let C = null;

  /* ---------------- 記録（周回・セーブをまたいで残る） ---------------- */
  const REC_KEY = 'eldia_records';
  const mem = {};
  const store = {
    get(k) { try { const v = localStorage.getItem(k); return v != null ? v : mem[k]; } catch (e) { return mem[k]; } },
    set(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const blank = () => ({ v: 1, endings: {}, trueCleared: false, secretUnlocked: false, allComplete: false, allCompleteAt: null });
  const Records = {
    get() {
      let r;
      try { r = JSON.parse(store.get(REC_KEY) || 'null'); } catch (e) { r = null; }
      if (!r || typeof r !== 'object' || !r.endings) r = blank();
      for (const id of Object.keys(r.endings)) if (!ELD.ENDINGS[id]) delete r.endings[id];
      r.trueCleared = !!(r.trueCleared || r.endings.true);
      r.secretUnlocked = r.trueCleared;
      return r;
    },
    put(r) { store.set(REC_KEY, JSON.stringify(r)); },
    // エンディング到達を記録。初回かどうか・新しく解放されたものを返す
    add(id, play, at) {
      const r = this.get(), now = at || Date.now();
      const e = r.endings[id] || (r.endings[id] = { first: now, count: 0, firstPlay: play, bestPlay: play });
      const first = e.count === 0;
      e.count++; e.last = now; e.lastPlay = play; e.bestPlay = Math.min(e.bestPlay == null ? play : e.bestPlay, play);
      const wasTrue = r.trueCleared;
      if (id === 'true') r.trueCleared = true;
      r.secretUnlocked = r.trueCleared;
      const all = ELD.ENDING_LIST.every((k) => r.endings[k]);
      const newComplete = all && !r.allComplete;
      if (newComplete) { r.allComplete = true; r.allCompleteAt = now; }
      this.put(r);
      return { rec: r, first, newSecret: !wasTrue && r.trueCleared, newComplete };
    },
    // セーブデータ側の到達記録を取り込む（記録だけ消えた場合の復元。記録は減らさない）
    merge(clears) {
      if (!Array.isArray(clears) || !clears.length) return;
      const r = this.get(); let ch = false;
      const byId = {};
      for (const c of clears) if (c && ELD.ENDINGS[c.id]) (byId[c.id] = byId[c.id] || []).push(c);
      for (const [id, list] of Object.entries(byId)) {
        const e = r.endings[id];
        const first = Math.min(...list.map((c) => c.at || Date.now())), best = Math.min(...list.map((c) => c.play || 0));
        if (!e) { r.endings[id] = { first, count: list.length, firstPlay: list[0].play, bestPlay: best, last: Math.max(...list.map((c) => c.at || 0)) }; ch = true; }
        else {
          if (e.count < list.length) { e.count = list.length; ch = true; }
          if (first < e.first) { e.first = first; ch = true; }
        }
      }
      if (r.endings.true && !r.trueCleared) { r.trueCleared = true; ch = true; }
      r.secretUnlocked = r.trueCleared;
      if (ELD.ENDING_LIST.every((k) => r.endings[k]) && !r.allComplete) { r.allComplete = true; r.allCompleteAt = Date.now(); ch = true; }
      if (ch) this.put(r);
    },
    reset() { this.put(blank()); },
  };

  /* ---------------- 判定 ---------------- */
  function evalCond(c, S, rec) {
    if (!c) return true;
    if (c.all) return c.all.every((x) => evalCond(x.cond || x, S, rec));
    if (c.any) return c.any.some((x) => evalCond(x.cond || x, S, rec));
    const has = (i) => S.inv.includes(i) || (S.used || []).includes(i);
    if (c.flag && ![].concat(c.flag).every((f) => S.flags[f])) return false;
    if (c.anyflag && ![].concat(c.anyflag).some((f) => S.flags[f])) return false;
    if (c.trustMin) for (const k in c.trustMin) if (((S.trust || {})[k] || 0) < c.trustMin[k]) return false;
    if (c.noflag && [].concat(c.noflag).some((f) => S.flags[f])) return false;
    if (c.items && !c.items.every(has)) return false;
    if (c.notes && !c.notes.every((n) => S.notes && S.notes[n])) return false;
    if (c.examined && !(S.examined && S.examined[c.examined])) return false;
    const v = (S.victims || []).length;
    if (c.victimsMax != null && v > c.victimsMax) return false;
    if (c.victimsAtLeast != null && v < c.victimsAtLeast) return false;
    if (c.trueCleared && !(rec || Records.get()).trueCleared) return false;
    return true;
  }
  function judge(S, rec) {
    rec = rec || Records.get();
    for (const id of ELD.ENDING_ORDER) if (evalCond(ELD.ENDING_RULES[id], S, rec)) return id;
    return 'normal';
  }
  // 各条件の達成状況（テスト・デバッグ用）
  function report(S, rec) {
    rec = rec || Records.get();
    const out = {};
    for (const id of ELD.ENDING_ORDER) {
      const R = ELD.ENDING_RULES[id], list = R.all || R.any || [];
      out[id] = list.map((x) => ({ id: x.id, label: x.label, ok: evalCond(x.cond, S, rec) }));
    }
    return out;
  }

  /* ---------------- クリア画面の集計 ---------------- */
  function summary(S) {
    S = S || { inv: [], used: [], victims: [], notes: {}, flags: {} };
    const v = S.victims || [];
    const victims = v.length ? v.length + '人（' + v.map((x) => typeof x === 'string' ? x : x.name + '・第' + x.ch + '章' + (x.cause ? '・' + x.cause : '')).join('、') + '）' : 'なし';
    const dead = new Set(v.map((x) => (typeof x === 'string' ? x : x.name)));
    const cast = ELD.CAST || [];
    const survivors = cast.length ? cast.filter((n) => !dead.has(n)).join('、') + '（' + cast.filter((n) => !dead.has(n)).length + '人）' : '';
    const status = (ELD.TRUE_REQ || []).filter((r) => r.res).map((r) => ({ label: r.res, ok: evalCond(r.cond, S) }));
    const has = (i) => (S.inv || []).includes(i) || (S.used || []).includes(i);
    const key = ELD.KEY_FLAGS || ELD.KEY_EVIDENCE || [], got = key.filter((k) => ELD.KEY_FLAGS ? S.flags && S.flags[k] : has(k)).length;
    const notes = ELD.NOTES || [], rec = notes.filter((n) => S.notes && S.notes[n.id]).length;
    const evidence = '重要な証拠 ' + got + ' / ' + key.length + '、推理手帳の記録率 ' + (notes.length ? Math.round((rec / notes.length) * 100) : 0) + '%';
    return { victims, survivors, status, evidence };
  }

  /* ---------------- 一枚絵（ドット絵を手続き的に描く） ---------------- */
  const W = 320, H = 180;
  const rnd = (s) => { let x = Math.sin(s * 127.1) * 43758.5453; return x - Math.floor(x); };
  function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function sky(g, stops) {
    // 帯状の空（ディザ付き）
    const n = stops.length - 1;
    for (let y = 0; y < H; y++) {
      const t = (y / H) * n, i = Math.min(n - 1, Math.floor(t)), f = t - i;
      const a = stops[i], b = stops[i + 1];
      for (let x = 0; x < W; x += 2) {
        const d = ((x >> 1) + y) % 2 ? 0.06 : -0.06, k = Math.max(0, Math.min(1, f + d));
        g.fillStyle = 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * k) + ',' + Math.round(a[1] + (b[1] - a[1]) * k) + ',' + Math.round(a[2] + (b[2] - a[2]) * k) + ')';
        g.fillRect(x, y, 2, 1);
      }
    }
  }
  function manor(g, base, lit, t, opt) {
    opt = opt || {};
    const gy = 132;
    // 両翼
    px(g, 40, 92, 96, gy - 92, base); px(g, 184, 92, 96, gy - 92, base);
    for (let i = 0; i < 12; i++) { px(g, 40 + i * 8, 86 - (i % 2) * 2, 6, 8, base); px(g, 184 + i * 8, 86 - (i % 2) * 2, 6, 8, base); }
    // 中央棟と時計塔
    px(g, 128, 78, 64, gy - 78, base);
    px(g, 146, 34, 28, 48, base);
    for (let i = 0; i < 14; i++) px(g, 160 - i, 34 - i * 1.4, i * 2, 2, base);
    px(g, 159, 8, 2, 8, base);
    // 時計盤
    const cl = opt.clock || 'rgba(240,220,160,0.85)';
    g.fillStyle = cl; g.beginPath(); g.arc(160, 52, 8, 0, Math.PI * 2); g.fill();
    g.strokeStyle = base; g.lineWidth = 1.5; g.beginPath(); g.moveTo(160, 52); g.lineTo(160 + Math.sin(opt.hand || 0) * 6, 52 - Math.cos(opt.hand || 0) * 6); g.moveTo(160, 52); g.lineTo(160 + 4, 52); g.stroke();
    // 窓
    for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) {
      for (const ox of [46, 190]) {
        const k = rnd(r * 31 + i * 7 + ox);
        const on = k < (opt.windows == null ? 0.35 : opt.windows);
        const fl = on ? 0.7 + Math.sin(t * 2 + k * 9) * 0.15 : 0;
        px(g, ox + i * 10, 96 + r * 11, 5, 6, on ? 'rgba(' + lit + ',' + fl + ')' : 'rgba(0,0,0,0.35)');
      }
    }
    for (let i = 0; i < 4; i++) px(g, 136 + i * 14, 90, 6, 10, 'rgba(' + lit + ',' + (opt.center == null ? 0.6 : opt.center) + ')');
    // 正面扉
    px(g, 152, gy - 18, 16, 18, opt.door || 'rgba(0,0,0,0.6)');
  }
  function ground(g, c1, c2) { for (let y = 132; y < H; y++) { const k = (y - 132) / (H - 132); px(g, 0, y, W, 1, k < 0.5 ? c1 : c2); } }
  function fog(g, t, a, c) {
    for (let i = 0; i < 6; i++) {
      const y = 120 + i * 9, x = ((t * (6 + i * 2) + i * 70) % (W + 160)) - 160;
      g.fillStyle = 'rgba(' + c + ',' + a * (1 - i * 0.12) + ')';
      g.fillRect(x, y, 160, 4); g.fillRect(x + 30, y + 2, 120, 4); g.fillRect(x - W - 20, y, 200, 4);
    }
  }
  const SCENES = {
    normal(g, t) {
      sky(g, [[14, 18, 38], [40, 52, 82], [96, 106, 130], [150, 150, 160]]);
      for (let i = 0; i < 30; i++) if (rnd(i) < 0.6) px(g, rnd(i + 1) * W, rnd(i + 2) * 60, 1, 1, 'rgba(255,255,255,' + (0.3 + 0.3 * Math.sin(t * 2 + i)) + ')');
      manor(g, '#1a1c28', '255,214,150', t, { windows: 0.12, center: 0.2, clock: 'rgba(200,200,190,0.5)', hand: 5.9 });
      ground(g, '#20222c', '#16171e');
      // 門
      for (let i = 0; i < 18; i++) px(g, 6 + i * 6, 112, 2, 50, '#0d0e14');
      for (let i = 0; i < 18; i++) px(g, 210 + i * 6, 112, 2, 50, '#0d0e14');
      px(g, 4, 116, 110, 2, '#0d0e14'); px(g, 208, 116, 110, 2, '#0d0e14');
      fog(g, t, 0.25, '200,210,225');
      // 届いた封筒
      const ey = 146 + Math.sin(t * 1.2) * 1.5;
      px(g, 236, ey, 52, 30, '#e8e0cc'); px(g, 236, ey, 52, 2, '#fff8e8');
      for (let i = 0; i < 26; i++) px(g, 236 + i, ey + i * 0.55, 1, 1, '#b8ae98'), px(g, 287 - i, ey + i * 0.55, 1, 1, '#b8ae98');
      g.fillStyle = '#7a1e22'; g.beginPath(); g.arc(262, ey + 15, 4, 0, Math.PI * 2); g.fill();
    },
    bad(g, t) {
      sky(g, [[30, 22, 26], [70, 46, 42], [120, 72, 56], [70, 60, 60]]);
      manor(g, '#141012', '255,120,60', t, { windows: 0.08, center: 0.0, clock: 'rgba(120,100,90,0.5)', hand: 3.1 });
      // 地下の炎
      for (let i = 0; i < 10; i++) { const f = 0.5 + 0.5 * Math.sin(t * 6 + i); px(g, 60 + i * 22, 128, 10, 4, 'rgba(255,' + Math.round(110 + 60 * f) + ',40,' + (0.5 + f * 0.4) + ')'); }
      // 煙
      for (let i = 0; i < 40; i++) {
        const life = ((t * 0.25 + rnd(i) * 3) % 3) / 3, x = 70 + rnd(i + 9) * 180 + Math.sin(life * 6 + i) * 10 + life * 40, y = 128 - life * 130;
        px(g, x, y, 6 + life * 10, 4 + life * 6, 'rgba(60,54,56,' + (0.5 * (1 - life)) + ')');
      }
      ground(g, '#1a1416', '#100c0e');
      // 雨
      for (let i = 0; i < 70; i++) { const x = (rnd(i) * W + t * 40) % W, y = (rnd(i + 3) * H + t * 220) % H; px(g, x, y, 1, 5, 'rgba(180,170,180,0.25)'); }
      // 灰
      for (let i = 0; i < 24; i++) { const y = (rnd(i + 7) * H + t * 12) % H; px(g, (rnd(i + 5) * W + Math.sin(t + i) * 8) % W, y, 2, 1, 'rgba(200,190,180,0.4)'); }
    },
    true(g, t) {
      sky(g, [[40, 44, 96], [170, 96, 120], [250, 170, 110], [255, 226, 160]]);
      // 朝日と光芒
      const cx = 160, cy = 120;
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + t * 0.05;
        g.fillStyle = 'rgba(255,220,150,' + (0.06 + 0.04 * Math.sin(t + i)) + ')';
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 400, cy + Math.sin(a) * 400); g.lineTo(cx + Math.cos(a + 0.12) * 400, cy + Math.sin(a + 0.12) * 400); g.fill();
      }
      g.restore();
      g.fillStyle = '#fff2c0'; g.beginPath(); g.arc(cx, cy, 26, 0, Math.PI * 2); g.fill();
      manor(g, '#3a2a3a', '255,230,170', t, { windows: 0.6, center: 0.8, clock: 'rgba(255,240,200,0.95)', hand: 0, door: 'rgba(255,230,170,0.9)' });
      ground(g, '#4a3a3a', '#2e2428');
      fog(g, t, 0.18, '255,230,200');
      // 鳥
      for (let i = 0; i < 5; i++) { const x = (t * 18 + i * 40) % (W + 40) - 20, y = 40 + i * 6 + Math.sin(t * 3 + i) * 3, w = Math.sin(t * 10 + i) > 0 ? 1 : 0; px(g, x, y, 2, 1, '#3a2a30'); px(g, x - 2, y - w, 2, 1, '#3a2a30'); px(g, x + 2, y - w, 2, 1, '#3a2a30'); }
      // 金の粒
      for (let i = 0; i < 40; i++) { const life = ((t * 0.2 + rnd(i)) % 1); px(g, rnd(i + 2) * W + Math.sin(t + i) * 6, H - life * H, 1, 1, 'rgba(255,230,140,' + (1 - life) + ')'); }
    },
    secret(g, t) {
      sky(g, [[10, 6, 30], [34, 18, 70], [70, 40, 110], [40, 30, 70]]);
      // 星
      for (let i = 0; i < 90; i++) { const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * (0.6 + rnd(i) * 2) + i)); px(g, rnd(i) * W, rnd(i + 50) * 110, 1, 1, 'rgba(255,250,230,' + tw + ')'); }
      // オーロラ
      for (let x = 0; x < W; x += 2) { const y = 30 + Math.sin(x * 0.03 + t * 0.6) * 10 + Math.sin(x * 0.011 - t * 0.3) * 8; px(g, x, y, 2, 18, 'rgba(160,120,255,0.10)'); px(g, x, y + 6, 2, 8, 'rgba(255,210,160,0.08)'); }
      // 月
      g.fillStyle = '#fff4d0'; g.beginPath(); g.arc(262, 34, 12, 0, Math.PI * 2); g.fill(); g.fillStyle = '#22134a'; g.beginPath(); g.arc(267, 30, 11, 0, Math.PI * 2); g.fill();
      manor(g, '#120c22', '255,220,170', t, { windows: 0.2, center: 0.3, clock: 'rgba(255,230,190,0.95)', hand: 0 });
      // 鐘楼の灯り
      g.save(); g.globalCompositeOperation = 'lighter'; const gl = 0.25 + 0.1 * Math.sin(t * 2); g.fillStyle = 'rgba(255,200,140,' + gl + ')'; g.beginPath(); g.arc(160, 52, 22, 0, Math.PI * 2); g.fill(); g.restore();
      // 音符が昇る
      for (let i = 0; i < 9; i++) {
        const life = ((t * 0.12 + i / 9) % 1), x = 160 + Math.sin(life * 8 + i) * (10 + life * 50), y = 50 - life * 60;
        const a = 1 - life; g.fillStyle = 'rgba(255,236,190,' + a + ')';
        g.fillRect(x, y, 3, 2); g.fillRect(x + 2, y - 6, 1, 7); g.fillRect(x + 3, y - 6, 2, 1);
      }
      ground(g, '#140e24', '#0c0818');
      // 手前のボイスレコーダーと波形
      px(g, 120, 150, 80, 22, '#2a2436'); px(g, 120, 150, 80, 2, '#4a405e'); px(g, 126, 155, 42, 12, '#0c1a14');
      for (let i = 0; i < 40; i++) { const h = 1 + Math.abs(Math.sin(t * 6 + i * 0.7) * Math.sin(i * 0.3 + t)) * 5; px(g, 127 + i, 161 - h, 1, h * 2, '#7cffc0'); }
      g.fillStyle = '#ff5050'; g.beginPath(); g.arc(186, 161, 3, 0, Math.PI * 2); g.fill();
    },
    complete(g, t) {
      sky(g, [[20, 12, 34], [50, 30, 70], [30, 20, 50]]);
      for (let i = 0; i < 70; i++) px(g, rnd(i) * W, rnd(i + 9) * H, 1, 1, 'rgba(255,240,210,' + (0.3 + 0.7 * Math.abs(Math.sin(t + i))) + ')');
      // 紋章
      const cx = 160, cy = 92;
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,210,140,0.12)'; g.beginPath(); g.arc(cx, cy, 64 + Math.sin(t) * 3, 0, Math.PI * 2); g.fill(); g.restore();
      g.strokeStyle = '#d8b25a'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 40, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(cx, cy, 33, 0, Math.PI * 2); g.stroke();
      // 4本の鍵（各エンディングの色）
      ELD.ENDING_LIST.forEach((id, i) => {
        const a = -Math.PI / 2 + (i / 4) * Math.PI * 2 + t * 0.15, col = ELD.ENDINGS[id].color;
        const x = cx + Math.cos(a) * 58, y = cy + Math.sin(a) * 58;
        g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2);
        g.fillStyle = col; g.beginPath(); g.arc(0, -8, 5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#20142c'; g.beginPath(); g.arc(0, -8, 2, 0, Math.PI * 2); g.fill();
        g.fillStyle = col; g.fillRect(-1, -3, 3, 16); g.fillRect(2, 8, 4, 2); g.fillRect(2, 11, 3, 2);
        g.restore();
      });
      // 中央の時計
      g.fillStyle = '#f6e6bd'; g.beginPath(); g.arc(cx, cy, 14, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#3a2a1a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(t) * 10, cy - Math.cos(t) * 10); g.moveTo(cx, cy); g.lineTo(cx, cy - 7); g.stroke();
      for (let i = 0; i < 30; i++) { const life = (t * 0.3 + rnd(i)) % 1, a = rnd(i + 4) * Math.PI * 2, r = 20 + life * 90; px(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1, 1, 'rgba(255,230,160,' + (1 - life) + ')'); }
    },
  };
  // 一枚絵をキャンバスに描き続ける
  function Painter(cv, scene) {
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    let raf = 0, t0 = performance.now(), alive = true;
    const loop = (ts) => { if (!alive) return; const t = (ts - t0) / 1000; try { SCENES[scene](g, t); } catch (e) { console.error(e); } raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    SCENES[scene](g, 0);
    return { stop() { alive = false; cancelAnimationFrame(raf); } };
  }

  /* ---------------- 日付・時間の表示 ---------------- */
  const fmtDate = (ts) => { const d = new Date(ts); const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); };
  const fmtPlay = (s) => { s = Math.floor(s || 0); return Math.floor(s / 3600) + ':' + String(Math.floor((s % 3600) / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------------- エンディング演出 → クリア画面 ---------------- */
  const Seq = {
    id: null, lines: [], i: 0, painter: null, timer: 0, phase: 'off', info: null, typing: 0, onDone: null,
    play(id, info) {
      const E = ELD.ENDINGS[id];
      this.id = id; this.info = info; this.i = -1; this.phase = 'story';
      this.lines = E.lines.map((l) => (typeof l === 'string' ? { t: C.fmt(l) } : { t: C.fmt(l.rec), rec: true }));
      const root = $('endSeq');
      root.className = 'show k-' + id + (E.special ? ' special' : '');
      $('endSkip').hidden = false;
      root.style.setProperty('--ec', E.color);
      $('endClear').classList.remove('show'); $('endTitleAnim').classList.remove('show');
      $('endLine').textContent = ''; $('endLine').classList.remove('rec');
      if (this.painter) this.painter.stop();
      this.painter = Painter($('endArt'), E.scene);
      C.Audio.ending(E.bgm);
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.next(), E.special ? 2200 : 1600);
    },
    next() {
      if (this.phase !== 'story') return;
      clearTimeout(this.timer);
      const el = $('endLine');
      // 文字送り中なら全文を出す
      if (this.typing && this.i >= 0 && el.dataset.full && el.textContent !== el.dataset.full) { clearInterval(this.typing); this.typing = 0; el.textContent = el.dataset.full; this.auto(); return; }
      this.i++;
      if (this.i >= this.lines.length) { this.titleAnim(); return; }
      const L = this.lines[this.i];
      el.classList.remove('in'); void el.offsetWidth;
      el.classList.toggle('rec', !!L.rec); el.classList.add('in');
      $('endRec').classList.toggle('show', !!L.rec);
      if (L.rec) C.Audio.lullaby();
      el.dataset.full = L.t; el.textContent = '';
      let k = 0; clearInterval(this.typing);
      const chars = Array.from(L.t), sp = L.rec ? 90 : 45;
      this.typing = setInterval(() => { k++; el.textContent = chars.slice(0, k).join(''); if (k >= chars.length) { clearInterval(this.typing); this.typing = 0; this.auto(); } }, sp);
    },
    auto() { const L = this.lines[this.i]; clearTimeout(this.timer); this.timer = setTimeout(() => this.next(), (L.rec ? 5200 : 2600) + L.t.length * 20); },
    skip() { if (this.phase === 'story') { clearTimeout(this.timer); clearInterval(this.typing); this.titleAnim(true); } else if (this.phase === 'title') this.clear(); },
    titleAnim(skipped) {
      this.phase = 'title';
      clearTimeout(this.timer); clearInterval(this.typing);
      $('endLine').textContent = ''; $('endRec').classList.remove('show');
      const E = ELD.ENDINGS[this.id];
      $('etKind').textContent = E.kind + ' END';
      $('etName').textContent = E.name;
      const ta = $('endTitleAnim'); ta.classList.remove('show'); void ta.offsetWidth; ta.classList.add('show');
      C.Audio.sfx(E.special ? 'important' : 'chime');
      this.timer = setTimeout(() => this.clear(), skipped ? 1400 : E.special ? 4200 : 3200);
    },
    clear() {
      this.phase = 'clear'; clearTimeout(this.timer);
      const E = ELD.ENDINGS[this.id], info = this.info;
      $('endTitleAnim').classList.remove('show'); $('endSkip').hidden = true;
      $('ecKind').textContent = E.kind + ' END';
      $('ecName').textContent = '「' + E.name + '」';
      // 結末の説明（必須・2〜3文）と、犠牲者・生存者・解決状況・証拠の達成状況
      const S = C.S, victims = (S && S.victims) || [];
      $('ecMsg').textContent = C.fmt((E.summary || E.message).replace('{all}', victims.length ? '生き残った者が' : '全員が'));
      $('ecSub').textContent = E.summary ? C.fmt(E.message) : '';
      const sum = summary(S);
      $('ecVictims').textContent = sum.victims;
      $('ecSurvRow').hidden = !sum.survivors; $('ecSurv').textContent = sum.survivors || '';
      $('ecStatus').innerHTML = sum.status.map((x) => '<span class="' + (x.ok ? 'ok' : 'ng') + '">' + esc(x.label) + '：' + (x.ok ? '証明' : '未証明') + '</span>').join('');
      $('ecEvid').textContent = sum.evidence;
      $('ecPlay').textContent = fmtPlay(info.play);
      $('ecCount').textContent = info.rec.endings[this.id].count + '回目';
      const notes = [];
      if (info.first) notes.push('初到達');
      if (info.newSecret) notes.push('SECRET END が解放された');
      $('ecNew').innerHTML = notes.map((n) => '<span>' + esc(n) + '</span>').join('');
      $('ecDone').textContent = ELD.ENDING_LIST.filter((k) => info.rec.endings[k]).length + ' / ' + ELD.ENDING_LIST.length;
      $('ecRetry').disabled = !C.hasRetry();
      $('endClear').classList.add('show');
      setTimeout(() => { const b = $('ecTitle'); b && b.focus({ preventScroll: true }); }, 50);
      if (info.newComplete) setTimeout(() => Complete.open(true), 900);
    },
    hide() {
      clearTimeout(this.timer); clearInterval(this.typing);
      if (this.painter) this.painter.stop(); this.painter = null;
      if ($('endSeq').className) C.Audio.area(null);
      $('endSeq').className = ''; this.phase = 'off';
      Complete.close(); EndList.close();
    },
    bind() {
      $('endSeq').addEventListener('pointerdown', (e) => { if (e.target.closest('button') || e.target.closest('#endClear')) return; C.Audio.unlock(); if (this.phase === 'story') this.next(); else if (this.phase === 'title') this.clear(); });
      $('endSkip').onclick = (e) => { e.stopPropagation(); this.skip(); };
      $('ecTitle').onclick = () => { this.hide(); C.toTitle(); };
      $('ecRetry').onclick = () => { this.hide(); C.retry(); };
      $('ecNew2').onclick = () => { this.hide(); C.newGameFlow(); };
      $('ecList').onclick = () => EndList.open();
    },
    key(code) {
      if (Complete.shown()) { if (code === 'Escape' || code === 'Enter' || code === 'Space' || code === 'KeyX') Complete.close(); return true; }
      if (EndList.shown()) { if (code === 'Escape' || code === 'KeyX') EndList.close(); return true; }
      if (this.phase === 'story') { if (code === 'Escape' || code === 'KeyS') this.skip(); else if (code === 'Enter' || code === 'Space' || code === 'KeyE') this.next(); return true; }
      if (this.phase === 'title') { this.clear(); return true; }
      return false; // クリア画面はボタン操作（Tab / Enter）
    },
  };

  /* ---------------- END LIST ---------------- */
  const EndList = {
    prev: null,
    shown() { return $('endListOv').classList.contains('show'); },
    open() {
      this.render();
      $('endListOv').classList.add('show');
      if (C.mode === 'play') { this.prev = 'play'; C.mode = 'overlay'; } else this.prev = null;
      setTimeout(() => $('elClose').focus({ preventScroll: true }), 30);
    },
    close() {
      if (!this.shown()) return false;
      $('endListOv').classList.remove('show');
      if (this.prev === 'play' && C.mode === 'overlay') C.mode = 'play';
      this.prev = null; return true;
    },
    render() {
      const r = Records.get(), box = $('elBody'); box.innerHTML = '';
      for (const id of ELD.ENDING_LIST) {
        const E = ELD.ENDINGS[id], e = r.endings[id];
        const locked = id === 'secret' && !r.secretUnlocked;
        const card = document.createElement('div');
        card.className = 'elc' + (e ? ' got k-' + id : '') + (locked ? ' locked' : '');
        card.style.setProperty('--ec', e ? E.color : '#5a5068');
        if (e) {
          card.innerHTML = '<div class="elk">' + esc(E.kind) + ' END</div><div class="eln">「' + esc(E.name) + '」</div>' +
            '<dl><dt>初回到達</dt><dd>' + fmtDate(e.first) + '</dd><dt>到達回数</dt><dd>' + e.count + '回</dd><dt>最短クリア</dt><dd>' + fmtPlay(e.bestPlay) + '</dd></dl>';
        } else {
          card.innerHTML = '<div class="elk">？？？</div><div class="eln">？？？</div><p class="elh">' + (locked ? '🔒 未解放' : 'まだ見ていない結末') + '</p>';
        }
        box.appendChild(card);
      }
      const n = ELD.ENDING_LIST.filter((k) => r.endings[k]).length;
      $('elStat').textContent = '達成 ' + n + ' / ' + ELD.ENDING_LIST.length + (r.allComplete ? '　★ ALL ENDINGS COMPLETE（' + fmtDate(r.allCompleteAt) + '）' : '');
      $('elComplete').hidden = !r.allComplete;
    },
    bind() {
      $('elClose').onclick = () => this.close();
      $('elComplete').onclick = () => Complete.open(false);
    },
  };

  /* ---------------- 全エンディング達成 ---------------- */
  const Complete = {
    painter: null,
    shown() { return $('completeOv').classList.contains('show'); },
    open(fresh) {
      const r = Records.get(); if (!r.allComplete) return;
      $('cpMsg').textContent = ELD.ENDING_COMPLETE.message;
      $('cpDate').textContent = '達成日 ' + fmtDate(r.allCompleteAt);
      $('cpList').innerHTML = ELD.ENDING_LIST.map((id) => { const E = ELD.ENDINGS[id], e = r.endings[id]; return '<li style="--ec:' + E.color + '"><b>' + E.kind + ' END</b><span>「' + esc(E.name) + '」</span><i>' + (e ? '✓ ' + e.count + '回' : '—') + '</i></li>'; }).join('');
      const ov = $('completeOv'); ov.classList.toggle('fresh', !!fresh); ov.classList.add('show');
      if (this.painter) this.painter.stop(); this.painter = Painter($('cpArt'), 'complete');
      if (fresh) C.Audio.sfx('important');
      setTimeout(() => $('cpClose').focus({ preventScroll: true }), 30);
    },
    close() { if (!this.shown()) return false; $('completeOv').classList.remove('show'); if (this.painter) this.painter.stop(); this.painter = null; return true; },
    bind() { $('cpClose').onclick = () => this.close(); },
  };

  ELD.Ending = {
    init(core) { C = core; Seq.bind(); EndList.bind(); Complete.bind(); },
    Records, evalCond, judge, report, summary, Seq, EndList, Complete, SCENES, fmtPlay, fmtDate,
    play(id, info) { Seq.play(id, info); },
    key(code) { return Seq.phase !== 'off' || EndList.shown() || Complete.shown() ? Seq.key(code) : false; },
    // オーバーレイ類を閉じる（閉じたら true）
    closeTop() { return Complete.close() || EndList.close(); },
  };
})();
