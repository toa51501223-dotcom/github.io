/* LUMEN GRID — QUVERIS
   Lights-out style puzzle. Stages are generated from a solved board, so every stage is solvable. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const boardEl = $("board"), stageEl = $("stage"), movesEl = $("moves"), litEl = $("lit");
  const clearEl = $("clear"), undoBtn = $("undo"), resetBtn = $("reset"), hintBtn = $("hint"), soundBtn = $("sound");

  const store = {
    get(k, d) { try { const v = localStorage.getItem("quveris.lumengrid." + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem("quveris.lumengrid." + k, JSON.stringify(v)); } catch (_) {} }
  };

  /* ---------- sound (synthesized; failures are ignored) */
  let actx = null, muted = store.get("muted", false);
  function unlock() {
    try {
      if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) actx = new AC(); }
      if (actx && actx.state === "suspended") actx.resume().catch(() => {});
    } catch (_) { actx = null; }
  }
  function tone(f, d = 0.07, type = "triangle", v = 0.06) {
    if (muted || !actx || actx.state !== "running") return;
    try {
      const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d + 0.02);
    } catch (_) {}
  }
  const syncSound = () => soundBtn.setAttribute("aria-pressed", String(muted));
  syncSound();

  /* ---------- seeded RNG so a stage is the same every time */
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  let level = Math.max(1, store.get("level", 1) | 0);
  let n, cells, start, solution, history, focusIdx = 0, locked = false;

  function config(lv) {
    const size = lv <= 2 ? 3 : lv <= 5 ? 4 : lv <= 10 ? 5 : 6;
    const presses = Math.min(size * size - 1, 1 + lv + Math.floor(lv / 3));
    return { size, presses };
  }
  function press(arr, i, size) {
    const x = i % size, y = (i / size) | 0;
    arr[i] ^= 1;
    if (x > 0) arr[i - 1] ^= 1;
    if (x < size - 1) arr[i + 1] ^= 1;
    if (y > 0) arr[i - size] ^= 1;
    if (y < size - 1) arr[i + size] ^= 1;
  }

  function buildLevel() {
    const { size, presses } = config(level);
    n = size;
    const r = rng(level * 7919 + 17);
    let board, sol;
    do {
      board = new Array(n * n).fill(0); sol = new Array(n * n).fill(0);
      const idx = [...Array(n * n).keys()];
      for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      idx.slice(0, presses).forEach((i) => { press(board, i, n); sol[i] = 1; });
    } while (board.every((v) => !v));
    start = board.slice(); cells = board; solution = sol; history = [];
    focusIdx = Math.min(focusIdx, n * n - 1);
    renderBoard();
  }

  function renderBoard() {
    boardEl.style.setProperty("--n", n);
    boardEl.innerHTML = "";
    for (let i = 0; i < n * n; i++) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "cell"; b.dataset.i = i;
      b.setAttribute("role", "gridcell");
      b.tabIndex = i === focusIdx ? 0 : -1;
      boardEl.appendChild(b);
    }
    sync();
  }
  function sync() {
    const kids = boardEl.children;
    let lit = 0;
    for (let i = 0; i < cells.length; i++) {
      kids[i].classList.toggle("on", !!cells[i]);
      kids[i].setAttribute("aria-label", `${(i % n) + 1}列${((i / n) | 0) + 1}行 ${cells[i] ? "点灯" : "消灯"}`);
      lit += cells[i];
    }
    stageEl.textContent = String(level).padStart(2, "0");
    movesEl.textContent = history.length;
    litEl.textContent = lit;
    undoBtn.disabled = !history.length || locked;
    resetBtn.disabled = !history.length || locked;
    hintBtn.disabled = locked;
  }

  function act(i) {
    if (locked) return;
    unlock();
    press(cells, i, n); solution[i] ^= 1; history.push(i);
    const kids = boardEl.children;
    [i, i - 1, i + 1, i - n, i + n].forEach((k) => {
      if (k < 0 || k >= n * n) return;
      if ((k === i - 1 || k === i + 1) && ((k / n) | 0) !== ((i / n) | 0)) return;
      kids[k].classList.remove("flash"); void kids[k].offsetWidth; kids[k].classList.add("flash");
    });
    tone(cells[i] ? 660 : 440);
    sync();
    if (cells.every((v) => !v)) win();
  }

  function win() {
    locked = true; sync();
    [523, 659, 784, 1046].forEach((f, k) => setTimeout(() => tone(f, 0.14, "square", 0.05), k * 90));
    $("clear-title").textContent = String(level).padStart(2, "0");
    $("clear-text").textContent = `${history.length} 手でクリア`;
    store.set("level", level + 1);
    setTimeout(() => { clearEl.hidden = false; $("next").focus(); }, 350);
  }
  $("next").addEventListener("click", () => {
    clearEl.hidden = true; locked = false; level += 1; buildLevel(); focusCell(focusIdx);
  });

  undoBtn.addEventListener("click", () => {
    if (!history.length || locked) return;
    const i = history.pop(); press(cells, i, n); solution[i] ^= 1; tone(330); sync();
  });
  resetBtn.addEventListener("click", () => {
    if (locked) return;
    history.forEach((i) => (solution[i] ^= 1));
    cells = start.slice(); history = []; tone(260); sync();
  });
  hintBtn.addEventListener("click", () => {
    if (locked) return;
    unlock();
    const i = solution.findIndex((v) => v);
    if (i < 0) return;
    const el = boardEl.children[i]; el.classList.remove("hint"); void el.offsetWidth; el.classList.add("hint");
    tone(880, 0.1, "sine");
  });
  soundBtn.addEventListener("click", () => { unlock(); muted = !muted; store.set("muted", muted); syncSound(); tone(600); });

  /* ---------- input */
  boardEl.addEventListener("click", (e) => {
    const b = e.target.closest(".cell"); if (!b) return;
    focusIdx = +b.dataset.i; act(focusIdx); updateTabIndex();
  });
  function updateTabIndex() { [...boardEl.children].forEach((c, k) => (c.tabIndex = k === focusIdx ? 0 : -1)); }
  function focusCell(i) { focusIdx = i; updateTabIndex(); const c = boardEl.children[i]; if (c) c.focus({ preventScroll: true }); }

  window.addEventListener("keydown", (e) => {
    if (!clearEl.hidden) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("next").click(); } return; }
    const x = focusIdx % n, y = (focusIdx / n) | 0;
    const map = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (map[e.key]) {
      e.preventDefault();
      const [dx, dy] = map[e.key];
      focusCell(Math.max(0, Math.min(n - 1, y + dy)) * n + Math.max(0, Math.min(n - 1, x + dx)));
    } else if (e.key === " " || e.key === "Enter") {
      // focused buttons (cells/tools) activate natively via click; only act when focus is elsewhere
      if (document.activeElement && document.activeElement.tagName === "BUTTON") return;
      e.preventDefault(); act(focusIdx);
    } else if (e.key === "z" || e.key === "Z") undoBtn.click();
    else if (e.key === "r" || e.key === "R") resetBtn.click();
    else if (e.key === "h" || e.key === "H") hintBtn.click();
  });
  // prevent double-tap zoom / long-press menu on iOS
  document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("contextmenu", (e) => { if (e.target.closest(".cell")) e.preventDefault(); });

  buildLevel();
})();
