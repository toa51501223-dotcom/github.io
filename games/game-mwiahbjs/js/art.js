/* =====================================================================
 * エルディア館 ピクセルアート描画モジュール
 *   - 床/壁はピクセル単位のシェーダで質感を生成（部屋入場時に1回だけ）
 *   - 家具はペインタ関数でドット描画し、静的なものはキャッシュ
 * ===================================================================== */
(function () {
  const ELD = (window.ELD = window.ELD || {});
  const T = 16;
  ELD.T = T;

  /* ---------- 乱数・ノイズ・色 ---------- */
  function hash(x, y, s) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 7, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const cl = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
  const mul = (c, k) => [cl(c[0] * k), cl(c[1] * k), cl(c[2] * k)];
  const mix = (a, b, t) => [cl(a[0] + (b[0] - a[0]) * t), cl(a[1] + (b[1] - a[1]) * t), cl(a[2] + (b[2] - a[2]) * t)];
  const cssCache = new Map();
  function css(c, k) {
    if (typeof c === 'string') return c;
    k = k == null ? 1 : k;
    const key = c[0] + ',' + c[1] + ',' + c[2] + ',' + k;
    let s = cssCache.get(key);
    if (!s) {
      const m = k > 1 ? mix(c, [255, 245, 225], Math.min(1, k - 1)) : mul(c, k);
      s = 'rgb(' + m[0] + ',' + m[1] + ',' + m[2] + ')';
      cssCache.set(key, s);
    }
    return s;
  }
  ELD.util = { hash, vnoise, mul, mix, css, cl };

  /* ---------- 共通パレット ---------- */
  const WOOD = [112, 70, 38], DWOOD = [62, 38, 22], GOLD = [208, 168, 72], BRASS = [196, 150, 64], IRON = [58, 60, 68];
  const MARBLE = [214, 208, 196], CLOTH = [232, 226, 214], SKIN = [238, 196, 160];
  const BOOKC = [[140, 40, 40], [40, 80, 130], [50, 100, 60], [150, 110, 40], [90, 50, 110], [120, 70, 40], [40, 40, 50], [160, 140, 110], [110, 30, 60]];

  /* ---------- 描画プリミティブ ---------- */
  let g = null;
  const R = (x, y, w, h, c, k) => { g.fillStyle = css(c, k); g.fillRect(x, y, w, h); };
  const A = (x, y, w, h, s) => { g.fillStyle = s; g.fillRect(x, y, w, h); };
  function box(x, y, w, h, c, hi, lo) {
    R(x, y, w, h, c);
    R(x, y, w, 1, c, hi || 1.35); R(x, y, 1, h, c, hi ? hi * 0.95 : 1.2);
    R(x, y + h - 1, w, 1, c, lo || 0.6); R(x + w - 1, y, 1, h, c, lo ? lo + 0.1 : 0.72);
  }
  function shadow(x, y, w, h, a) { A(x + 2, y + 2, w, h, 'rgba(0,0,0,' + (a || 0.32) + ')'); }
  function oval(cx, cy, rx, ry, c, k) {
    g.fillStyle = css(c, k);
    for (let yy = -ry; yy <= ry; yy++) {
      const ww = Math.round(rx * Math.sqrt(Math.max(0, 1 - (yy * yy) / (ry * ry + 0.01))));
      g.fillRect(Math.round(cx - ww), Math.round(cy + yy), ww * 2, 1);
    }
  }
  function flame(x, y, t, s, seed) {
    s = s || 1;
    const f = Math.sin(t * 13 + (seed || 0)) * 0.5 + Math.sin(t * 7.3 + (seed || 0) * 2) * 0.5;
    const h = Math.round((4 + f) * s);
    A(x - 1, y - h, 3, h, '#ff9a2a');
    A(x, y - h - 1 - (f > 0.3 ? 1 : 0), 1, h, '#ffd84a');
    A(x, y - 2, 1, 2, '#fff6c0');
  }

  /* =====================================================================
   * 床シェーダ
   * ===================================================================== */
  const FLOOR = {
    parquet(x, y, p) {
      const bx = x >> 3, by = y >> 3, hor = ((bx + by) & 1) === 0;
      const acr = hor ? y & 3 : x & 3, along = hor ? x : y;
      const plank = hor ? by * 2 + ((y & 7) >> 2) : bx * 2 + ((x & 7) >> 2);
      const id = hash(plank, hor ? bx : by, hor ? 3 : 5);
      let k = 0.82 + id * 0.3 + Math.sin(along * 0.8 + id * 30 + acr * 1.9) * 0.05;
      if (acr === 3 || (hor ? (x & 7) === 0 : (y & 7) === 0)) k *= 0.6;
      else if (acr === 0) k *= 1.12;
      return mul(p.groundC || [124, 80, 46], k);
    },
    marble(x, y, p) {
      const tx = x >> 4, ty = y >> 4, dark = (tx + ty) & 1;
      const base = dark ? p.marbleB || [52, 48, 60] : p.marbleA || [212, 204, 188];
      const n = vnoise(x * 0.09, y * 0.09, 11);
      const v = Math.abs(Math.sin(x * 0.17 + y * 0.11 + n * 7 + tx * 2.1 + ty));
      let k = 1;
      if (v < 0.05) k = dark ? 1.5 : 0.78; else if (v < 0.12) k = dark ? 1.18 : 0.9;
      const lx = x & 15, ly = y & 15;
      if (lx === 0 || ly === 0) k *= dark ? 1.25 : 1.06;
      if (lx === 15 || ly === 15) k *= 0.72;
      if (lx === 2 && ly === 2) k *= 1.2;
      return mul(base, k * (0.95 + hash(x, y, 1) * 0.07));
    },
    carpet(x, y, p, rug) {
      const c = (rug && rug.c) || p.groundC || [110, 30, 36];
      const x0 = rug ? rug.x * T : T, y0 = rug ? rug.y * T : 2 * T;
      const x1 = rug ? (rug.x + rug.w) * T - 1 : (p.W - 1) * T - 1, y1 = rug ? (rug.y + rug.h) * T - 1 : (p.H - 1) * T - 1;
      const d = Math.min(x - x0, x1 - x, y - y0, y1 - y);
      const fab = 0.94 + hash(x, y, 4) * 0.1 - ((x + y) & 1) * 0.03;
      if (rug) {
        if (d === 0) return mul(c, 0.45);
        if (d < 3) return mul(GOLD, (d === 1 ? 0.95 : 0.75) * fab);
        if (d === 3) return mul(c, 0.5);
        if (d < 6) { const q = ((x + y) >> 1) & 3; return mul(c, (q === 0 ? 1.45 : 0.85) * fab); }
        if (d === 6) return mul(GOLD, 0.6);
      }
      const u = (x - x0) & 15, v = (y - y0) & 15, m = Math.abs(u - 8) + Math.abs(v - 8);
      let k = 1;
      if (m === 7 || m === 8) k = 1.45; else if (m <= 2) k = m === 0 ? 1.8 : 1.35; else if (m === 4) k = 0.82;
      if (k > 1.4 && m <= 2) return mul(GOLD, 0.85 * fab);
      return mul(c, k * fab);
    },
    stone(x, y, p) {
      const row = Math.floor(y / 10), off = (row * 7) % 14, col = Math.floor((x + off) / 14);
      const lx = (x + off) % 14, ly = y % 10, id = hash(col, row, 9);
      const base = p.groundC || [86, 84, 92];
      if (lx === 0 || ly === 0) return mul(base, 0.45);
      let k = 0.82 + id * 0.3 + (vnoise(x * 0.3, y * 0.3, row) - 0.5) * 0.18;
      if (lx === 1 || ly === 1) k *= 1.18; if (lx === 13 || ly === 9) k *= 0.8;
      if (id > 0.95 && Math.abs(lx - ly * 1.2 - 2) < 0.6) k *= 0.7;
      return mul(base, k);
    },
    tile(x, y) {
      const tx = x >> 3, ty = y >> 3, lx = x & 7, ly = y & 7;
      if (lx === 0 || ly === 0) return [150, 160, 166];
      const blue = ((tx + ty) % 4 === 0);
      let c = blue ? [70, 120, 160] : [218, 226, 230];
      let k = 0.95 + hash(tx, ty, 2) * 0.08;
      if (lx === 1 && ly === 1) k *= 1.12; if (lx === 7 || ly === 7) k *= 0.9;
      return mul(c, k);
    },
    checker(x, y) {
      const tx = x >> 3, ty = y >> 3, lx = x & 7, ly = y & 7, dark = (tx + ty) & 1;
      if (lx === 0 || ly === 0) return [70, 64, 60];
      let c = dark ? [44, 42, 48] : [214, 206, 188];
      let k = 0.94 + vnoise(x * 0.2, y * 0.2, 6) * 0.12;
      if (lx === 1 || ly === 1) k *= 1.08;
      return mul(c, k);
    },
    plank(x, y, p) {
      const row = Math.floor(y / 6), ly = y % 6, len = 24 + Math.floor(hash(row, 1, 8) * 18);
      const off = Math.floor(hash(row, 2, 8) * len), seg = Math.floor((x + off) / len), lx = (x + off) % len;
      const id = hash(seg, row, 12), base = p.groundC || [104, 70, 44];
      if (ly === 5) return mul(base, 0.5);
      if (lx === 0) return mul(base, 0.58);
      let k = 0.85 + id * 0.25 + Math.sin(x * 0.45 + id * 40 + ly) * 0.05;
      if (ly === 0) k *= 1.12;
      if ((lx === 2 || lx === len - 3) && ly === 2) return [40, 36, 34];
      return mul(base, k);
    },
    grate(x, y) {
      const lx = x & 7, ly = y & 7;
      if (lx === 0 || ly === 0) return [36, 32, 30];
      if (lx === 4 || ly === 4) return [20, 18, 18];
      let k = 0.9 + hash(x >> 3, y >> 3, 3) * 0.2;
      if (lx === 1 || ly === 1) k *= 1.3;
      return mul([92, 84, 76], k);
    },
    metal(x, y) {
      const lx = x & 31, ly = y & 31;
      if (lx === 0 || ly === 0) return [40, 44, 50];
      if ((lx === 3 || lx === 28) && (ly === 3 || ly === 28)) return [150, 156, 166];
      const u = x % 6, v = y % 6, alt = ((x / 6 | 0) + (y / 6 | 0)) & 1;
      let k = 0.92 + vnoise(x * 0.08, y * 0.08, 5) * 0.14;
      if (alt ? u === v : u + v === 5) k *= 1.28;
      if (lx === 1 || ly === 1) k *= 1.1;
      return mul([92, 100, 110], k);
    },
    brick(x, y) {
      const row = y >> 2, off = (row & 1) * 4, lx = (x + off) & 7, ly = y & 3;
      if (ly === 0 || lx === 0) return [58, 46, 42];
      const id = hash((x + off) >> 3, row, 14);
      let k = 0.8 + id * 0.35;
      if (ly === 1) k *= 1.1;
      return mul([132, 74, 54], k);
    },
    cave(x, y, p) {
      const n = vnoise(x * 0.07, y * 0.07, 21);
      if (n > 0.7) {
        const k = 0.8 + Math.sin((x + y) * 0.5) * 0.1 + (hash(x, y, 3) > 0.97 ? 0.8 : 0);
        return mul([34, 44, 62], k);
      }
      return FLOOR.stone(x, y, { groundC: [70, 70, 74] });
    },
    obsidian(x, y) {
      const lx = x & 15, ly = y & 15;
      let k = 0.85 + vnoise(x * 0.12, y * 0.12, 33) * 0.3;
      if (lx === 0 || ly === 0) return [18, 14, 26];
      if (lx === 1 || ly === 1) k *= 1.3;
      const vein = Math.abs(Math.sin(x * 0.08 + y * 0.21 + vnoise(x * 0.05, y * 0.05, 3) * 6));
      if (vein < 0.03) return [120, 90, 200];
      return mul([40, 34, 56], k);
    },
    ritual(x, y, p) {
      const cx = (p.W * T) / 2, cy = (p.H * T) / 2 + 8;
      const dx = x - cx, dy = (y - cy) * 1.15, d = Math.sqrt(dx * dx + dy * dy);
      const base = FLOOR.obsidian(x, y);
      const ring = (r) => Math.abs(d - r) < 0.9;
      if (ring(30) || ring(54) || ring(78)) return [150, 110, 230];
      if (d > 56 && d < 76) {
        const a = Math.atan2(dy, dx), s = Math.round((a / (Math.PI * 2)) * 24);
        const ang = (s / 24) * Math.PI * 2;
        const px = cx + Math.cos(ang) * 66, py = cy + (Math.sin(ang) * 66) / 1.15;
        if (Math.abs(x - px) < 2 && Math.abs(y - py) < 2) return (s & 1) ? [120, 200, 230] : [180, 140, 240];
      }
      if (d < 30 && Math.abs(Math.abs(dx) - Math.abs(dy) * 0.95) < 0.8) return [110, 80, 180];
      return base;
    },
    grass(x, y) {
      const n = vnoise(x * 0.08, y * 0.08, 41), h = hash(x, y, 7);
      let k = 0.78 + n * 0.32;
      if (h > 0.93) k *= 1.25; else if (h < 0.06) k *= 0.7;
      if (((x * 7 + y * 3) % 11) === 0 && h > 0.5) k *= 1.18;
      return mul([46, 70, 52], k);
    },
    gravel(x, y) {
      const h = hash(x, y, 9), n = vnoise(x * 0.3, y * 0.3, 17);
      let k = 0.8 + n * 0.25 + (h > 0.8 ? 0.18 : h < 0.15 ? -0.15 : 0);
      return mul([128, 122, 112], k);
    },
    flag(x, y) {
      const lx = x & 15, ly = y & 15, off = ((y >> 4) & 1) * 8, bx = (x + off) & 15;
      let k = 0.88 + hash((x + off) >> 4, y >> 4, 6) * 0.16;
      if (ly === 0 || bx === 0) k = 0.6;
      return mul([132, 128, 120], k);
    },
    void(x, y) {
      const k = 0.18 + vnoise(x * 0.05, y * 0.05, 2) * 0.08;
      return mul(FLOOR.marble(x * 2, y * 2, {}), k);
    },
  };

  /* =====================================================================
   * 壁シェーダ（上壁 正面 32px）
   * ===================================================================== */
  const WALL = {
    paper(x, y, w) {
      const c = w.c;
      if (y < 2) return mul(DWOOD, 0.45);
      if (y < 5) return mul(WOOD, y === 2 ? 1.3 : y === 3 ? 1 : 0.6);
      if (y < 21) {
        const u = x % 12, v = (y - 5) % 16;
        const f = Math.abs(u - 6) + Math.abs(v - 8) * 0.6;
        let k = 1 - (21 - y) * 0.006;
        if ((f > 3.4 && f < 4.4) || (u === 6 && v > 4 && v < 12) || (f < 1)) k *= 1.32;
        if (u === 0) k *= 0.86;
        if (y === 20) k *= 0.7;
        return mul(c, k * (0.97 + hash(x, y, 1) * 0.05));
      }
      if (y < 23) return mul(WOOD, y === 21 ? 1.45 : 0.9);
      if (y >= 30) return mul(DWOOD, y === 30 ? 0.9 : 0.5);
      const lx = x % 16;
      let k = 0.85;
      if (lx === 0 || y === 24) k = 0.6; else if (lx === 15 || y === 28) k = 0.62; else if (lx === 1 || y === 25) k = 1.15;
      if (lx > 2 && lx < 14 && y > 25 && y < 28) k = 1.0 + (y - 26) * 0.05;
      return mul(WOOD, k * (0.95 + hash(x, y, 2) * 0.08));
    },
    wood(x, y) {
      if (y < 2) return mul(DWOOD, 0.4);
      if (y < 5) return mul(WOOD, y === 2 ? 1.3 : 0.65);
      if (y > 29) return mul(DWOOD, 0.5);
      const lx = x % 6, id = hash(Math.floor(x / 6), 0, 17);
      let k = 0.62 + id * 0.18 + Math.sin(y * 0.6 + id * 20) * 0.04;
      if (lx === 0) k *= 0.55; if (lx === 1) k *= 1.15;
      if (y === 18) k = 1.0;
      return mul(WOOD, k);
    },
    stone(x, y) {
      if (y < 2) return [24, 24, 28];
      const row = Math.floor((y - 2) / 8), off = (row & 1) * 8, lx = (x + off) % 16, ly = (y - 2) % 8;
      if (lx === 0 || ly === 0) return [40, 40, 46];
      const id = hash(Math.floor((x + off) / 16), row, 19);
      let k = 0.75 + id * 0.3 + (vnoise(x * 0.4, y * 0.4, 5) - 0.5) * 0.15;
      if (ly === 1 || lx === 1) k *= 1.2; if (ly === 7) k *= 0.75;
      if (hash(x, y, 77) > 0.985) return [70, 96, 60];
      return mul([104, 102, 112], k * (y > 26 ? 0.85 : 1));
    },
    brick(x, y) {
      if (y < 2) return [30, 22, 20];
      const row = (y - 2) >> 2, off = (row & 1) * 4, lx = (x + off) & 7, ly = (y - 2) & 3;
      if (lx === 0 || ly === 0) return [64, 52, 48];
      const id = hash((x + off) >> 3, row, 23);
      let k = 0.72 + id * 0.35; if (ly === 1) k *= 1.1;
      return mul([140, 70, 50], k);
    },
    metal(x, y) {
      if (y < 2) return [22, 24, 28];
      const lx = x % 16;
      if (y >= 8 && y <= 11) return mul([110, 118, 126], y === 8 ? 1.4 : y === 11 ? 0.55 : 0.95);
      if (lx === 0) return [36, 40, 46];
      if ((lx === 2 || lx === 13) && (y === 4 || y === 28)) return [170, 176, 186];
      let k = 0.85 + vnoise(x * 0.1, y * 0.3, 9) * 0.2; if (lx === 1) k *= 1.2;
      if (hash(x >> 2, y >> 2, 31) > 0.93) return mul([120, 70, 40], k);
      return mul([78, 86, 96], k * (y > 28 ? 0.7 : 1));
    },
    tile(x, y, w) {
      const c = w.c || [200, 210, 214];
      if (y < 2) return [60, 64, 66];
      if (y === 19 || y === 20) return mul([60, 110, 150], y === 19 ? 1.3 : 0.8);
      const lx = x & 7, ly = (y - 2) & 7;
      if (lx === 0 || ly === 0) return mul(c, 0.72);
      let k = 0.94 + hash(x >> 3, (y - 2) >> 3, 4) * 0.1; if (lx === 1 && ly === 1) k = 1.15;
      return y > 20 ? mul([90, 140, 170], k) : mul(c, k);
    },
    sky(x, y) {
      if (y < 15 || (y < 21 && (x % 16) >= 9)) {
        const s = hash(x, y, 51), tw = s > 0.985 ? 1 : 0;
        if (tw) return [230, 230, 255];
        return mix([10, 14, 40], [40, 56, 104], y / 22);
      }
      const lx = x % 16, ly = (y - 15) % 6;
      if (lx === 0 || ly === 0 || (y < 21 && lx === 8)) return [50, 52, 64];
      return mul([116, 116, 132], 0.78 + hash(x >> 3, y >> 3, 5) * 0.25);
    },
    facade(x, y) {
      // 館の正面外壁：灰色の石積み、上端に軒
      if (y < 3) return mix([16, 18, 34], [26, 30, 52], y / 3);
      if (y < 5) return mul([70, 64, 70], y === 3 ? 1.3 : 0.7);
      const row = Math.floor((y - 5) / 6), off = (row & 1) * 8, lx = (x + off) % 16, ly = (y - 5) % 6;
      if (lx === 0 || ly === 0) return [58, 56, 64];
      return mul([104, 100, 108], 0.82 + hash((x + off) >> 4, row, 8) * 0.22);
    },
    crystal(x, y) {
      if (y < 2) return [14, 10, 22];
      const v = Math.abs(Math.sin(x * 0.2 + vnoise(x * 0.1, y * 0.2, 4) * 5 + y * 0.05));
      if (v < 0.06) return [150, 120, 240];
      if (v < 0.12) return [90, 70, 150];
      const row = Math.floor((y - 2) / 10), off = (row & 1) * 10, lx = (x + off) % 20, ly = (y - 2) % 10;
      if (lx === 0 || ly === 0) return [20, 16, 30];
      return mul([46, 38, 66], 0.8 + hash(x >> 2, y >> 2, 6) * 0.3);
    },
  };
  const WALLTOP = { paper: [40, 28, 26], wood: [40, 28, 22], stone: [42, 42, 50], brick: [48, 32, 28], metal: [34, 38, 44], tile: [70, 74, 78], sky: [60, 62, 76], crystal: [30, 24, 44], facade: [30, 46, 36] };

  /* =====================================================================
   * 部屋背景生成
   * ===================================================================== */
  function buildBG(room, es) {
    const W = room.W, H = room.H;
    const cv = document.createElement('canvas');
    cv.width = W * T; cv.height = H * T;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(cv.width, cv.height);
    const d = img.data;
    const ws = room.wall.s, wfn = WALL[ws], wtop = WALLTOP[ws] || [40, 36, 40];
    const fl = FLOOR[room.ground] || FLOOR.parquet;
    const rugAt = (tx, ty) => { const rs = room.rugs; if (!rs) return null; for (let i = rs.length - 1; i >= 0; i--) { const r = rs[i]; if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return r; } return null; };
    const voidAt = (tx, ty) => (room.voids || []).some((v) => tx >= v.x && tx < v.x + v.w && ty >= v.y && ty < v.y + v.h);
    const P = room;
    for (let y = 0; y < cv.height; y++) {
      const ty = y >> 4;
      for (let x = 0; x < cv.width; x++) {
        const tx = x >> 4;
        let c;
        const side = tx === 0 || tx === W - 1 || ty === H - 1;
        if (ty <= 1 && !(side && ty > 1)) {
          if (tx === 0 || tx === W - 1) c = mul(wtop, 0.8);
          else c = wfn(x, y, room.wall);
        } else if (side) {
          let k = 0.9 + hash(x >> 2, y >> 2, 3) * 0.12;
          const lx = x & 15, ly = y & 15;
          if (tx === 0 && lx >= 13) k = lx === 15 ? 1.5 : 0.6;
          if (tx === W - 1 && lx <= 2) k = lx === 0 ? 1.5 : 0.6;
          if (ty === H - 1 && ly <= 2) k = ly === 0 ? 1.5 : 0.6;
          c = mul(wtop, k);
        } else if (voidAt(tx, ty)) {
          c = FLOOR.void(x, y);
        } else {
          const rug = rugAt(tx, ty);
          const pa = room.paths && room.paths.find((q) => tx >= q.x && tx < q.x + q.w && ty >= q.y && ty < q.y + q.h);
          c = rug ? FLOOR.carpet(x, y, P, rug) : pa ? FLOOR[pa.g](x, y, P, null) : fl(x, y, P, null);
          // 壁際の陰（アンビエントオクルージョン）
          let ao = 1;
          const fy = y - 2 * T;
          if (fy < 6) ao *= 0.55 + fy * 0.075;
          const lx = x - T, rx = (W - 1) * T - 1 - x, by = (H - 1) * T - 1 - y;
          if (lx < 4) ao *= 0.7 + lx * 0.075;
          if (rx < 4) ao *= 0.7 + rx * 0.075;
          if (by < 2) ao *= 0.85;
          if (ao < 1) c = mul(c, ao);
        }
        const i = (y * cv.width + x) * 4;
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    g = ctx;
    // 上壁の下端に影
    A(T, 2 * T, (W - 2) * T, 1, 'rgba(0,0,0,0.35)');
    // 出入口
    for (const ex of room.exits) {
      const st = es[ex.id];
      if (!st || !st.visible) continue;
      drawExit(room, ex, st.open, wtop);
    }
    // 手すり越しの吹き抜け
    for (const v of room.voids || []) {
      A(v.x * T, v.y * T, v.w * T, 2, 'rgba(0,0,0,0.6)');
    }
    return cv;
  }

  function drawExit(room, ex, open, wtop) {
    const kind = ex.kind || 'wood';
    const W = room.W, H = room.H;
    if (ex.side === 'N') {
      const x = ex.at * T, w = (ex.w || 1) * T;
      if (kind === 'great') return greatDoor(x, w, open);
      // 枠
      R(x - 2, 3, w + 4, 29, DWOOD, 0.7);
      R(x - 1, 4, w + 2, 2, GOLD, 0.8);
      if (open) {
        for (let i = 0; i < 26; i++) A(x + 1, 6 + i, w - 2, 1, 'rgba(' + (6 + i) + ',' + (5 + i) + ',' + (8 + i) + ',1)');
        A(x + 4, 28, w - 6, 4, 'rgba(255,230,180,0.08)');
      } else if (kind === 'metal') {
        box(x + 1, 6, w - 2, 26, [84, 92, 100]);
        for (let i = 0; i < 3; i++) A(x + 3, 10 + i * 7, w - 6, 1, 'rgba(0,0,0,0.35)');
        A(x + w - 5, 16, 3, 5, '#202428'); A(x + w - 4, 17, 1, 1, '#ff3030');
      } else if (kind === 'bars') {
        A(x + 1, 6, w - 2, 26, '#0c0a0e');
        for (let i = 2; i < w - 1; i += 3) R(x + i, 6, 1, 26, IRON, 1.5);
        R(x + 1, 12, w - 2, 1, IRON, 1.3); R(x + 1, 24, w - 2, 1, IRON, 1.3);
      } else {
        const dc = [104, 62, 34];
        box(x + 1, 6, w - 2, 26, dc);
        const pw = w >= 32 ? (w - 2) / 2 : w - 2;
        for (let p = 0; p * pw < w - 3; p++) {
          const px = x + 1 + p * pw;
          box(px + 2, 9, pw - 4, 8, dc, 0.85, 1.2);
          box(px + 2, 19, pw - 4, 10, dc, 0.85, 1.2);
          if (p > 0) A(px, 6, 1, 26, 'rgba(0,0,0,0.5)');
        }
        A(x + (w >> 1) + (w >= 32 ? 2 : 3), 19, 2, 2, css(GOLD, 1.2));
        if (w >= 32) A(x + (w >> 1) - 4, 19, 2, 2, css(GOLD, 1.2));
        if (ex.lock && ex.lock.item) { A(x + (w >> 1) - 1, 22, 3, 3, css(GOLD, 0.8)); A(x + (w >> 1), 23, 1, 1, '#000'); }
      }
    } else if (ex.side === 'S') {
      const x = ex.at * T, w = (ex.w || 1) * T, y = (H - 1) * T;
      if (open) {
        for (let i = 0; i < 16; i++) A(x, y + i, w, 1, 'rgba(0,0,0,' + (0.25 + i * 0.045) + ')');
        if (kind === 'grand') { A(x - 2, y, w + 4, 2, css(GOLD)); }
        A(x + 2, y - 3, w - 4, 3, 'rgba(120,40,40,0.55)');
      } else if (kind === 'grand') {
        R(x - 4, y - 2, w + 8, 18, DWOOD, 0.6);
        box(x - 2, y, w + 4, 10, [96, 56, 30]);
        A(x + (w >> 1) - 1, y, 2, 10, 'rgba(0,0,0,0.5)');
        for (let i = 0; i < w + 4; i += 4) { R(x - 2 + i, y + 3, 3, 3, IRON, 1.6); R(x - 1 + i, y + 4, 1, 1, IRON, 0.6); }
        R(x + (w >> 1) - 3, y + 2, 6, 7, [150, 140, 120]);
        A(x + (w >> 1) - 1, y + 5, 2, 2, '#222');
      } else if (kind === 'bars') {
        A(x, y, w, 16, '#0a0a0e');
        for (let i = 1; i < w; i += 3) R(x + i, y, 1, 10, IRON, 1.5);
      } else {
        box(x, y, w, 6, kind === 'metal' ? [84, 92, 100] : [104, 62, 34]);
        A(x, y + 6, w, 10, 'rgba(0,0,0,0.6)');
      }
    } else if (ex.side === 'W' || ex.side === 'E') {
      const y = ex.at * T, h = (ex.w || 1) * T, x = ex.side === 'W' ? 0 : (W - 1) * T;
      if (open) {
        for (let i = 0; i < 16; i++) {
          const a = ex.side === 'W' ? 0.9 - i * 0.05 : 0.15 + i * 0.05;
          A(x + i, y, 1, h, 'rgba(0,0,0,' + a + ')');
        }
        R(ex.side === 'W' ? x + 12 : x, y - 3, 4, 3, wtop, 1.2);
        R(ex.side === 'W' ? x + 12 : x, y + h, 4, 2, wtop, 0.7);
      } else if (kind === 'bars') {
        A(x, y, T, h, '#0a0a0e');
        for (let i = 1; i < h; i += 3) R(x + (ex.side === 'W' ? 10 : 2), y + i, 4, 1, IRON, 1.5);
        R(x + (ex.side === 'W' ? 11 : 3), y, 2, h, IRON, 1.1);
      } else {
        R(ex.side === 'W' ? x + 10 : x, y, 6, h, [104, 62, 34]);
        R(ex.side === 'W' ? x + 10 : x + 5, y, 1, h, [104, 62, 34], 1.4);
      }
    } else {
      stairs(ex, open, ex.side === 'U', room);
    }
  }

  function stairs(ex, open, up, room) {
    const x = ex.x * T, y = ex.y * T, w = ex.w * T, h = ex.h * T;
    const stone = room.wall.s === 'stone' || room.wall.s === 'brick' || room.wall.s === 'crystal' || room.wall.s === 'sky';
    const base = room.ground === 'metal' ? [100, 106, 116] : stone ? [112, 108, 116] : [128, 84, 48];
    A(x + 2, y + 2, w, h, 'rgba(0,0,0,0.35)');
    const steps = Math.floor(h / 4);
    for (let i = 0; i < steps; i++) {
      const sy = y + i * 4;
      const k = up ? 0.7 + (i / steps) * 0.0 + (steps - i) * 0.07 : 0.95 - i * 0.12;
      R(x, sy, w, 3, base, Math.max(0.15, k));
      R(x, sy + 3, w, 1, base, Math.max(0.08, k * 0.5));
      R(x, sy, w, 1, base, Math.max(0.2, k * 1.18));
    }
    if (!up) A(x, y + h - 4, w, 4, 'rgba(0,0,0,0.7)');
    // 中央の絨毯
    if (!stone && room.ground !== 'metal') A(x + 4, y, w - 8, h, 'rgba(130,20,30,0.45)');
    // 手すり
    R(x, y - (up ? 6 : 0), 2, h + (up ? 6 : 0), DWOOD, 1.1);
    R(x + w - 2, y - (up ? 6 : 0), 2, h + (up ? 6 : 0), DWOOD, 1.1);
    R(x, y + h - 3, 3, 4, DWOOD, 1.5); R(x + w - 3, y + h - 3, 3, 4, DWOOD, 1.5);
    if (!open) {
      for (let i = 2; i < w - 1; i += 3) R(x + i, y - 2, 1, h + 2, IRON, 1.4);
      R(x, y + 2, w, 1, IRON, 1.3); R(x, y + h - 4, w, 1, IRON, 1.3);
      R(x + (w >> 1) - 2, y + (h >> 1) - 2, 5, 5, [150, 130, 70]);
    }
  }

  function greatDoor(x, w, open) {
    R(x - 6, 0, w + 12, 32, [30, 22, 40]);
    for (let i = 0; i < 6; i++) R(x - 6 + i, 0, 1, 32, [120, 100, 180], 0.5 + i * 0.12);
    for (let i = 0; i < 6; i++) R(x + w + 5 - i, 0, 1, 32, [120, 100, 180], 0.5 + i * 0.12);
    if (open) {
      for (let i = 0; i < 30; i++) A(x, 2 + i, w, 1, 'rgba(' + (40 + i * 3) + ',' + (20 + i * 2) + ',' + (70 + i * 4) + ',1)');
      A(x + 4, 2, w - 8, 30, 'rgba(255,220,255,0.06)');
      R(x, 2, 4, 30, [70, 56, 30]); R(x + w - 4, 2, 4, 30, [70, 56, 30]);
      return;
    }
    box(x, 2, w, 30, [86, 64, 34]);
    A(x + (w >> 1), 2, 1, 30, 'rgba(0,0,0,0.6)');
    for (let i = 0; i < 4; i++) { R(x + 3, 5 + i * 7, w - 6, 1, GOLD, 0.7); }
    const cy = 18, cx = x + (w >> 1);
    [[-14, 'star'], [0, 'moon'], [14, 'sun']].forEach(([dx, s]) => {
      oval(cx + dx, cy, 5, 5, [20, 16, 28]);
      oval(cx + dx, cy, 3, 3, s === 'sun' ? [120, 90, 40] : s === 'moon' ? [60, 70, 110] : [90, 90, 110]);
    });
  }

  /* =====================================================================
   * 家具定義（既定サイズ・属性）
   * ===================================================================== */
  const FD = {
    window: { wall: 1 }, painting: { wall: 1 }, wlamp: { wall: 1, light: { dx: 8, dy: 18, r: 52, c: [255, 196, 120], fl: 1 } },
    fireplace: { wall: 1, w: 2, anim: 1, light: { dx: 16, dy: 30, r: 84, c: [255, 140, 60], fl: 1 } }, mirror: { wall: 1 },
    pots: { wall: 1 }, wallshelf: { wall: 1 }, cobweb: { wall: 1 }, plaque: { wall: 1 },
    torch: { wall: 1, anim: 1, light: { dx: 8, dy: 12, r: 58, c: [255, 150, 70], fl: 1 } }, pipes: { wall: 1 }, chalkboard: { wall: 1 },
    monitors: { wall: 1, anim: 1, light: { dx: 0, dy: 20, r: 60, c: [90, 200, 220], fl: 0.3, wide: 1 } },
    clockface: { wall: 1, anim: 1, light: { dx: 48, dy: 22, r: 70, c: [140, 160, 220] } }, board: { wall: 1 },
    chandelier: { over: 1, anim: 1, light: { dx: 16, dy: 6, r: 110, c: [255, 210, 140], fl: 0.4 } },
    gclock: { anim: 1 }, plant: {}, pillar: {}, armor: {}, counter: { light: { dx: 70, dy: -2, r: 40, c: [255, 200, 120], fl: 1 } }, bench: {}, statue: {},
    railing: {}, longtable: { light: { dx: 80, dy: 10, r: 64, c: [255, 200, 120], fl: 1 } }, chair: {}, cupboard: {},
    stove: { light: { dx: 16, dy: 8, r: 46, c: [255, 120, 50], fl: 1 } }, sink: {}, shelf: {}, worktable: {}, barrel: {}, crate: {}, sack: {},
    tub: {}, basin: {}, candle: { anim: 1, light: { dx: 8, dy: -6, r: 46, c: [255, 190, 110], fl: 1 } }, shelfv: {}, chest: {},
    bunk: { h: 2 }, locker: {}, table: {}, stool: {}, bed: {}, nightstand: { light: { dx: 8, dy: -2, r: 36, c: [255, 190, 120], fl: 1 } },
    wardrobe: {}, desk: {}, trunk: {}, dollhouse: {}, vase: {}, readtable: { light: { dx: 32, dy: 6, r: 50, c: [255, 210, 140], fl: 0.5 } },
    globe: {}, armchair: {}, lamp: { light: { dx: 8, dy: -12, r: 58, c: [255, 200, 130] } }, ladder: {}, bookshelf: {}, safe: {}, cabinet: {},
    sofa: {}, teatable: {}, gramophone: {}, piano: {}, harp: {}, stand: {}, cello: {}, lectern: { light: { dx: 8, dy: 0, r: 34, c: [180, 200, 255] } },
    weights: {}, gear: { anim: 1 }, axle: {}, oilcan: {}, pendulum: { anim: 1 }, workbench: {}, bell: {}, telescope: {},
    winerack: {}, labtable: { light: { dx: 20, dy: 4, r: 30, c: [120, 220, 200] } }, tank: { anim: 1, light: { dx: 8, dy: -4, r: 50, c: [80, 255, 160], fl: 0.2 } },
    optable: {}, console: { anim: 1, light: { dx: 24, dy: 2, r: 32, c: [100, 220, 255], fl: 0.2 } }, machine: { anim: 1 }, lever: {},
    rubble: {}, crystal: { anim: 1, light: { dx: 8, dy: 0, r: 40, c: [150, 130, 255], fl: 0.15 } },
    brazier: { anim: 1, light: { dx: 8, dy: -6, r: 64, c: [255, 140, 70], fl: 1 } }, pedestal: { anim: 1 },
    core: { anim: 1, light: { dx: 16, dy: 8, r: 150, c: [190, 120, 255], fl: 0.3 } }, musicbox: {}, plush: {}, rope: { nosolid: 1 },
    weightsx: {},
    busseat: {}, buswin: { wall: 1, anim: 1 }, busdriver: { light: { dx: 20, dy: 6, r: 40, c: [120, 200, 160], fl: 0.4 } }, busrail: { nosolid: 1 },
    person: {}, fence: {}, irongate: {}, busstop: {}, lamppost: { light: { dx: 8, dy: -30, r: 70, c: [255, 210, 150], fl: 0.6 } }, flowerbed: {}, hedge: {}, campole: {},
    gatepanel: { light: { dx: 8, dy: -6, r: 26, c: [120, 220, 160], fl: 0.3 } }, keybox: { wall: 1 }, placecard: { nosolid: 1 },
    bigwindow: { wall: 1, light: { dx: 16, dy: 18, r: 48, c: [255, 200, 120], fl: 0.4 } }, phone: {},
  };
  ELD.FD = FD;

  /* =====================================================================
   * 家具ペインタ（原点 = 足元矩形の左上。上方向へはみ出し可）
   * ===================================================================== */
  const PT = {};
  const fw = (f) => (f.w || 1) * T, fh = (f) => (f.h || 1) * T;

  /* ---- 壁掛け ---- */
  PT.window = (f, t, S) => {
    const w = fw(f);
    R(1, 3, w - 2, 26, DWOOD, 0.8);
    const gx = 3, gy = 5, gw = w - 6, gh = 21;
    const dawn = S && S.dawn ? S.dawn : 0;
    for (let i = 0; i < gh; i++) A(gx, gy + i, gw, 1, css(mix(mix([12, 18, 50], [50, 70, 120], i / gh), [230, 150, 120], dawn * (i / gh))));
    for (let i = 0; i < 6; i++) { const sx = gx + Math.floor(hash(i, f.x, 3) * gw), sy = gy + Math.floor(hash(i, f.x, 4) * 10); A(sx, sy, 1, 1, 'rgba(255,255,255,' + (0.4 + 0.4 * Math.sin(t * 2 + i)) + ')'); }
    if (w >= 32 || f.x % 2 === 0) { oval(gx + gw - 6, gy + 5, 3, 3, [240, 240, 210]); A(gx + gw - 7, gy + 3, 2, 2, 'rgba(200,200,180,0.6)'); }
    A(gx, gy + gh - 6, gw, 6, 'rgba(160,170,200,0.25)');
    R(gx + (gw >> 1) - 1, gy, 2, gh, DWOOD, 1); R(gx, gy + 9, gw, 2, DWOOD, 1);
    R(0, 27, w, 3, WOOD, 1.25); R(0, 29, w, 1, DWOOD, 0.6);
    const cur = f.fake ? [180, 110, 140] : [120, 26, 40];
    R(0, 2, 4, 26, cur); R(1, 2, 1, 26, cur, 1.3); R(3, 2, 1, 26, cur, 0.7);
    R(w - 4, 2, 4, 26, cur); R(w - 3, 2, 1, 26, cur, 1.3); R(w - 1, 2, 1, 26, cur, 0.7);
    R(0, 1, w, 2, GOLD, 0.9);
  };
  function paintingArt(v, x, y, w, h, t) {
    const S = (yy, c1, c2, hh) => { for (let i = 0; i < hh; i++) A(x, y + yy + i, w, 1, css(mix(c1, c2, i / hh))); };
    switch (v) {
      case 'land': S(0, [60, 50, 90], [200, 120, 90], h); oval(x + w * 0.7, y + h * 0.35, 2, 2, [255, 230, 160]); for (let i = 0; i < w; i++) { const hh = Math.round(h * 0.55 + Math.sin(i * 0.4) * 2); A(x + i, y + hh, 1, h - hh, css([40, 60, 40])); } A(x + 3, y + h - 8, 2, 6, '#2a1a10'); oval(x + 4, y + h - 9, 3, 3, [30, 70, 40]); break;
      case 'land2': S(0, [10, 20, 50], [40, 60, 90], h); oval(x + 5, y + 4, 2, 2, [230, 230, 200]); for (let i = 0; i < w; i += 3) { const th = 5 + ((i * 7) % 4); A(x + i, y + h - th, 3, th, '#14241c'); A(x + i + 1, y + h - th - 2, 1, 2, '#14241c'); } break;
      case 'sea': S(0, [70, 80, 100], [110, 120, 130], h >> 1); S(h >> 1, [30, 50, 80], [20, 30, 50], h - (h >> 1)); for (let i = 0; i < w; i += 2) A(x + i, y + (h >> 1) + ((i * 3) % 5), 2, 1, '#a0b8d0'); A(x + (w >> 1) - 3, y + (h >> 1) - 1, 6, 2, '#3a2010'); A(x + (w >> 1), y + (h >> 1) - 7, 1, 6, '#3a2010'); A(x + (w >> 1) + 1, y + (h >> 1) - 6, 3, 4, '#d8d0c0'); break;
      case 'still': A(x, y, w, h, '#2a1c14'); A(x, y + h - 5, w, 5, '#5a3820'); oval(x + 5, y + h - 7, 3, 3, [180, 40, 40]); oval(x + 9, y + h - 6, 2, 2, [200, 160, 40]); oval(x + w - 6, y + h - 8, 3, 4, [90, 120, 60]); break;
      case 'lord': case 'lady': case 'girl': {
        const bg = v === 'lord' ? [30, 26, 34] : v === 'lady' ? [36, 60, 46] : [60, 70, 100];
        A(x, y, w, h, css(bg)); A(x, y, w, 3, css(bg, 1.2));
        const cx = x + (w >> 1);
        const body = v === 'lord' ? [24, 24, 30] : v === 'lady' ? [140, 30, 40] : [70, 110, 180];
        oval(cx, y + h, w * 0.38, h * 0.38, body);
        if (v === 'lord') { A(cx - 1, y + h - 7, 3, 4, '#e8e0d0'); }
        const hair = v === 'lord' ? [160, 160, 160] : v === 'lady' ? [90, 50, 30] : [230, 200, 110];
        oval(cx, y + h * 0.42, w * 0.18 + 1, h * 0.2 + 1, hair);
        oval(cx, y + h * 0.46, w * 0.14, h * 0.17, SKIN);
        A(cx - 2, y + Math.round(h * 0.44), 1, 1, '#302020'); A(cx + 1, y + Math.round(h * 0.44), 1, 1, '#302020');
        if (v === 'girl') { A(cx - w * 0.2, y + h * 0.3, 2, h * 0.3, css(hair)); A(cx + w * 0.2 - 1, y + h * 0.3, 2, h * 0.3, css(hair)); A(cx - 2, y + h * 0.26, 4, 1, '#d04060'); }
        if (v === 'lord') A(cx - 2, y + Math.round(h * 0.55), 4, 1, '#808080');
        break;
      }
      case 'family': A(x, y, w, h, '#2c2430'); oval(x + w * 0.36, y + h, 5, 8, [30, 30, 36]); oval(x + w * 0.36, y + h * 0.38, 3, 3, SKIN); A(x + w * 0.36 - 3, y + h * 0.22, 6, 2, '#a0a0a0'); oval(x + w * 0.66, y + h, 4, 5, [80, 120, 180]); oval(x + w * 0.66, y + h * 0.6, 2, 2, SKIN); A(x + w * 0.66 - 3, y + h * 0.5, 6, 2, '#e0c070'); break;
      case 'manor': S(0, [80, 50, 90], [230, 140, 90], h); A(x + 3, y + h - 8, w - 6, 8, '#1a1418'); A(x + (w >> 1) - 2, y + 3, 4, h - 6, '#1a1418'); A(x + (w >> 1) - 3, y + 2, 6, 2, '#1a1418'); oval(x + (w >> 1), y + 6, 1, 1, [255, 220, 140]); for (let i = 5; i < w - 5; i += 3) A(x + i, y + h - 5, 1, 2, 'rgba(255,200,120,0.8)'); break;
      default: A(x, y, w, h, '#333');
    }
  }
  PT.painting = (f, t) => {
    const w = fw(f), small = w < 32;
    const x = small ? 2 : 4, y = 6, iw = w - x * 2, ih = small ? 16 : 18;
    A(x - 1 + 2, y - 1 + 2, iw + 4, ih + 4, 'rgba(0,0,0,0.4)');
    box(x - 2, y - 2, iw + 4, ih + 4, GOLD, 1.4, 0.5);
    R(x - 1, y - 1, iw + 2, ih + 2, GOLD, 0.65);
    paintingArt(f.v, x, y, iw, ih, t);
    A(x, y, iw, 1, 'rgba(255,255,255,0.1)');
    if (!small) { R(x + (iw >> 1) - 3, y + ih + 3, 6, 2, GOLD, 0.9); }
  };
  PT.wlamp = (f, t) => {
    R(5, 14, 6, 7, BRASS, 0.8); R(6, 15, 4, 5, BRASS, 1.1);
    R(7, 10, 2, 5, BRASS, 0.9);
    A(5, 9, 6, 2, css(BRASS, 1.2));
    A(6, 4, 4, 5, 'rgba(255,220,160,0.55)'); A(6, 4, 1, 5, 'rgba(255,255,255,0.4)');
    flame(8, 9, t, 0.8, f.x);
  };
  PT.torch = (f, t) => { R(7, 14, 2, 10, IRON, 1); R(5, 12, 6, 3, IRON, 1.3); R(6, 10, 4, 3, [90, 50, 20]); flame(8, 11, t, 1.4, f.x * 3); };
  PT.fireplace = (f, t) => {
    const w = fw(f);
    box(-2, 6, w + 4, 26, [150, 140, 130]);
    R(-4, 4, w + 8, 4, MARBLE, 1.05); R(-4, 7, w + 8, 1, MARBLE, 0.6);
    A(2, 12, w - 4, 20, '#120a08');
    for (let i = 0; i < 4; i++) A(3 + i, 13 + i, w - 6 - i * 2, 1, 'rgba(60,40,30,0.5)');
    R(1, 30, w - 2, 6, [110, 100, 96]);
    if (!f.cold) {
      for (let i = 0; i < 5; i++) {
        const fx = 6 + i * ((w - 12) / 4), ff = Math.sin(t * 9 + i * 1.7) * 2;
        A(fx - 2, 26 - 6 - ff, 5, 7 + ff, '#c84a14'); A(fx - 1, 24 - 6 - ff, 3, 6 + ff, '#ff9a2a'); A(fx, 26 - 4 - ff * 0.5, 1, 3, '#ffe27a');
      }
      R(4, 27, w - 8, 3, [60, 30, 18]); A(6, 28, w - 12, 1, '#ff6020');
    } else { R(4, 28, w - 8, 2, [70, 66, 64]); A(6, 27, 3, 1, '#555'); }
    R(w / 2 - 3, 9, 6, 2, GOLD, 1);
  };
  PT.mirror = (f) => {
    oval(8, 14, 6, 9, GOLD, 0.9); oval(8, 14, 5, 8, [150, 180, 200]);
    A(5, 9, 1, 6, 'rgba(255,255,255,0.6)'); A(6, 8, 1, 3, 'rgba(255,255,255,0.4)');
    if (f.broken) { A(7, 8, 1, 6, '#405060'); A(8, 13, 3, 1, '#405060'); A(6, 15, 2, 4, '#405060'); A(9, 16, 1, 5, '#405060'); }
  };
  PT.pots = (f) => {
    const w = fw(f); R(2, 6, w - 4, 2, IRON, 1.3);
    for (let i = 0; i < f.w * 2; i++) { const x = 4 + i * 8; A(x + 2, 8, 1, 4, '#333'); oval(x + 2, 15 + (i % 2) * 2, 3, 3, [190, 100, 60]); A(x, 14 + (i % 2) * 2, 1, 2, 'rgba(255,220,180,0.6)'); }
  };
  PT.wallshelf = (f) => {
    const w = fw(f);
    R(0, 2, w, 30, DWOOD, 0.8);
    for (let s = 0; s < 3; s++) {
      const sy = 5 + s * 9;
      A(1, sy, w - 2, 8, '#1a100a');
      let x = 2;
      while (x < w - 3) {
        const bw = 2 + Math.floor(hash(x, sy + f.x * 7, 2) * 2), bh = 5 + Math.floor(hash(x, sy, 3) * 3);
        let c = BOOKC[Math.floor(hash(x + f.x * 31, sy, 4) * BOOKC.length)];
        if (f.odd && s === 1 && x > 6 && x < 10) c = [200, 160, 50];
        R(x, sy + 8 - bh, bw, bh, c); R(x, sy + 8 - bh, 1, bh, c, 1.3);
        if (bh > 5) A(x, sy + 9 - bh + 1, bw, 1, 'rgba(255,220,120,0.5)');
        x += bw + (hash(x, sy, 9) > 0.85 ? 1 : 0);
      }
      R(0, sy + 8, w, 1, WOOD, 1.3);
    }
    R(0, 2, w, 2, WOOD, 1.2); R(0, 2, 1, 30, WOOD, 1.1); R(w - 1, 2, 1, 30, DWOOD, 0.6);
  };
  PT.cobweb = (f) => { const w = fw(f); g.strokeStyle = 'rgba(220,220,230,0.35)'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i < 5; i++) { g.moveTo(0.5, 2.5); g.lineTo(w * (i / 4) + 0.5, 2.5 + (4 - i) * 5); } g.stroke(); for (let r = 4; r < 16; r += 5) { g.beginPath(); g.arc(0, 2, r, 0, Math.PI / 2); g.stroke(); } };
  PT.plaque = (f) => { const w = fw(f); box(4, 10, w - 8, 12, BRASS); for (let i = 0; i < 3; i++) A(7, 13 + i * 3, w - 14 - (i % 2) * 4, 1, 'rgba(60,40,10,0.7)'); };
  PT.pipes = (f) => {
    const w = fw(f);
    R(0, 12, w, 4, [110, 100, 90]); R(0, 12, w, 1, [110, 100, 90], 1.4); R(0, 15, w, 1, [110, 100, 90], 0.5);
    R(0, 20, w, 3, [90, 80, 70]); R(0, 20, w, 1, [90, 80, 70], 1.4);
    for (let x = 6; x < w; x += 20) { R(x, 4, 3, 28, [100, 92, 84]); R(x, 4, 1, 28, [100, 92, 84], 1.4); R(x - 1, 11, 5, 6, [120, 110, 100]); }
    oval(w - 8, 18, 3, 3, [170, 40, 30]); A(w - 9, 18, 3, 1, '#600');
    A(12, 23, 1, 9, 'rgba(120,70,40,0.6)');
  };
  PT.chalkboard = (f) => {
    const w = fw(f); box(1, 5, w - 2, 20, WOOD);
    R(3, 7, w - 6, 16, [30, 50, 40]);
    for (let i = 0; i < 5; i++) A(6 + ((i * 13) % 20), 9 + i * 3, 10 + (i % 3) * 6, 1, 'rgba(230,230,220,0.7)');
    g.strokeStyle = 'rgba(230,230,220,0.7)'; g.beginPath(); g.arc(w / 2 + 0.5, 15.5, 5, 0, Math.PI * 2); g.stroke();
    R(3, 24, w - 6, 2, WOOD, 1.2); A(8, 23, 3, 1, '#eee');
  };
  PT.monitors = (f, t) => {
    const w = fw(f); R(0, 3, w, 28, [30, 32, 38]);
    for (let r = 0; r < 2; r++) for (let c = 0; c < f.w * 2 - 0; c++) {
      const x = 2 + c * 8, y = 5 + r * 12;
      if (x + 7 > w) continue;
      box(x, y, 7, 10, [60, 64, 70]);
      const ph = hash(c, r, f.x), on = Math.sin(t * (1 + ph) * 3 + ph * 10) > -0.9;
      const col = ph > 0.7 ? [90, 230, 140] : ph > 0.35 ? [90, 200, 230] : [200, 220, 240];
      A(x + 1, y + 1, 5, 7, on ? css(col, 0.5) : '#111');
      if (on) { for (let k = 0; k < 3; k++) A(x + 1, y + 2 + k * 2, 2 + Math.floor(hash(k, Math.floor(t * 2) + c, r) * 4), 1, css(col, 1.1)); A(x + 1, y + 1 + (Math.floor(t * 10 + c) % 7), 5, 1, 'rgba(255,255,255,0.25)'); }
    }
  };
  PT.clockface = (f, t, S) => {
    const w = fw(f), cx = w / 2, cy = 32, r = 30;
    g.save(); g.beginPath(); g.rect(-4, 0, w + 8, 32); g.clip();
    oval(cx, cy, r + 3, r + 3, [70, 56, 40]);
    oval(cx, cy, r + 1, r + 1, BRASS, 0.8);
    oval(cx, cy, r - 1, r - 1, [40, 50, 80]);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; A(Math.round(cx + Math.cos(a) * (r - 5)) - 1, Math.round(cy + Math.sin(a) * (r - 5)) - 1, 2, 2, '#d8d0b0'); }
    g.strokeStyle = 'rgba(180,170,140,0.4)'; g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI + (i / 5) * Math.PI; g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.stroke();
    const mins = S ? S.time : 0;
    // 文字盤の「裏側」なので左右反転
    const ha = ((mins / 60) % 12) / 12 * Math.PI * 2, ma = (mins % 60) / 60 * Math.PI * 2;
    g.strokeStyle = '#1a1410'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - Math.sin(ha) * 14, cy - Math.cos(ha) * 14); g.stroke();
    g.lineWidth = 1; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - Math.sin(ma) * 22, cy - Math.cos(ma) * 22); g.stroke();
    g.restore();
    A(cx - 20, 6, 6, 2, 'rgba(255,255,255,0.25)');
  };
  PT.board = (f) => { const w = fw(f); box(2, 6, w - 4, 18, [150, 110, 70]); for (let i = 0; i < 4; i++) { const x = 5 + i * 6, y = 8 + (i % 2) * 6; A(x, y, 5, 6, '#e8e4d8'); A(x + 2, y, 1, 1, '#c03030'); A(x + 1, y + 2, 3, 1, '#999'); } };

  /* ---- 頭上 ---- */
  PT.chandelier = (f, t) => {
    const w = fw(f), cx = w / 2, y = f.top ? 2 : -20;
    if (!f.top) A(cx, y - 40, 1, 40, 'rgba(60,50,30,0.8)');
    oval(cx, y + 6, 14, 4, GOLD, 0.6); oval(cx, y + 5, 13, 3, GOLD, 1.0); oval(cx, y + 4, 9, 2, GOLD, 1.3);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3, px = Math.round(cx + Math.cos(a) * 12), py = Math.round(y + 4 + Math.sin(a) * 3);
      A(px, py - 4, 1, 4, '#f4ecd8'); flame(px, py - 4, t, 0.6, i);
      A(px, py + 3, 1, 3, 'rgba(200,230,255,0.7)');
    }
    A(cx, y + 8, 1, 6, 'rgba(200,230,255,0.8)'); A(cx - 1, y + 13, 3, 2, 'rgba(220,240,255,0.9)');
  };

  /* ---- 床置き ---- */
  PT.gclock = (f, t, S) => {
    shadow(2, -2, 12, 16);
    box(2, -26, 12, 40, DWOOD, 1.4, 0.5);
    R(1, -28, 14, 4, DWOOD, 1.3); oval(8, -28, 5, 2, DWOOD, 1.2);
    oval(8, -18, 5, 5, GOLD, 0.8); oval(8, -18, 4, 4, [238, 230, 210]);
    const m = f.stop != null && !(S && S.running) ? f.stop : (S ? S.time : 350) + 1080, ha = ((m / 60) % 12) / 12 * Math.PI * 2, ma = (m % 60) / 60 * Math.PI * 2;
    g.strokeStyle = '#201810'; g.beginPath(); g.moveTo(8.5, -17.5); g.lineTo(8.5 + Math.sin(ha) * 2.5, -17.5 - Math.cos(ha) * 2.5); g.moveTo(8.5, -17.5); g.lineTo(8.5 + Math.sin(ma) * 3.5, -17.5 - Math.cos(ma) * 3.5); g.stroke();
    A(4, -11, 8, 19, 'rgba(20,14,10,0.9)'); A(4, -11, 1, 19, 'rgba(255,255,255,0.15)');
    const sw = S && S.running ? Math.sin(t * 3.2) * 2.5 : 0;
    A(Math.round(8 + sw * 0.5), -10, 1, 12, css(BRASS, 0.9)); oval(Math.round(8 + sw), 3, 2, 2, BRASS, 1.2);
    R(1, 10, 14, 4, DWOOD, 0.9);
  };
  /* ---- 物語本編の屋外・人物 ---- */
  PT.person = (f, t, S) => { drawPerson(g, f.dir || 'down', 0, false, ELD.LOOKS[f.who] || ELD.LOOKS.hero, -10); };
  PT.lamppost = (f) => {
    shadow(5, 10, 6, 5); R(7, -30, 2, 42, IRON, 1.2); R(5, 10, 6, 3, IRON); box(4, -36, 8, 7, IRON);
    A(5, -35, 6, 5, 'rgba(255,220,150,0.95)'); R(3, -37, 10, 2, IRON, 0.8);
  };
  PT.flowerbed = (f) => {
    const w = fw(f), h = fh(f);
    box(0, 2, w, h - 2, [86, 64, 50], 1.1, 0.7); A(1, 3, w - 2, h - 4, '#2c2218');
    for (let i = 0; i < w; i += 3) for (let j = 4; j < h - 2; j += 4) {
      const k = (i * 7 + j * 3) % 5;
      R(i + 1, j - 4, 1, 6, [50, 96, 52]);
      A(i, j - 5, 2, 1, k > 1 ? '#c070b8' : '#e4a0d8'); A(i + 1, j - 3, 1, 1, '#a04c98'); A(i, j - 1, 2, 1, '#c070b8');
    }
  };
  PT.hedge = (f) => {
    const w = fw(f), h = fh(f);
    shadow(0, 4, w, h);
    for (let i = 0; i < w; i += 5) oval(i + 3, -2, 4, 6, [34, 70, 42], 0.9);
    box(0, -4, w, h + 4, [38, 76, 46], 1, 0.7);
    for (let i = 1; i < w; i += 3) A(i, -3 + ((i * 5) % 7), 1, 1, '#5fa06a');
  };
  PT.campole = (f) => {
    R(7, -30, 2, 44, IRON); R(5, 12, 6, 2, IRON);
    box(2, -34, 10, 5, [40, 42, 48]); A(2, -33, 2, 3, '#111'); A(3, -32, 1, 1, '#ff3030');
  };
  PT.gatepanel = (f) => {
    shadow(3, 8, 10, 6); R(6, 2, 4, 12, IRON); box(2, -12, 12, 15, [70, 74, 82]);
    A(4, -10, 8, 5, '#103020'); A(5, -9, 5, 1, '#5fe0a0'); A(5, -7, 3, 1, '#5fe0a0');
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) A(4 + i * 3, -3 + j * 3, 2, 2, '#c8ccd4');
  };
  PT.fence = (f) => {
    const w = fw(f);
    shadow(0, 10, w, 4);
    R(0, -2, w, 2, IRON, 1.1); R(0, 8, w, 2, IRON);
    for (let x = 1; x < w; x += 4) { R(x, -6, 2, 18, IRON, 1.15); A(x, -8, 2, 2, css(IRON, 1.5)); }
  };
  PT.irongate = (f) => {
    const w = fw(f);
    shadow(0, 10, w, 4);
    R(0, -10, w, 3, IRON, 1.2); R(0, 8, w, 2, IRON);
    for (let x = 1; x < w; x += 3) { R(x, -8, 2, 18, IRON, 1.25); }
    A((w >> 1) - 3, -2, 6, 6, '#3a3c44'); A((w >> 1) - 1, 0, 2, 2, '#ff4040');
  };
  PT.busstop = (f) => {
    shadow(5, 10, 6, 4); R(7, -22, 2, 34, IRON); box(1, -30, 14, 9, [200, 196, 180]); A(3, -28, 10, 1, '#555'); A(3, -26, 7, 1, '#555'); A(3, -24, 9, 1, '#555');
  };
  /* ---- 最終バスの車内（プロローグ） ---- */
  PT.busseat = (f) => { // 前（右）向きの二人掛け。上から見た座面と背もたれ
    const h = fh(f), blue = [46, 72, 92];
    shadow(1, 2, 14, h - 2, 0.3);
    box(1, 1, 12, h - 2, blue); R(2, 2, 10, h - 4, blue, 1.25); R(2, 2 + ((h - 4) >> 1), 10, 1, blue, 0.7);
    box(1, 0, 3, h, [36, 54, 70]); R(13, 3, 2, h - 6, IRON);
  };
  PT.buswin = (f, t) => { // 雨の窓。霧と、遠い灯り。雨筋が流れる
    const w = fw(f);
    R(0, 2, w, 28, [40, 44, 52]);
    for (let i = 0; i < 24; i++) A(2, 4 + i, w - 4, 1, css(mix([18, 22, 34], [58, 66, 82], i / 24)));
    A(2, 18, w - 4, 10, 'rgba(150,160,175,0.18)');
    if (f.lamp) { oval(w - 9, 16, 2, 2, [255, 214, 140]); A(w - 13, 13, 9, 7, 'rgba(255,200,120,0.12)'); }
    for (let i = 0; i < 7; i++) { const sx = 3 + Math.floor(hash(i, f.x, 7) * (w - 6)), sp = 10 + hash(i, f.x, 9) * 14, y = 4 + ((t * sp + i * 9) % 22); A(sx, y, 1, 3, 'rgba(200,215,235,0.55)'); }
    R(0, 2, w, 2, [70, 76, 86]); R(0, 28, w, 2, [70, 76, 86]); R((w >> 1) - 1, 2, 2, 28, [70, 76, 86]);
  };
  PT.busdriver = (f) => { // 運転席：ハンドルと計器、運転手の背中
    shadow(0, 2, 16, 26, 0.3);
    box(0, 2, 14, 26, [30, 40, 50]); R(2, 4, 10, 22, [24, 30, 38]);
    oval(17, 15, 6, 8, [20, 20, 24]); oval(17, 15, 4, 6, [44, 46, 52]);
    oval(6, 15, 5, 6, [40, 44, 58]); oval(6, 9, 4, 3, [52, 46, 40]); R(3, 8, 6, 2, [34, 50, 80]);
    A(22, 8, 6, 14, 'rgba(90,200,150,0.5)');
  };
  PT.busrail = (f) => { const w = fw(f); R(0, 6, w, 2, IRON, 1.2); for (let x = 4; x < w; x += 16) R(x, 6, 1, 6, IRON); };
  PT.keybox = (f) => {
    box(3, 8, 10, 14, [70, 50, 34]); A(4, 9, 8, 12, '#2a1c12');
    for (let i = 0; i < 4; i++) { A(5 + i * 2, 18, 1, 2, '#ddd'); }
    A(5, 11, 6, 4, '#c8b88a'); A(6, 12, 4, 1, '#3a2a1a');
  };
  PT.bigwindow = (f) => {
    const w = fw(f);
    box(2, 8, w - 4, 20, [40, 34, 34]); A(4, 10, w - 8, 16, 'rgba(255,200,120,0.85)');
    A((w >> 1) - 1, 10, 2, 16, '#3a2e28'); A(4, 17, w - 8, 1, '#3a2e28');
  };
  PT.placecard = (f) => { A(4, 4, 8, 5, '#f0e8d4'); A(5, 6, 6, 1, '#555'); };
  PT.phone = (f) => { shadow(3, 8, 10, 5); box(3, 4, 10, 8, [40, 36, 34]); box(4, 1, 8, 4, [30, 28, 26]); A(6, 6, 4, 3, '#ddd'); };
  PT.plant = (f) => {
    shadow(2, 8, 12, 6);
    box(4, 6, 8, 8, [70, 100, 140]); R(3, 6, 10, 2, [70, 100, 140], 1.3);
    const L = [[8, -6, 5], [4, -2, 4], [12, -2, 4], [6, 2, 4], [10, 2, 4], [8, -1, 4]];
    L.forEach(([x, y, r], i) => { oval(x, y, r, r - 1, [40, 96 + i * 8, 50], 0.85); oval(x - 1, y - 1, r - 2, r - 2, [60, 130 + i * 6, 70]); });
    A(7, -8, 1, 1, '#b0e090'); A(3, -3, 1, 1, '#b0e090');
  };
  PT.pillar = (f) => {
    const m = f.dark ? [60, 50, 80] : MARBLE;
    shadow(0, 4, 16, 12, 0.4);
    box(0, 6, 16, 10, m, 1.2, 0.6); box(1, 2, 14, 5, m);
    for (let x = 2; x < 14; x++) { const k = 0.75 + Math.sin((x - 2) / 12 * Math.PI) * 0.4 + ((x % 3) === 0 ? -0.15 : 0); R(x, -38, 1, 40, m, k); }
    box(0, -42, 16, 5, m, 1.3); box(-1, -45, 18, 3, m, 1.3);
    if (f.dark) { A(5, -30, 1, 20, 'rgba(160,130,240,0.6)'); }
  };
  PT.armor = (f) => {
    shadow(2, 8, 12, 6);
    R(3, 11, 10, 4, DWOOD); R(5, 8, 2, 4, [130, 136, 150]); R(9, 8, 2, 4, [130, 136, 150]);
    box(4, -4, 8, 12, [150, 156, 170]); A(5, -3, 2, 9, 'rgba(255,255,255,0.4)');
    box(1, -4, 3, 10, [130, 136, 150]); box(12, -4, 3, 10, [130, 136, 150]);
    box(5, -12, 6, 8, [160, 166, 180]); A(6, -9, 4, 1, '#111'); R(7, -14, 2, 3, [150, 30, 40]);
    A(14, -14, 1, 24, css(IRON, 1.6)); A(13, -16, 3, 3, '#ccc');
  };
  PT.counter = (f) => {
    const w = fw(f), h = fh(f);
    shadow(0, 2, w, h);
    box(0, 4, w, h - 4, [96, 56, 30], 1.2, 0.55);
    for (let x = 4; x < w - 8; x += 14) { box(x, 9, 10, h - 12, [96, 56, 30], 0.8, 1.25); A(x + 4, 12, 2, 2, css(GOLD)); }
    box(-1, -2, w + 2, 7, [200, 194, 182], 1.15, 0.7);
    A(6, -6, 9, 5, '#e8e0cc'); A(6, -6, 9, 1, '#a02020'); A(10, -6, 1, 5, '#776');
    oval(28, -3, 3, 2, GOLD, 1.1); A(28, -6, 1, 2, css(GOLD));
    R(w - 12, -12, 2, 9, BRASS); oval(w - 11, -13, 4, 3, [240, 220, 170]);
  };
  PT.bench = (f) => { const w = fw(f); shadow(0, 6, w, 8); R(1, 10, 2, 5, DWOOD); R(w - 3, 10, 2, 5, DWOOD); box(0, 4, w, 7, WOOD); R(1, 3, w - 2, 4, [130, 30, 40]); R(1, 3, w - 2, 1, [130, 30, 40], 1.4); };
  PT.statue = (f) => {
    const m = f.dark ? [70, 60, 90] : MARBLE;
    shadow(2, 6, 12, 10);
    box(2, 2, 12, 12, [120, 110, 100]); box(1, 0, 14, 3, [140, 130, 120]);
    if (f.dark) { box(3, -14, 10, 14, m); A(4, -12, 2, 2, '#c060ff'); A(10, -12, 2, 2, '#c060ff'); R(1, -10, 3, 6, m, 0.8); R(12, -10, 3, 6, m, 0.8); return; }
    oval(8, -2, 6, 3, m, 0.9); oval(8, -9, 4, 5, m); A(6, -12, 1, 6, 'rgba(255,255,255,0.4)'); A(7, -9, 1, 1, '#999'); A(9, -9, 1, 1, '#999');
  };
  PT.railing = (f) => {
    const w = fw(f);
    A(0, 10, w, 4, 'rgba(0,0,0,0.3)');
    for (let x = 1; x < w; x += 4) { R(x, 0, 2, 12, MARBLE, 0.9); R(x, 0, 1, 12, MARBLE, 1.1); oval(x + 1, 6, 1, 2, MARBLE, 0.95); }
    box(0, -3, w, 4, DWOOD, 1.6); R(0, 11, w, 2, DWOOD, 0.8);
    for (let x = 0; x < w; x += 48) box(x, -6, 5, 18, DWOOD, 1.4);
  };
  PT.longtable = (f, t) => {
    const w = fw(f), h = fh(f);
    shadow(0, 2, w, h + 2);
    R(0, 0, w, h + 2, CLOTH); R(0, 0, w, 1, CLOTH, 1.3);
    for (let x = 0; x < w; x += 4) { A(x, h + 2, 3, 2, css(CLOTH, 0.85)); A(x + 1, h + 4, 1, 1, css(CLOTH, 0.7)); }
    A(0, h, w, 2, 'rgba(0,0,0,0.12)');
    R(4, 4, w - 8, 2, [140, 30, 40]);
    for (let i = 0; i < 4; i++) {
      const px = 20 + i * ((w - 40) / 3);
      oval(px, 3, 3, 2, [250, 250, 245]); oval(px, 3, 2, 1, [200, 200, 195]);
      oval(px, h - 4, 3, 2, [250, 250, 245]); oval(px, h - 4, 1, 1, [180, 90, 60]);
      A(px + 5, 1, 1, 3, '#c0c4d0'); A(px + 5, h - 6, 1, 3, '#c0c4d0');
    }
    const cx = w / 2;
    oval(cx, h / 2, 5, 3, [200, 160, 80]); oval(cx - 3, h / 2 - 1, 2, 2, [180, 40, 40]); oval(cx + 3, h / 2, 2, 2, [220, 180, 50]);
    [cx - 18, cx + 18].forEach((x, i) => { R(x - 1, h / 2 - 6, 3, 8, GOLD); R(x - 4, h / 2 - 8, 9, 2, GOLD, 1.1); [-3, 0, 3].forEach((d) => { A(x + d, h / 2 - 12, 1, 4, '#f4ecd8'); flame(x + d, h / 2 - 12, t, 0.5, i * 3 + d); }); });
  };
  PT.chair = (f) => {
    const d = f.d || 'down', red = [140, 34, 44];
    shadow(3, 6, 11, 8, 0.25);
    R(3, 12, 2, 4, DWOOD); R(11, 12, 2, 4, DWOOD);
    box(3, 5, 10, 8, WOOD); R(4, 6, 8, 5, red); R(4, 6, 8, 1, red, 1.4);
    if (d === 'down') { box(3, -4, 10, 9, WOOD); R(5, -2, 6, 5, red, 0.9); }
    else if (d === 'up') { box(3, 10, 10, 4, WOOD, 1.2); }
    else if (d === 'right') { box(2, -4, 3, 16, WOOD); }
    else { box(11, -4, 3, 16, WOOD); }
  };
  PT.cupboard = (f) => {
    const w = fw(f);
    shadow(0, -2, w, 16);
    box(0, -18, w, 32, DWOOD, 1.3, 0.5);
    R(-1, -21, w + 2, 4, DWOOD, 1.4);
    A(2, -15, w - 4, 14, 'rgba(160,190,210,0.25)');
    for (let i = 0; i < f.w * 2; i++) { oval(5 + i * 7, -10, 3, 3, [236, 236, 230]); oval(5 + i * 7, -10, 1, 1, [80, 100, 160]); A(3 + i * 7, -4, 5, 2, '#d8d8e0'); }
    A(w / 2, -15, 1, 14, css(DWOOD, 0.6));
    for (let x = 2; x < w - 2; x += 8) box(x, 1, 6, 10, DWOOD, 1.2, 0.7);
    A(3, -14, 1, 12, 'rgba(255,255,255,0.3)');
  };
  PT.stove = (f, t) => {
    const w = fw(f);
    shadow(0, 0, w, 16);
    R(w / 2 - 2, -24, 4, 22, [40, 40, 44]); R(w / 2 - 2, -24, 1, 22, [80, 80, 90]);
    box(0, -2, w, 16, [44, 44, 50], 1.6, 0.6);
    R(0, -4, w, 3, [70, 70, 78]);
    A(4, 5, w - 8, 6, '#1a0a06');
    for (let i = 0; i < w - 10; i += 3) A(5 + i, 7 + Math.round(Math.sin(t * 8 + i) * 1), 2, 3, i % 2 ? '#ff7a20' : '#ffb040');
    oval(9, -5, 5, 3, [100, 100, 110]); oval(9, -6, 4, 2, [150, 90, 50]);
    oval(23, -5, 4, 2, [60, 60, 66]);
    A(9, -12 - (t * 8 % 4), 1, 3, 'rgba(255,255,255,0.25)');
  };
  PT.sink = (f) => { shadow(0, 0, 16, 14); box(1, 2, 14, 12, [150, 146, 140]); A(3, 4, 10, 6, '#405058'); A(4, 5, 4, 1, 'rgba(255,255,255,0.4)'); R(7, -6, 2, 9, BRASS); R(7, -6, 5, 2, BRASS, 1.2); };
  PT.shelf = (f) => {
    const w = fw(f);
    shadow(0, -4, w, 14);
    R(0, -14, 2, 28, DWOOD); R(w - 2, -14, 2, 28, DWOOD);
    for (let s = 0; s < 3; s++) {
      const y = -12 + s * 9;
      R(0, y + 7, w, 2, WOOD, 1.1);
      for (let x = 3; x < w - 4; x += 5) {
        const k = hash(x, s, f.x * 7 + f.y);
        if (f.jars || k > 0.5) { R(x, y + 2, 3, 5, f.jars ? [80 + k * 120, 160, 120 + k * 80] : [120, 90, 60]); A(x, y + 2, 1, 5, 'rgba(255,255,255,0.35)'); R(x, y + 1, 3, 1, [90, 70, 50]); }
        else box(x, y + 3, 4, 4, [150, 120, 80]);
      }
    }
  };
  PT.shelfv = (f) => {
    const h = fh(f);
    shadow(0, 0, 14, h);
    box(1, -10, 13, h + 10, DWOOD, 1.3, 0.5);
    for (let y = -8; y < h - 2; y += 7) { R(2, y + 5, 11, 1, WOOD, 1.2); for (let x = 3; x < 12; x += 3) R(x, y + 1, 2, 4, BOOKC[Math.floor(hash(x, y, 3) * 9)]); }
  };
  PT.worktable = (f) => {
    const w = fw(f), h = fh(f);
    shadow(0, 0, w, h);
    R(1, h - 4, 2, 4, DWOOD); R(w - 3, h - 4, 2, 4, DWOOD);
    box(0, -2, w, h - 1, [150, 110, 70]);
    for (let x = 0; x < w; x += 5) A(x, -2, 1, h - 1, 'rgba(0,0,0,0.12)');
    box(6, 2, 14, 9, [190, 150, 100]); oval(12, 5, 3, 2, [220, 120, 40]); oval(17, 7, 2, 2, [80, 150, 60]);
    A(24, 4, 10, 1, '#d0d4dc'); A(24, 4, 3, 2, '#3a2a1a');
    oval(w - 12, 8, 4, 3, [200, 190, 160]); oval(w - 12, 8, 3, 2, [180, 60, 40]);
  };
  PT.barrel = (f) => {
    shadow(1, 4, 14, 10);
    for (let x = 1; x < 15; x++) { const k = 0.65 + Math.sin(((x - 1) / 13) * Math.PI) * 0.5; R(x, -2, 1, 16, [126, 80, 44], k); }
    R(1, 0, 14, 2, IRON, 1.2); R(1, 10, 14, 2, IRON, 1.2);
    oval(8, -3, 7, 3, [140, 92, 54]); oval(8, -3, 5, 2, [110, 72, 40]);
  };
  PT.crate = (f) => {
    shadow(0, 2, 16, 12);
    box(0, -2, 16, 16, [150, 112, 66], 1.3, 0.6);
    R(0, 2, 16, 1, [150, 112, 66], 0.6); R(0, 8, 16, 1, [150, 112, 66], 0.6);
    g.strokeStyle = css([150, 112, 66], 0.7); g.beginPath(); g.moveTo(1, 13); g.lineTo(15, -1); g.stroke();
    R(0, -4, 16, 3, [170, 130, 80]);
  };
  PT.sack = (f) => { shadow(2, 6, 12, 8); oval(8, 6, 6, 7, [180, 160, 120]); oval(7, 4, 4, 4, [200, 180, 140]); R(6, -2, 4, 3, [160, 140, 100]); A(5, -2, 6, 1, '#6a5030'); };
  PT.tub = (f) => {
    const w = fw(f), h = fh(f);
    shadow(0, 0, w, h);
    R(3, h - 2, 3, 3, GOLD); R(w - 6, h - 2, 3, 3, GOLD);
    for (let y = 0; y < h; y++) { const inset = y < 3 ? 3 - y : y > h - 4 ? y - (h - 4) : 0; A(inset, y - 2, w - inset * 2, 1, css([236, 236, 230], y < 2 ? 1.2 : 0.95)); }
    for (let y = 3; y < h - 5; y++) A(4, y - 2, w - 8, 1, css([120, 180, 210], 0.9 + Math.sin(y) * 0.04));
    A(6, 2, 8, 1, 'rgba(255,255,255,0.6)');
    R(w - 6, -6, 2, 5, GOLD, 1.1);
  };
  PT.basin = (f) => { shadow(2, 4, 12, 10); R(3, 6, 2, 8, DWOOD); R(11, 6, 2, 8, DWOOD); box(1, 2, 14, 5, WOOD); oval(8, 1, 5, 2, [230, 230, 236]); oval(8, 1, 3, 1, [120, 170, 200]); R(11, -6, 3, 6, [220, 220, 228]); };
  PT.candle = (f, t) => {
    shadow(4, 10, 8, 4);
    R(5, 12, 6, 2, IRON, 1.2); R(7, -2, 2, 14, IRON, 1.1); R(4, -3, 8, 2, IRON, 1.3);
    A(7, -9, 2, 6, '#f2ead6'); A(7, -9, 1, 6, '#fffaf0');
    flame(7, -9, t, 0.9, f.x * 5 + f.y);
  };
  PT.chest = (f, t, S) => {
    shadow(0, 4, 16, 10);
    box(1, 2, 14, 12, [120, 70, 34], 1.3, 0.55);
    R(1, 6, 14, 2, IRON, 1.3); R(4, 2, 2, 12, IRON, 1.1); R(10, 2, 2, 12, IRON, 1.1);
    if (f._open) { R(1, -7, 14, 9, [100, 60, 30]); R(2, -6, 12, 6, [40, 26, 16]); A(2, 1, 12, 3, '#120a06'); }
    else { box(1, -2, 14, 5, [130, 78, 40]); R(7, 1, 2, 3, GOLD); }
  };
  PT.bunk = (f) => {
    shadow(0, 0, 16, 32);
    R(0, -14, 2, 46, DWOOD); R(14, -14, 2, 46, DWOOD);
    [-12, 10].forEach((y) => { R(1, y, 14, 18, [90, 60, 40]); R(2, y + 1, 12, 15, [200, 196, 186]); R(3, y + 1, 10, 4, [240, 236, 228]); R(2, y + 6, 12, 10, [70, 90, 110]); R(2, y + 6, 12, 1, [70, 90, 110], 1.4); });
    R(1, -14, 14, 2, DWOOD, 1.3);
  };
  PT.locker = (f) => { shadow(1, -2, 14, 16); box(1, -18, 14, 32, [86, 104, 96], 1.3, 0.55); for (let i = 0; i < 4; i++) A(4, -14 + i * 2, 8, 1, 'rgba(0,0,0,0.5)'); A(11, -2, 2, 4, '#c0c0b0'); A(4, -18, 1, 32, 'rgba(255,255,255,0.12)'); };
  PT.table = (f) => {
    const w = fw(f), h = fh(f);
    shadow(0, 0, w, h);
    R(1, h - 5, 2, 5, DWOOD); R(w - 3, h - 5, 2, 5, DWOOD);
    box(0, -3, w, h - 1, WOOD, 1.3, 0.55);
    for (let x = 0; x < w; x += 6) A(x, -2, 1, h - 3, 'rgba(0,0,0,0.12)');
    if (f.w >= 3) { A(8, 0, 6, 8, '#e8e4d8'); A(10, 2, 3, 1, '#888'); A(w - 14, 2, 7, 5, '#c8c0a8'); }
  };
  PT.stool = (f) => { shadow(4, 8, 8, 6); R(5, 8, 1, 6, DWOOD); R(10, 8, 1, 6, DWOOD); oval(8, 7, 5, 3, WOOD); oval(8, 6, 4, 2, WOOD, 1.2); };
  PT.bed = (f) => {
    const w = fw(f), h = fh(f), c = f.c || [80, 60, 120];
    shadow(0, 0, w, h);
    box(-1, -14, w + 2, 16, DWOOD, 1.3, 0.6); R(1, -12, w - 2, 1, GOLD, 0.8);
    oval(w / 2, -14, w / 2 - 2, 3, DWOOD, 1.2);
    R(1, 2, w - 2, h - 4, [230, 226, 216]);
    oval(w * 0.3, 6, 5, 3, [250, 248, 240]); oval(w * 0.7, 6, 5, 3, [250, 248, 240]);
    R(1, 12, w - 2, h - 14, c); R(1, 12, w - 2, 3, [240, 236, 226]);
    for (let y = 16; y < h - 3; y += 4) A(2, y, w - 4, 1, css(c, 1.25));
    A(1, 12, 1, h - 14, css(c, 1.3));
    box(-1, h - 4, w + 2, 6, DWOOD, 1.3, 0.6);
  };
  PT.nightstand = (f, t) => { shadow(1, 2, 14, 12); box(2, -2, 12, 14, WOOD); R(3, 4, 10, 1, DWOOD); A(7, 6, 2, 1, css(GOLD)); R(6, -10, 4, 8, [230, 200, 150]); R(5, -12, 6, 3, [200, 160, 110]); A(7, -9, 2, 4, 'rgba(255,230,180,0.8)'); };
  PT.wardrobe = (f) => {
    const w = fw(f);
    shadow(0, -2, w, 16);
    box(0, -22, w, 36, DWOOD, 1.3, 0.5); R(-1, -25, w + 2, 4, DWOOD, 1.45);
    box(2, -18, w / 2 - 3, 28, DWOOD, 0.85, 1.2); box(w / 2 + 1, -18, w / 2 - 3, 28, DWOOD, 0.85, 1.2);
    A(w / 2 - 3, -6, 1, 3, css(GOLD)); A(w / 2 + 2, -6, 1, 3, css(GOLD));
    oval(w / 2, -23, 4, 2, GOLD, 0.9);
  };
  PT.desk = (f, t) => {
    const w = fw(f);
    shadow(0, 0, w, 14);
    box(0, -4, w, 18, f.big ? [90, 50, 26] : WOOD, 1.3, 0.5);
    R(0, 4, w, 1, DWOOD, 0.8); for (let x = 4; x < w - 6; x += 12) { box(x, 6, 8, 6, WOOD, 0.9, 1.1); A(x + 3, 8, 2, 1, css(GOLD)); }
    A(3, -2, 8, 6, '#ece4cc'); A(4, -1, 5, 1, '#888'); A(4, 1, 4, 1, '#888');
    A(13, -1, 3, 3, '#202030'); A(15, -6, 1, 6, '#e8e0d0');
    if (f.w >= 3) { box(w - 18, -3, 8, 5, [120, 30, 30]); }
    if (f.lamp) { R(w - 8, -8, 2, 8, BRASS); R(w - 11, -12, 8, 4, [40, 120, 70]); R(w - 11, -12, 8, 1, [80, 170, 110]); A(w - 10, -8, 6, 2, 'rgba(255,230,160,0.6)'); }
  };
  PT.readtable = (f, t) => { PT.table(f, t); const w = fw(f); A(6, 2, 10, 7, '#efe6cc'); A(11, 2, 1, 7, '#b0a080'); A(22, 4, 8, 6, '#6a2a2a'); R(w - 12, -8, 2, 8, BRASS); R(w - 15, -12, 8, 4, [40, 120, 70]); };
  PT.trunk = (f) => { shadow(0, 2, 16, 12); box(1, 0, 14, 13, [100, 60, 36]); R(1, 3, 14, 2, [60, 36, 20]); R(4, 0, 2, 13, [140, 100, 50]); R(10, 0, 2, 13, [140, 100, 50]); A(7, 4, 2, 2, css(GOLD)); };
  PT.dollhouse = (f) => {
    shadow(0, 2, 16, 12);
    box(1, -2, 14, 15, [210, 190, 160]);
    g.fillStyle = css([120, 50, 60]); g.beginPath(); g.moveTo(0, -1); g.lineTo(8, -9); g.lineTo(16, -1); g.fill();
    A(3, 1, 3, 3, '#ffd880'); A(10, 1, 3, 3, '#3a4a70'); A(3, 7, 3, 3, '#3a4a70'); A(7, 8, 2, 5, '#6a4030'); A(10, 7, 3, 3, '#ffd880');
    A(12, -10, 2, 6, '#6a5040');
  };
  PT.vase = (f) => { shadow(2, 6, 12, 8); R(4, 4, 8, 2, WOOD, 1.2); R(7, 6, 2, 8, WOOD); R(4, 12, 8, 2, WOOD); oval(8, 0, 3, 4, [60, 90, 160]); A(7, -4, 2, 2, '#3a6a3a'); [[5, -8], [8, -10], [11, -8], [7, -6], [10, -6]].forEach(([x, y]) => oval(x, y, 2, 2, [190, 30, 50])); };
  PT.globe = (f) => {
    shadow(3, 8, 10, 6);
    R(4, 12, 8, 2, DWOOD); R(7, 6, 2, 7, DWOOD);
    g.strokeStyle = css(BRASS); g.beginPath(); g.arc(8, 0, 7, 0, Math.PI * 2); g.stroke();
    oval(8, 0, 5, 5, [50, 100, 150]); A(5, -3, 3, 2, '#5a8a4a'); A(8, 1, 3, 3, '#5a8a4a'); A(5, -3, 1, 1, 'rgba(255,255,255,0.6)');
  };
  PT.armchair = (f) => {
    const c = [100, 40, 60], d = f.d || 'down';
    shadow(0, 2, 16, 12);
    box(1, 0, 14, 13, c, 1.25, 0.55);
    R(3, 2, 10, 8, c, 1.15);
    if (d === 'down' || d === 'right' || d === 'left') box(1, -6, 14, 7, c, 1.3, 0.6);
    box(0, 0, 3, 12, c, 1.2, 0.6); box(13, 0, 3, 12, c, 1.2, 0.6);
    R(2, 13, 2, 2, DWOOD); R(12, 13, 2, 2, DWOOD);
  };
  PT.lamp = (f) => { shadow(4, 10, 8, 4); R(5, 12, 6, 2, BRASS); R(7, -12, 2, 24, BRASS, 0.9); g.fillStyle = css([230, 200, 150]); g.beginPath(); g.moveTo(3, -12); g.lineTo(13, -12); g.lineTo(11, -20); g.lineTo(5, -20); g.fill(); A(4, -13, 8, 1, 'rgba(255,240,200,0.9)'); };
  PT.ladder = (f) => { R(2, -22, 2, 36, WOOD, 1.1); R(12, -22, 2, 36, WOOD, 1.1); for (let y = -20; y < 14; y += 5) R(2, y, 12, 2, WOOD, 0.9); };
  PT.bookshelf = (f) => {
    const w = fw(f);
    shadow(0, 2, w, 14);
    R(0, -16, w, 30, DWOOD, 0.7);
    for (let s = 0; s < 3; s++) {
      const sy = -14 + s * 9;
      A(1, sy, w - 2, 8, '#1a100a');
      let x = 2;
      while (x < w - 3) { const bw = 2 + Math.floor(hash(x, sy + f.y * 13 + f.x, 2) * 2), bh = 5 + Math.floor(hash(x, sy + f.y, 3) * 3); const c = BOOKC[Math.floor(hash(x + f.y * 17, sy + f.x, 4) * BOOKC.length)]; R(x, sy + 8 - bh, bw, bh, c); R(x, sy + 8 - bh, 1, bh, c, 1.3); x += bw + (hash(x, sy, 11) > 0.88 ? 2 : 0); }
      R(0, sy + 8, w, 1, WOOD, 1.2);
    }
    R(0, -18, w, 3, WOOD, 1.3); R(0, 11, w, 3, DWOOD, 1.1); R(0, -16, 1, 30, WOOD, 1.1); R(w - 1, -16, 1, 30, DWOOD, 0.5);
  };
  PT.safe = (f) => { shadow(1, 0, 14, 14); box(1, -4, 14, 18, [60, 64, 72], 1.5, 0.5); box(3, -2, 10, 13, [70, 74, 82], 0.8, 1.2); oval(8, 4, 3, 3, [180, 170, 140]); A(8, 2, 1, 2, '#222'); A(11, 1, 1, 4, '#ccc'); };
  PT.cabinet = (f) => {
    const w = fw(f);
    shadow(0, -2, w, 16);
    for (let i = 0; i < (f.w || 1); i++) {
      const x = i * 16;
      box(x, -12, 16, 26, [96, 106, 92], 1.3, 0.55);
      for (let d = 0; d < 3; d++) { box(x + 2, -10 + d * 8, 12, 7, [96, 106, 92], 1.15, 0.8); A(x + 6, -7 + d * 8, 4, 1, '#d0d0c0'); A(x + 5, -9 + d * 8, 6, 2, 'rgba(240,240,230,0.5)'); }
    }
  };
  PT.sofa = (f) => {
    const w = fw(f), c = [70, 40, 90], d = f.d || 'down';
    shadow(0, 2, w, 12);
    box(0, 0, w, 13, c, 1.2, 0.55);
    for (let x = 3; x < w - 3; x += Math.floor((w - 6) / 3)) { R(x, 2, (w - 6) / 3 - 1, 7, c, 1.15); R(x, 2, (w - 6) / 3 - 1, 1, c, 1.35); }
    if (d === 'up') box(0, 8, w, 6, c, 1.3, 0.6); else box(0, -6, w, 7, c, 1.3, 0.6);
    box(-1, 0, 3, 12, c, 1.2, 0.5); box(w - 2, 0, 3, 12, c, 1.2, 0.5);
  };
  PT.teatable = (f) => {
    const w = fw(f);
    shadow(0, 2, w, 12);
    R(2, 9, 2, 5, DWOOD); R(w - 4, 9, 2, 5, DWOOD);
    box(0, 0, w, 10, [90, 56, 34], 1.3, 0.55);
    oval(12, 4, 4, 3, [240, 240, 236]); R(15, 2, 3, 2, [240, 240, 236]); oval(12, 3, 2, 1, [140, 80, 40]);
    [24, 32, 40].forEach((x) => { oval(x, 5, 2, 2, [240, 240, 236]); A(x - 1, 4, 2, 1, '#8a4a20'); });
    A(12, -3 - 0, 1, 3, 'rgba(255,255,255,0.3)');
  };
  PT.gramophone = (f) => { shadow(1, 6, 14, 8); box(1, 4, 14, 10, WOOD); oval(8, 4, 5, 2, [30, 30, 30]); R(10, -6, 2, 10, BRASS); g.fillStyle = css(BRASS, 1.1); g.beginPath(); g.moveTo(11, -6); g.lineTo(2, -16); g.lineTo(8, -20); g.fill(); oval(5, -18, 3, 3, BRASS, 0.7); };
  PT.piano = (f) => {
    const w = fw(f), h = fh(f), blk = [26, 24, 30];
    shadow(0, 4, w, h);
    g.fillStyle = css(blk); g.beginPath(); g.moveTo(0, h - 8); g.lineTo(0, 2); g.quadraticCurveTo(4, -6, w * 0.45, -4); g.quadraticCurveTo(w * 0.7, -2, w - 4, h * 0.45); g.lineTo(w, h - 8); g.closePath(); g.fill();
    g.fillStyle = css([170, 130, 60]); g.beginPath(); g.moveTo(4, h - 10); g.lineTo(4, 4); g.quadraticCurveTo(8, -1, w * 0.42, 0); g.quadraticCurveTo(w * 0.62, 3, w - 9, h * 0.45); g.lineTo(w - 6, h - 10); g.closePath(); g.fill();
    for (let x = 7; x < w - 8; x += 2) A(x, 2, 1, h - 14, 'rgba(240,230,200,0.5)');
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(2, 2); g.quadraticCurveTo(6, -4, w * 0.4, -3); g.stroke();
    A(w * 0.2, -12, 2, 14, css(blk, 1.6));
    R(0, h - 10, w, 9, blk, 1.1);
    for (let x = 2; x < w - 2; x += 2) A(x, h - 8, 1, 6, '#f4f0e8');
    for (let x = 3; x < w - 3; x += 2) if (((x - 3) / 2) % 7 !== 2 && ((x - 3) / 2) % 7 !== 6) A(x, h - 8, 1, 3, '#111');
    A(w / 2 - 6, h - 14, 12, 4, '#efe8d4');
  };
  PT.harp = (f) => {
    shadow(3, 8, 10, 6);
    R(4, 10, 8, 4, GOLD, 0.8);
    g.strokeStyle = css(GOLD, 1.1); g.lineWidth = 2; g.beginPath(); g.moveTo(5, 12); g.lineTo(4, -18); g.quadraticCurveTo(10, -22, 13, -10); g.lineTo(6, 12); g.stroke(); g.lineWidth = 1;
    for (let x = 6; x < 12; x++) A(x, -16 + (x - 6) * 1.5, 1, 26 - (x - 6) * 2, 'rgba(240,230,200,0.7)');
  };
  PT.stand = (f) => { R(7, -2, 1, 14, IRON, 1.4); R(5, 12, 6, 1, IRON, 1.4); R(3, -8, 10, 7, IRON, 1.2); A(4, -7, 8, 5, '#e8e0cc'); for (let i = 0; i < 3; i++) A(5, -6 + i * 2, 6, 1, '#555'); };
  PT.cello = (f) => { shadow(3, 8, 10, 6); oval(8, 4, 5, 7, [140, 70, 30]); oval(8, 0, 3, 2, [140, 70, 30], 0.6); A(7, -14, 2, 12, '#2a1a10'); A(6, -15, 4, 2, '#2a1a10'); A(6, 2, 1, 3, '#111'); A(10, 2, 1, 3, '#111'); A(5, 0, 1, 8, 'rgba(255,255,255,0.3)'); };
  PT.lectern = (f, t) => {
    shadow(3, 6, 10, 8);
    R(5, 2, 6, 12, DWOOD, 1.1); R(3, 12, 10, 2, DWOOD);
    g.fillStyle = css(WOOD); g.beginPath(); g.moveTo(0, 2); g.lineTo(16, 2); g.lineTo(14, -5); g.lineTo(2, -5); g.fill();
    A(2, -6, 12, 6, '#e8dcc0'); A(8, -6, 1, 6, '#a09070');
    A(3, -5, 4, 1, '#6a5a40'); A(9, -4, 4, 1, '#6a5a40');
    A(4, -8, 8, 2, 'rgba(180,200,255,' + (0.3 + Math.sin(t * 2) * 0.1) + ')');
  };
  PT.weights = (f, t) => { A(5, -60, 1, 62, '#555'); A(11, -60, 1, 56, '#555'); box(3, 0, 5, 10, IRON, 1.5); box(9, -6, 5, 10, IRON, 1.5); };
  PT.gear = (f, t, S) => {
    const w = fw(f), r = w / 2 - 1, cx = w / 2, cy = fh(f) / 2 - 4;
    const rot = S && S.running ? t * (f.spin || 1) * 0.6 : 0.2 * (f.spin || 1);
    A(4, fh(f) - 6, w - 4, 6, 'rgba(0,0,0,0.35)');
    g.save(); g.translate(cx, cy); g.rotate(rot);
    const teeth = Math.round(r * 0.8);
    g.fillStyle = css(BRASS, 0.75);
    for (let i = 0; i < teeth; i++) { g.save(); g.rotate((i / teeth) * Math.PI * 2); g.fillRect(-2, -r - 1, 4, 5); g.restore(); }
    g.beginPath(); g.arc(0, 0, r - 2, 0, Math.PI * 2); g.fill();
    g.fillStyle = css(BRASS, 1.05); g.beginPath(); g.arc(0, 0, r - 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a2018';
    for (let i = 0; i < 5; i++) { g.save(); g.rotate((i / 5) * Math.PI * 2); g.beginPath(); g.arc(0, -(r * 0.55), r * 0.22, 0, Math.PI * 2); g.fill(); g.restore(); }
    g.fillStyle = css(BRASS, 1.35); g.beginPath(); g.arc(-1, -1, r * 0.22, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1a1410'; g.fillRect(-1, -1, 3, 3);
    g.restore();
    A(cx - r * 0.6, cy - r * 0.7, 3, 1, 'rgba(255,240,200,0.5)');
  };
  PT.axle = (f, t, S) => {
    shadow(3, 6, 10, 8);
    box(4, 2, 8, 12, IRON, 1.5); R(7, -6, 2, 8, IRON, 1.6);
    if (S && S.running) { g.save(); g.translate(8, -4); g.rotate(t * 1.2); g.fillStyle = css(BRASS); for (let i = 0; i < 8; i++) { g.save(); g.rotate((i / 8) * Math.PI * 2); g.fillRect(-1, -7, 2, 3); g.restore(); } g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#222'; g.fillRect(-1, -1, 2, 2); g.restore(); }
    else { A(5, -5, 6, 1, 'rgba(255,220,120,' + (0.4 + Math.sin(t * 4) * 0.3) + ')'); }
  };
  PT.oilcan = () => { shadow(4, 8, 8, 4); box(4, 4, 8, 9, [150, 40, 30]); R(11, 0, 4, 2, [150, 40, 30]); R(6, 2, 4, 2, IRON); };
  PT.pendulum = (f, t, S) => {
    const w = fw(f), h = fh(f), cx = w / 2;
    const a = S && S.running ? Math.sin(t * 1.6) * 0.35 : 0.0;
    const len = 52;
    A(cx - 10, h - 4, 20, 4, 'rgba(0,0,0,0.3)');
    g.save(); g.translate(cx, -36); g.rotate(a);
    g.fillStyle = css(BRASS, 0.7); g.fillRect(-1, 0, 3, len);
    g.fillStyle = css(BRASS); g.beginPath(); g.arc(0, len + 4, 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = css(BRASS, 1.35); g.beginPath(); g.arc(-2, len + 2, 3, 0, Math.PI * 2); g.fill();
    g.restore();
  };
  PT.workbench = (f) => {
    const w = fw(f);
    shadow(0, 0, w, 14);
    R(1, 6, 2, 8, DWOOD); R(w - 3, 6, 2, 8, DWOOD);
    box(0, -4, w, 11, [130, 96, 60]);
    A(4, -2, 6, 2, '#9aa0aa'); A(4, -2, 2, 4, '#5a3a20'); A(14, -1, 4, 4, '#888'); oval(28, 1, 3, 3, BRASS); oval(36, -1, 2, 2, BRASS, 0.8);
    box(w - 10, -8, 7, 6, IRON, 1.5);
    if (f._card !== false) A(20, -2, 6, 4, '#e0d8b8');
  };
  PT.bell = (f, t) => {
    const w = fw(f), h = fh(f);
    shadow(0, h - 8, w, 8);
    R(-2, -34, 3, 46, DWOOD, 1.1); R(w - 1, -34, 3, 46, DWOOD, 1.1); R(-4, -36, w + 8, 4, DWOOD, 1.3);
    const sw = Math.sin(t * 0.8) * 0.5;
    g.save(); g.translate(w / 2, -32); g.rotate(sw * 0.03);
    g.fillStyle = css([150, 110, 50]); g.beginPath(); g.moveTo(-6, 0); g.quadraticCurveTo(-10, 18, -15, 28); g.lineTo(15, 28); g.quadraticCurveTo(10, 18, 6, 0); g.closePath(); g.fill();
    g.fillStyle = css([150, 110, 50], 1.4); g.fillRect(-7, 4, 2, 20);
    g.fillStyle = css([150, 110, 50], 0.6); g.fillRect(-15, 26, 30, 3);
    g.fillStyle = '#2a1e10'; g.beginPath(); g.arc(0, 30, 3, 0, Math.PI * 2); g.fill();
    g.restore();
  };
  PT.telescope = (f) => { shadow(2, 8, 12, 6); g.strokeStyle = css(DWOOD, 1.3); g.beginPath(); g.moveTo(8, 2); g.lineTo(3, 14); g.moveTo(8, 2); g.lineTo(13, 14); g.moveTo(8, 2); g.lineTo(8, 14); g.stroke(); g.save(); g.translate(8, 0); g.rotate(-0.6); A(-8, -2, 18, 4, css(BRASS)); A(-8, -2, 18, 1, css(BRASS, 1.4)); A(8, -3, 3, 6, css(BRASS, 0.8)); g.restore(); };
  PT.winerack = (f) => {
    const w = fw(f);
    shadow(0, -2, w, 16);
    R(0, -14, w, 28, DWOOD, 0.8);
    for (let y = -12; y < 12; y += 6) for (let x = 2; x < w - 2; x += 5) { oval(x + 2, y + 3, 2, 2, [30, 40, 30]); A(x + 2, y + 3, 1, 1, hash(x, y, 2) > 0.5 ? '#8a2030' : '#c0b070'); }
    R(0, -16, w, 3, WOOD, 1.1);
  };
  PT.labtable = (f, t) => {
    const w = fw(f);
    shadow(0, 0, w, 14);
    R(1, 6, 2, 8, IRON); R(w - 3, 6, 2, 8, IRON);
    box(0, -4, w, 11, [170, 176, 184], 1.2, 0.6);
    for (let i = 0; i < f.w * 2; i++) {
      const x = 4 + i * 7, c = [[80, 220, 160], [80, 160, 240], [220, 90, 160], [240, 200, 80]][(i + f.x) % 4];
      oval(x + 2, -3, 3, 3, c, 0.9); R(x + 1, -10, 2, 6, [220, 230, 240]); A(x + 1, -4, 1, 1, 'rgba(255,255,255,0.8)');
      if ((i + f.y) % 3 === 0) A(x + 2, -8 - ((t * 6 + i) % 4), 1, 1, 'rgba(255,255,255,0.6)');
    }
    A(w - 8, -8, 5, 4, '#555'); A(w - 7, -10, 2, 2, '#4af');
  };
  PT.tank = (f, t) => {
    shadow(1, 6, 14, 8);
    box(0, 8, 16, 6, IRON, 1.5);
    A(2, -22, 12, 30, 'rgba(60,200,140,0.55)');
    A(2, -22, 12, 2, 'rgba(160,255,210,0.5)');
    for (let i = 0; i < 4; i++) { const by = 6 - ((t * 10 + i * 9) % 26); A(4 + ((i * 3) % 8), by, 1, 1, 'rgba(220,255,240,0.9)'); }
    g.save(); g.translate(8, -8 + Math.sin(t) * 1.5); g.rotate(t * 0.5); A(-2, -3, 4, 6, 'rgba(200,255,240,0.95)'); g.restore();
    A(3, -22, 1, 30, 'rgba(255,255,255,0.4)');
    box(0, -26, 16, 5, IRON, 1.5); R(6, -34, 4, 9, IRON);
  };
  PT.optable = (f) => {
    const w = fw(f);
    shadow(0, 0, w, 14);
    R(w / 2 - 2, 4, 4, 10, IRON);
    box(0, -2, w, 9, [190, 196, 204]); R(2, -1, w - 4, 6, [220, 220, 220]);
    R(12, -2, 3, 9, [80, 50, 30]); R(w - 14, -2, 3, 9, [80, 50, 30]);
    oval(6, 2, 3, 2, [240, 240, 240]);
  };
  PT.console = (f, t) => {
    const w = fw(f);
    shadow(0, 0, w, 14);
    box(0, -2, w, 16, [60, 66, 76], 1.4, 0.55);
    g.fillStyle = css([80, 88, 100]); g.beginPath(); g.moveTo(0, -2); g.lineTo(w, -2); g.lineTo(w - 2, -9); g.lineTo(2, -9); g.fill();
    for (let i = 0; i < f.w * 3; i++) { const on = Math.sin(t * 3 + i * 1.7) > 0; A(4 + i * 5, -6, 2, 2, on ? ['#ff4040', '#40ff80', '#ffd040'][i % 3] : '#333'); }
    for (let i = 0; i < f.w; i++) { A(4 + i * 16, 2, 10, 7, '#0a2a30'); A(5 + i * 16, 3 + ((t * 8 + i) % 5 | 0), 8, 1, '#60e0f0'); }
  };
  PT.machine = (f, t) => {
    const w = fw(f), h = fh(f);
    shadow(0, 0, w, h);
    box(0, -10, w, h + 8, [70, 80, 74], 1.4, 0.5);
    for (let i = 0; i < 3; i++) { oval(8 + i * 12, -2, 4, 4, [220, 220, 200]); g.strokeStyle = '#a02020'; g.beginPath(); g.moveTo(8 + i * 12, -2); g.lineTo(8 + i * 12 + Math.cos(t * (i + 1)) * 3, -2 + Math.sin(t * (i + 1)) * 3); g.stroke(); }
    for (let i = 0; i < 5; i++) A(6 + i * 7, h - 6, 3, 2, Math.sin(t * 4 + i) > 0 ? '#60ff90' : '#204030');
    for (let y = 6; y < h - 8; y += 3) A(4, y, w - 8, 1, 'rgba(0,0,0,0.3)');
  };
  PT.lever = (f) => {
    shadow(2, 6, 12, 8);
    box(2, 0, 12, 14, [80, 86, 96], 1.4, 0.55); A(4, 2, 8, 2, '#d0c040'); A(4, 2, 2, 2, '#202020'); A(8, 2, 2, 2, '#202020');
    const on = f._on;
    g.save(); g.translate(8, 8); g.rotate(on ? 0.7 : -0.7); A(-1, -14, 2, 14, css(IRON, 1.6)); oval(0, -15, 3, 3, on ? [60, 200, 90] : [200, 40, 40]); g.restore();
  };
  PT.rubble = (f) => { [[4, 8, 4], [10, 10, 5], [7, 4, 3], [13, 6, 3]].forEach(([x, y, r], i) => { oval(x, y, r, r - 1, [90, 88, 96], 0.7 + i * 0.1); A(x - 1, y - r + 1, 2, 1, '#aaa'); }); };
  PT.crystal = (f, t) => {
    const s = f.big ? 1.6 : 1;
    shadow(2, 8, 12, 6);
    const p = 0.85 + Math.sin(t * 1.5 + f.x) * 0.15;
    [[8, 0, 4, 18], [4, 4, 3, 11], [12, 5, 3, 9]].forEach(([x, y, w, h], i) => {
      const H = h * s, W = w * s;
      g.fillStyle = 'rgba(' + (140 + i * 20) + ',' + (120 + i * 20) + ',255,' + (0.85 * p) + ')';
      g.beginPath(); g.moveTo(x, y + 10 - H); g.lineTo(x + W / 2, y + 10 - H + 4); g.lineTo(x + W / 2, y + 10); g.lineTo(x - W / 2, y + 10); g.lineTo(x - W / 2, y + 10 - H + 4); g.fill();
      A(x - 1, y + 10 - H + 3, 1, H - 5, 'rgba(255,255,255,0.6)');
    });
  };
  PT.brazier = (f, t) => {
    shadow(3, 8, 10, 6);
    R(4, 4, 1, 10, IRON, 1.3); R(11, 4, 1, 10, IRON, 1.3); R(7, 4, 2, 10, IRON);
    oval(8, 2, 6, 3, IRON, 1.2); oval(8, 1, 5, 2, [40, 20, 10]);
    for (let i = 0; i < 4; i++) flame(5 + i * 2, 1, t, 1.3, i * 2 + f.x);
  };
  PT.pedestal = (f, t) => {
    shadow(2, 6, 12, 10);
    box(3, -4, 10, 18, [90, 80, 110], 1.3, 0.55); box(1, -7, 14, 4, [110, 100, 130]); box(2, 11, 12, 3, [80, 70, 100]);
    const on = f._on, ic = f.v;
    if (on) {
      const p = 0.7 + Math.sin(t * 2) * 0.3;
      g.globalAlpha = 0.35 * p; oval(8, -10, 8, 6, ic === 'sun' ? [255, 200, 80] : ic === 'moon' ? [150, 190, 255] : [220, 230, 255]); g.globalAlpha = 1;
      drawIcon(g, ic, 2, -16, 0.75);
    } else { oval(8, -6, 3, 1, [40, 30, 50]); }
  };
  PT.core = (f, t) => {
    const w = fw(f), h = fh(f), cx = w / 2, cy = -6;
    A(-6, h - 6, w + 12, 8, 'rgba(0,0,0,0.4)');
    if (f._broken) {
      for (let i = 0; i < 9; i++) { const a = i * 0.7, r = 6 + (i % 3) * 5; g.fillStyle = 'rgba(180,150,255,0.7)'; g.fillRect(cx + Math.cos(a) * r, h - 6 + Math.sin(a) * 4, 3, 2); }
      for (let i = 0; i < 12; i++) { const y = ((t * 10 + i * 13) % 60); A(cx - 14 + ((i * 7) % 28), cy + 20 - y, 1, 1, 'rgba(255,240,255,' + (1 - y / 60) + ')'); }
      return;
    }
    const p = Math.sin(t * 2.4) * 0.5 + 0.5;
    g.strokeStyle = 'rgba(200,170,255,0.6)'; g.lineWidth = 1;
    for (let i = 0; i < 2; i++) { g.save(); g.translate(cx, cy); g.rotate(t * (i ? -0.5 : 0.7)); g.scale(1, 0.4); g.beginPath(); g.arc(0, 0, 20 + i * 5, 0, Math.PI * 2); g.stroke(); g.restore(); }
    g.fillStyle = 'rgba(' + (170 + p * 60) + ',130,255,0.92)';
    g.beginPath(); g.moveTo(cx, cy - 24); g.lineTo(cx + 12, cy); g.lineTo(cx, cy + 22); g.lineTo(cx - 12, cy); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,230,255,0.5)'; g.beginPath(); g.moveTo(cx, cy - 24); g.lineTo(cx - 12, cy); g.lineTo(cx - 3, cy); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,20,60,0.8)'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(-t * 3) * 7, cy + Math.sin(-t * 3) * 7); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(-t * 0.4) * 5, cy + Math.sin(-t * 0.4) * 5); g.stroke();
    R(cx - 10, h - 8, 20, 6, [60, 50, 80]); R(cx - 12, h - 4, 24, 3, [80, 66, 100]);
  };
  PT.musicbox = (f) => { shadow(3, 8, 10, 6); R(4, 8, 8, 6, WOOD); box(3, 2, 10, 7, [150, 70, 90]); R(3, -2, 10, 4, [170, 90, 110]); A(6, 4, 4, 2, css(GOLD)); };
  PT.plush = (f) => { shadow(3, 8, 10, 6); oval(8, 8, 4, 4, [210, 200, 190]); oval(8, 2, 3, 3, [220, 210, 200]); R(6, -5, 1, 5, [220, 210, 200]); R(9, -5, 1, 5, [220, 210, 200]); A(7, 2, 1, 1, '#222'); A(9, 2, 1, 1, '#222'); };
  PT.display = (f) => {
    const w = fw(f);
    shadow(0, 2, w, 12);
    box(1, 4, w - 2, 10, [70, 46, 28], 1.3, 0.55);
    R(2, -8, w - 4, 12, [120, 150, 170]);
    A(3, -7, w - 6, 10, 'rgba(20,30,40,0.55)');
    oval(w / 2, -1, 4, 2, [180, 30, 40]);
    if (f.x % 2) { oval(w / 2, -3, 3, 3, GOLD, 1.1); A(w / 2, -5, 1, 2, '#222'); } else { A(w / 2 - 3, -4, 6, 3, '#d8d0c0'); A(w / 2 - 3, -2, 3, 1, '#a08060'); }
    A(3, -8, 1, 11, 'rgba(255,255,255,0.5)'); A(4, -8, w - 8, 1, 'rgba(255,255,255,0.35)');
    R(1, -9, w - 2, 1, GOLD, 0.9);
  };
  PT.rope = (f) => { const w = fw(f); for (let x = 0; x < w; x += 48) { R(x + 6, -2, 2, 12, BRASS); oval(x + 7, -3, 2, 2, BRASS, 1.3); } g.strokeStyle = css([150, 30, 40]); g.lineWidth = 2; g.beginPath(); for (let x = 0; x + 48 < w; x += 48) { g.moveTo(x + 7, 0); g.quadraticCurveTo(x + 31, 8, x + 55, 0); } g.stroke(); g.lineWidth = 1; };

  ELD.PAINT = PT;
  ELD.setCtx = (c) => (g = c);

  /* ---------- 家具キャッシュ ---------- */
  const PADT = 64, PADX = 12;
  function spriteFor(f, S) {
    const cv = document.createElement('canvas');
    cv.width = fw(f) + PADX * 2; cv.height = fh(f) + PADT + 16;
    const c = cv.getContext('2d');
    const old = g; g = c;
    c.translate(PADX, PADT);
    try { PT[f.t] && PT[f.t](f, 0, S); } catch (e) { console.error('paint', f.t, e); }
    g = old;
    return cv;
  }
  ELD.spriteFor = spriteFor;
  ELD.SPR_PAD = { x: PADX, y: PADT };
  ELD.buildBG = buildBG;

  /* ---------- 扉の開閉アニメーション（背景の上に重ねる扉板） ----------
     t = 0 で閉じた状態、1 で開ききった状態。蝶番側へ扉板が縮んで見える。 */
  function drawDoorLeaf(c, room, ex, t, ox, oy) {
    const old = g; g = c;
    c.save(); c.translate(ox, oy);
    const metal = ex.kind === 'metal', dc = metal ? [84, 92, 100] : [104, 62, 34];
    const k = 1 - t; // 扉板の見かけの幅
    if (ex.side === 'N') {
      const x = ex.at * T, w = (ex.w || 1) * T, dbl = w >= 32;
      if (dbl) {
        const hw = (w - 2) / 2, lw = Math.max(2, Math.round(hw * k));
        box(x + 1, 6, lw, 26, dc, 1.25, 0.6);
        box(x + w - 1 - lw, 6, lw, 26, dc, 1.25, 0.6);
        if (lw > 6) { A(x + lw - 2, 19, 2, 2, css(GOLD, 1.2)); A(x + w - lw, 19, 2, 2, css(GOLD, 1.2)); }
      } else {
        const lw = Math.max(3, Math.round((w - 2) * k));
        box(x + 1, 6, lw, 26, dc, 1.25, 0.6);
        if (lw > 8) {
          if (!metal) { box(x + 3, 9, lw - 4, 8, dc, 0.85, 1.2); box(x + 3, 19, lw - 4, 10, dc, 0.85, 1.2); }
          else for (let i = 0; i < 3; i++) A(x + 3, 10 + i * 7, lw - 4, 1, 'rgba(0,0,0,0.35)');
          A(x + lw - 3, 19, 2, 2, css(GOLD, 1.2));
        }
      }
      if (t > 0 && t < 1) A(x + 1, 30, w - 2, 2, 'rgba(255,220,170,' + (0.12 * t) + ')');
    } else if (ex.side === 'S') {
      const x = ex.at * T, w = (ex.w || 1) * T, y = (ex.y != null ? ex.y : room.H - 1) * T;
      const lw = Math.max(2, Math.round(w * k));
      box(x, y, lw, 6, dc);
    } else {
      const y = ex.at * T, h = (ex.w || 1) * T, x = ex.side === 'W' ? 10 : (room.W - 1) * T;
      const lh = Math.max(2, Math.round(h * k));
      R(x, y, 6, lh, dc); R(ex.side === 'W' ? x : x + 5, y, 1, lh, dc, 1.4);
      A(x, y + lh - 1, 6, 1, 'rgba(0,0,0,0.4)');
    }
    c.restore(); g = old;
  }
  ELD.drawDoorLeaf = drawDoorLeaf;

  /* =====================================================================
   * 主人公スプライト（16×24, 4方向×4フレーム）
   * ===================================================================== */
  /* 人物の見た目。hair: long|short|bob|bun|pony|messy|slick|gray, legs: pants|skirt|dress */
  ELD.LOOKS = {
    hero:    { coat: [44, 52, 86], hair: [34, 26, 40], hairS: 'long', acc: [150, 110, 190], accK: 'pendant', legs: 'pants', legC: [56, 54, 64], eye: [120, 80, 170] },
    ren:     { coat: [150, 128, 92], hair: [92, 62, 40], hairS: 'messy', acc: [40, 40, 44], accK: 'strap', legs: 'pants', legC: [70, 70, 80] },
    mizuki:  { coat: [70, 110, 84], hair: [150, 104, 64], hairS: 'bob', acc: [230, 220, 200], accK: 'collar', legs: 'skirt', legC: [90, 70, 60] },
    kurose:  { coat: [64, 64, 70], hair: [70, 70, 74], hairS: 'short', acc: [130, 40, 40], accK: 'tie', legs: 'pants', legC: [50, 50, 56], beard: 1 },
    fuyuko:  { coat: [86, 60, 96], hair: [176, 172, 176], hairS: 'bun', acc: [230, 226, 214], accK: 'collar', legs: 'dress', legC: [64, 50, 70] },
    minato:  { coat: [40, 96, 104], hair: [24, 24, 30], hairS: 'messy', acc: [30, 30, 36], accK: 'phones', legs: 'pants', legC: [50, 56, 76] },
    reina:   { coat: [196, 196, 200], hair: [28, 24, 30], hairS: 'pony', acc: [70, 120, 160], accK: 'collar', legs: 'pants', legC: [50, 50, 60] },
    soichiro:{ coat: [32, 32, 40], hair: [150, 150, 156], hairS: 'slick', acc: [120, 30, 40], accK: 'tie', legs: 'pants', legC: [30, 30, 38] },
    yu:      { coat: [96, 98, 64], hair: [100, 74, 52], hairS: 'short', acc: [230, 230, 220], accK: 'collar', legs: 'pants', legC: [70, 64, 56], glasses: [40, 40, 40] },
    kotone:  { coat: [36, 30, 40], hair: [170, 120, 80], hairS: 'long', acc: [220, 210, 230], accK: 'collar', legs: 'dress', legC: [36, 30, 40] },
    haibara: { coat: [56, 64, 78], hair: [150, 148, 150], hairS: 'short', acc: [236, 232, 224], accK: 'shirt', legs: 'pants', legC: [44, 48, 58], glasses: [90, 70, 40], tint: 1, burn: 1 },
  };
  function drawPerson(c, dir, frame, moving, L, oy) {
    const old = g; g = c;
    c.save(); if (oy) c.translate(0, oy);
    const coat = L.coat, coatD = mul(coat, 0.7), hair = L.hair, legC = L.legC, boot = [40, 30, 26];
    const step = moving ? [0, 1, 0, -1][frame & 3] : 0;
    const bob = moving && (frame & 1) ? 1 : 0;
    A(3, 22, 10, 2, 'rgba(0,0,0,0.35)');
    const lA = step > 0 ? -1 : 0, lB = step < 0 ? -1 : 0;
    if (L.legs === 'dress') { R(4, 16, 8, 6, legC); R(4, 16, 1, 6, legC, 1.25); R(5, 21, 2, 2, boot); R(9, 21, 2, 2, boot); }
    else if (dir === 'left' || dir === 'right') {
      R(6 + step, 17, 3, 5, legC); R(6 + step, 21, 4, 2, boot);
      R(7 - step, 17, 3, 5, legC, 0.8); R(7 - step, 21, 4, 2, boot, 0.8);
    } else {
      R(5, 17 + lA, 3, 5, L.legs === 'skirt' ? SKIN : legC); R(5, 21 + lA, 3, 2, boot);
      R(8, 17 + lB, 3, 5, L.legs === 'skirt' ? SKIN : legC); R(8, 21 + lB, 3, 2, boot);
      if (L.legs === 'skirt') R(4, 16, 8, 3, legC);
    }
    const y0 = bob;
    R(3, 9 + y0, 10, 9, coat); R(3, 9 + y0, 1, 9, coat, 1.3); R(12, 9 + y0, 1, 9, coatD);
    R(4, 17 + y0, 8, 1, coatD);
    if (dir === 'down') { R(7, 11 + y0, 2, 6, coatD); }
    // 首元の小物
    const ac = L.acc;
    if (dir === 'down') {
      if (L.accK === 'tie') { A(7, 9 + y0, 2, 1, css([236, 232, 224])); R(7, 10 + y0, 2, 5, ac); }
      else if (L.accK === 'shirt') { R(6, 9 + y0, 4, 7, ac); A(7, 10 + y0, 2, 1, '#202020'); }
      else if (L.accK === 'collar') { R(5, 9 + y0, 6, 1, ac); }
      else if (L.accK === 'strap') { for (let i = 0; i < 7; i++) A(4 + i, 10 + i + y0, 1, 1, css(ac)); R(9, 15 + y0, 3, 3, [30, 30, 34]); A(10, 16 + y0, 1, 1, '#9ab'); }
      else if (L.accK === 'pendant') { A(7, 9 + y0, 2, 1, css(SKIN)); A(7, 11 + y0, 2, 2, css(ac, 1.2)); A(7, 10 + y0, 1, 1, css(GOLD)); }
    }
    const sw = moving ? step : 0;
    const hand = L.glove ? [236, 236, 230] : SKIN;
    if (dir === 'down' || dir === 'up') {
      R(2, 10 + y0 + sw, 2, 7, coat, 0.9); R(12, 10 + y0 - sw, 2, 7, coat, 0.9);
      A(2, 17 + y0 + sw, 2, 1, css(SKIN)); A(12, 17 + y0 - sw, 2, 1, css(dir === 'down' ? hand : SKIN));
    } else {
      const ax = dir === 'left' ? 8 : 6;
      R(ax + sw, 10 + y0, 3, 7, coat, 0.85); A(ax + sw, 17 + y0, 3, 1, css(SKIN));
    }
    // 頭
    R(4, 1 + y0, 8, 8, SKIN);
    const hs = L.hairS;
    if (dir === 'down') {
      if (hs === 'bun') { oval(8, 0 + y0, 3, 2, hair); }
      R(4, 0 + y0, 8, hs === 'slick' ? 2 : 3, hair);
      if (hs === 'long') { R(3, 1 + y0, 1, 11, hair); R(12, 1 + y0, 1, 11, hair); R(3, 9 + y0, 2, 4, hair); R(11, 9 + y0, 2, 4, hair); }
      else if (hs === 'bob') { R(3, 1 + y0, 1, 7, hair); R(12, 1 + y0, 1, 7, hair); }
      else if (hs === 'pony') { R(3, 1 + y0, 1, 4, hair); R(12, 1 + y0, 1, 4, hair); }
      else if (hs === 'messy') { R(3, 1 + y0, 1, 4, hair); R(12, 1 + y0, 1, 4, hair); A(5, 3 + y0, 2, 1, css(hair)); A(9, 3 + y0, 1, 1, css(hair)); A(4, -1 + y0, 2, 1, css(hair)); A(10, -1 + y0, 2, 1, css(hair)); }
      else { R(3, 1 + y0, 1, 3, hair); R(12, 1 + y0, 1, 3, hair); }
      if (hs !== 'slick' && hs !== 'short') { R(5, 3 + y0, 2, 1, hair); R(9, 3 + y0, 3, 1, hair); }
      const eye = L.eye ? css(L.eye, 0.6) : '#2a1a20';
      A(6, 5 + y0, 1, 2, eye); A(9, 5 + y0, 1, 2, eye);
      if (L.glasses) { const gc = css(L.glasses); A(5, 5 + y0, 3, 1, gc); A(8, 5 + y0, 3, 1, gc); if (L.tint) { A(5, 5 + y0, 2, 2, 'rgba(120,80,40,0.75)'); A(9, 5 + y0, 2, 2, 'rgba(120,80,40,0.75)'); } }
      if (L.beard) A(5, 8 + y0, 6, 1, 'rgba(60,60,60,0.55)');
      if (L.burn) { A(10, 6 + y0, 2, 3, 'rgba(170,80,70,0.75)'); A(11, 9 + y0, 1, 1, 'rgba(170,80,70,0.6)'); }
      if (!L.beard && (hs === 'long' || hs === 'bob' || hs === 'bun' || hs === 'pony')) { A(5, 7 + y0, 1, 1, 'rgba(230,120,120,0.45)'); A(10, 7 + y0, 1, 1, 'rgba(230,120,120,0.45)'); }
      if (L.accK === 'phones') { R(2, 3 + y0, 2, 4, [40, 40, 46]); R(12, 3 + y0, 2, 4, [40, 40, 46]); A(3, 0 + y0, 10, 1, '#28282e'); }
    } else if (dir === 'up') {
      R(3, 0 + y0, 10, 8, hair); R(4, 0 + y0, 8, 1, hair, 1.3);
      if (hs === 'long') R(3, 8 + y0, 10, 5, hair);
      if (hs === 'pony') R(7, 6 + y0, 2, 6, hair);
      if (hs === 'bun') oval(8, 1 + y0, 3, 2, hair, 1.1);
    } else {
      const Lf = dir === 'left';
      R(4, 0 + y0, 8, 3, hair); R(Lf ? 9 : 3, 1 + y0, 4, 6, hair);
      if (hs === 'long') R(Lf ? 9 : 3, 6 + y0, 4, 7, hair);
      if (hs === 'pony') R(Lf ? 12 : 1, 3 + y0, 2, 7, hair);
      A(Lf ? 5 : 10, 5 + y0, 1, 2, '#2a1a20');
      if (L.glasses) A(Lf ? 4 : 9, 5 + y0, 3, 1, css(L.glasses));
    }
    A(5, 1 + y0, 3, 1, 'rgba(255,255,255,0.18)');
    c.restore(); g = old;
  }
  ELD.drawPerson = drawPerson;
  function drawPlayer(c, dir, frame, moving) { drawPerson(c, dir, frame, moving, ELD.LOOKS.hero); }
  ELD.drawPlayer = drawPlayer;

  /* ---------- アイテムアイコン（16×16） ---------- */
  function drawIcon(c, icon, x, y, s, col) {
    const old = g; g = c; s = s || 1;
    c.save(); c.translate(x, y); c.scale(s, s);
    const C = col ? ELD.util.css(hexToArr(col)) : null;
    const Cc = col ? hexToArr(col) : GOLD;
    switch (icon) {
      case 'key': oval(4, 5, 3, 3, Cc); A(3, 4, 2, 2, '#000'); R(6, 4, 9, 2, Cc); R(11, 6, 2, 3, Cc); R(14, 6, 1, 2, Cc); A(4, 3, 1, 1, 'rgba(255,255,255,0.7)'); break;
      case 'gear': c.fillStyle = css(BRASS); for (let i = 0; i < 8; i++) { c.save(); c.translate(8, 8); c.rotate((i / 8) * Math.PI * 2); c.fillRect(-1.5, -8, 3, 4); c.restore(); } oval(8, 8, 5, 5, BRASS, 1.1); oval(8, 8, 2, 2, [40, 30, 20]); break;
      case 'card': box(1, 3, 14, 10, [70, 140, 200]); A(2, 5, 12, 2, '#1a1a1a'); A(3, 9, 5, 1, '#fff'); A(11, 8, 3, 3, css(GOLD)); break;
      case 'score': box(2, 1, 12, 14, [236, 228, 204]); for (let i = 0; i < 4; i++) A(3, 4 + i * 3, 10, 1, '#555'); A(6, 3, 2, 2, '#222'); A(10, 9, 2, 2, '#222'); break;
      case 'star': c.fillStyle = css([210, 220, 255]); c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 3 : 7, a = (i / 10) * Math.PI * 2 - Math.PI / 2; c.lineTo(8 + Math.cos(a) * r, 8 + Math.sin(a) * r); } c.fill(); A(7, 4, 1, 3, '#fff'); break;
      case 'moon': oval(8, 8, 6, 6, [170, 200, 255]); oval(11, 6, 5, 5, [20, 24, 44]); A(4, 6, 1, 4, '#fff'); break;
      case 'sun': c.fillStyle = css([255, 200, 80]); for (let i = 0; i < 8; i++) { c.save(); c.translate(8, 8); c.rotate((i / 8) * Math.PI * 2); c.fillRect(-1, -8, 2, 3); c.restore(); } oval(8, 8, 4, 4, [255, 210, 90]); A(6, 6, 2, 1, '#fff'); break;
    }
    c.restore(); g = old;
  }
  function hexToArr(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  ELD.drawIcon = drawIcon;
})();
