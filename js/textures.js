/*
 * Gougou House — procedural, seamlessly tiling textures (floors, fabric, wood grain, stone).
 * Each texture is painted pixel by pixel on a canvas once, turned into a data URL, and exposed as an
 * SVG <pattern> in a shared, hidden <defs> block. Patterns use feet as their unit.
 */
(function (GG) {
  const PX_PER_FT = 128;

  /* ---------- seeded random + periodic value noise ---------- */
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Smooth noise that repeats every px × py lattice cells (so textures tile without seams). */
  function noise2(seed, px, py = px) {
    const r = rng(seed);
    const g = new Float32Array(px * py);
    for (let i = 0; i < g.length; i++) g[i] = r();
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py;
      const x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
      const s = xf * xf * (3 - 2 * xf), t = yf * yf * (3 - 2 * yf);
      const a = g[y0 * px + x0], b = g[y0 * px + x1], c = g[y1 * px + x0], d = g[y1 * px + x1];
      return a + (b - a) * s + (c - a) * t + (a - b - c + d) * s * t;
    };
  }

  /** Fractal noise over an N×N canvas; cx/cy = lattice cells across the canvas at the base octave. */
  function fbm(seed, N, cx, cy, octaves = 4) {
    const layers = [];
    for (let o = 0; o < octaves; o++) layers.push({ f: noise2(seed + o * 101, cx << o, cy << o), sx: (cx << o) / N, sy: (cy << o) / N, amp: 0.5 ** o });
    const norm = layers.reduce((a, l) => a + l.amp, 0);
    return (x, y) => {
      let v = 0;
      for (const l of layers) v += l.f(x * l.sx, y * l.sy) * l.amp;
      return v / norm;
    };
  }

  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

  function paint(N, fn, alpha = false, NY = N) {
    const c = document.createElement('canvas');
    c.width = N;
    c.height = NY;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(N, NY);
    const d = img.data;
    for (let y = 0; y < NY; y++) {
      for (let x = 0; x < N; x++) {
        const [r, g, b, a = 255] = fn(x, y);
        const i = (y * N + x) * 4;
        d[i] = clamp255(r);
        d[i + 1] = clamp255(g);
        d[i + 2] = clamp255(b);
        d[i + 3] = alpha ? clamp255(a) : 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL(alpha ? 'image/png' : 'image/jpeg', 0.88);
  }

  /* ---------- floors ---------- */
  /** Wood boards: 8 ft × 4 ft tile, boards 6" wide and 4 ft long with staggered ends and wavy grain. */
  function planks({ seed, colors, plankFt = 0.5, gap = 1.4, gapColor = [52, 36, 24], grain = 1, weather = 0 }) {
    const W = 8 * PX_PER_FT, H = 4 * PX_PER_FT;
    const pw = plankFt * PX_PER_FT;
    const rows = Math.round(H / pw);
    const L = W / 2; // 4 ft boards
    const r = rng(seed);
    const boards = Array.from({ length: rows }, () => {
      const joint = Math.floor(r() * L);
      const tone = () => {
        const c = colors[Math.floor(r() * colors.length)];
        const k = 0.94 + r() * 0.1; // one brightness factor per board keeps the hue natural
        return { c: c.map((v) => v * k), off: r() * 900 };
      };
      return { joint, a: tone(), b: tone() };
    });
    const warp = fbm(seed + 1, W, 6, 3, 3);
    const fine = fbm(seed + 2, W, 4, 160, 2);
    const blotch = fbm(seed + 3, W, 10, 5, 3);
    return paint(W, (x, y) => {
      const row = Math.min(rows - 1, Math.floor(y / pw));
      const bd = boards[row];
      const dx = (x - bd.joint + W) % W;
      const t = dx < L ? bd.a : bd.b;
      const inRow = y - row * pw;
      // grain: wavy lines running along the board
      const yy = y + warp((x + t.off) % W, y) * 46;
      const lines = Math.sin(yy * 0.55) * 0.5 + Math.sin(yy * 1.7 + 1.3) * 0.25;
      const v = 1 + (lines * 0.04 + (fine((x + t.off) % W, y) - 0.5) * 0.16 + (blotch(x, y) - 0.5) * 0.12) * grain;
      let [rr, gg, bb] = t.c.map((c) => c * v);
      if (weather) {
        const w = (blotch(x, y) - 0.5) * weather * 90;
        rr += w; gg += w; bb += w;
      }
      const jx = dx % L;
      if (inRow < gap || jx < gap) return gapColor;
      const bevel = inRow < gap + 1.5 || jx < gap + 1.5 ? 1.05 : inRow > pw - 1.5 || jx > L - 1.5 ? 0.93 : 1;
      return [rr * bevel, gg * bevel, bb * bevel];
    }, false, H);
  }

  function tiles({ seed, base, vary = 0.04, tileFt = 1, sizeFt = 4, grout = [205, 200, 192], groutPx = 3, checker = null, marbleVeins = 0 }) {
    const N = sizeFt * PX_PER_FT;
    const t = tileFt * PX_PER_FT;
    const r = rng(seed);
    const per = Math.round(sizeFt / tileFt);
    const tone = Array.from({ length: per * per }, () => 1 + (r() - 0.5) * vary * 2);
    const n = fbm(seed + 3, N, 16, 16, 3);
    const veins = marbleVeins ? fbm(seed + 9, N, 4, 4, 5) : null;
    return paint(N, (x, y) => {
      const tx = Math.floor(x / t), ty = Math.floor(y / t);
      const lx = x - tx * t, ly = y - ty * t;
      if (lx < groutPx / 2 || ly < groutPx / 2 || lx > t - groutPx / 2 || ly > t - groutPx / 2) return grout;
      let col = checker && (tx + ty) % 2 ? checker : base;
      const k = tone[(ty % per) * per + (tx % per)] * (0.97 + n(x, y) * 0.06);
      let [rr, gg, bb] = col.map((c) => c * k);
      if (veins) {
        const m = Math.abs(Math.sin(((x + y * 0.6) / N) * Math.PI * 4 + veins(x, y) * 9));
        const v = Math.pow(1 - m, 10) * marbleVeins;
        rr -= v * 70; gg -= v * 68; bb -= v * 62;
      }
      const edge = lx < groutPx + 2 || ly < groutPx + 2 ? 1.04 : lx > t - groutPx - 2 || ly > t - groutPx - 2 ? 0.95 : 1;
      return [rr * edge, gg * edge, bb * edge];
    });
  }

  function marble({ seed, base = [242, 240, 236], vein = [150, 147, 142], sizeFt = 4, slabFt = 2, grout = true, strength = 0.75 }) {
    const N = sizeFt * PX_PER_FT;
    const n = fbm(seed, N, 4, 4, 6);
    const fine = fbm(seed + 5, N, 24, 24, 2);
    const slab = slabFt * PX_PER_FT;
    return paint(N, (x, y) => {
      if (grout && (x % slab < 1.5 || y % slab < 1.5)) return [214, 210, 204];
      const m = Math.abs(Math.sin(((x * 3 + y * 2) / N) * Math.PI * 2 + n(x, y) * 10));
      const v = (Math.pow(1 - m, 16) + Math.pow(1 - m, 4) * 0.1) * strength;
      const k = 0.98 + fine(x, y) * 0.04;
      return base.map((c, i) => (c - (c - vein[i]) * v) * k);
    });
  }

  function speckle({ seed, base, cells = 6, amp = 0.12, fineAmp = 0.06, sizeFt = 4, specks = 0 }) {
    const N = sizeFt * PX_PER_FT;
    const n = fbm(seed, N, cells, cells, 5);
    const f = fbm(seed + 7, N, 96, 96, 2);
    const r = rng(seed + 11);
    const dots = new Set();
    for (let i = 0; i < specks; i++) dots.add(Math.floor(r() * N) * N + Math.floor(r() * N));
    return paint(N, (x, y) => {
      const k = 1 + (n(x, y) - 0.5) * amp * 2 + (f(x, y) - 0.5) * fineAmp * 2;
      const dot = dots.has(y * N + x) ? 0.8 : 1;
      return base.map((c) => c * k * dot);
    });
  }

  function grass(seed) {
    const N = 512;
    const n = fbm(seed, N, 5, 5, 4);
    const blades = fbm(seed + 4, N, 160, 40, 2);
    return paint(N, (x, y) => {
      const k = 0.85 + n(x, y) * 0.3;
      const b = (blades(x, y) - 0.5) * 0.5;
      return [(96 + b * 60) * k, (130 + b * 70) * k, (64 + b * 30) * k];
    });
  }

  /* ---------- overlays (grayscale with alpha, drawn on top of any color) ---------- */
  function fabric(seed) {
    const N = 256; // 2 ft
    const n = fbm(seed, N, 64, 64, 2);
    const slub = fbm(seed + 2, N, 16, 64, 2);
    return paint(N, (x, y) => {
      const weave = ((x >> 1) + (y >> 1)) % 2 ? 0.06 : 0;
      const a = weave * 255 + n(x, y) * 40 + slub(x, y) * 30;
      return [0, 0, 0, a];
    }, true);
  }

  function grain(seed) {
    const N = 256; // 2 ft
    const n = fbm(seed, N, 2, 48, 4);
    return paint(N, (x, y) => {
      const v = n(x, y);
      const ring = Math.abs(Math.sin(v * 28));
      return [40, 22, 8, (1 - ring) * 55 + v * 30];
    }, true);
  }

  function shag(seed) {
    const N = 256;
    const n = fbm(seed, N, 96, 96, 2);
    return paint(N, (x, y) => {
      const v = n(x, y);
      return v > 0.5 ? [255, 255, 255, (v - 0.5) * 140] : [0, 0, 0, (0.5 - v) * 220];
    }, true);
  }

  /* ---------- catalog ---------- */
  const OAK = [[205, 168, 122], [198, 160, 114], [212, 176, 130], [194, 155, 108]];
  const DEFS = {
    oak: { ftW: 8, label: 'Light oak', ft: 4, make: () => planks({ seed: 11, colors: OAK }) },
    walnut: { ftW: 8, label: 'Walnut', ft: 4, make: () => planks({ seed: 23, colors: [[112, 76, 50], [104, 70, 46], [120, 82, 54]], gapColor: [36, 24, 16] }) },
    ashgray: { ftW: 8, label: 'Gray oak', ft: 4, make: () => planks({ seed: 37, colors: [[178, 168, 154], [170, 160, 146], [186, 176, 162]], gapColor: [96, 88, 80], grain: 0.8 }) },
    tile: { label: 'White tile', ft: 4, make: () => tiles({ seed: 5, base: [240, 238, 233], vary: 0.015 }) },
    terracotta: { label: 'Terracotta', ft: 4, make: () => tiles({ seed: 8, base: [184, 98, 62], vary: 0.09, tileFt: 2 / 3, grout: [196, 180, 160], groutPx: 4 }) },
    checker: { label: 'Checkerboard', ft: 4, make: () => tiles({ seed: 9, base: [236, 232, 224], checker: [52, 52, 54], tileFt: 1, vary: 0.02, grout: [150, 146, 140], groutPx: 2 }) },
    marble: { label: 'Marble', ft: 4, make: () => marble({ seed: 3 }) },
    concrete: { label: 'Concrete', ft: 4, make: () => speckle({ seed: 13, base: [184, 180, 173], cells: 5, amp: 0.1, fineAmp: 0.05, specks: 900 }) },
    carpet: { label: 'Carpet', ft: 4, make: () => speckle({ seed: 17, base: [214, 204, 188], cells: 8, amp: 0.05, fineAmp: 0.12 }) },
    deck: { ftW: 8, label: 'Wood deck', ft: 4, make: () => planks({ seed: 29, colors: [[150, 124, 98], [144, 118, 92], [156, 130, 104]], gap: 5, gapColor: [48, 40, 34], weather: 0.3 }) },
    grass: { label: 'Grass', ft: 4, make: () => grass(31) },
    // overlays & materials used by furniture
    'o-fabric': { ft: 2, make: () => fabric(41) },
    'o-grain': { ft: 2, make: () => grain(43) },
    'o-shag': { ft: 2, make: () => shag(47) },
    stone: { ft: 4, make: () => marble({ seed: 53, sizeFt: 4, grout: false, strength: 0.45, vein: [170, 167, 162] }) },
    'stone-dark': { ft: 4, make: () => marble({ seed: 59, base: [62, 62, 64], vein: [150, 150, 152], sizeFt: 4, grout: false }) },
    'small-tile': { ft: 2, make: () => tiles({ seed: 61, base: [222, 232, 234], tileFt: 0.25, sizeFt: 2, groutPx: 2, grout: [190, 198, 200], vary: 0.03 }) },
  };
  const FLOORS = ['oak', 'walnut', 'ashgray', 'tile', 'terracotta', 'checker', 'marble', 'concrete', 'carpet', 'deck', 'grass'];

  const cache = {};
  let host = null;

  function defsHost() {
    if (host && host.isConnected) return host;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.innerHTML = `<defs id="gg-defs">${STATIC_DEFS}</defs>`;
    document.body.prepend(svg);
    host = svg.querySelector('defs');
    return host;
  }

  const patternMarkup = (name) => {
    const h = DEFS[name].ft, w = DEFS[name].ftW || h;
    return `<pattern id="tx-${name}" patternUnits="userSpaceOnUse" width="${w}" height="${h}"><image href="${cache[name]}" width="${w}" height="${h}" preserveAspectRatio="none"/></pattern>`;
  };

  /** Make sure a texture exists; returns its fill reference. */
  function use(name) {
    if (!DEFS[name]) name = 'oak';
    if (!cache[name]) {
      cache[name] = DEFS[name].make();
      defsHost().insertAdjacentHTML('beforeend', patternMarkup(name));
    }
    return `url(#tx-${name})`;
  }

  /* gradients & filters shared by furniture (objectBoundingBox so they fit any shape) */
  const STATIC_DEFS = `
    <filter id="f-shadow" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0.07" dy="0.12" stdDeviation="0.1" flood-color="#1c140c" flood-opacity="0.38"/>
    </filter>
    <filter id="f-shadow-low" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0.02" dy="0.04" stdDeviation="0.04" flood-color="#1c140c" flood-opacity="0.25"/>
    </filter>
    <filter id="f-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.12"/></filter>
    <radialGradient id="g-cushion" cx="50%" cy="40%" r="70%">
      <stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/>
    </radialGradient>
    <linearGradient id="g-sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".14"/>
    </linearGradient>
    <linearGradient id="g-sheen-h" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity=".12"/><stop offset=".5" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".12"/>
    </linearGradient>
    <radialGradient id="g-ceramic" cx="45%" cy="40%" r="65%">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#eeeeec"/><stop offset="1" stop-color="#cfcfcc"/>
    </radialGradient>
    <radialGradient id="g-basin" cx="50%" cy="45%" r="60%">
      <stop offset="0" stop-color="#e9eef0"/><stop offset=".8" stop-color="#d4dadd"/><stop offset="1" stop-color="#b9c0c4"/>
    </radialGradient>
    <linearGradient id="g-steel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e4e6e8"/><stop offset=".45" stop-color="#bfc3c7"/><stop offset=".55" stop-color="#d3d6d9"/><stop offset="1" stop-color="#a9aeb3"/>
    </linearGradient>
    <linearGradient id="g-glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#d7ecf5"/><stop offset=".5" stop-color="#b6d6e6"/><stop offset="1" stop-color="#e4f2f8"/>
    </linearGradient>
    <radialGradient id="g-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#fff2cf" stop-opacity=".75"/><stop offset=".45" stop-color="#ffe8b0" stop-opacity=".25"/><stop offset="1" stop-color="#ffe8b0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g-leaf" cx="30%" cy="30%" r="80%">
      <stop offset="0" stop-color="#8fb36b"/><stop offset=".6" stop-color="#4f7a3a"/><stop offset="1" stop-color="#2f4d24"/>
    </radialGradient>
    <radialGradient id="g-leaf2" cx="30%" cy="30%" r="80%">
      <stop offset="0" stop-color="#a3c27a"/><stop offset=".6" stop-color="#5f8a45"/><stop offset="1" stop-color="#36562a"/>
    </radialGradient>
    <radialGradient id="g-pot" cx="40%" cy="35%" r="70%">
      <stop offset="0" stop-color="#d98a5f"/><stop offset="1" stop-color="#8f4b2c"/>
    </radialGradient>
    <radialGradient id="g-dogfur" cx="45%" cy="45%" r="60%">
      <stop offset="0" stop-color="#e6a465"/><stop offset=".7" stop-color="#cf8445"/><stop offset="1" stop-color="#a95e2a"/>
    </radialGradient>
    <radialGradient id="g-ao" cx="50%" cy="50%" r="50%">
      <stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/>
    </radialGradient>`;

  GG.textures = {
    use,
    floors: FLOORS,
    label: (name) => (DEFS[name] || DEFS.oak).label,
    /** Self-contained <defs> (all generated textures + gradients) for exporting a picture. */
    exportDefs: () => `<defs>${STATIC_DEFS}${Object.keys(cache).map(patternMarkup).join('')}</defs>`,
    init() {
      defsHost();
      ['oak', 'tile', 'o-fabric', 'o-grain', 'stone'].forEach(use);
    },
  };
})(window.GG);
