/*
 * Gougou House — realistic top-down furniture renderer.
 * item(o) returns SVG in the piece's local coordinates (centered on 0,0, unrotated, units = feet).
 * Materials layer a base color with shared textures/gradients from textures.js.
 */
(function (GG) {
  const T = GG.textures;
  const n = (v) => +(+v).toFixed(3);

  /* ---------- small helpers ---------- */
  function shade(hex, amt) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex;
    const v = parseInt(m[1], 16);
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    return '#' + [v >> 16, (v >> 8) & 255, v & 255].map((c) => Math.round(c + (t - c) * p).toString(16).padStart(2, '0')).join('');
  }
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

  const rect = (x, y, w, h, r, a = '') => `<rect x="${n(x)}" y="${n(y)}" width="${n(Math.max(0, w))}" height="${n(Math.max(0, h))}" rx="${n(r)}" ${a}/>`;
  const ell = (cx, cy, rx, ry, a = '') => `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(Math.max(0, rx))}" ry="${n(Math.max(0, ry))}" ${a}/>`;
  const line = (x1, y1, x2, y2, a = '') => `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${a}/>`;

  /** Paint one geometry with several stacked fills: geom(fillAttr) -> element */
  const layers = (geom, fills) => fills.filter(Boolean).map((f) => geom(f)).join('');
  const fabricFills = (c) => [`fill="${c}"`, `fill="${T.use('o-fabric')}"`, 'fill="url(#g-cushion)"'];
  const woodFills = (c) => [`fill="${c}"`, `fill="${T.use('o-grain')}"`, 'fill="url(#g-sheen)"'];
  const stoneFills = (dark) => [`fill="${T.use(dark ? 'stone-dark' : 'stone')}"`, 'fill="url(#g-sheen)"'];
  const edge = (c, w = 0.03) => `stroke="${shade(c, -0.35)}" stroke-width="${w}"`;

  const fabricRect = (x, y, w, h, r, c) => layers((f) => rect(x, y, w, h, r, f), fabricFills(c)) + rect(x, y, w, h, r, `fill="none" ${edge(c, 0.025)}`);
  const woodRect = (x, y, w, h, r, c) => layers((f) => rect(x, y, w, h, r, f), woodFills(c)) + rect(x + 0.04, y + 0.04, w - 0.08, h - 0.08, Math.max(0, r - 0.03), `fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="0.03"`) + rect(x, y, w, h, r, `fill="none" ${edge(c, 0.03)}`);
  const stoneRect = (x, y, w, h, r, dark) => layers((f) => rect(x, y, w, h, r, f), stoneFills(dark)) + rect(x, y, w, h, r, `fill="none" stroke="#000" stroke-opacity=".22" stroke-width="0.03"`);
  const ceramicEll = (cx, cy, rx, ry) => ell(cx, cy, rx, ry, 'fill="url(#g-ceramic)" stroke="#b9b9b5" stroke-width="0.025"');

  /* ---------- decor bits reused on furniture ---------- */
  function pillow(cx, cy, s, rot, c) {
    return `<g transform="translate(${n(cx)} ${n(cy)}) rotate(${rot})">${fabricRect(-s / 2, -s / 2, s, s, s * 0.28, c)}</g>`;
  }
  function vase(cx, cy, r, flowers = '#e9d8c0') {
    let petals = '';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      petals += ell(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7, r * 0.45, r * 0.45, `fill="${i % 2 ? '#7d9a5c' : flowers}"`);
    }
    return ceramicEll(cx, cy, r * 1.1, r * 1.1) + petals + ell(cx, cy, r * 0.35, r * 0.35, 'fill="#c9a23a"');
  }
  function books(cx, cy, s, rot) {
    return `<g transform="translate(${n(cx)} ${n(cy)}) rotate(${rot})">
      ${rect(-s * 0.55, -s * 0.4, s * 1.1, s * 0.8, 0.02, 'fill="#2f3e55"')}
      ${rect(-s * 0.48, -s * 0.33, s * 0.95, s * 0.66, 0.02, 'fill="#d8cfc0" transform="rotate(-9)"')}
      ${rect(-s * 0.48, -s * 0.33, s * 0.95, s * 0.66, 0.02, 'fill="none" stroke="#000" stroke-opacity=".2" stroke-width="0.02" transform="rotate(-9)"')}
    </g>`;
  }
  function foliage(o, cx, cy, R, count, big = false) {
    const r = rngFor(o.id + 'leaf');
    let out = '';
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + r() * 0.6;
      const d = R * (0.35 + r() * 0.35);
      const lx = cx + Math.cos(a) * d, ly = cy + Math.sin(a) * d;
      const lw = R * (big ? 0.42 : 0.5) * (0.8 + r() * 0.4), lh = R * (big ? 0.3 : 0.17) * (0.8 + r() * 0.4);
      const deg = (a * 180) / Math.PI;
      out += `<g transform="translate(${n(lx)} ${n(ly)}) rotate(${n(deg)})">
        ${ell(0, 0, lw, lh, `fill="url(#${i % 2 ? 'g-leaf' : 'g-leaf2'})" stroke="#24391b" stroke-opacity=".5" stroke-width="0.015"`)}
        ${line(-lw * 0.9, 0, lw * 0.9, 0, 'stroke="#d8e6c0" stroke-opacity=".35" stroke-width="0.012"')}
      </g>`;
    }
    return out;
  }
  function fringe(x, y, w, h) {
    // tassels on the two short ends
    let out = '';
    const along = w >= h;
    const len = along ? h : w;
    for (let t = 0.08; t < len - 0.04; t += 0.11) {
      out += along
        ? line(x, y + t, x - 0.22, y + t, 'stroke="#efe6d2" stroke-width="0.035"') + line(x + w, y + t, x + w + 0.22, y + t, 'stroke="#efe6d2" stroke-width="0.035"')
        : line(x + t, y, x + t, y - 0.22, 'stroke="#efe6d2" stroke-width="0.035"') + line(x + t, y + h, x + t, y + h + 0.22, 'stroke="#efe6d2" stroke-width="0.035"');
    }
    return out;
  }

  /* ---------- rugs ---------- */
  function rug(o, x, y, w, h, c) {
    const id = `rp-${o.id}`;
    const tex = `fill="${T.use('o-fabric')}"`;
    switch (o.kind) {
      case 'rugjute': {
        let rings = '';
        for (let k = 0.2; k < Math.min(w, h) / 2; k += 0.2) rings += ell(0, 0, w / 2 - k, h / 2 - k, `fill="none" stroke="${shade(c, -0.18)}" stroke-width="0.05"`);
        return ell(0, 0, w / 2, h / 2, `fill="${c}"`) + rings + ell(0, 0, w / 2, h / 2, tex) + ell(0, 0, w / 2, h / 2, `fill="${T.use('o-grain')}" opacity=".5"`) + ell(0, 0, w / 2, h / 2, `fill="none" stroke="${shade(c, -0.3)}" stroke-width="0.06"`);
      }
      case 'rugshag':
        return rect(x, y, w, h, 0.45, `fill="${c}"`) + rect(x, y, w, h, 0.45, `fill="${T.use('o-shag')}"`) + rect(x, y, w, h, 0.45, tex);
      case 'rugsm': {
        const dark = shade(c, -0.75);
        return `<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="1.2" height="1.7" x="${n(x)}" y="${n(y)}">
            <path d="M0.6 0 L1.2 0.85 L0.6 1.7 L0 0.85 Z" fill="none" stroke="${dark}" stroke-width="0.07" stroke-linejoin="round"/>
            <circle cx="0.6" cy="0.85" r="0.07" fill="${dark}"/></pattern></defs>
          ${fringe(x, y, w, h)}
          ${rect(x, y, w, h, 0.04, `fill="${c}"`)}${rect(x + 0.3, y + 0.3, w - 0.6, h - 0.6, 0, `fill="url(#${id})"`)}
          ${rect(x, y, w, h, 0.04, `fill="${T.use('o-shag')}" opacity=".7"`)}${rect(x, y, w, h, 0.04, tex)}`;
      }
      case 'rugstripe': {
        const s1 = shade(c, -0.45), s2 = accentFor(o, c);
        const along = w >= h;
        return `<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="${along ? 1.4 : 100}" height="${along ? 100 : 1.4}" x="${n(x)}" y="${n(y)}">
            ${along ? `<rect x="0.15" y="0" width="0.28" height="100" fill="${s1}"/><rect x="0.55" y="0" width="0.08" height="100" fill="${s2}"/>` : `<rect y="0.15" x="0" height="0.28" width="100" fill="${s1}"/><rect y="0.55" x="0" height="0.08" width="100" fill="${s2}"/>`}
          </pattern></defs>
          ${fringe(x, y, w, h)}${rect(x, y, w, h, 0.03, `fill="${c}"`)}${rect(x, y, w, h, 0.03, `fill="url(#${id})"`)}${rect(x, y, w, h, 0.03, tex)}`;
      }
      case 'runner': {
        const dark = shade(c, -0.55), cream = '#ecdcbf';
        const along = h >= w;
        const L = along ? h : w, Wd = along ? w : h;
        let motifs = '';
        for (let t = 0.7; t < L - 0.5; t += 1.1) {
          const cx = along ? 0 : x + t, cy = along ? y + t : 0;
          const a = Wd * 0.32;
          motifs += `<path d="M${n(cx)} ${n(cy - a)} L${n(cx + a)} ${n(cy)} L${n(cx)} ${n(cy + a)} L${n(cx - a)} ${n(cy)} Z" fill="${dark}"/>
            <path d="M${n(cx)} ${n(cy - a * 0.55)} L${n(cx + a * 0.55)} ${n(cy)} L${n(cx)} ${n(cy + a * 0.55)} L${n(cx - a * 0.55)} ${n(cy)} Z" fill="${cream}"/>`;
        }
        return `${fringe(x, y, w, h)}${rect(x, y, w, h, 0.03, `fill="${c}"`)}
          ${rect(x + 0.12, y + 0.12, w - 0.24, h - 0.24, 0, `fill="none" stroke="${dark}" stroke-width="0.1"`)}
          ${rect(x + 0.24, y + 0.24, w - 0.48, h - 0.48, 0, `fill="none" stroke="${cream}" stroke-width="0.04"`)}
          ${motifs}${rect(x, y, w, h, 0.03, tex)}`;
      }
      default: {
        // Persian: border bands, floral field, lobed central medallion, corner spandrels, pile & abrash
        const navy = shade(c, -0.62), cream = '#e9dbbd', mid = shade(c, -0.3), gold = '#c49a4a', light = shade(c, 0.18);
        const b = Math.min(0.75, Math.min(w, h) * 0.09);
        const fx = x + b + 0.14, fy = y + b + 0.14, fw = w - 2 * (b + 0.14), fh = h - 2 * (b + 0.14);
        const mrx = fw * 0.26, mry = fh * 0.3;
        const flower = (cx, cy, r, col, eye) => [0, 1, 2, 3].map((k) => ell(cx + Math.cos((k * Math.PI) / 2) * r * 0.55, cy + Math.sin((k * Math.PI) / 2) * r * 0.55, r * 0.42, r * 0.42, `fill="${col}"`)).join('') + ell(cx, cy, r * 0.3, r * 0.3, `fill="${eye}"`);
        const corner = (cx, cy) => lobed(cx, cy, mrx * 0.55, mry * 0.55, 10, 0.12, `fill="${navy}"`) + lobed(cx, cy, mrx * 0.38, mry * 0.38, 10, 0.12, `fill="${cream}"`) + lobed(cx, cy, mrx * 0.22, mry * 0.22, 8, 0.15, `fill="${mid}"`);
        return `<defs>
            <pattern id="${id}" patternUnits="userSpaceOnUse" width="1" height="1" x="${n(fx)}" y="${n(fy)}">
              <path d="M0 0.5 Q0.25 0.3 0.5 0.5 T1 0.5" fill="none" stroke="${mid}" stroke-width="0.035"/>
              <path d="M0.5 0 Q0.7 0.25 0.5 0.5 T0.5 1" fill="none" stroke="${mid}" stroke-width="0.035"/>
              ${flower(0.5, 0.5, 0.16, cream, gold)}${flower(0, 0, 0.12, navy, light)}${flower(1, 0, 0.12, navy, light)}${flower(0, 1, 0.12, navy, light)}${flower(1, 1, 0.12, navy, light)}
            </pattern>
            <pattern id="${id}-b" patternUnits="userSpaceOnUse" width="0.7" height="0.7" x="${n(x)}" y="${n(y)}">
              <path d="M0.35 0.08 L0.62 0.35 L0.35 0.62 L0.08 0.35 Z" fill="${mid}"/>${flower(0.35, 0.35, 0.12, cream, navy)}
            </pattern>
            <linearGradient id="${id}-ab" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="#000" stop-opacity=".06"/><stop offset=".35" stop-color="#fff" stop-opacity=".05"/><stop offset=".6" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity=".04"/>
            </linearGradient>
            <clipPath id="${id}-c"><rect x="${n(fx)}" y="${n(fy)}" width="${n(fw)}" height="${n(fh)}"/></clipPath>
          </defs>
          ${fringe(x, y, w, h)}
          ${rect(x, y, w, h, 0.03, `fill="${navy}"`)}
          ${rect(x + 0.1, y + 0.1, w - 0.2, h - 0.2, 0, `fill="url(#${id}-b)"`)}
          ${rect(x + b, y + b, w - 2 * b, h - 2 * b, 0, `fill="none" stroke="${gold}" stroke-width="0.07"`)}
          ${rect(x + b + 0.1, y + b + 0.1, w - 2 * b - 0.2, h - 2 * b - 0.2, 0, `fill="${c}" stroke="${cream}" stroke-width="0.05"`)}
          ${rect(fx, fy, fw, fh, 0, `fill="url(#${id})"`)}
          <g clip-path="url(#${id}-c)">${corner(fx, fy)}${corner(fx + fw, fy)}${corner(fx, fy + fh)}${corner(fx + fw, fy + fh)}</g>
          ${lobed(0, 0, mrx * 1.18, mry * 1.18, 16, 0.1, `fill="${cream}"`)}
          ${lobed(0, 0, mrx, mry, 16, 0.1, `fill="${navy}"`)}
          ${lobed(0, 0, mrx * 0.74, mry * 0.74, 12, 0.14, `fill="${light}"`)}
          ${flower(0, 0, Math.min(mrx, mry) * 0.42, cream, gold)}
          ${lobed(0, 0, mrx * 0.2, mry * 0.2, 8, 0.15, `fill="${navy}"`)}
          ${rect(x, y, w, h, 0.03, `fill="url(#${id}-ab)"`)}
          ${rect(x, y, w, h, 0.03, `fill="${T.use('o-shag')}" opacity=".35"`)}${rect(x, y, w, h, 0.03, tex)}`;
      }
    }
  }

  /** A soft-edged lobed oval (rug medallions). */
  function lobed(cx, cy, rx, ry, lobes, depth, attrs) {
    const pts = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      const k = 1 - depth * (0.5 - 0.5 * Math.cos(lobes * a));
      pts.push(`${n(cx + Math.cos(a) * rx * k)},${n(cy + Math.sin(a) * ry * k)}`);
    }
    return `<polygon points="${pts.join(' ')}" ${attrs}/>`;
  }

  /* ---------- seating ---------- */
  function sofa(o, x, y, w, h, c) {
    const arm = Math.min(0.55, w * 0.13), back = Math.min(0.75, h * 0.28);
    const nSeat = w > 6.2 ? 3 : w > 3.5 ? 2 : 1;
    const sw = (w - 2 * arm - 0.04) / nSeat;
    let seats = '';
    for (let i = 0; i < nSeat; i++) seats += fabricRect(x + arm + 0.02 + i * sw + 0.02, y + back - 0.06, sw - 0.04, h - back - 0.04, 0.16, shade(c, 0.04));
    const acc = accentFor(o, c);
    const pillows = nSeat > 1 ? pillow(x + arm + 0.55, y + back + 0.25, 0.75, -14, acc) + pillow(x + w - arm - 0.55, y + back + 0.25, 0.75, 12, shade(acc, 0.25)) : '';
    return fabricRect(x, y, w, h, 0.22, shade(c, -0.14)) +
      fabricRect(x + arm * 0.5, y + 0.04, w - arm, back, 0.18, shade(c, -0.05)) +
      fabricRect(x + 0.02, y + 0.04, arm, h - 0.08, 0.2, shade(c, -0.07)) +
      fabricRect(x + w - arm - 0.02, y + 0.04, arm, h - 0.08, 0.2, shade(c, -0.07)) +
      seats + pillows;
  }

  function sectional(o, x, y, w, h, c) {
    const d = Math.min(3, w / 2, h / 2), back = 0.7, arm = 0.5;
    const path = `M${n(x)} ${n(y)} H${n(x + w)} V${n(y + d)} H${n(x + d)} V${n(y + h)} H${n(x)} Z`;
    const p = (f) => `<path d="${path}" ${f} stroke-linejoin="round"/>`;
    let seats = '';
    const topLen = w - back - arm, nTop = Math.max(2, Math.round(topLen / 2.6)), tw = topLen / nTop;
    for (let i = 0; i < nTop; i++) seats += fabricRect(x + back + i * tw + 0.03, y + back - 0.05, tw - 0.06, d - back, 0.16, shade(c, 0.04));
    const legLen = h - d - arm;
    seats += fabricRect(x + back - 0.05, y + d + 0.03, d - back + 0.02, legLen - 0.06, 0.16, shade(c, 0.04));
    const acc = accentFor(o, c);
    return layers(p, fabricFills(shade(c, -0.14))) + p(`fill="none" ${edge(c, 0.025)}`) +
      fabricRect(x + 0.04, y + 0.04, w - arm - 0.04, back, 0.18, shade(c, -0.05)) +
      fabricRect(x + 0.04, y + 0.04, back, h - arm - 0.04, 0.18, shade(c, -0.05)) +
      fabricRect(x + w - arm - 0.02, y + 0.04, arm, d - 0.08, 0.2, shade(c, -0.07)) +
      fabricRect(x + 0.04, y + h - arm - 0.02, d - 0.08, arm, 0.2, shade(c, -0.07)) +
      seats + pillow(x + back + 0.45, y + back + 0.45, 0.8, 45, acc) + pillow(x + w - arm - 0.6, y + back + 0.3, 0.75, 10, shade(acc, 0.25));
  }

  function armchair(o, x, y, w, h, c) {
    const arm = Math.min(0.45, w * 0.18), back = Math.min(0.6, h * 0.25);
    return fabricRect(x, y, w, h, 0.22, shade(c, -0.12)) +
      fabricRect(x + arm * 0.5, y + 0.04, w - arm, back, 0.18, shade(c, -0.04)) +
      fabricRect(x + 0.03, y + 0.06, arm, h - 0.12, 0.18, shade(c, -0.06)) +
      fabricRect(x + w - arm - 0.03, y + 0.06, arm, h - 0.12, 0.18, shade(c, -0.06)) +
      fabricRect(x + arm + 0.02, y + back - 0.05, w - 2 * arm - 0.04, h - back - 0.06, 0.15, shade(c, 0.05));
  }

  /* ---------- bedroom ---------- */
  function bed(o, x, y, w, h, c) {
    if (o.kind === 'crib') {
      return woodRect(x, y, w, h, 0.1, '#f2efe9') + fabricRect(x + 0.18, y + 0.18, w - 0.36, h - 0.36, 0.08, '#f7f4ee') +
        fabricRect(x + w * 0.45, y + 0.25, w * 0.45, h - 0.5, 0.08, '#d9b1a3') +
        Array.from({ length: Math.floor(w / 0.35) }, (_, i) => line(x + 0.2 + i * 0.35, y + 0.06, x + 0.2 + i * 0.35, y + 0.16, 'stroke="#cfc8bc" stroke-width="0.04"')).join('');
    }
    const head = 0.3;
    const acc = accentFor(o, c);
    const nP = w > 4.6 ? 2 : 1, pw = (w - 0.5 - (nP - 1) * 0.15) / nP;
    let pillows = '';
    for (let i = 0; i < nP; i++) {
      const px = x + 0.25 + i * (pw + 0.15);
      pillows += fabricRect(px, y + head + 0.15, pw, 0.95, 0.3, '#fbfaf7') + line(px + 0.12, y + head + 0.62, px + pw - 0.12, y + head + 0.62, 'stroke="#000" stroke-opacity=".06" stroke-width="0.03"');
    }
    const duvetY = y + head + 1.35;
    return fabricRect(x, y, w, head, 0.08, shade(c, -0.45)) +
      fabricRect(x + 0.06, y + head - 0.04, w - 0.12, h - head, 0.18, '#f6f3ee') +
      pillows +
      fabricRect(x + 0.03, duvetY, w - 0.06, y + h - duvetY + 0.02, 0.16, c) +
      fabricRect(x + 0.03, duvetY, w - 0.06, 0.5, 0.14, shade(c, 0.35)) +
      fabricRect(x + 0.0, y + h - 1.35, w, 0.95, 0.08, acc) +
      line(x + 0.05, y + h - 1.2, x + w - 0.05, y + h - 1.2, `stroke="${shade(acc, 0.3)}" stroke-width="0.04"`);
  }

  /* ---------- tables & storage ---------- */
  function table(o, x, y, w, h, c) {
    const round = o.kind === 'roundtable';
    const top = round
      ? layers((f) => ell(0, 0, w / 2, h / 2, f), woodFills(c)) + ell(0, 0, w / 2, h / 2, `fill="none" ${edge(c)}`) + ell(0, 0, w / 2 - 0.06, h / 2 - 0.06, 'fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="0.03"')
      : woodRect(x, y, w, h, 0.08, c);
    let deco = '';
    if (o.kind === 'table6' || o.kind === 'table4') {
      const along = w >= h;
      deco = along ? fabricRect(x + 0.3, -0.35, w - 0.6, 0.7, 0.03, '#e8e0d2') : fabricRect(-0.35, y + 0.3, 0.7, h - 0.6, 0.03, '#e8e0d2');
      deco += vase(0, 0, 0.22);
      const mats = [];
      const off = along ? [[-w * 0.3, -h * 0.28], [w * 0.3, -h * 0.28], [-w * 0.3, h * 0.28], [w * 0.3, h * 0.28]] : [[-w * 0.28, -h * 0.3], [w * 0.28, -h * 0.3], [-w * 0.28, h * 0.3], [w * 0.28, h * 0.3]];
      off.forEach(([px, py]) => mats.push(ell(px, py, 0.32, 0.32, 'fill="#fbfaf7" stroke="#d9d4cc" stroke-width="0.02"') + ell(px, py, 0.22, 0.22, 'fill="none" stroke="#e5e0d8" stroke-width="0.02"')));
      deco += mats.join('');
    } else if (round) deco = vase(0, 0, Math.min(0.28, w * 0.1));
    return top + deco;
  }

  function coffee(o, x, y, w, h, c) {
    return woodRect(x, y, w, h, 0.12, c) + books(x + w * 0.28, 0, Math.min(0.9, h * 0.6), -8) +
      rect(x + w * 0.58, y + h * 0.25, w * 0.28, h * 0.5, 0.06, 'fill="#2b2b2b" opacity=".85"') + ell(x + w * 0.66, 0, 0.12, 0.12, 'fill="#efe6d2"') + ell(x + w * 0.78, 0, 0.1, 0.1, 'fill="url(#g-leaf)"');
  }

  function storage(o, x, y, w, h, c) {
    let deco = '';
    if (o.kind === 'tv') {
      deco = rect(x + w * 0.12, y + 0.12, w * 0.76, 0.2, 0.03, 'fill="#111"') + line(x + w * 0.14, y + 0.17, x + w * 0.86, y + 0.17, 'stroke="#555" stroke-width="0.02"') +
        rect(x + w * 0.3, y + h - 0.45, w * 0.4, 0.22, 0.08, 'fill="#2a2a2b"') + ell(x + 0.45, 0, 0.18, 0.18, 'fill="url(#g-leaf2)"');
    } else if (o.kind === 'nightstand') {
      deco = ell(0, -h * 0.05, Math.min(w, h) * 0.3, Math.min(w, h) * 0.3, 'fill="#f3eee4" stroke="#d6cfc2" stroke-width="0.03"') + ell(0, -h * 0.05, Math.min(w, h) * 0.1, Math.min(w, h) * 0.1, 'fill="#fff6dc"');
    } else if (o.kind === 'dresser') {
      deco = rect(x + w * 0.1, y + h * 0.25, w * 0.25, h * 0.5, 0.05, 'fill="#c9a23a" opacity=".8"') + vase(x + w * 0.75, 0, Math.min(0.2, h * 0.25));
    } else if (o.kind === 'bookshelf') {
      const r = rngFor(o.id);
      for (let bx = x + 0.12; bx < x + w - 0.2; bx += 0.12 + r() * 0.08) deco += rect(bx, y + 0.12, 0.09, h - 0.24, 0.01, `fill="${['#2f3e55', '#8a5a3b', '#d8cfc0', '#4f6b58', '#b5653f'][Math.floor(r() * 5)]}"`);
    } else if (o.kind === 'wardrobe' || o.kind === 'closet') {
      deco = line(0, y + 0.05, 0, y + h - 0.05, `stroke="${shade(c, -0.4)}" stroke-width="0.03"`);
      if (o.kind === 'closet') for (let k = x + 0.4; k < x + w - 0.3; k += 0.25) deco += line(k, y + 0.25, k, y + h - 0.25, 'stroke="#000" stroke-opacity=".12" stroke-width="0.025"');
    }
    return woodRect(x, y, w, h, 0.06, c) + deco;
  }

  /* ---------- kitchen & bath ---------- */
  function counter(o, x, y, w, h) {
    let deco = rect(x, y, w, 0.1, 0.02, 'fill="#d9d4cc"');
    if (o.kind === 'island') deco = rect(x + 0.12, y + h * 0.6, w - 0.24, 0.02, 0, 'fill="#000" opacity=".12"') + vase(x + w * 0.75, y + h * 0.3, 0.2);
    if (o.kind === 'sink') deco += rect(x + w * 0.15, y + h * 0.22, w * 0.7, h * 0.62, 0.12, 'fill="url(#g-basin)" stroke="#9aa1a6" stroke-width="0.03"') + ell(0, y + h * 0.53, 0.07, 0.07, 'fill="#7a8085"') + rect(-0.04, y + 0.06, 0.08, h * 0.25, 0.04, 'fill="url(#g-steel)"');
    if (o.kind === 'counter' && w > 5) deco += rect(x + w * 0.62, y + 0.3, w * 0.12, h * 0.55, 0.04, 'fill="#e9e3d6" stroke="#cfc7b8" stroke-width="0.02"') + ell(x + w * 0.2, y + h * 0.55, 0.25, 0.25, 'fill="#c8ccd0" stroke="#9aa1a6" stroke-width="0.02"');
    return stoneRect(x, y, w, h, 0.04, false) + deco;
  }

  function fridge(o, x, y, w, h) {
    return rect(x, y, w, h, 0.06, 'fill="url(#g-steel)" stroke="#8d9297" stroke-width="0.03"') + line(0, y + 0.05, 0, y + h - 0.05, 'stroke="#8d9297" stroke-width="0.03"') +
      rect(-0.35, y + h - 0.12, 0.25, 0.07, 0.03, 'fill="#9aa0a5"') + rect(0.1, y + h - 0.12, 0.25, 0.07, 0.03, 'fill="#9aa0a5"');
  }

  function range(o, x, y, w, h) {
    let burners = '';
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b], i) => {
      const cx = (a * w) / 4.4, cy = (b * h) / 4.6 - 0.05, r = Math.min(w, h) * (i % 3 ? 0.13 : 0.17);
      burners += ell(cx, cy, r, r, 'fill="#1a1a1b" stroke="#4a4a4c" stroke-width="0.03"') + ell(cx, cy, r * 0.55, r * 0.55, 'fill="none" stroke="#5a5a5c" stroke-width="0.03"') +
        line(cx - r, cy, cx + r, cy, 'stroke="#3a3a3c" stroke-width="0.04"') + line(cx, cy - r, cx, cy + r, 'stroke="#3a3a3c" stroke-width="0.04"');
    });
    let knobs = '';
    for (let k = 0; k < 4; k++) knobs += ell(x + w * (0.2 + k * 0.2), y + h - 0.12, 0.06, 0.06, 'fill="url(#g-steel)"');
    return rect(x, y, w, h, 0.05, 'fill="url(#g-steel)" stroke="#7c8186" stroke-width="0.03"') + rect(x + 0.08, y + 0.06, w - 0.16, h - 0.3, 0.04, 'fill="#202022"') + burners + knobs;
  }

  function toilet(o, x, y, w, h) {
    return rect(x + 0.05, y, w - 0.1, h * 0.3, 0.08, 'fill="url(#g-ceramic)" stroke="#b9b9b5" stroke-width="0.025"') +
      ceramicEll(0, y + h * 0.63, w / 2, h * 0.37) + ell(0, y + h * 0.65, w * 0.36, h * 0.28, 'fill="#f4f4f2" stroke="#c9c9c5" stroke-width="0.02"') +
      ell(0, y + h * 0.67, w * 0.24, h * 0.18, 'fill="#cfe2e8"') + rect(-0.08, y + 0.08, 0.16, 0.06, 0.03, 'fill="url(#g-steel)"');
  }

  function vanity(o, x, y, w, h) {
    const k = o.kind === 'vanity2' ? 2 : 1;
    let basins = '';
    for (let i = 0; i < k; i++) {
      const cx = x + (w * (i + 0.5)) / k;
      basins += ell(cx, y + h * 0.56, Math.min(0.62, w / k / 3), Math.min(0.42, h * 0.3), 'fill="url(#g-basin)" stroke="#b5bbbf" stroke-width="0.03"') + ell(cx, y + h * 0.6, 0.05, 0.05, 'fill="#8a9095"') + rect(cx - 0.04, y + 0.06, 0.08, 0.22, 0.04, 'fill="url(#g-steel)"');
    }
    return stoneRect(x, y, w, h, 0.05, false) + basins;
  }

  function tub(o, x, y, w, h) {
    return rect(x, y, w, h, 0.25, 'fill="url(#g-ceramic)" stroke="#b9b9b5" stroke-width="0.03"') +
      rect(x + 0.25, y + 0.22, w - 0.5, h - 0.44, Math.min(0.9, (h - 0.44) / 2), 'fill="url(#g-basin)" stroke="#c4cacd" stroke-width="0.03"') +
      ell(x + 0.6, 0, 0.07, 0.07, 'fill="#8a9095"') + rect(x + 0.06, -0.12, 0.16, 0.24, 0.05, 'fill="url(#g-steel)"');
  }

  function shower(o, x, y, w, h) {
    return rect(x, y, w, h, 0.02, `fill="${T.use('small-tile')}"`) + rect(x, y, w, h, 0.02, 'fill="url(#g-sheen)"') +
      line(x + 0.04, y + h - 0.04, x + w - 0.04, y + h - 0.04, 'stroke="url(#g-glass)" stroke-width="0.09"') + line(x + w - 0.04, y + 0.04, x + w - 0.04, y + h - 0.04, 'stroke="url(#g-glass)" stroke-width="0.09"') +
      ell(0, 0, 0.12, 0.12, 'fill="#9aa1a6" stroke="#7c8186" stroke-width="0.02"') + ell(x + 0.4, y + 0.4, 0.25, 0.25, 'fill="url(#g-steel)"');
  }

  function washer(o, x, y, w, h) {
    const u = (w - 0.1) / 2;
    let out = '';
    for (let i = 0; i < 2; i++) {
      const ux = x + i * (u + 0.1);
      out += rect(ux, y, u, h, 0.1, 'fill="url(#g-ceramic)" stroke="#bdbdb9" stroke-width="0.03"') + rect(ux + 0.1, y + 0.08, u - 0.2, 0.35, 0.05, 'fill="#e2e3e1"') +
        ell(ux + u / 2, y + h * 0.58, Math.min(u, h) * 0.32, Math.min(u, h) * 0.32, 'fill="#cfd2d3" stroke="#a7abad" stroke-width="0.03"') +
        ell(ux + u / 2, y + h * 0.58, Math.min(u, h) * 0.22, Math.min(u, h) * 0.22, 'fill="#5c646a" opacity=".85"');
    }
    return out;
  }

  /* ---------- work, decor, outdoor, pets ---------- */
  function desk(o, x, y, w, h, c) {
    return woodRect(x, y, w, h, 0.06, c) +
      rect(-0.6, y + h * 0.28, 1.2, 0.85, 0.05, 'fill="#c9ccd1" stroke="#9a9ea3" stroke-width="0.02"') + rect(-0.5, y + h * 0.36, 1.0, 0.45, 0.03, 'fill="#6f7479"') +
      ell(x + w - 0.5, y + 0.45, 0.22, 0.22, 'fill="#2b2b2b"') + ell(x + w - 0.5, y + 0.45, 0.1, 0.1, 'fill="#fff6dc"') +
      ell(x + 0.55, y + h - 0.55, 0.13, 0.13, 'fill="#efebe4" stroke="#c9c2b6" stroke-width="0.03"');
  }

  function officechair(o, x, y, w, h, c) {
    return ell(0, 0, w * 0.48, h * 0.48, 'fill="#1f1f20" opacity=".35"') + layers((f) => ell(0, h * 0.06, w * 0.38, h * 0.36, f), fabricFills(c)) +
      `<path d="M${n(-w * 0.42)} ${n(-h * 0.12)} Q0 ${n(-h * 0.62)} ${n(w * 0.42)} ${n(-h * 0.12)}" fill="none" stroke="${shade(c, -0.3)}" stroke-width="0.2" stroke-linecap="round"/>`;
  }

  function plant(o, x, y, w, h, c) {
    const R = Math.min(w, h) / 2;
    const terracotta = (c || '').toLowerCase() === '#b5653f';
    const pot = terracotta ? ell(0, 0, R * 0.8, R * 0.8, 'fill="url(#g-pot)" stroke="#6e3a22" stroke-width="0.03"') : layers((f) => ell(0, 0, R * 0.8, R * 0.8, f), [`fill="${c}"`, 'fill="url(#g-cushion)"']) + ell(0, 0, R * 0.8, R * 0.8, `fill="none" ${edge(c)}`);
    const big = o.kind === 'plantbig';
    return pot + ell(0, 0, R * 0.62, R * 0.62, 'fill="#3e2d20"') + foliage(o, 0, 0, R * (big ? 1.5 : 1.35), big ? 13 : 11, big);
  }

  function lamp(o, x, y, w, h, c) {
    const r = Math.min(w, h) / 2;
    return ell(0, 0, r * 4.5, r * 4.5, 'fill="url(#g-glow)"') + ell(0.08, 0.12, r, r, 'fill="#000" opacity=".25" filter="url(#f-blur)"') +
      layers((f) => ell(0, 0, r, r, f), fabricFills(c)) + ell(0, 0, r, r, `fill="none" ${edge(c)}`) + ell(0, 0, r * 0.3, r * 0.3, 'fill="#fff4d6"');
  }

  function pouf(o, x, y, w, h, c) {
    let tufts = '';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      tufts += line(0, 0, Math.cos(a) * w * 0.45, Math.sin(a) * h * 0.45, `stroke="${shade(c, -0.25)}" stroke-width="0.025"`);
    }
    return layers((f) => ell(0, 0, w / 2, h / 2, f), fabricFills(c)) + tufts + ell(0, 0, 0.06, 0.06, `fill="${shade(c, -0.35)}"`) + ell(0, 0, w / 2, h / 2, `fill="none" ${edge(c)}`);
  }

  function piano(o, x, y, w, h) {
    return rect(x, y, w, h * 0.72, 0.06, 'fill="#1a1716"') + rect(x, y, w, h * 0.72, 0.06, 'fill="url(#g-sheen)"') +
      rect(x + 0.1, y + h * 0.72, w - 0.2, h * 0.28, 0.02, 'fill="#f7f5f0" stroke="#1a1716" stroke-width="0.03"') +
      Array.from({ length: Math.floor((w - 0.2) / 0.12) }, (_, i) => (i % 7 === 2 || i % 7 === 6 ? '' : rect(x + 0.16 + i * 0.12, y + h * 0.72, 0.07, h * 0.15, 0.01, 'fill="#1a1716"'))).join('');
  }

  function yogamat(o, x, y, w, h, c) {
    return layers((f) => rect(x, y, w, h, 0.1, f), [`fill="${c}"`, `fill="${T.use('o-fabric')}"`, 'fill="url(#g-sheen)"']) + rect(x, y + h - 0.6, w, 0.6, 0.1, `fill="${shade(c, -0.12)}"`);
  }

  function grill(o, x, y, w, h) {
    const bw = w * 0.6;
    let grate = '';
    for (let gx = -bw / 2 + 0.12; gx < bw / 2 - 0.05; gx += 0.12) grate += line(gx, y + 0.18, gx, y + h - 0.18, 'stroke="#5a5a5c" stroke-width="0.03"');
    return rect(x, y + 0.2, w, h - 0.4, 0.05, 'fill="url(#g-steel)" stroke="#7c8186" stroke-width="0.03"') + rect(-bw / 2, y, bw, h, 0.2, 'fill="#1f1f20"') +
      rect(-bw / 2 + 0.08, y + 0.1, bw - 0.16, h - 0.2, 0.15, 'fill="#2c2c2e"') + grate + rect(-0.4, y + h - 0.1, 0.8, 0.08, 0.03, 'fill="#9aa0a5"');
  }

  function patio(o, x, y, w, h, c) {
    const R = (Math.min(w, h) / 2) * 1.7;
    let canopy = '', spokes = '';
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      pts.push(`${n(Math.cos(a) * R)},${n(Math.sin(a) * R)}`);
      spokes += line(0, 0, Math.cos(a) * R, Math.sin(a) * R, 'stroke="#000" stroke-opacity=".12" stroke-width="0.03"');
    }
    canopy = `<polygon points="${pts.join(' ')}" fill="#efe8dc" opacity=".92" stroke="#cfc6b6" stroke-width="0.03"/><polygon points="${pts.join(' ')}" fill="${T.use('o-fabric')}"/>`;
    return layers((f) => ell(0, 0, w / 2, h / 2, f), woodFills(c)) + canopy + spokes + ell(0, 0, 0.1, 0.1, 'fill="#8a8f94"');
  }

  function lounger(o, x, y, w, h, c) {
    let slats = '';
    for (let sy = y + 0.1; sy < y + h - 0.1; sy += 0.22) slats += rect(x + 0.04, sy, w - 0.08, 0.15, 0.02, 'fill="#a07850"');
    return rect(x, y, w, h, 0.08, 'fill="#7c5a3a"') + slats + fabricRect(x + 0.12, y + 0.15, w - 0.24, h - 0.3, 0.15, c) + line(x + 0.12, y + h * 0.3, x + w - 0.12, y + h * 0.3, `stroke="${shade(c, -0.2)}" stroke-width="0.04"`);
  }

  function hammock(o, x, y, w, h, c) {
    return line(0, y, 0, y + 0.8, 'stroke="#8a7a62" stroke-width="0.04"') + line(0, y + h - 0.8, 0, y + h, 'stroke="#8a7a62" stroke-width="0.04"') +
      layers((f) => ell(0, 0, w / 2, h / 2 - 0.7, f), fabricFills(c)) +
      Array.from({ length: 4 }, (_, i) => line(-w / 2 + 0.2 + i * (w - 0.4) / 3, -h / 2 + 1.2, -w / 2 + 0.2 + i * (w - 0.4) / 3, h / 2 - 1.2, `stroke="${shade(c, -0.25)}" stroke-width="0.05"`)).join('');
  }

  function planter(o, x, y, w, h, c) {
    let leaves = '';
    const r = rngFor(o.id);
    for (let px = x + 0.4; px < x + w - 0.3; px += 0.55) leaves += ell(px + r() * 0.1, 0, 0.32, 0.3, `fill="url(#${r() > 0.5 ? 'g-leaf' : 'g-leaf2'})"`);
    return woodRect(x, y, w, h, 0.05, c) + rect(x + 0.1, y + 0.1, w - 0.2, h - 0.2, 0.03, 'fill="#3e2d20"') + leaves;
  }

  function dogbed(o, x, y, w, h, c) {
    return layers((f) => ell(0, 0, w / 2, h / 2, f), fabricFills(shade(c, -0.1))) + ell(0, 0, w / 2, h / 2, `fill="none" ${edge(c)}`) +
      layers((f) => ell(0, h * 0.04, w * 0.36, h * 0.33, f), fabricFills(shade(c, 0.3)));
  }

  function crate(o, x, y, w, h) {
    let grid = '';
    for (let gx = x + 0.25; gx < x + w - 0.1; gx += 0.25) grid += line(gx, y, gx, y + h, 'stroke="#4a4a4c" stroke-width="0.025"');
    return fabricRect(x + 0.08, y + 0.08, w - 0.16, h - 0.16, 0.08, '#a39e97') + grid + rect(x, y, w, h, 0.05, 'fill="none" stroke="#2a2a2b" stroke-width="0.07"');
  }

  function bowls(o, x, y, w, h) {
    const r = Math.min(w / 4, h / 2) * 0.95;
    let kib = '';
    const rr = rngFor(o.id);
    for (let i = 0; i < 10; i++) kib += ell(-w / 4 + (rr() - 0.5) * r, (rr() - 0.5) * r, 0.04, 0.035, 'fill="#8a5a3b"');
    return rect(x, y, w, h, 0.2, 'fill="#e9e4da" stroke="#cfc8bc" stroke-width="0.02"') +
      ell(-w / 4, 0, r, r, 'fill="url(#g-steel)"') + ell(-w / 4, 0, r * 0.7, r * 0.7, 'fill="#a6abb0"') + kib +
      ell(w / 4, 0, r, r, 'fill="url(#g-steel)"') + ell(w / 4, 0, r * 0.7, r * 0.7, 'fill="#bcd6df"');
  }

  function cattree(o, x, y, w, h, c) {
    return layers((f) => rect(x, y, w, h, 0.15, f), fabricFills(c)) + layers((f) => ell(w * 0.15, -h * 0.15, w * 0.3, h * 0.3, f), fabricFills(shade(c, 0.15))) + ell(-w * 0.25, h * 0.25, 0.12, 0.12, 'fill="#c8a97a"');
  }

  function chair(o, x, y, w, h, c) {
    return woodRect(x, y + 0.18, w, h - 0.18, 0.06, c) + woodRect(x, y, w, 0.22, 0.06, shade(c, -0.15));
  }

  function barcart(o, x, y, w, h, c) {
    let bottles = '';
    [['#3d5a3a', 0.12], ['#8a2f2a', 0.1], ['#e9e4da', 0.09], ['#c9a23a', 0.11]].forEach(([col, r], i) => (bottles += ell(x + 0.35 + i * (w - 0.6) / 3, i % 2 ? -0.1 : 0.1, r, r, `fill="${col}" stroke="#000" stroke-opacity=".2" stroke-width="0.015"`)));
    return rect(x, y, w, h, 0.05, 'fill="#d9e8ec" opacity=".55"') + rect(x, y, w, h, 0.05, `fill="none" stroke="${c}" stroke-width="0.08"`) + bottles;
  }

  function stairs(o, x, y, w, h, c) {
    let out = woodRect(x, y, w, h, 0.02, c);
    for (let ty = y + 0.85; ty < y + h - 0.1; ty += 0.85) out += rect(x, ty - 0.08, w, 0.08, 0, 'fill="#000" opacity=".22"') + line(x, ty, x + w, ty, 'stroke="#fff" stroke-opacity=".25" stroke-width="0.03"');
    return out;
  }

  function door(o, x, y, w, h, c) {
    return rect(x - 0.02, y + h - 0.26, w + 0.04, 0.52, 0, 'fill="#e9e3d8"') +
      `<path d="M${n(x + w)} ${n(y + h)} A${n(w)} ${n(h)} 0 0 0 ${n(x)} ${n(y)}" fill="none" stroke="#6f665d" stroke-opacity=".45" stroke-width="0.03" stroke-dasharray="0.15 0.12"/>` +
      woodRect(x, y, 0.15, h, 0.02, c);
  }

  function windowPane(o, x, y, w, h) {
    return rect(x, y, w, h, 0.02, 'fill="#f6f6f4" stroke="#8f8a83" stroke-width="0.03"') + rect(x + 0.08, y + h * 0.25, w - 0.16, h * 0.5, 0, 'fill="url(#g-glass)"') + line(0, y, 0, y + h, 'stroke="#8f8a83" stroke-width="0.03"');
  }

  /* ---------- dispatch ---------- */
  const RENDER = {
    sofa, loveseat: sofa, sectional, armchair,
    king: bed, queen: bed, full: bed, crib: bed,
    table4: table, table6: table, roundtable: table, coffee,
    tv: storage, nightstand: storage, dresser: storage, bookshelf: storage, wardrobe: storage, closet: storage,
    counter, island: counter, sink: counter, fridge, range, toilet, vanity, vanity2: vanity, tub, shower, washer,
    desk, officechair, plant, plantbig: plant, floorlamp: lamp, pouf, piano, yogamat,
    grill, patiotable: patio, lounger, hammock, planter,
    dogbed, crate, bowls, cattree, chair, barcart, stairs, door, window: windowPane,
    rug, rugsm: rug, rugstripe: rug, rugshag: rug, rugjute: rug, runner: rug,
  };

  /** Shadow filter for a piece: rugs & openings sit flat, everything else casts a soft shadow. */
  function shadowFor(o) {
    const c = GG.data.furnitureByKind[o.kind] || {};
    if (c.layer === 3 || o.kind === 'floorlamp') return '';
    return c.layer === 0 ? 'url(#f-shadow-low)' : 'url(#f-shadow)';
  }

  function item(o, warn = false) {
    const c = GG.data.furnitureByKind[o.kind] || {};
    const w = o.w, h = o.h, x = -w / 2, y = -h / 2;
    const color = o.color || c.color || '#cccccc';
    const fn = RENDER[o.kind] || ((oo, xx, yy, ww, hh, cc) => (c.mat === 'fabric' ? fabricRect(xx, yy, ww, hh, 0.15, cc) : woodRect(xx, yy, ww, hh, 0.06, cc)));
    let out = fn(o, x, y, w, h, color);
    if (warn) out += rect(x - 0.05, y - 0.05, w + 0.1, h + 0.1, 0.1, 'fill="#d64545" fill-opacity=".12" stroke="#d64545" stroke-width="0.08" stroke-dasharray="0.25 0.15"');
    return out;
  }

  GG.render = { item, shadowFor, shade };
})(window.GG);
