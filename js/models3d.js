/*
 * Gougou House — 3D furniture, built from simple shapes with real-world sizes (feet).
 * build(o) returns a THREE.Group whose origin is the centre of the piece's footprint on the floor,
 * unrotated: local x = the piece's width, local z = its depth (−z is the back), y is up.
 */
(function (GG) {
  const THREE = window.THREE;
  if (!THREE) return;
  const shade = (c, a) => GG.render.shade(c, a);

  /* ------------------------------------------------------------------ */
  /* Textures & materials (cached)                                       */
  /* ------------------------------------------------------------------ */
  const texCache = {};
  let onTextureReady = () => {};

  /** Overlay textures (fabric weave, wood grain) composited onto white so they tint with any color. */
  function overlayTex(name) {
    if (texCache[name]) return texCache[name];
    const info = GG.textures.info(name);
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.repeat.set(1 / info.w, 1 / info.h);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 256, 256);
      tex.needsUpdate = true;
      onTextureReady();
    };
    img.src = info.url;
    return (texCache[name] = tex);
  }

  /** Full-color textures (floors, stone); UVs are in feet, so repeat = 1 / tile size. */
  function colorTex(name) {
    if (texCache[name]) return texCache[name];
    const info = GG.textures.info(name);
    const tex = new THREE.TextureLoader().load(info.url, () => onTextureReady());
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.repeat.set(1 / info.w, 1 / info.h);
    tex.anisotropy = 8;
    return (texCache[name] = tex);
  }

  const matCache = {};
  const cached = (key, make) => matCache[key] || (matCache[key] = make());
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const MAT = {
    fabric: (c) => cached('fab' + c, () => std({ color: c, map: overlayTex('o-fabric'), roughness: 0.95 })),
    leather: (c) => cached('lea' + c, () => std({ color: c, map: overlayTex('o-fabric'), roughness: 0.55 })),
    wood: (c) => cached('wood' + c, () => std({ color: c, map: overlayTex('o-grain'), roughness: 0.6 })),
    paint: (c) => cached('paint' + c, () => std({ color: c, roughness: 0.7 })),
    stone: () => cached('stone', () => std({ color: '#ffffff', map: colorTex('stone'), roughness: 0.25 })),
    stoneDark: () => cached('stoneD', () => std({ color: '#ffffff', map: colorTex('stone-dark'), roughness: 0.25 })),
    tile: () => cached('stile', () => std({ color: '#ffffff', map: colorTex('small-tile'), roughness: 0.35 })),
    steel: () => cached('steel', () => std({ color: '#c9cdd1', metalness: 0.85, roughness: 0.32 })),
    darkMetal: () => cached('dmetal', () => std({ color: '#2b2b2c', metalness: 0.6, roughness: 0.45 })),
    gold: () => cached('gold', () => std({ color: '#c9a23a', metalness: 0.85, roughness: 0.35 })),
    ceramic: () => cached('cer', () => std({ color: '#fbfbf9', roughness: 0.12 })),
    gloss: (c = '#141414') => cached('gl' + c, () => std({ color: c, roughness: 0.12, metalness: 0.1 })),
    glass: () => cached('glass', () => std({ color: '#cfe6f0', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.25, depthWrite: false })),
    mirror: () => cached('mirror', () => std({ color: '#cfdde3', roughness: 0.08, metalness: 0.25, emissive: '#9fb4bd', emissiveIntensity: 0.25 })),
    water: () => cached('water', () => std({ color: '#bcd6df', roughness: 0.05, transparent: true, opacity: 0.8 })),
    screen: () => cached('screen', () => std({ color: '#0c0d10', roughness: 0.15, emissive: '#0d1622', emissiveIntensity: 0.6 })),
    lampShade: () => cached('shade', () => std({ color: '#f6efe2', roughness: 0.9, emissive: '#ffd9a0', emissiveIntensity: 0.9, side: THREE.DoubleSide })),
    bulb: () => cached('bulb', () => std({ color: '#fff4d6', emissive: '#ffe2a8', emissiveIntensity: 2 })),
    leaf: (i) => cached('leaf' + i, () => std({ color: ['#4f7a3a', '#5f8a45', '#3e6a2e', '#6d9450'][i % 4], roughness: 0.65, side: THREE.DoubleSide })),
    soil: () => cached('soil', () => std({ color: '#3e2d20', roughness: 1 })),
    terracotta: () => cached('terra', () => std({ color: '#b5653f', roughness: 0.85 })),
    linen: () => cached('linen', () => std({ color: '#f7f4ee', map: overlayTex('o-fabric'), roughness: 0.95 })),
    canvasMat: (tex) => std({ map: tex, roughness: 1 }),
  };

  /* ------------------------------------------------------------------ */
  /* Geometry helpers (cached; UVs in feet so textures keep their scale) */
  /* ------------------------------------------------------------------ */
  const geoCache = {};
  const g = (key, make) => geoCache[key] || (geoCache[key] = make());
  const k = (...a) => a.map((v) => (typeof v === 'number' ? v.toFixed(3) : v)).join('|');

  function boxGeo(w, h, d) {
    return g(k('box', w, h, d), () => {
      const geo = new THREE.BoxGeometry(w, h, d);
      // faces: +x, −x, +y, −y, +z, −z (4 vertices each) → scale UVs to the face's real size
      const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      const uv = geo.attributes.uv;
      for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
        const i = f * 4 + v;
        uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
      }
      return geo;
    });
  }

  /** Box with rounded edges (cushions, mattresses, upholstered frames). */
  function rboxGeo(w, h, d, r) {
    r = Math.max(0.01, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01));
    return g(k('rbox', w, h, d, r), () => {
      const W = w - 2 * r, H = h - 2 * r;
      const s = new THREE.Shape();
      s.moveTo(-W / 2, -H / 2);
      s.lineTo(W / 2, -H / 2);
      s.lineTo(W / 2, H / 2);
      s.lineTo(-W / 2, H / 2);
      s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 4, curveSegments: 2 });
      geo.center();
      return geo;
    });
  }

  const cylGeo = (rt, rb, h, seg = 28, open = false) => g(k('cyl', rt, rb, h, seg, open), () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
  const sphGeo = (r, ws = 24, hs = 16) => g(k('sph', r, ws, hs), () => new THREE.SphereGeometry(r, ws, hs));
  const torGeo = (r, t, rs = 12, ts = 32, arc = Math.PI * 2) => g(k('tor', r, t, rs, ts, arc), () => new THREE.TorusGeometry(r, t, rs, ts, arc));

  function mesh(parent, geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  /** Shapes are positioned by their *bottom* y so pieces sit on the floor naturally. */
  const box = (p, w, h, d, mat, x, y, z) => mesh(p, boxGeo(w, h, d), mat, x, y + h / 2, z);
  const rbox = (p, w, h, d, r, mat, x, y, z) => mesh(p, rboxGeo(w, h, d, r), mat, x, y + h / 2, z);
  const cyl = (p, rt, rb, h, mat, x, y, z, seg) => mesh(p, cylGeo(rt, rb, h, seg), mat, x, y + h / 2, z);
  const sph = (p, r, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const m = mesh(p, sphGeo(r), mat, x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  };
  const legs = (p, w, d, h, inset, mat, r = 0.06) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(p, r, r * 0.8, h, mat, sx * (w / 2 - inset), 0, sz * (d / 2 - inset), 10);
  };

  const hash = (s) => {
    let h = 2166136261;
    for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return h >>> 0;
  };
  const rngFor = (id) => {
    let a = hash(id);
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), a | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const ACCENTS = ['#8f9e86', '#b5653f', '#2f3e55', '#c9a23a', '#d9b1a3', '#6f6b66'];
  const accentFor = (o, base) => {
    const a = ACCENTS[hash(o.id) % ACCENTS.length];
    return a.toLowerCase() === (base || '').toLowerCase() ? ACCENTS[(hash(o.id) + 1) % ACCENTS.length] : a;
  };

  /* ------------------------------------------------------------------ */
  /* Flat pieces (rugs, mats): reuse the detailed 2D drawing as a texture */
  /* ------------------------------------------------------------------ */
  const flatCache = {};
  function flatTexture(o, pad) {
    const key = k(o.kind, o.color, o.w, o.h);
    if (flatCache[key]) return flatCache[key];
    const W = o.w + 2 * pad, H = o.h + 2 * pad;
    const px = Math.min(96, 2048 / Math.max(W, H));
    const c = document.createElement('canvas');
    c.width = Math.round(W * px);
    c.height = Math.round(H * px);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-W / 2} ${-H / 2} ${W} ${H}" width="${c.width}" height="${c.height}">${GG.textures.exportDefs()}${GG.render.item({ ...o, id: `flat-${o.kind}`, rot: 0 })}</svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      tex.needsUpdate = true;
      onTextureReady();
    };
    img.src = url;
    return (flatCache[key] = tex);
  }

  function flat(o, G, lift = 0.02) {
    const pad = 0.3;
    const mat = MAT.canvasMat(flatTexture(o, pad));
    mat.transparent = true;
    mat.alphaTest = 0.05;
    const m = mesh(G, g(k('plane', o.w + 2 * pad, o.h + 2 * pad), () => new THREE.PlaneGeometry(o.w + 2 * pad, o.h + 2 * pad)), mat, 0, lift, 0);
    m.rotation.x = -Math.PI / 2;
    m.castShadow = false;
    return m;
  }

  /* ------------------------------------------------------------------ */
  /* Models                                                              */
  /* ------------------------------------------------------------------ */
  const legWood = () => MAT.wood('#5a3f2c');

  function sofa(o, G, w, d, c) {
    const fab = (o.kind === 'armchair' && c === '#8a5a3b' ? MAT.leather : MAT.fabric);
    const arm = Math.min(0.55, w * 0.14), back = Math.min(0.75, d * 0.3);
    legs(G, w, d, 0.3, 0.25, legWood(), 0.05);
    rbox(G, w, 0.75, d, 0.12, fab(shade(c, -0.12)), 0, 0.3, 0);
    const nSeat = o.kind === 'armchair' ? 1 : w > 6.2 ? 3 : 2;
    const sw = (w - 2 * arm) / nSeat;
    for (let i = 0; i < nSeat; i++) {
      const x = -w / 2 + arm + sw * (i + 0.5);
      rbox(G, sw - 0.04, 0.5, d - back - 0.04, 0.16, fab(shade(c, 0.04)), x, 1.02, back / 2);
      const b = rbox(G, sw - 0.06, 1.25, 0.5, 0.2, fab(c), x, 1.1, -d / 2 + back - 0.15);
      b.rotation.x = -0.12;
    }
    rbox(G, w, 1.55, back * 0.55, 0.12, fab(shade(c, -0.1)), 0, 0.95, -d / 2 + back * 0.28);
    for (const sx of [-1, 1]) rbox(G, arm, 1.0, d, 0.18, fab(shade(c, -0.06)), sx * (w / 2 - arm / 2), 0.95, 0);
    if (nSeat > 1) {
      const acc = accentFor(o, c);
      for (const [sx, col] of [[-1, acc], [1, shade(acc, 0.25)]]) {
        const p = rbox(G, 0.85, 0.85, 0.28, 0.12, MAT.fabric(col), sx * (w / 2 - arm - 0.55), 1.5, -d / 2 + back + 0.05);
        p.rotation.set(-0.3, sx * 0.25, sx * 0.15);
      }
    }
  }

  function sectional(o, G, w, d, c) {
    const dd = Math.min(3, w / 2, d / 2), back = 0.7, arm = 0.5;
    const base = MAT.fabric(shade(c, -0.12)), seat = MAT.fabric(shade(c, 0.04)), bk = MAT.fabric(c);
    rbox(G, w, 0.75, dd, 0.12, base, 0, 0.3, -d / 2 + dd / 2);
    rbox(G, dd, 0.75, d - dd, 0.12, base, -w / 2 + dd / 2, 0.3, dd / 2);
    const topLen = w - back - arm, nTop = Math.max(2, Math.round(topLen / 2.6)), tw = topLen / nTop;
    for (let i = 0; i < nTop; i++) {
      const x = -w / 2 + back + tw * (i + 0.5);
      rbox(G, tw - 0.05, 0.5, dd - back, 0.16, seat, x, 1.02, -d / 2 + back + (dd - back) / 2);
      rbox(G, tw - 0.06, 1.25, 0.5, 0.2, bk, x, 1.1, -d / 2 + back - 0.2).rotation.x = -0.12;
    }
    const legLen = d - dd - arm;
    rbox(G, dd - back, 0.5, legLen, 0.16, seat, -w / 2 + back + (dd - back) / 2, 1.02, -d / 2 + dd + legLen / 2);
    rbox(G, w - arm, 1.55, 0.4, 0.12, MAT.fabric(shade(c, -0.1)), -arm / 2, 0.95, -d / 2 + 0.2);
    rbox(G, 0.4, 1.55, d - arm, 0.12, MAT.fabric(shade(c, -0.1)), -w / 2 + 0.2, 0.95, -arm / 2);
    rbox(G, arm, 1.0, dd, 0.18, base, w / 2 - arm / 2, 0.95, -d / 2 + dd / 2);
    rbox(G, dd, 1.0, arm, 0.18, base, -w / 2 + dd / 2, 0.95, d / 2 - arm / 2);
    const acc = accentFor(o, c);
    rbox(G, 0.9, 0.9, 0.3, 0.12, MAT.fabric(acc), -w / 2 + back + 0.6, 1.5, -d / 2 + back + 0.2).rotation.set(-0.3, 0.7, 0.1);
  }

  function bed(o, G, w, d, c) {
    if (o.kind === 'crib') {
      const white = MAT.paint('#f2efe9');
      legs(G, w, d, 0.6, 0.08, white, 0.06);
      box(G, w, 0.15, d, white, 0, 0.6, 0);
      rbox(G, w - 0.2, 0.4, d - 0.2, 0.1, MAT.linen(), 0, 0.75, 0);
      for (let x = -w / 2 + 0.1; x <= w / 2 - 0.05; x += 0.3) for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) cyl(G, 0.03, 0.03, 2.2, white, x, 0.75, z, 8);
      for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) box(G, w, 0.12, 0.12, white, 0, 2.95, z);
      return;
    }
    const acc = accentFor(o, c);
    const frame = MAT.fabric(shade(c, -0.45));
    legs(G, w, d, 0.35, 0.3, legWood(), 0.07);
    rbox(G, w, 0.75, d, 0.1, frame, 0, 0.35, 0.05);
    rbox(G, w + 0.1, 3.6, 0.35, 0.12, frame, 0, 0, -d / 2 + 0.17);
    rbox(G, w - 0.15, 0.8, d - 0.45, 0.18, MAT.linen(), 0, 1.05, 0.15);
    const nP = w > 4.6 ? 2 : 1, pw = (w - 0.5 - (nP - 1) * 0.15) / nP;
    for (let i = 0; i < nP; i++) {
      const p = rbox(G, pw, 0.45, 1.0, 0.2, MAT.linen(), -w / 2 + 0.25 + pw / 2 + i * (pw + 0.15), 1.8, -d / 2 + 0.95);
      p.rotation.x = -0.25;
    }
    const duvetLen = d - 2.0;
    rbox(G, w - 0.05, 0.28, duvetLen, 0.12, MAT.fabric(c), 0, 1.72, d / 2 - duvetLen / 2 - 0.05);
    rbox(G, w - 0.05, 0.3, 0.55, 0.14, MAT.fabric(shade(c, 0.3)), 0, 1.74, d / 2 - duvetLen + 0.2);
    rbox(G, w + 0.12, 0.1, 1.0, 0.04, MAT.fabric(acc), 0, 1.98, d / 2 - 0.9);
  }

  function storage(o, G, w, d, c) {
    const wood = MAT.wood(c);
    const H = { nightstand: 2.0, dresser: 2.8, wardrobe: 6.5, closet: 7, tv: 1.7, bookshelf: 6 }[o.kind] || 2.5;
    if (o.kind === 'bookshelf') {
      box(G, w, H, 0.08, wood, 0, 0, -d / 2 + 0.04);
      for (const sx of [-1, 1]) box(G, 0.08, H, d, wood, sx * (w / 2 - 0.04), 0, 0);
      const r = rngFor(o.id);
      const cols = ['#2f3e55', '#8a5a3b', '#d8cfc0', '#4f6b58', '#b5653f', '#c9a23a'];
      for (let y = 0; y < H - 0.1; y += 1.2) {
        box(G, w, 0.08, d, wood, 0, y, 0);
        if (y > H - 1.3) continue;
        for (let x = -w / 2 + 0.12; x < w / 2 - 0.2; ) {
          const bw = 0.08 + r() * 0.08, bh = 0.7 + r() * 0.35;
          if (r() > 0.12) box(G, bw, bh, d * 0.8, MAT.paint(cols[Math.floor(r() * cols.length)]), x + bw / 2, y + 0.08, 0.02);
          x += bw + 0.01;
        }
      }
      box(G, w, 0.08, d, wood, 0, H - 0.08, 0);
      return;
    }
    if (o.kind !== 'tv') box(G, w, H - 0.25, d, wood, 0, 0.25, 0);
    else box(G, w, H - 0.35, d, wood, 0, 0.35, 0);
    legs(G, w, d, o.kind === 'tv' ? 0.35 : 0.25, 0.12, MAT.darkMetal(), 0.035);
    const front = d / 2 + 0.005;
    if (o.kind === 'dresser' || o.kind === 'nightstand') {
      const rows = o.kind === 'dresser' ? 3 : 2;
      for (let i = 1; i < rows; i++) box(G, w - 0.1, 0.02, 0.02, MAT.paint(shade(c, -0.45)), 0, 0.25 + ((H - 0.25) * i) / rows, front);
      for (let i = 0; i < rows; i++) for (const sx of o.kind === 'dresser' ? [-1, 1] : [0]) cyl(G, 0.035, 0.035, 0.05, MAT.gold(), sx * w * 0.25, 0.25 + ((H - 0.25) * (i + 0.5)) / rows, front + 0.02, 10).rotation.x = Math.PI / 2;
    }
    if (o.kind === 'wardrobe' || o.kind === 'closet') {
      box(G, 0.02, H - 0.35, 0.02, MAT.paint(shade(c, -0.45)), 0, 0.3, front);
      for (const sx of [-1, 1]) box(G, 0.04, 0.7, 0.05, MAT.gold(), sx * 0.12, H * 0.5, front + 0.02);
    }
    if (o.kind === 'nightstand') {
      cyl(G, 0.18, 0.22, 0.12, MAT.ceramic(), 0, H, 0);
      cyl(G, 0.03, 0.03, 0.75, MAT.gold(), 0, H + 0.12, 0, 8);
      const sh = cyl(G, 0.32, 0.42, 0.6, MAT.lampShade(), 0, H + 0.7, 0, 24);
      sh.castShadow = false;
    }
    if (o.kind === 'dresser') vase(G, w * 0.3, H, 0, 0.14);
    if (o.kind === 'tv') {
      const tw = Math.min(w * 0.85, 4.8), th = tw * 0.56;
      box(G, tw, th, 0.08, MAT.gloss('#111'), 0, H + 0.25, -d / 2 + 0.35);
      box(G, tw - 0.1, th - 0.1, 0.01, MAT.screen(), 0, H + 0.3, -d / 2 + 0.395);
      box(G, 0.6, 0.25, 0.4, MAT.gloss('#222'), 0, H, -d / 2 + 0.35);
      box(G, w * 0.35, 0.22, 0.3, MAT.paint('#2a2a2b'), 0, H, d / 2 - 0.3);
      plantPot(G, { id: o.id + 'p' }, -w / 2 + 0.4, H, 0, 0.18, 0.9);
    }
  }

  function vase(G, x, y, z, r) {
    cyl(G, r * 0.7, r, r * 3, MAT.ceramic(), x, y, z, 16);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      sph(G, r * 0.5, MAT.paint(i % 2 ? '#e9d8c0' : '#d9b1a3'), x + Math.cos(a) * r * 0.6, y + r * 3.6, z + Math.sin(a) * r * 0.6);
    }
    for (let i = 0; i < 4; i++) sph(G, r * 0.45, MAT.leaf(i), x + (i - 1.5) * r * 0.5, y + r * 3.3, z, 1.4, 0.4, 1);
  }

  function table(o, G, w, d, c) {
    const wood = MAT.wood(c);
    const H = o.kind === 'coffee' ? 1.35 : 2.5;
    if (o.kind === 'roundtable' || o.kind === 'patiotable') {
      cyl(G, w / 2, w / 2, 0.12, wood, 0, H - 0.12, 0, 40);
      cyl(G, 0.12, 0.14, H - 0.12, MAT.darkMetal(), 0, 0, 0, 16);
      cyl(G, w * 0.28, w * 0.3, 0.06, MAT.darkMetal(), 0, 0, 0, 28);
      if (o.kind === 'patiotable') {
        cyl(G, 0.05, 0.05, 5.5, MAT.paint('#e8e2d6'), 0, H, 0, 10);
        const canopy = mesh(G, g('canopy', () => new THREE.ConeGeometry(w * 0.85, 1.4, 8, 1, true)), MAT.fabric('#efe8dc'), 0, H + 5.2, 0);
        canopy.material.side = THREE.DoubleSide;
      } else vase(G, 0, H, 0, 0.12);
      return;
    }
    box(G, w, 0.14, d, wood, 0, H - 0.14, 0);
    const inset = Math.min(0.25, w * 0.08);
    legs(G, w, d, H - 0.14, inset, MAT.wood(shade(c, -0.15)), o.kind === 'coffee' ? 0.07 : 0.08);
    if (o.kind === 'coffee') {
      const books = [['#2f3e55', 0.08], ['#d8cfc0', 0.07], ['#8a5a3b', 0.06]];
      let y = H;
      books.forEach(([col, h], i) => {
        box(G, 0.9, h, 0.65, MAT.paint(col), -w * 0.22, y, 0).rotation.y = (i - 1) * 0.15;
        y += h;
      });
      box(G, w * 0.28, 0.05, d * 0.5, MAT.gloss('#2b2b2b'), w * 0.22, H, 0);
      cyl(G, 0.1, 0.1, 0.25, MAT.paint('#efe6d2'), w * 0.17, H + 0.05, 0, 14);
      plantPot(G, { id: o.id + 'p' }, w * 0.3, H + 0.05, 0, 0.1, 0.55);
    } else {
      const along = w >= d;
      box(G, along ? w - 0.6 : 0.7, 0.01, along ? 0.7 : d - 0.6, MAT.fabric('#e8e0d2'), 0, H, 0);
      vase(G, 0, H, 0, 0.12);
      const spots = along
        ? [[-w * 0.3, -d * 0.3], [w * 0.3, -d * 0.3], [-w * 0.3, d * 0.3], [w * 0.3, d * 0.3], [0, -d * 0.3], [0, d * 0.3]].slice(0, o.kind === 'table6' ? 6 : 4)
        : [[-w * 0.28, -d * 0.3], [w * 0.28, -d * 0.3], [-w * 0.28, d * 0.3], [w * 0.28, d * 0.3]];
      spots.forEach(([x, z]) => {
        cyl(G, 0.33, 0.33, 0.01, MAT.fabric('#d9d1c3'), x, H, z, 24);
        cyl(G, 0.24, 0.2, 0.04, MAT.ceramic(), x, H + 0.01, z, 24);
      });
    }
  }

  function chair(o, G, w, d, c) {
    const wood = MAT.wood(c);
    legs(G, w, d, 1.45, 0.08, wood, 0.05);
    box(G, w, 0.12, d, wood, 0, 1.45, 0.02);
    rbox(G, w - 0.12, 0.1, d - 0.2, 0.04, MAT.fabric('#d8cfc0'), 0, 1.57, 0.05);
    for (const sx of [-1, 1]) box(G, 0.08, 1.5, 0.08, wood, sx * (w / 2 - 0.08), 1.55, -d / 2 + 0.06);
    box(G, w, 0.45, 0.07, wood, 0, 2.55, -d / 2 + 0.06);
  }

  function counter(o, G, w, d, c) {
    const cab = MAT.paint('#e9e5dd');
    box(G, w, 0.3, d - 0.2, MAT.paint('#2f2c29'), 0, 0, -0.05);
    box(G, w, 2.55, d - 0.05, cab, 0, 0.3, -0.02);
    const doors = Math.max(1, Math.round(w / 1.5));
    for (let i = 1; i < doors; i++) box(G, 0.015, 2.4, 0.02, MAT.paint('#cfc8bc'), -w / 2 + (w * i) / doors, 0.38, d / 2 - 0.03);
    for (let i = 0; i < doors; i++) box(G, 0.4, 0.04, 0.05, MAT.steel(), -w / 2 + (w * (i + 0.5)) / doors, 2.6, d / 2);
    box(G, w + (o.kind === 'island' ? 0.3 : 0), 0.15, d + (o.kind === 'island' ? 0.6 : 0.05), MAT.stone(), 0, 2.85, o.kind === 'island' ? 0.25 : 0);
    if (o.kind === 'counter') {
      box(G, w, 1.5, 0.05, MAT.tile(), 0, 3.0, -d / 2 + 0.025);
      if (w > 5) {
        box(G, 1.8, 0.02, 1.3, MAT.steel(), w * 0.2, 2.99, 0.05);
        box(G, 1.6, 0.03, 1.1, MAT.darkMetal(), w * 0.2, 2.985, 0.05);
        cyl(G, 0.05, 0.05, 1.0, MAT.steel(), w * 0.2, 3.0, -d / 2 + 0.2, 10);
        box(G, 0.06, 0.06, 0.5, MAT.steel(), w * 0.2, 3.95, -d / 2 + 0.45);
        box(G, 1.0, 0.08, 0.6, MAT.wood('#c9a77c'), -w * 0.3, 3.0, 0.1);
        cyl(G, 0.25, 0.28, 0.6, MAT.paint('#e9e3d6'), -w * 0.1, 3.0, -0.3, 16);
      }
    } else if (o.kind === 'sink') {
      box(G, w * 0.65, 0.02, d * 0.6, MAT.darkMetal(), 0, 2.99, 0.05);
      cyl(G, 0.05, 0.05, 1.0, MAT.steel(), 0, 3.0, -d / 2 + 0.2, 10);
    } else vase(G, w * 0.3, 3.0, -0.1, 0.12);
  }

  function fridge(o, G, w, d) {
    rbox(G, w, 6, d, 0.05, MAT.steel(), 0, 0, 0);
    box(G, 0.02, 3.9, 0.02, MAT.darkMetal(), 0, 2.0, d / 2 + 0.005);
    box(G, w, 0.02, 0.02, MAT.darkMetal(), 0, 2.0, d / 2 + 0.005);
    for (const sx of [-1, 1]) box(G, 0.05, 1.6, 0.08, MAT.steel(), sx * 0.12, 3.3, d / 2 + 0.05);
  }

  function range(o, G, w, d) {
    box(G, w, 2.9, d, MAT.steel(), 0, 0, 0);
    box(G, w - 0.04, 0.04, d - 0.3, MAT.gloss('#151515'), 0, 2.9, 0.1);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b], i) => {
      const r = Math.min(w, d) * (i % 3 ? 0.13 : 0.17);
      const t = mesh(G, torGeo(r, 0.025, 8, 24), MAT.darkMetal(), (a * w) / 4.4, 2.97, (b * d) / 4.6 + 0.05);
      t.rotation.x = Math.PI / 2;
      cyl(G, r * 0.4, r * 0.4, 0.03, MAT.darkMetal(), (a * w) / 4.4, 2.94, (b * d) / 4.6 + 0.05, 16);
    });
    box(G, w, 0.4, 0.15, MAT.steel(), 0, 2.9, -d / 2 + 0.07);
    box(G, w * 0.8, 0.6, 0.02, MAT.gloss('#1a1a1a'), 0, 0.9, d / 2 + 0.005);
    for (let i = 0; i < 4; i++) cyl(G, 0.06, 0.06, 0.08, MAT.steel(), -w * 0.3 + (i * w * 0.6) / 3, 2.55, d / 2 + 0.04, 12).rotation.x = Math.PI / 2;
  }

  function toilet(o, G, w, d) {
    const cer = MAT.ceramic();
    rbox(G, w - 0.1, 1.3, d * 0.3, 0.08, cer, 0, 1.35, -d / 2 + d * 0.15);
    box(G, w - 0.05, 0.08, d * 0.33, cer, 0, 2.65, -d / 2 + d * 0.16);
    cyl(G, 0.25, 0.32, 1.25, cer, 0, 0, d * 0.08, 24).scale.set(1, 1, 1.25);
    const seat = mesh(G, torGeo(0.28, 0.07, 10, 28), cer, 0, 1.33, d * 0.12);
    seat.rotation.x = Math.PI / 2;
    seat.scale.set(1, 1.25, 1);
    cyl(G, 0.22, 0.22, 0.02, MAT.water(), 0, 1.2, d * 0.12, 24).scale.set(1, 1, 1.25);
  }

  function vanity(o, G, w, d) {
    box(G, w, 2.65, d, MAT.wood('#f2efe9'), 0, 0.2, 0);
    box(G, w + 0.05, 0.15, d + 0.05, MAT.stone(), 0, 2.85, 0);
    const n = o.kind === 'vanity2' ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w * (i + 0.5)) / n;
      cyl(G, 0.62, 0.55, 0.3, MAT.ceramic(), x, 3.0, 0.08, 28).scale.set(1, 1, 0.7);
      cyl(G, 0.5, 0.5, 0.01, MAT.paint('#dfe5e8'), x, 3.3, 0.08, 28).scale.set(1, 1, 0.7);
      cyl(G, 0.04, 0.04, 0.6, MAT.steel(), x, 3.0, -d / 2 + 0.2, 10);
      box(G, 0.05, 0.05, 0.35, MAT.steel(), x, 3.55, -d / 2 + 0.35);
      box(G, Math.min(2.2, w / n - 0.3), 2.6, 0.06, MAT.mirror(), x, 4.2, -d / 2 + 0.03);
    }
  }

  function tub(o, G, w, d) {
    rbox(G, w, 1.8, d, 0.2, MAT.ceramic(), 0, 0, 0);
    rbox(G, w - 0.5, 0.05, d - 0.45, 0.2, MAT.water(), 0, 1.5, 0);
    cyl(G, 0.06, 0.06, 0.6, MAT.steel(), -w / 2 + 0.2, 1.8, 0, 10);
    box(G, 0.4, 0.06, 0.06, MAT.steel(), -w / 2 + 0.38, 2.35, 0);
  }

  function shower(o, G, w, d) {
    box(G, w, 0.12, d, MAT.tile(), 0, 0, 0);
    const gl = MAT.glass();
    const a = box(G, w, 6.6, 0.04, gl, 0, 0.12, d / 2 - 0.02);
    const b = box(G, 0.04, 6.6, d, gl, w / 2 - 0.02, 0.12, 0);
    a.castShadow = b.castShadow = false;
    box(G, w, 0.05, 0.06, MAT.steel(), 0, 6.72, d / 2 - 0.02);
    cyl(G, 0.25, 0.25, 0.04, MAT.steel(), -w / 2 + 0.6, 6.5, -d / 2 + 0.6, 20);
    cyl(G, 0.03, 0.03, 0.5, MAT.steel(), -w / 2 + 0.6, 6.5, -d / 2 + 0.6, 8);
  }

  function washer(o, G, w, d) {
    const u = (w - 0.1) / 2;
    for (const sx of [-1, 1]) {
      const x = sx * (u / 2 + 0.05);
      rbox(G, u, 3.1, d, 0.05, MAT.ceramic(), x, 0, 0);
      box(G, u - 0.1, 0.3, 0.02, MAT.paint('#e2e3e1'), x, 2.65, d / 2 + 0.01);
      const ring = mesh(G, torGeo(0.55, 0.07, 10, 32), MAT.paint('#cfd2d3'), x, 1.45, d / 2 + 0.03);
      const door = cyl(G, 0.5, 0.5, 0.03, MAT.gloss('#3b4247'), x, 1.43, d / 2 + 0.02, 32);
      door.rotation.x = Math.PI / 2;
      door.position.y = 1.45;
      ring.rotation.set(0, 0, 0);
    }
  }

  function desk(o, G, w, d, c) {
    const wood = MAT.wood(c);
    box(G, w, 0.12, d, wood, 0, 2.38, 0);
    for (const sx of [-1, 1]) box(G, 0.1, 2.38, d - 0.2, MAT.darkMetal(), sx * (w / 2 - 0.15), 0, 0);
    box(G, 1.2, 0.04, 0.85, MAT.steel(), 0, 2.5, 0.15);
    const scr = box(G, 1.2, 0.8, 0.03, MAT.steel(), 0, 2.52, -0.28);
    scr.rotation.x = -0.25;
    box(G, 1.1, 0.7, 0.01, MAT.screen(), 0, 2.57, -0.25).rotation.x = -0.25;
    cyl(G, 0.15, 0.18, 0.05, MAT.darkMetal(), w / 2 - 0.5, 2.5, -d / 2 + 0.4, 16);
    cyl(G, 0.025, 0.025, 1.3, MAT.darkMetal(), w / 2 - 0.5, 2.5, -d / 2 + 0.4, 8);
    cyl(G, 0.12, 0.25, 0.3, MAT.darkMetal(), w / 2 - 0.5, 3.75, -d / 2 + 0.55, 16);
    cyl(G, 0.11, 0.1, 0.32, MAT.ceramic(), -w / 2 + 0.55, 2.5, d / 2 - 0.5, 16);
  }

  function officechair(o, G, w, d, c) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leg = box(G, 0.85, 0.08, 0.1, MAT.darkMetal(), Math.cos(a) * 0.42, 0.15, Math.sin(a) * 0.42);
      leg.rotation.y = -a;
      sph(G, 0.08, MAT.gloss('#1a1a1a'), Math.cos(a) * 0.82, 0.08, Math.sin(a) * 0.82);
    }
    cyl(G, 0.06, 0.06, 1.2, MAT.steel(), 0, 0.2, 0, 10);
    rbox(G, w * 0.82, 0.32, d * 0.8, 0.12, MAT.fabric(c), 0, 1.4, 0.05);
    const back = rbox(G, w * 0.8, 1.6, 0.25, 0.12, MAT.fabric(c), 0, 1.85, -d * 0.38);
    back.rotation.x = 0.12;
  }

  function plantPot(G, o, x, y, z, r, height, potMat) {
    cyl(G, r, r * 0.78, r * 2.1, potMat || MAT.terracotta(), x, y, z, 20);
    cyl(G, r * 0.92, r * 0.92, 0.02, MAT.soil(), x, y + r * 2.05, z, 20);
    const rnd = rngFor(o.id);
    const top = y + r * 2.1;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.5;
      const h = height * (0.45 + rnd() * 0.55);
      const lean = 0.35 + rnd() * 0.5;
      const leaf = sph(G, r * 0.9, MAT.leaf(i), x + Math.cos(a) * r * lean * 1.4, top + h * 0.75, z + Math.sin(a) * r * lean * 1.4, 0.35, 1.1 * (h / height) * 1.6, 0.12);
      leaf.rotation.set(Math.sin(a) * lean, -a, Math.cos(a) * lean * 0.8);
    }
  }

  function plant(o, G, w, d, c) {
    const R = Math.min(w, d) / 2;
    const potMat = (c || '').toLowerCase() === '#b5653f' ? MAT.terracotta() : MAT.paint(c);
    if (o.kind === 'plantbig') {
      cyl(G, R * 0.8, R * 0.62, R * 1.6, potMat, 0, 0, 0, 24);
      cyl(G, R * 0.74, R * 0.74, 0.02, MAT.soil(), 0, R * 1.58, 0, 20);
      cyl(G, 0.06, 0.08, 4.2, MAT.wood('#6b4a33'), 0, R * 1.6, 0, 8);
      const rnd = rngFor(o.id);
      for (let i = 0; i < 26; i++) {
        const a = rnd() * Math.PI * 2, y = R * 1.6 + 2.2 + rnd() * 3, rr = 0.3 + rnd() * 0.9 * (1 - (y - 3.6) / 4);
        const leaf = sph(G, 0.38, MAT.leaf(i), Math.cos(a) * rr, y, Math.sin(a) * rr, 1, 0.75, 0.12);
        leaf.rotation.set(rnd() - 0.5, -a, 0.6 + rnd() * 0.5);
      }
      return;
    }
    plantPot(G, o, 0, 0, 0, R * 0.8, 1.6, potMat);
  }

  function lamp(o, G, w, d, c, lights) {
    cyl(G, w * 0.38, w * 0.42, 0.08, MAT.darkMetal(), 0, 0, 0, 24);
    cyl(G, 0.035, 0.035, 4.6, MAT.darkMetal(), 0, 0.08, 0, 8);
    const sh = mesh(G, cylGeo(w * 0.42, w * 0.55, 1.1, 28, true), MAT.lampShade(), 0, 4.95, 0);
    sh.castShadow = false;
    sph(G, 0.12, MAT.bulb(), 0, 4.7, 0);
    if (lights) {
      const l = new THREE.PointLight('#ffd9a0', 9, 16, 1.6);
      l.position.set(0, 4.6, 0);
      G.add(l);
    }
  }

  function pouf(o, G, w, d, c) {
    sph(G, w / 2, MAT.fabric(c), 0, 0.62, 0, 1, 0.62, d / w);
    mesh(G, torGeo(w * 0.42, 0.05, 8, 32), MAT.fabric(shade(c, -0.15)), 0, 1.0, 0).rotation.x = Math.PI / 2;
  }

  function piano(o, G, w, d) {
    const black = MAT.gloss('#121010');
    box(G, w, 4.1, d * 0.62, black, 0, 0, -d / 2 + d * 0.31);
    box(G, w - 0.2, 0.5, d * 0.38, black, 0, 2.0, d * 0.12);
    box(G, w - 0.3, 0.08, d * 0.3, MAT.paint('#f7f5f0'), 0, 2.5, d * 0.15);
    for (let x = -w / 2 + 0.25; x < w / 2 - 0.2; x += 0.12) if (Math.round(x / 0.12) % 7 !== 2) box(G, 0.05, 0.05, d * 0.16, black, x, 2.58, d * 0.08);
    for (const sx of [-1, 1]) box(G, 0.12, 2.0, 0.12, black, sx * (w / 2 - 0.2), 0, d * 0.25);
  }

  function grill(o, G, w, d) {
    const bw = w * 0.6;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(G, 0.08, 2.6, 0.08, MAT.darkMetal(), sx * (bw / 2 - 0.1), 0, sz * (d / 2 - 0.1));
    box(G, bw, 0.8, d, MAT.gloss('#1f1f20'), 0, 2.4, 0);
    const lid = mesh(G, g(k('lid', bw, d), () => new THREE.CylinderGeometry(d / 2, d / 2, bw, 24, 1, false, 0, Math.PI)), MAT.gloss('#1f1f20'), 0, 3.2, 0);
    lid.rotation.z = Math.PI / 2;
    lid.rotation.y = Math.PI / 2;
    for (const sx of [-1, 1]) box(G, (w - bw) / 2, 0.06, d * 0.8, MAT.steel(), sx * (bw / 2 + (w - bw) / 4), 2.9, 0);
    box(G, 0.8, 0.06, 0.08, MAT.steel(), 0, 3.5, d / 2);
  }

  function lounger(o, G, w, d, c) {
    const teak = MAT.wood('#8a6038');
    legs(G, w, d, 0.9, 0.12, teak, 0.06);
    box(G, w, 0.12, d * 0.68, teak, 0, 0.9, d * 0.16);
    rbox(G, w - 0.15, 0.3, d * 0.66, 0.12, MAT.fabric(c), 0, 1.02, d * 0.16);
    const back = rbox(G, w - 0.15, 0.3, d * 0.36, 0.12, MAT.fabric(c), 0, 1.6, -d * 0.3);
    back.rotation.x = 0.7;
  }

  function hammock(o, G, w, d, c) {
    for (const sz of [-1, 1]) {
      cyl(G, 0.08, 0.1, 4.2, MAT.wood('#7c5a3a'), 0, 0, sz * (d / 2 - 0.1), 10);
    }
    const bed = flat(o, G, 2.0);
    bed.castShadow = true;
  }

  function planter(o, G, w, d, c) {
    box(G, w, 1.6, d, MAT.wood(c), 0, 0, 0);
    box(G, w - 0.15, 0.02, d - 0.15, MAT.soil(), 0, 1.58, 0);
    const rnd = rngFor(o.id);
    for (let x = -w / 2 + 0.4; x < w / 2 - 0.3; x += 0.5) {
      for (let i = 0; i < 4; i++) {
        const leaf = sph(G, 0.3, MAT.leaf(i), x + (rnd() - 0.5) * 0.3, 2.1 + rnd() * 0.4, (rnd() - 0.5) * d * 0.4, 0.5, 1.2, 0.15);
        leaf.rotation.set(rnd() - 0.5, rnd() * 3, rnd() - 0.5);
      }
    }
  }

  function dogbed(o, G, w, d, c) {
    const ring = mesh(G, torGeo(Math.min(w, d) * 0.4, 0.28, 14, 40), MAT.fabric(shade(c, -0.08)), 0, 0.3, 0);
    ring.rotation.x = Math.PI / 2;
    ring.scale.set(w / Math.min(w, d), d / Math.min(w, d), 1);
    sph(G, Math.min(w, d) * 0.38, MAT.fabric(shade(c, 0.3)), 0, 0.15, 0, w / Math.min(w, d), 0.25, d / Math.min(w, d));
  }

  function crate(o, G, w, d) {
    const wire = MAT.darkMetal();
    const H = 2.5;
    for (const y of [0, H]) {
      box(G, w, 0.04, 0.04, wire, 0, y, -d / 2);
      box(G, w, 0.04, 0.04, wire, 0, y, d / 2);
      box(G, 0.04, 0.04, d, wire, -w / 2, y, 0);
      box(G, 0.04, 0.04, d, wire, w / 2, y, 0);
    }
    for (let x = -w / 2; x <= w / 2 + 0.01; x += 0.25) for (const z of [-d / 2, d / 2]) box(G, 0.02, H, 0.02, wire, x, 0, z);
    for (let z = -d / 2; z <= d / 2 + 0.01; z += 0.25) for (const x of [-w / 2, w / 2]) box(G, 0.02, H, 0.02, wire, x, 0, z);
    rbox(G, w - 0.1, 0.25, d - 0.1, 0.1, MAT.fabric('#a39e97'), 0, 0.04, 0);
  }

  function bowls(o, G, w, d) {
    box(G, w, 0.03, d, MAT.paint('#e9e4da'), 0, 0, 0);
    const r = Math.min(w / 4, d / 2) * 0.9;
    for (const [sx, inner] of [[-1, MAT.paint('#8a5a3b')], [1, MAT.water()]]) {
      cyl(G, r, r * 0.8, 0.25, MAT.steel(), sx * w / 4, 0.03, 0, 24);
      cyl(G, r * 0.8, r * 0.8, 0.02, inner, sx * w / 4, 0.2, 0, 24);
    }
  }

  function cattree(o, G, w, d, c) {
    const carpet = MAT.fabric(c);
    box(G, w, 0.2, d, carpet, 0, 0, 0);
    cyl(G, 0.2, 0.2, 4.5, MAT.paint('#c8a97a'), -w * 0.2, 0.2, 0, 12);
    cyl(G, 0.18, 0.18, 2.8, MAT.paint('#c8a97a'), w * 0.25, 0.2, d * 0.2, 12);
    cyl(G, w * 0.35, w * 0.35, 0.15, carpet, w * 0.2, 3.0, d * 0.15, 24);
    cyl(G, w * 0.42, w * 0.42, 0.15, carpet, -w * 0.15, 4.7, -d * 0.1, 24);
  }

  function barcart(o, G, w, d, c) {
    const frame = MAT.gold();
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(G, 0.03, 0.03, 2.8, frame, sx * (w / 2 - 0.05), 0.15, sz * (d / 2 - 0.05), 8);
    for (const y of [0.6, 2.4]) box(G, w - 0.1, 0.03, d - 0.1, MAT.glass(), 0, y, 0);
    for (const sx of [-1, 1]) cyl(G, 0.15, 0.15, 0.06, MAT.darkMetal(), sx * (w / 2 - 0.1), 0, d / 2 - 0.1, 16).rotation.z = Math.PI / 2;
    [['#3d5a3a', 1.0], ['#8a2f2a', 0.8], ['#e9e4da', 0.9], ['#c9a23a', 0.7]].forEach(([col, h], i) => {
      cyl(G, 0.1, 0.1, h, MAT.gloss(col), -w / 2 + 0.35 + (i * (w - 0.6)) / 3, 2.43, i % 2 ? -0.1 : 0.1, 14);
      cyl(G, 0.03, 0.04, 0.25, MAT.gloss(col), -w / 2 + 0.35 + (i * (w - 0.6)) / 3, 2.43 + h, i % 2 ? -0.1 : 0.1, 8);
    });
  }

  function stairs(o, G, w, d, c) {
    const n = Math.max(3, Math.round(d / 0.85));
    const rise = 8 / n, run = d / n;
    for (let i = 0; i < n; i++) box(G, w, rise * (i + 1), run, MAT.wood(c), 0, 0, d / 2 - run * (i + 0.5));
  }

  function door(o, G, w, d, c) {
    const leaf = box(G, 0.13, 6.8, d, MAT.paint('#f3efe8'), -w / 2 + 0.065, 0, 0);
    box(G, 0.15, 6.8, 0.05, MAT.wood(c), -w / 2 + 0.065, 0, -d / 2 + 0.03);
    sph(G, 0.06, MAT.gold(), -w / 2 + 0.2, 3.3, -d / 2 + 0.35);
    leaf.castShadow = true;
  }

  function windowModel(o, G, w, d) {
    const frame = MAT.paint('#fbfaf7');
    const y0 = 3, h = 4;
    box(G, w, 0.12, d, frame, 0, y0, 0);
    box(G, w, 0.12, d, frame, 0, y0 + h - 0.12, 0);
    for (const sx of [-1, 0, 1]) box(G, 0.1, h, d, frame, sx * (w / 2 - (sx ? 0.05 : 0)), y0, 0);
    const glass = box(G, w - 0.1, h - 0.2, 0.03, MAT.glass(), 0, y0 + 0.1, 0);
    glass.castShadow = false;
    box(G, w + 0.3, 0.08, d + 0.3, frame, 0, y0 - 0.08, 0.05);
  }

  function yogamat(o, G) {
    flat(o, G, 0.03);
  }

  function rug(o, G) {
    const m = flat(o, G, o.kind === 'rugshag' ? 0.05 : 0.025);
    m.receiveShadow = true;
  }

  const BUILD = {
    sofa, loveseat: sofa, armchair: sofa, sectional,
    king: bed, queen: bed, full: bed, crib: bed,
    nightstand: storage, dresser: storage, wardrobe: storage, closet: storage, tv: storage, bookshelf: storage,
    coffee: table, table4: table, table6: table, roundtable: table, patiotable: table, chair, barcart,
    counter, island: counter, sink: counter, fridge, range, toilet, vanity, vanity2: vanity, tub, shower, washer,
    desk, officechair, plant, plantbig: plant, floorlamp: lamp, pouf, piano, yogamat,
    grill, lounger, hammock, planter, dogbed, crate, bowls, cattree, stairs, door, window: windowModel,
    rug, rugsm: rug, rugstripe: rug, rugshag: rug, rugjute: rug, runner: rug,
  };

  function build(o, { lights = true } = {}) {
    const G = new THREE.Group();
    const c = o.color || (GG.data.furnitureByKind[o.kind] || {}).color || '#cccccc';
    const fn = BUILD[o.kind];
    if (fn) fn(o, G, o.w, o.h, c, lights);
    else rbox(G, o.w, 2, o.h, 0.08, MAT.wood(c), 0, 0, 0);
    return G;
  }

  /* ------------------------------------------------------------------ */
  /* Gougou in 3D                                                        */
  /* ------------------------------------------------------------------ */
  function dog() {
    const fur = std({ color: '#d88a49', map: overlayTex('o-fabric'), roughness: 0.9 });
    const cream = std({ color: '#f2e2c8', map: overlayTex('o-fabric'), roughness: 0.9 });
    const dark = std({ color: '#1f1a17', roughness: 0.4 });
    const D = new THREE.Group();
    const awake = new THREE.Group();
    sph(awake, 0.5, fur, -0.05, 1.05, 0, 1.55, 0.78, 0.8);
    sph(awake, 0.42, cream, 0.25, 0.95, 0, 0.9, 0.7, 0.7);
    const head = new THREE.Group();
    head.position.set(0.72, 1.45, 0);
    sph(head, 0.3, fur, 0, 0, 0, 1, 0.92, 0.95);
    sph(head, 0.16, cream, 0.26, -0.08, 0, 1.25, 0.85, 1.05);
    sph(head, 0.045, dark, 0.46, -0.04, 0);
    for (const s of [-1, 1]) {
      sph(head, 0.035, dark, 0.24, 0.07, s * 0.15);
      const ear = mesh(head, g('ear', () => new THREE.ConeGeometry(0.11, 0.26, 4)), fur, -0.04, 0.3, s * 0.15);
      ear.rotation.set(s * -0.25, 0, -0.15);
    }
    awake.add(head);
    const legsArr = [];
    for (const [x, z] of [[0.45, -0.2], [0.45, 0.2], [-0.5, -0.2], [-0.5, 0.2]]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.8, z);
      cyl(pivot, 0.08, 0.07, 0.8, fur, 0, -0.8, 0, 10);
      sph(pivot, 0.08, cream, 0.03, -0.78, 0, 1.2, 0.6, 1);
      awake.add(pivot);
      legsArr.push(pivot);
    }
    const tail = mesh(awake, torGeo(0.17, 0.08, 10, 20, Math.PI * 1.6), fur, -0.72, 1.45, 0);
    tail.rotation.set(0, Math.PI / 2, 0.4);
    D.add(awake);

    const asleep = new THREE.Group();
    sph(asleep, 0.62, fur, 0, 0.42, 0, 1, 0.62, 0.95);
    const t2 = mesh(asleep, torGeo(0.55, 0.12, 10, 24, Math.PI), fur, 0, 0.18, 0);
    t2.rotation.x = Math.PI / 2;
    const h2 = new THREE.Group();
    h2.position.set(0.42, 0.5, 0.25);
    h2.rotation.y = -0.9;
    sph(h2, 0.27, fur, 0, 0, 0);
    sph(h2, 0.14, cream, 0.22, -0.05, 0, 1.2, 0.8, 1);
    sph(h2, 0.04, dark, 0.38, -0.03, 0);
    for (const s of [-1, 1]) mesh(h2, g('ear', () => new THREE.ConeGeometry(0.11, 0.26, 4)), fur, -0.05, 0.27, s * 0.14).rotation.set(s * -0.3, 0, -0.3);
    asleep.add(h2);
    asleep.visible = false;
    D.add(asleep);
    D.traverse((m) => m.isMesh && (m.castShadow = true));
    D.userData = { awake, asleep, legs: legsArr, tail, head };
    return D;
  }

  GG.models3d = {
    build,
    dog,
    floorTexture: colorTex,
    onTextureReady(fn) {
      onTextureReady = fn;
    },
  };
})(window.GG);
