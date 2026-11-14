/* MINT DRIFT — QUVERIS
   Self-contained: no dependency on the portal. Works standalone or inside an iframe. */
(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const btnPause = document.getElementById("btn-pause");
  const btnMute = document.getElementById("btn-mute");
  const btnFs = document.getElementById("btn-fs");

  const C = { mint: "#81f5c4", mint2: "#4fd6a0", purple: "#9b6bff", purple2: "#c4a8ff", text: "#e8edf8", dim: "#5d6789", bg: "#03060f" };

  /* ---------------- storage (may throw in private mode / sandboxed iframes) */
  const store = {
    get(k, d) { try { const v = localStorage.getItem("quveris.mintdrift." + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem("quveris.mintdrift." + k, JSON.stringify(v)); } catch (_) {} }
  };

  /* ---------------- audio: synthesized, so there are no files to fail */
  const audio = {
    ctx: null, muted: store.get("muted", false),
    unlock() {
      if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {}); return; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      } catch (_) { this.ctx = null; }
    },
    blip(freq, dur = 0.08, type = "square", vol = 0.05, slide = 0) {
      if (this.muted || !this.ctx || this.ctx.state !== "running") return;
      try {
        const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.02);
      } catch (_) {}
    }
  };
  const setMuteUI = () => { btnMute.setAttribute("aria-pressed", String(audio.muted)); btnMute.textContent = audio.muted ? "×" : "♪"; };
  setMuteUI();

  /* ---------------- sizing */
  let W = 0, H = 0, U = 1, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    U = Math.min(W, H) / 100;
    if (player) { player.x = clamp(player.x, 0, W); player.y = clamp(player.y, 0, H); }
    initStars();
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------------- state */
  let state = "title"; // title | play | pause | over
  let player, shards, orbs, particles, stars;
  let score, best = store.get("best", 0), combo, hp, time, spawnT, orbT, invuln, shake, newBest;
  const keys = new Set();
  const pointer = { active: false, x: 0, y: 0, offY: 0, mouse: false };

  function initStars() {
    stars = Array.from({ length: Math.round((W * H) / 9000) + 20 }, () => ({ x: rand(0, W), y: rand(0, H), z: rand(0.2, 1) }));
  }
  function reset() {
    player = { x: W / 2, y: H * 0.78, r: 2.6 * U, vx: 0, vy: 0, trail: [] };
    shards = []; orbs = []; particles = [];
    score = 0; combo = 1; hp = 3; time = 0; spawnT = 0.6; orbT = 0.4; invuln = 0; shake = 0; newBest = false;
  }

  function start() {
    audio.unlock();
    reset(); state = "play";
    audio.blip(440, 0.1, "square", 0.05, 440);
  }
  function setPause(p) {
    if (state !== "play" && state !== "pause") return;
    state = p ? "pause" : "play";
    btnPause.textContent = p ? "▶" : "II";
    keys.clear(); pointer.active = false;
  }
  function gameOver() {
    state = "over";
    if (score > best) { best = score; newBest = true; store.set("best", best); }
    audio.blip(220, 0.5, "sawtooth", 0.06, -180);
    burst(player.x, player.y, C.mint, 40);
  }

  /* ---------------- spawning */
  function difficulty() { return Math.min(1, time / 120); }
  function spawnShard() {
    const d = difficulty();
    const s = rand(1.6, 3.4) * U * (1 + d * 0.4);
    shards.push({ x: rand(s, W - s), y: -s * 2, s, vy: rand(22, 34) * U * (1 + d * 1.3) / 1, vx: rand(-4, 4) * U * d, rot: rand(0, 6.28), vr: rand(-3, 3) });
  }
  function spawnOrb() {
    orbs.push({ x: rand(4 * U, W - 4 * U), y: -3 * U, r: 1.7 * U, vy: rand(16, 22) * U, ph: rand(0, 6.28) });
  }
  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(10, 45) * U;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.3, 0.8), max: 0.8, color, s: rand(0.4, 1) * U });
    }
  }

  /* ---------------- update */
  function update(dt) {
    // stars always drift
    const sp = state === "play" ? 1 + difficulty() * 2 : 0.4;
    for (const s of stars) { s.y += s.z * 12 * U * sp * dt; if (s.y > H) { s.y = 0; s.x = rand(0, W); } }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96;
      if (p.life <= 0) particles.splice(i, 1);
    }
    shake = Math.max(0, shake - dt * 30);
    if (state !== "play") return;

    time += dt;
    invuln = Math.max(0, invuln - dt);

    // movement
    const speed = 70 * U;
    let kx = 0, ky = 0;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) kx -= 1;
    if (keys.has("ArrowRight") || keys.has("KeyD")) kx += 1;
    if (keys.has("ArrowUp") || keys.has("KeyW")) ky -= 1;
    if (keys.has("ArrowDown") || keys.has("KeyS")) ky += 1;
    if (kx || ky) {
      const l = Math.hypot(kx, ky); player.x += (kx / l) * speed * dt; player.y += (ky / l) * speed * dt;
    } else if (pointer.active) {
      const tx = pointer.x, ty = pointer.y - pointer.offY;
      const k = 1 - Math.pow(0.0005, dt); // smooth follow
      player.x += (tx - player.x) * k; player.y += (ty - player.y) * k;
    }
    player.x = clamp(player.x, player.r, W - player.r);
    player.y = clamp(player.y, player.r + 50, H - player.r);
    player.trail.push({ x: player.x, y: player.y }); if (player.trail.length > 14) player.trail.shift();

    // spawns
    const d = difficulty();
    spawnT -= dt; if (spawnT <= 0) { spawnShard(); spawnT = rand(0.35, 0.7) * (1 - d * 0.65) * Math.max(0.6, 100 * U / W); }
    orbT -= dt; if (orbT <= 0) { spawnOrb(); orbT = rand(0.7, 1.3); }

    // shards
    for (let i = shards.length - 1; i >= 0; i--) {
      const s = shards[i]; s.y += s.vy * dt; s.x += s.vx * dt; s.rot += s.vr * dt;
      if (s.y > H + s.s * 2) { shards.splice(i, 1); score += 1; continue; }
      if (invuln <= 0 && Math.hypot(s.x - player.x, s.y - player.y) < s.s * 0.8 + player.r * 0.7) {
        shards.splice(i, 1); hp -= 1; combo = 1; invuln = 1.4; shake = 10;
        burst(s.x, s.y, C.purple, 18); audio.blip(160, 0.25, "sawtooth", 0.07, -80);
        if (navigator.vibrate) try { navigator.vibrate(60); } catch (_) {}
        if (hp <= 0) { gameOver(); return; }
      }
    }
    // orbs
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i]; o.y += o.vy * dt; o.ph += dt * 6;
      if (o.y > H + o.r * 3) { orbs.splice(i, 1); combo = 1; continue; }
      if (Math.hypot(o.x - player.x, o.y - player.y) < o.r + player.r) {
        orbs.splice(i, 1); score += 10 * combo; combo = Math.min(combo + 1, 9);
        burst(o.x, o.y, C.mint, 12); audio.blip(520 + combo * 70, 0.07, "square", 0.04);
      }
    }
  }

  /* ---------------- render */
  function shardPath(s) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = s.rot + (i * Math.PI * 2) / 3, r = i === 0 ? s.s * 1.25 : s.s * 0.8;
      i ? ctx.lineTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r) : ctx.moveTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r);
    }
    ctx.closePath();
  }
  function text(str, x, y, size, color, align = "center", weight = 700) {
    ctx.font = `${weight} ${size}px ui-monospace, "SFMono-Regular", Menlo, monospace`;
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(str, x, y);
  }
  function render() {
    ctx.save();
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    if (shake) ctx.translate(rand(-shake, shake), rand(-shake, shake));

    // grid floor
    ctx.strokeStyle = "rgba(129,245,196,0.05)"; ctx.lineWidth = 1;
    const g = 8 * U, off = (time * 20 * U) % g;
    for (let y = off; y < H; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let x = (W / 2) % g; x < W; x += g) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }

    for (const s of stars) { ctx.fillStyle = s.z > 0.7 ? "rgba(196,168,255,.7)" : "rgba(232,237,248,.35)"; ctx.fillRect(s.x, s.y, s.z * 2, s.z * 2); }

    // orbs
    for (const o of orbs) {
      const pr = o.r * (1 + Math.sin(o.ph) * 0.12);
      ctx.fillStyle = "rgba(129,245,196,.15)"; ctx.beginPath(); ctx.arc(o.x, o.y, pr * 2.2, 0, 7); ctx.fill();
      ctx.fillStyle = C.mint; ctx.beginPath(); ctx.arc(o.x, o.y, pr, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillRect(o.x - pr * 0.4, o.y - pr * 0.4, pr * 0.35, pr * 0.35);
    }
    // shards
    for (const s of shards) {
      shardPath(s); ctx.fillStyle = "rgba(91,35,166,.9)"; ctx.fill();
      ctx.lineWidth = Math.max(1.5, U * 0.35); ctx.strokeStyle = C.purple2; ctx.stroke();
    }
    // particles
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.s, p.s); }
    ctx.globalAlpha = 1;

    // player
    if (player && state !== "over" && state !== "title") {
      for (let i = 0; i < player.trail.length; i++) {
        const t = player.trail[i], a = i / player.trail.length;
        ctx.fillStyle = `rgba(129,245,196,${a * 0.25})`; ctx.fillRect(t.x - a * U, t.y - a * U + player.r, a * 2 * U, a * 2 * U);
      }
      if (!(invuln > 0 && Math.floor(invuln * 12) % 2)) {
        const { x, y, r } = player;
        ctx.fillStyle = "rgba(129,245,196,.18)"; ctx.beginPath(); ctx.arc(x, y, r * 2, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x, y - r * 1.4); ctx.lineTo(x + r, y + r); ctx.lineTo(x, y + r * 0.45); ctx.lineTo(x - r, y + r); ctx.closePath();
        ctx.fillStyle = C.mint; ctx.fill();
        ctx.fillStyle = C.purple; ctx.fillRect(x - r * 0.18, y - r * 0.2, r * 0.36, r * 0.5);
      }
    }
    ctx.restore();

    // HUD
    const top = 26, fs = Math.max(12, Math.min(18, U * 3.4));
    if (state === "play" || state === "pause") {
      text("SCORE " + String(score).padStart(6, "0"), 16, top, fs, C.text, "left");
      text("x" + combo, 16, top + fs * 1.5, fs * 0.9, combo > 1 ? C.mint : C.dim, "left");
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i < hp ? C.mint : "rgba(93,103,137,.5)"; ctx.fillRect(16 + i * (fs * 0.9), top + fs * 2.8, fs * 0.6, fs * 0.6); }
    }

    const big = Math.max(26, Math.min(64, U * 10));
    if (state === "title") {
      overlay(0.55);
      text("MINT", W / 2, H * 0.36, big, C.mint);
      text("DRIFT", W / 2, H * 0.36 + big * 1.05, big, C.purple2);
      text("紫の破片をかわし、ミントの光を集めろ", W / 2, H * 0.36 + big * 2.2, Math.max(12, fs * 0.85), C.text, "center", 400);
      blinkText(isTouch ? "TAP TO START" : "CLICK / SPACE TO START", H * 0.72, fs);
      if (best) text("BEST " + best, W / 2, H * 0.72 + fs * 2.2, fs * 0.85, C.dim);
    } else if (state === "pause") {
      overlay(0.6);
      text("PAUSED", W / 2, H * 0.45, big * 0.8, C.text);
      blinkText(isTouch ? "TAP TO RESUME" : "CLICK / P TO RESUME", H * 0.58, fs);
    } else if (state === "over") {
      overlay(0.65);
      text("SIGNAL LOST", W / 2, H * 0.36, big * 0.8, C.purple2);
      text(String(score), W / 2, H * 0.36 + big * 1.2, big * 1.1, C.mint);
      text(newBest ? "NEW BEST!" : "BEST " + best, W / 2, H * 0.36 + big * 2.1, fs, newBest ? C.mint : C.dim);
      if (overT > 0.6) blinkText(isTouch ? "TAP TO RETRY" : "CLICK / SPACE TO RETRY", H * 0.74, fs);
    }
  }
  function overlay(a) { ctx.fillStyle = `rgba(3,6,15,${a})`; ctx.fillRect(0, 0, W, H); }
  function blinkText(s, y, fs) { if (Math.floor(performance.now() / 500) % 2 === 0) text(s, W / 2, y, fs, C.text); }

  /* ---------------- loop */
  let last = performance.now(), overT = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt);
    overT = state === "over" ? overT + dt : 0;
    render();
    requestAnimationFrame(frame);
  }

  /* ---------------- input */
  let isTouch = matchMedia("(pointer: coarse)").matches;
  function primaryAction() {
    if (state === "title") start();
    else if (state === "pause") setPause(false);
    else if (state === "over" && overT > 0.6) start();
  }
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    isTouch = e.pointerType !== "mouse";
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    window.focus();
    if (state !== "play") { primaryAction(); }
    pointer.active = true; pointer.x = e.clientX; pointer.y = e.clientY;
    pointer.offY = e.pointerType === "mouse" ? 0 : 9 * U; // keep ship above the finger
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") { pointer.active = true; pointer.offY = 0; }
    pointer.x = e.clientX; pointer.y = e.clientY;
  });
  const endPointer = (e) => { if (e.pointerType !== "mouse") pointer.active = false; };
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") pointer.active = false; });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

  window.addEventListener("keydown", (e) => {
    const k = e.code;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(k)) e.preventDefault();
    isTouch = false;
    if (k === "Space" || k === "Enter") { audio.unlock(); primaryAction(); return; }
    if (k === "KeyP" || k === "Escape") { if (state === "play") setPause(true); else if (state === "pause") setPause(false); return; }
    if (k === "KeyM") { toggleMute(); return; }
    keys.add(k); pointer.active = false;
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));

  btnPause.addEventListener("click", () => { if (state === "play") setPause(true); else if (state === "pause") setPause(false); });
  function toggleMute() { audio.unlock(); audio.muted = !audio.muted; store.set("muted", audio.muted); setMuteUI(); }
  btnMute.addEventListener("click", toggleMute);

  // standalone fullscreen button (inside the portal, the portal provides fullscreen)
  const inFrame = (() => { try { return window.self !== window.top; } catch (_) { return true; } })();
  if (!inFrame && (document.fullscreenEnabled || document.webkitFullscreenEnabled)) {
    btnFs.hidden = false;
    btnFs.addEventListener("click", () => {
      const el = document.documentElement;
      if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    });
  }

  // auto-pause when the tab / app goes to background
  document.addEventListener("visibilitychange", () => { if (document.hidden) setPause(true); });
  window.addEventListener("blur", () => setPause(true));
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 200));

  resize();
  reset();
  requestAnimationFrame(frame);
})();
