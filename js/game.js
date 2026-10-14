/* Gougou House — the decorating game. Everything is stored in feet; SVG user units = feet. */
(function (GG) {
  const { esc, uid, clamp, len, area, toUnit, fromUnit, toast } = GG.util;
  const D = GG.data;
  const SNAP = 0.25;
  const snap = (v, step = SNAP) => Math.round(v / step) * step;
  const r2 = (v) => Math.round(v * 100) / 100;

  const TABS = [
    ['Rooms', '🚪'], ['Living', '🛋️'], ['Bedroom', '🛏️'], ['Dining', '🍽️'], ['Kitchen', '🍳'],
    ['Bath', '🛁'], ['Work', '💻'], ['Outdoor', '🌳'], ['Pets', '🐶'], ['Structure', '🧱'],
  ];
  const ROOM_SIZES = { Closet: [6, 4], Bathroom: [8, 7], Hallway: [4, 12], Balcony: [12, 5], Laundry: [6, 6], Yard: [30, 15], Kitchen: [12, 10] };
  const ITEM_COLORS = ['#c9b79c', '#e3dccf', '#a68a6d', '#5e5246', '#e8a868', '#d9825b', '#f2a5a0', '#8aa38b', '#5d8ca3', '#b9aed3', '#ffffff', '#3b3330'];
  const ROOM_COLORS = ['#f6e7d7', '#e8efe1', '#f8e5e0', '#e6e9f4', '#dff0f2', '#f3ecd9', '#efedea', '#eadff2', '#fde9c9', '#dcebd3'];

  const ui = { sel: null, view: null, viewPlan: null, drag: null, svg: null, root: null, cat: 'Living', raf: 0, hist: null, tile: null };

  const S = () => GG.store.state;
  const plan = () => S().plans.find((p) => p.id === S().activePlan) || S().plans[0];
  const find = (id) => id && (plan().rooms.find((r) => r.id === id) || plan().items.find((i) => i.id === id));
  const isRoom = (o) => !o.kind;
  const cat = (o) => D.furnitureByKind[o.kind] || {};
  /** footprint on the plan (items rotated by 90/270 swap width & depth) */
  const foot = (o) => (isRoom(o) || o.rot % 180 === 0 ? { w: o.w, h: o.h } : { w: o.h, h: o.w });

  /* ================================================================== */
  /* Undo / redo                                                        */
  /* ================================================================== */
  const snapshot = () => JSON.stringify({ rooms: plan().rooms, items: plan().items });

  function resetHistory() {
    ui.hist = { past: [], future: [], last: snapshot(), plan: plan().id };
    updateUndo();
  }

  /** Record the current plan as one undo step, save, and let Gougou re-map the rooms. */
  function commit() {
    if (!ui.hist || ui.hist.plan !== plan().id) resetHistory();
    const now = snapshot();
    if (now === ui.hist.last) return;
    ui.hist.past.push(ui.hist.last);
    if (ui.hist.past.length > 200) ui.hist.past.shift();
    ui.hist.future = [];
    ui.hist.last = now;
    GG.store.save();
    GG.dog.invalidate();
    updateUndo();
    renderHud();
  }

  function restore(json) {
    const d = JSON.parse(json);
    plan().rooms = d.rooms;
    plan().items = d.items;
    ui.hist.last = json;
    if (ui.sel && !find(ui.sel)) ui.sel = null;
    GG.store.save();
    GG.dog.invalidate();
    refresh();
    updateUndo();
  }

  const undo = () => {
    if (!ui.hist.past.length) return;
    ui.hist.future.push(ui.hist.last);
    restore(ui.hist.past.pop());
  };
  const redo = () => {
    if (!ui.hist.future.length) return;
    ui.hist.past.push(ui.hist.last);
    restore(ui.hist.future.pop());
  };

  function updateUndo() {
    if (!ui.root) return;
    const u = ui.root.querySelector('[data-act="undo"]'), r = ui.root.querySelector('[data-act="redo"]');
    if (u) u.disabled = !ui.hist.past.length;
    if (r) r.disabled = !ui.hist.future.length;
  }

  /* ================================================================== */
  /* Layout                                                             */
  /* ================================================================== */

  function render(root) {
    ui.root = root;
    const s = S();
    const p = plan();
    if (ui.sel && !find(ui.sel)) ui.sel = null;
    if (!ui.hist || ui.hist.plan !== p.id) resetHistory();

    root.innerHTML = `
      <div class="game">
        <header class="bar">
          <span class="brand">${GG.util.mascot(34)}<span class="brand-name">Gougou<span> House</span></span></span>
          <div class="plan-pick">
            <select id="plan-select" data-act="plan" aria-label="Design">
              ${s.plans.map((x) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
            </select>
            <button class="icon-btn" data-act="new-plan" title="New space">＋</button>
            <button class="icon-btn" data-act="plan-menu" title="Rename, copy, share or delete this design">⋯</button>
          </div>
          <span class="grow"></span>
          <div class="tools">
            <button class="icon-btn" data-act="undo" title="Undo (Ctrl+Z)">↶</button>
            <button class="icon-btn" data-act="redo" title="Redo (Ctrl+Shift+Z)">↷</button>
            <button class="btn sm ${s.dog ? 'on' : 'ghost'}" data-act="dog" title="Show or hide Gougou">🐶 <span>Gougou</span></button>
            <button class="btn sm ghost" data-act="export-png" title="Save a picture of this design">📸 <span>Picture</span></button>
            <button class="icon-btn" data-act="settings" title="Settings & backup">⚙️</button>
          </div>
        </header>

        <div class="game-body">
          <aside class="shelf">
            <nav class="shelf-tabs">
              ${TABS.map(([g, e]) => `<button class="${ui.cat === g ? 'on' : ''}" data-cat="${g}" title="${g}"><span class="t-emoji">${e}</span><span class="t-label">${g}</span></button>`).join('')}
            </nav>
            <div class="shelf-grid">
              ${ui.cat === 'Rooms' ? D.roomTypes.map(roomTile).join('') : D.furniture.filter((f) => f.group === ui.cat).map(itemTile).join('')}
            </div>
            <p class="shelf-hint">Drag onto the plan — or tap to drop it in the middle.</p>
          </aside>

          <div class="stage">
            <svg id="pl-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"></svg>
            <div class="hud top-left" id="hud"></div>
            <div class="hud bottom-left">
              <button class="icon-btn" data-act="zoom-out" title="Zoom out">−</button>
              <button class="btn sm" data-act="fit" title="Fit to screen">Fit</button>
              <button class="icon-btn" data-act="zoom-in" title="Zoom in">＋</button>
              <span class="seg small">
                <button class="${s.unit === 'ft' ? 'on' : ''}" data-unit="ft">ft</button>
                <button class="${s.unit === 'm' ? 'on' : ''}" data-unit="m">m</button>
              </span>
            </div>
            <div class="empty-stage" id="empty-stage" hidden>
              ${GG.util.mascot(84)}
              <p><b>An empty lot!</b><br>Open the <b>🚪 Rooms</b> shelf and drag in a living room to start building.</p>
            </div>
            <div class="inspector" id="inspector" hidden></div>
          </div>
        </div>
      </div>`;

    ui.svg = root.querySelector('#pl-svg');
    bindSvg(ui.svg);
    bindUi(root);
    if (!ui.view || ui.viewPlan !== p.id) fit();
    else applyView();
    refresh();
    updateUndo();
  }

  function itemTile(f) {
    const pad = 0.6;
    return `<button class="tile" data-add="${f.kind}" title="${esc(f.name)} · ${len(f.w)} × ${len(f.h)}">
      <svg viewBox="${-f.w / 2 - pad} ${-f.h / 2 - pad} ${f.w + 2 * pad} ${f.h + 2 * pad}" preserveAspectRatio="xMidYMid meet">${shape({ ...f, rot: 0 }, false)}</svg>
      <span>${esc(f.name)}</span>
      <small>${len(f.w)} × ${len(f.h)}</small>
    </button>`;
  }

  function roomTile(r, i) {
    const [w, h] = ROOM_SIZES[r.name] || [12, 12];
    const k = 40 / Math.max(w, h);
    return `<button class="tile" data-room="${i}" title="${esc(r.name)} · ${len(w)} × ${len(h)}">
      <svg viewBox="-2 -2 44 44"><rect x="${(40 - w * k) / 2}" y="${(40 - h * k) / 2}" width="${w * k}" height="${h * k}" fill="${r.color}" stroke="${r.outdoor ? '#7c8b5a' : '#3b3330'}" stroke-width="2.4" ${r.outdoor ? 'stroke-dasharray="4 3"' : ''}/></svg>
      <span>${esc(r.name)}</span>
      <small>${len(w)} × ${len(h)}</small>
    </button>`;
  }

  /* ================================================================== */
  /* Drawing                                                            */
  /* ================================================================== */

  /** SVG for an item in local coordinates, centered on 0,0 (unrotated). */
  function shape(o, warn) {
    const c = cat(o);
    const w = o.w, h = o.h, x = -w / 2, y = -h / 2;
    const stroke = warn ? '#d64545' : '#5e5246';
    const sw = warn ? 0.12 : 0.06;
    const fill = o.color || c.color || '#ddd';
    const base = `fill="${fill}" stroke="${stroke}" stroke-width="${sw}"`;
    switch (c.shape) {
      case 'round':
        return `<ellipse cx="0" cy="0" rx="${w / 2}" ry="${h / 2}" ${base}/>`;
      case 'rug':
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="0.3" fill="${fill}" opacity="0.75" stroke="${stroke}" stroke-width="0.04" stroke-dasharray="0.25 0.18"/>
                <rect x="${x + 0.35}" y="${y + 0.35}" width="${Math.max(0, w - 0.7)}" height="${Math.max(0, h - 0.7)}" rx="0.2" fill="none" stroke="${stroke}" stroke-opacity=".25" stroke-width="0.04"/>`;
      case 'door':
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent"/>
                <path d="M${x + w} ${y + h} A${w} ${h} 0 0 0 ${x} ${y}" fill="#fffdf9" fill-opacity=".6" stroke="${stroke}" stroke-width="0.04" stroke-dasharray="0.2 0.15"/>
                <line x1="${x}" y1="${y + h}" x2="${x}" y2="${y}" stroke="${stroke}" stroke-width="0.12"/>
                <line x1="${x}" y1="${y + h}" x2="${x + w}" y2="${y + h}" stroke="#fffdf9" stroke-width="0.4"/>`;
      case 'window':
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="0.06"/>
                <line x1="${x}" y1="0" x2="${x + w}" y2="0" stroke="${stroke}" stroke-width="0.04"/>`;
      case 'lshape': {
        const d = Math.min(3, w / 2, h / 2);
        return `<path d="M${x} ${y} H${x + w} V${y + d} H${x + d} V${y + h} H${x} Z" ${base} stroke-linejoin="round"/>
                <path d="M${x + 0.6} ${y + h - 0.2} V${y + 0.6} H${x + w - 0.2}" fill="none" stroke="${stroke}" stroke-opacity=".3" stroke-width="0.05"/>`;
      }
      case 'stairs': {
        let lines = '';
        for (let yy = y + 0.85; yy < y + h - 0.1; yy += 0.85) lines += `<line x1="${x}" y1="${yy}" x2="${x + w}" y2="${yy}" stroke="${stroke}" stroke-width="0.04"/>`;
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${base}/>${lines}
                <path d="M0 ${y + h - 0.6} V${y + 0.6} m-0.4 0.5 l0.4 -0.5 l0.4 0.5" fill="none" stroke="${stroke}" stroke-width="0.07"/>`;
      }
      case 'tub':
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="0.25" ${base}/>
                <rect x="${x + 0.3}" y="${y + 0.3}" width="${w - 0.6}" height="${h - 0.6}" rx="${Math.min(1, (h - 0.6) / 2)}" fill="#dff0f2" stroke="${stroke}" stroke-width="0.04"/>`;
    }
    let detail = '';
    if (['king', 'queen', 'full', 'crib'].includes(o.kind) && h > 3) {
      const pw = w > 4.5 ? (w - 0.9) / 2 : w - 0.6;
      detail = `<rect x="${x + 0.3}" y="${y + 0.3}" width="${pw}" height="1.1" rx="0.3" fill="#fff" stroke="${stroke}" stroke-width="0.04"/>
        ${w > 4.5 ? `<rect x="${x + 0.6 + pw}" y="${y + 0.3}" width="${pw}" height="1.1" rx="0.3" fill="#fff" stroke="${stroke}" stroke-width="0.04"/>` : ''}
        <line x1="${x}" y1="${y + 1.9}" x2="${x + w}" y2="${y + 1.9}" stroke="${stroke}" stroke-opacity=".35" stroke-width="0.05"/>`;
    } else if (['sofa', 'loveseat', 'armchair'].includes(o.kind)) {
      const back = Math.min(0.75, h * 0.28), arm = Math.min(0.6, w * 0.18);
      detail = `<path d="M${x} ${y + back} H${x + w} M${x + arm} ${y + back} V${y + h} M${x + w - arm} ${y + back} V${y + h}" fill="none" stroke="${stroke}" stroke-opacity=".45" stroke-width="0.05"/>`;
    } else if (o.kind === 'range') {
      detail = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => `<circle cx="${(a * w) / 4.5}" cy="${(b * h) / 4.5}" r="${Math.min(w, h) / 6}" fill="none" stroke="#fff" stroke-width="0.05"/>`).join('');
    } else if (o.kind === 'sink' || o.kind === 'vanity' || o.kind === 'vanity2') {
      const n = o.kind === 'vanity2' ? 2 : 1;
      detail = Array.from({ length: n }, (_, i) => `<ellipse cx="${x + (w * (i + 0.5)) / n}" cy="0" rx="${Math.min(0.75, w / n / 3)}" ry="${Math.min(0.55, h / 3)}" fill="#fff" stroke="${stroke}" stroke-width="0.04"/>`).join('');
    } else if (o.kind === 'toilet') {
      return `<rect x="${x}" y="${y}" width="${w}" height="${h * 0.32}" rx="0.1" ${base}/><ellipse cx="0" cy="${y + h * 0.64}" rx="${w / 2}" ry="${h * 0.34}" ${base}/>`;
    }
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(0.2, w / 4, h / 4)}" ${base}/>${detail}`;
  }

  /** Items that physically overlap (rugs, doors & windows excluded). */
  function overlaps(p) {
    const solid = p.items.filter((i) => ![0, 3].includes(cat(i).layer ?? 1));
    const bad = new Set();
    const eps = 0.05;
    for (let a = 0; a < solid.length; a++) {
      const A = solid[a], fa = foot(A);
      for (let b = a + 1; b < solid.length; b++) {
        const B = solid[b], fb = foot(B);
        if (A.x + eps < B.x + fb.w && B.x + eps < A.x + fa.w && A.y + eps < B.y + fb.h && B.y + eps < A.y + fa.h) {
          bad.add(A.id);
          bad.add(B.id);
        }
      }
    }
    return bad;
  }

  /** True for fills dark enough that labels should be light. */
  function isDark(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return false;
    const n = parseInt(m[1], 16);
    return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255) < 120;
  }

  /** Room name + size, placed in whichever corner/edge of the room is least covered by furniture. */
  function roomLabel(r, items) {
    const fs = Math.max(0.3, Math.min(clamp(Math.min(r.w, r.h) / 9, 0.45, 0.85), (r.w - 0.9) / (r.name.length * 0.6)));
    const dims = `${len(r.w)} × ${len(r.h)} · ${area(r.w * r.h)}`;
    const bw = Math.max(r.name.length * fs * 0.6, dims.length * fs * 0.68 * 0.52) + 0.3;
    const bh = fs * 2.3 + 0.2;
    const m = 0.45;
    const L = r.x + m, R = r.x + r.w - bw - m, T = r.y + m, B = r.y + r.h - bh - m;
    const CX = r.x + (r.w - bw) / 2, CY = r.y + (r.h - bh) / 2;
    const spots = bw + 2 * m > r.w || bh + 2 * m > r.h ? [[L, T]] : [[L, T], [R, T], [L, B], [R, B], [CX, T], [CX, B], [L, CY], [R, CY], [CX, CY]];
    let best = spots[0], bestCost = Infinity;
    spots.forEach(([x, y], i) => {
      let cost = i * 0.01; // prefer top-left when tied
      items.forEach((o) => {
        const f = foot(o);
        const ox = Math.max(0, Math.min(x + bw, o.x + f.w) - Math.max(x, o.x));
        const oy = Math.max(0, Math.min(y + bh, o.y + f.h) - Math.max(y, o.y));
        const layer = cat(o).layer ?? 1;
        cost += ox * oy * (layer === 1 ? 1 : 0.15); // rugs, doors & windows matter less
      });
      if (cost < bestCost) [best, bestCost] = [[x, y], cost];
    });
    const [x, y] = best;
    return `<text x="${r2(x + 0.1)}" y="${r2(y + fs)}" font-size="${r2(fs)}" font-weight="700" fill="#3b3330" paint-order="stroke" stroke="#fffdf9" stroke-width="${r2(fs * 0.22)}" stroke-linejoin="round">${esc(r.name)}</text>
      <text x="${r2(x + 0.1)}" y="${r2(y + 0.2 + fs * 1.95)}" font-size="${r2(fs * 0.68)}" fill="#6f665d" paint-order="stroke" stroke="#fffdf9" stroke-width="${r2(fs * 0.18)}">${dims}</text>`;
  }

  function markup(p, { exporting = false } = {}) {
    const bad = overlaps(p);
    const items = [...p.items].sort((a, b) => (cat(a).layer ?? 1) - (cat(b).layer ?? 1));
    let out = '';
    if (!exporting) {
      out += `<defs>
        <pattern id="g1" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="#ece5da" stroke-width="0.03"/></pattern>
        <pattern id="g5" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="url(#g1)"/><path d="M5 0H0V5" fill="none" stroke="#dcd2c4" stroke-width="0.06"/></pattern>
      </defs>
      <rect x="-1000" y="-1000" width="2000" height="2000" fill="url(#g5)"/>`;
    }
    out += p.rooms
      .map((r) => `<g data-id="${r.id}" class="el room ${r.id === ui.dropId ? 'pop' : ''}">
        <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.color}" ${r.outdoor ? 'fill-opacity=".8"' : ''}
          stroke="${r.outdoor ? '#7c8b5a' : '#3b3330'}" stroke-width="${r.outdoor ? 0.15 : 0.35}" ${r.outdoor ? 'stroke-dasharray="0.6 0.4"' : ''} stroke-linejoin="miter"/>
      </g>`)
      .join('');
    out += items
      .map((o) => {
        const f = foot(o);
        const cx = o.x + f.w / 2, cy = o.y + f.h / 2;
        return `<g data-id="${o.id}" class="el item" transform="translate(${r2(cx)} ${r2(cy)}) rotate(${o.rot || 0})"><g class="${o.id === ui.dropId ? 'pop' : ''}">${shape(o, bad.has(o.id))}</g></g>`;
      })
      .join('');
    out += `<g pointer-events="none" font-family="ui-sans-serif, system-ui, Helvetica, Arial, sans-serif">`;
    out += items
      .map((o) => {
        const c = cat(o);
        if (['door', 'window'].includes(c.shape)) return '';
        const f = foot(o);
        const fs = Math.min(0.55, (f.w * 1.7) / Math.max(o.name.length, 3), f.h * 0.42);
        if (fs < 0.22) return '';
        const ink = isDark(o.color || c.color) ? '#fffdf9' : '#3b3330';
        // rugs sit under other furniture: label them along their bottom edge, and skip it if that's covered too
        const ty = c.shape === 'rug' && f.h > 2 ? o.y + f.h - 0.5 : o.y + f.h / 2 + fs * 0.35;
        const lx = o.x + f.w / 2;
        if (c.shape === 'rug' && items.some((q) => q !== o && (cat(q).layer ?? 1) === 1 && lx > q.x && lx < q.x + foot(q).w && ty > q.y - 0.3 && ty < q.y + foot(q).h + 0.3)) return '';
        return `<text x="${r2(o.x + f.w / 2)}" y="${r2(ty)}" font-size="${r2(fs)}" text-anchor="middle" fill="${ink}" fill-opacity=".9">${esc(o.name)}</text>`;
      })
      .join('');
    out += p.rooms.map((r) => roomLabel(r, p.items)).join('');
    out += `</g>`;
    if (exporting) return out;

    out += GG.dog.markup();
    const sel = find(ui.sel);
    if (sel) {
      const f = foot(sel);
      const upp = unitsPerPx();
      const pad = 0.15;
      out += `<rect x="${sel.x - pad}" y="${sel.y - pad}" width="${f.w + 2 * pad}" height="${f.h + 2 * pad}" fill="none" stroke="#d9825b" stroke-width="${upp * 2}" stroke-dasharray="${upp * 6} ${upp * 4}" pointer-events="none"/>
        <circle data-handle="1" cx="${sel.x + f.w}" cy="${sel.y + f.h}" r="${upp * 9}" fill="#d9825b" stroke="#fff" stroke-width="${upp * 2.5}" style="cursor:nwse-resize"/>
        <text x="${sel.x + f.w / 2}" y="${sel.y - pad - upp * 8}" font-size="${upp * 13}" text-anchor="middle" fill="#d9825b" font-weight="700" pointer-events="none" font-family="ui-sans-serif, system-ui, sans-serif" paint-order="stroke" stroke="#fffdf9" stroke-width="${upp * 3}">${len(f.w)} × ${len(f.h)}</text>`;
    }
    return out;
  }

  function draw() {
    if (ui.svg) ui.svg.innerHTML = markup(plan());
  }
  const drawSoon = () => {
    if (ui.raf) return;
    ui.raf = requestAnimationFrame(() => {
      ui.raf = 0;
      draw();
    });
  };

  function refresh() {
    draw();
    renderInspector();
    renderHud();
  }

  /* ================================================================== */
  /* View (zoom / pan)                                                  */
  /* ================================================================== */

  function bounds(p, pad = 3) {
    const els = [...p.rooms, ...p.items];
    if (!els.length) return { x: -2, y: -2, w: 34, h: 26 };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    els.forEach((o) => {
      const f = foot(o);
      x0 = Math.min(x0, o.x); y0 = Math.min(y0, o.y);
      x1 = Math.max(x1, o.x + f.w); y1 = Math.max(y1, o.y + f.h);
    });
    return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
  }

  function fit() {
    const b = bounds(plan());
    const rect = ui.svg.getBoundingClientRect();
    const aspect = rect.width && rect.height ? rect.width / rect.height : 1.4;
    let { x, y, w, h } = b;
    if (w / h < aspect) {
      const nw = h * aspect;
      x -= (nw - w) / 2;
      w = nw;
    } else {
      const nh = w / aspect;
      y -= (nh - h) / 2;
      h = nh;
    }
    ui.view = { x, y, w, h };
    ui.viewPlan = plan().id;
    applyView();
  }

  function applyView() {
    const v = ui.view;
    ui.svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
  }

  function unitsPerPx() {
    const ctm = ui.svg && ui.svg.getScreenCTM();
    return ctm && ctm.a ? 1 / ctm.a : 0.05;
  }

  function zoom(factor, cx, cy) {
    const v = ui.view;
    if (cx === undefined) {
      cx = v.x + v.w / 2;
      cy = v.y + v.h / 2;
    }
    const nw = clamp(v.w * factor, 6, 400);
    const k = nw / v.w;
    ui.view = { x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, w: v.w * k, h: v.h * k };
    applyView();
    draw();
  }

  function toPlan(e) {
    const pt = ui.svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(ui.svg.getScreenCTM().inverse());
  }

  const overSvg = (e) => {
    const r = ui.svg.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  };

  /* ================================================================== */
  /* Editing                                                            */
  /* ================================================================== */

  function setFoot(o, fw, fh) {
    if (isRoom(o) || o.rot % 180 === 0) {
      o.w = fw;
      o.h = fh;
    } else {
      o.w = fh;
      o.h = fw;
    }
  }

  function makeItem(kind) {
    const c = D.furnitureByKind[kind];
    return { id: uid('i'), kind, name: c.name, w: c.w, h: c.h, rot: 0, color: c.color };
  }

  function makeRoom(i) {
    const t = D.roomTypes[i];
    const [w, h] = ROOM_SIZES[t.name] || [12, 12];
    const count = plan().rooms.filter((r) => r.name.startsWith(t.name)).length;
    return { id: uid('r'), name: count ? `${t.name} ${count + 1}` : t.name, w, h, color: t.color, outdoor: !!t.outdoor };
  }

  /** Something new landed on the plan: select it, celebrate, record it. */
  function placed(o) {
    ui.sel = o.id;
    ui.dropId = o.id;
    setTimeout(() => (ui.dropId = null), 400);
    commit();
    refresh();
    const f = foot(o);
    if (isRoom(o)) GG.dog.reactRoom();
    else {
      GG.dog.reactAdd(o);
      GG.dog.visit(o.x + f.w / 2, o.y + f.h + 1);
    }
  }

  function dropAtCenter(o) {
    const v = ui.view;
    const f = foot(o);
    const step = isRoom(o) ? 0.5 : SNAP;
    o.x = snap(v.x + v.w / 2 - f.w / 2, step);
    o.y = snap(v.y + v.h / 2 - f.h / 2, step);
    (isRoom(o) ? plan().rooms : plan().items).push(o);
    placed(o);
  }

  function rotate(o) {
    if (!o || isRoom(o)) return;
    const before = foot(o);
    const cx = o.x + before.w / 2, cy = o.y + before.h / 2;
    o.rot = ((o.rot || 0) + 90) % 360;
    const after = foot(o);
    o.x = snap(cx - after.w / 2);
    o.y = snap(cy - after.h / 2);
    commit();
    refresh();
  }

  function duplicate(o) {
    if (!o) return;
    const copy = { ...o, id: uid(isRoom(o) ? 'r' : 'i'), x: o.x + 1, y: o.y + 1 };
    (isRoom(o) ? plan().rooms : plan().items).push(copy);
    placed(copy);
  }

  function remove(o) {
    if (!o) return;
    const p = plan();
    p.rooms = p.rooms.filter((r) => r.id !== o.id);
    p.items = p.items.filter((i) => i.id !== o.id);
    ui.sel = null;
    commit();
    refresh();
    GG.dog.reactRemove(o);
  }

  /* ================================================================== */
  /* Pointer: plan canvas                                               */
  /* ================================================================== */

  function bindSvg(svg) {
    svg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('[data-dog]')) return GG.dog.poke();
      const pt = toPlan(e);
      const handle = e.target.closest('[data-handle]');
      const el = e.target.closest('[data-id]');
      if (handle && find(ui.sel)) {
        const o = find(ui.sel);
        ui.drag = { mode: 'resize', start: pt, orig: { ...foot(o) }, o };
      } else if (el) {
        const o = find(el.dataset.id);
        ui.sel = o.id;
        // rooms carry the furniture inside them, unless Alt is held
        const carry = isRoom(o) && !e.altKey
          ? plan().items.filter((i) => {
              const f = foot(i), cx = i.x + f.w / 2, cy = i.y + f.h / 2;
              return cx > o.x && cx < o.x + o.w && cy > o.y && cy < o.y + o.h;
            }).map((i) => ({ i, x: i.x, y: i.y }))
          : [];
        ui.drag = { mode: 'move', start: pt, orig: { x: o.x, y: o.y }, o, carry };
      } else {
        ui.sel = null;
        ui.drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, orig: { ...ui.view }, upp: unitsPerPx() };
        svg.classList.add('panning');
      }
      svg.setPointerCapture(e.pointerId);
      draw();
      renderInspector();
    });

    svg.addEventListener('pointermove', (e) => {
      const d = ui.drag;
      if (!d) return;
      d.moved = true;
      if (d.mode === 'pan') {
        ui.view = { ...d.orig, x: d.orig.x - (e.clientX - d.sx) * d.upp, y: d.orig.y - (e.clientY - d.sy) * d.upp };
        return applyView();
      }
      const pt = toPlan(e);
      const dx = pt.x - d.start.x, dy = pt.y - d.start.y;
      const step = e.shiftKey ? 1 : isRoom(d.o) ? 0.5 : SNAP;
      if (d.mode === 'move') {
        d.o.x = snap(d.orig.x + dx, step);
        d.o.y = snap(d.orig.y + dy, step);
        const mx = d.o.x - d.orig.x, my = d.o.y - d.orig.y;
        d.carry.forEach((c) => {
          c.i.x = r2(c.x + mx);
          c.i.y = r2(c.y + my);
        });
      } else {
        setFoot(d.o, Math.max(0.5, snap(d.orig.w + dx, step)), Math.max(0.5, snap(d.orig.h + dy, step)));
      }
      drawSoon();
      renderInspectorLive();
    });

    const end = () => {
      if (!ui.drag) return;
      const moved = ui.drag.moved && ui.drag.mode !== 'pan';
      ui.drag = null;
      svg.classList.remove('panning');
      if (moved) {
        commit();
        renderInspector();
      }
      draw();
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);

    svg.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const pt = toPlan(e);
        zoom(Math.exp(e.deltaY * 0.0015), pt.x, pt.y);
      },
      { passive: false }
    );

    svg.addEventListener('dblclick', () => {
      const input = ui.sel && ui.root.querySelector('#inspector [data-prop="name"]');
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  /* ================================================================== */
  /* Pointer: dragging from the shelf onto the plan                     */
  /* ================================================================== */

  function startTileDrag(e, tile) {
    // touch: let the shelf scroll, a tap drops the piece in the middle
    if (e.pointerType === 'touch' || e.button !== 0) return;
    e.preventDefault();
    ui.tile = { tile, sx: e.clientX, sy: e.clientY, started: false, obj: null, inPlan: false, chip: null };
  }

  document.addEventListener('pointermove', (e) => {
    const t = ui.tile;
    if (!t) return;
    if (!t.started) {
      if (Math.hypot(e.clientX - t.sx, e.clientY - t.sy) < 6) return;
      t.started = true;
      t.obj = t.tile.dataset.add ? makeItem(t.tile.dataset.add) : makeRoom(Number(t.tile.dataset.room));
      t.chip = document.createElement('div');
      t.chip.className = 'drag-chip';
      t.chip.textContent = t.obj.name;
      document.body.appendChild(t.chip);
      document.body.classList.add('dragging-tile');
    }
    const over = overSvg(e);
    t.chip.style.transform = `translate(${e.clientX + 12}px, ${e.clientY + 12}px)`;
    t.chip.classList.toggle('hide', over);
    const list = isRoom(t.obj) ? plan().rooms : plan().items;
    if (over) {
      const pt = toPlan(e);
      const f = foot(t.obj);
      const step = isRoom(t.obj) ? 0.5 : SNAP;
      t.obj.x = snap(pt.x - f.w / 2, step);
      t.obj.y = snap(pt.y - f.h / 2, step);
      if (!t.inPlan) {
        list.push(t.obj);
        t.inPlan = true;
      }
    } else if (t.inPlan) {
      list.splice(list.indexOf(t.obj), 1);
      t.inPlan = false;
    }
    drawSoon();
  });

  document.addEventListener('pointerup', () => {
    const t = ui.tile;
    if (!t) return;
    ui.tile = null;
    if (!t.started) return; // a plain click — handled by the click listener
    ui.swallowClick = true;
    setTimeout(() => (ui.swallowClick = false), 0);
    t.chip.remove();
    document.body.classList.remove('dragging-tile');
    if (t.inPlan) placed(t.obj);
    else draw();
  });

  /* ================================================================== */
  /* Buttons, inputs, keys                                              */
  /* ================================================================== */

  function bindUi(root) {
    root.querySelector('.shelf-grid').addEventListener('pointerdown', (e) => {
      const tile = e.target.closest('.tile');
      if (tile) startTileDrag(e, tile);
    });

    root.onclick = (e) => {
      if (ui.swallowClick) return;
      const t = e.target.closest('[data-act],[data-add],[data-room],[data-cat],[data-unit],[data-color]');
      if (!t) return;
      const d = t.dataset;
      const o = find(ui.sel);
      if (d.add) return dropAtCenter(makeItem(d.add));
      if (d.room) return dropAtCenter(makeRoom(Number(d.room)));
      if (d.color && o) {
        o.color = d.color;
        commit();
        return refresh();
      }
      if (d.cat) {
        ui.cat = d.cat;
        return render(root);
      }
      if (d.unit) {
        S().unit = d.unit;
        GG.store.save();
        return render(root);
      }
      switch (d.act) {
        case 'undo': return undo();
        case 'redo': return redo();
        case 'zoom-in': return zoom(1 / 1.25);
        case 'zoom-out': return zoom(1.25);
        case 'fit': fit(); return draw();
        case 'rotate': return rotate(o);
        case 'dup': return duplicate(o);
        case 'del': return remove(o);
        case 'deselect':
          ui.sel = null;
          return refresh();
        case 'dog':
          S().dog = !S().dog;
          GG.store.save();
          if (S().dog) GG.dog.reset();
          return render(root);
        case 'new-plan': return newPlanDialog();
        case 'plan-menu': return planMenu();
        case 'settings': return GG.app.settings();
        case 'export-png': return exportPng();
      }
    };

    root.onchange = (e) => {
      const t = e.target;
      if (t.dataset.act === 'plan') return switchPlan(t.value);
      if (t.dataset.prop) {
        commit();
        renderInspector();
      }
    };

    root.oninput = (e) => {
      const t = e.target;
      const o = find(ui.sel);
      if (!o || !t.dataset.prop) return;
      const prop = t.dataset.prop;
      if (prop === 'name') o.name = t.value;
      else if (prop === 'color') o.color = t.value;
      else if (prop === 'outdoor') o.outdoor = t.checked;
      else if (prop === 'fw' || prop === 'fh') {
        const v = fromUnit(t.value);
        if (!(v > 0.1)) return;
        const f = foot(o);
        prop === 'fw' ? setFoot(o, r2(v), f.h) : setFoot(o, f.w, r2(v));
      }
      GG.store.save();
      draw();
    };
  }

  document.addEventListener('keydown', (e) => {
    if (!ui.svg || !ui.svg.isConnected || e.target.closest('input, textarea, select') || document.querySelector('.modal-backdrop')) return;
    const k = e.key;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && k.toLowerCase() === 'z') {
      e.preventDefault();
      return e.shiftKey ? redo() : undo();
    }
    if (mod && k.toLowerCase() === 'y') {
      e.preventDefault();
      return redo();
    }
    const o = find(ui.sel);
    if (!o) return;
    if (k === 'Delete' || k === 'Backspace') {
      e.preventDefault();
      remove(o);
    } else if (k === 'r' || k === 'R') rotate(o);
    else if (mod && k.toLowerCase() === 'd') {
      e.preventDefault();
      duplicate(o);
    } else if (k === 'Escape') {
      ui.sel = null;
      refresh();
    } else if (k.startsWith('Arrow')) {
      e.preventDefault();
      const step = e.shiftKey ? 1 : SNAP;
      if (k === 'ArrowLeft') o.x = r2(o.x - step);
      if (k === 'ArrowRight') o.x = r2(o.x + step);
      if (k === 'ArrowUp') o.y = r2(o.y - step);
      if (k === 'ArrowDown') o.y = r2(o.y + step);
      draw();
      clearTimeout(ui.nudgeTimer);
      ui.nudgeTimer = setTimeout(commit, 400); // a burst of nudges = one undo step
    }
  });

  window.addEventListener(
    'resize',
    GG.util.debounce(() => {
      if (ui.svg && ui.svg.isConnected) {
        fit();
        draw();
      }
    }, 150)
  );

  /* ================================================================== */
  /* Inspector & HUD                                                    */
  /* ================================================================== */

  function renderInspector() {
    const el = ui.root && ui.root.querySelector('#inspector');
    if (!el) return;
    const o = find(ui.sel);
    el.hidden = !o;
    if (!o) return (el.innerHTML = '');
    const f = foot(o);
    const u = S().unit;
    const step = u === 'm' ? 0.05 : 0.25;
    const colors = isRoom(o) ? ROOM_COLORS : ITEM_COLORS;
    el.innerHTML = `
      <div class="insp-head">
        <input type="text" data-prop="name" value="${esc(o.name)}" maxlength="40" aria-label="Name">
        <button class="x" data-act="deselect" title="Done (Esc)">✕</button>
      </div>
      <div class="two">
        <label class="lbl">Width (${u}) <input type="number" min="0.5" step="${step}" data-prop="fw" value="${toUnit(f.w)}"></label>
        <label class="lbl">${isRoom(o) ? 'Length' : 'Depth'} (${u}) <input type="number" min="0.5" step="${step}" data-prop="fh" value="${toUnit(f.h)}"></label>
      </div>
      <div class="swatch-row">
        ${colors.map((c) => `<button class="sw ${c === o.color ? 'on' : ''}" style="background:${c}" data-color="${c}" aria-label="Color ${c}"></button>`).join('')}
        <label class="sw custom" title="Any color"><input type="color" data-prop="color" value="${o.color || '#dddddd'}">🎨</label>
      </div>
      ${isRoom(o) ? `<label class="switch"><input type="checkbox" data-prop="outdoor" ${o.outdoor ? 'checked' : ''}> Outdoor space</label>` : ''}
      <div class="insp-actions">
        ${isRoom(o) ? '' : '<button class="btn sm" data-act="rotate" title="Rotate (R)">⟳ Rotate</button>'}
        <button class="btn sm" data-act="dup" title="Copy (Ctrl+D)">⧉ Copy</button>
        <button class="btn sm danger" data-act="del" title="Delete (Del)">🗑</button>
      </div>`;
  }

  function renderInspectorLive() {
    const o = find(ui.sel);
    if (!o || !ui.root) return;
    const f = foot(o);
    const fw = ui.root.querySelector('[data-prop="fw"]'), fh = ui.root.querySelector('[data-prop="fh"]');
    if (fw) fw.value = toUnit(f.w);
    if (fh) fh.value = toUnit(f.h);
  }

  function renderHud() {
    const el = ui.root && ui.root.querySelector('#hud');
    if (!el) return;
    const p = plan();
    let indoor = 0;
    p.rooms.forEach((r) => !r.outdoor && (indoor += r.w * r.h));
    const bad = overlaps(p).size;
    const pieces = p.items.filter((i) => (cat(i).layer ?? 1) !== 3).length;
    el.innerHTML = p.rooms.length
      ? `<span class="chip-hud">🏠 ${area(indoor)}</span><span class="chip-hud">🪑 ${pieces} piece${pieces === 1 ? '' : 's'}</span>${bad ? `<span class="chip-hud warn">⚠️ ${bad} bumping</span>` : ''}`
      : '';
    const empty = ui.root.querySelector('#empty-stage');
    if (empty) empty.hidden = p.rooms.length > 0;
  }

  /* ================================================================== */
  /* Designs                                                            */
  /* ================================================================== */

  function switchPlan(id) {
    S().activePlan = id;
    ui.sel = null;
    GG.store.save();
    GG.dog.reset();
    render(ui.root);
  }

  function addPlan(p) {
    S().plans.push(p);
    switchPlan(p.id);
  }

  function newPlanDialog() {
    let empty = true;
    const thumb = (tpl) => {
      const p = GG.data.instantiateTemplate(tpl, uid, false);
      if (!p.rooms.length) return '<div class="tpl-blank">✏️</div>';
      const b = bounds(p, 1);
      return `<svg viewBox="${b.x} ${b.y} ${b.w} ${b.h}" preserveAspectRatio="xMidYMid meet">${markup(p, { exporting: true })}</svg>`;
    };
    GG.util.modal({
      title: 'Pick a space to decorate',
      wide: true,
      body: `
        <div class="seg" style="margin-bottom:14px">
          <button class="on" data-empty="1">📦 Empty rooms — we’ll furnish it</button>
          <button data-empty="0">🛋️ Already furnished</button>
        </div>
        <div class="tpl-grid">${D.templates.map((t) => `<button class="tpl" data-tpl="${t.id}">${thumb(t)}<b>${t.emoji} ${esc(t.name)}</b><span class="muted small">${esc(t.blurb)}</span></button>`).join('')}</div>`,
      onMount: (modal, close) => {
        modal.addEventListener('click', (e) => {
          const seg = e.target.closest('[data-empty]');
          if (seg) {
            empty = seg.dataset.empty === '1';
            seg.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === seg));
            return;
          }
          const b = e.target.closest('[data-tpl]');
          if (!b) return;
          const tpl = D.templates.find((t) => t.id === b.dataset.tpl);
          close();
          addPlan(GG.store.newPlan(tpl.id, tpl.name, empty));
          if (empty && tpl.rooms.length) setTimeout(() => GG.dog.say('Empty! Let’s fill it up 🛋️', 3500), 900);
        });
      },
    });
  }

  function planMenu() {
    const p = plan();
    GG.util.modal({
      title: 'This design',
      body: `
        <label class="lbl">Name <input type="text" id="plan-name" value="${esc(p.name)}" maxlength="60"></label>
        <div class="menu-list">
          <button class="btn" data-m="dup">⧉ Make a copy</button>
          <button class="btn" data-m="share">💌 Copy a link to send</button>
          <button class="btn" data-m="svg">⬇ Download as SVG</button>
          <button class="btn danger" data-m="del" ${S().plans.length < 2 ? 'disabled' : ''}>🗑 Delete this design</button>
        </div>`,
      actions: [{ label: 'Done', primary: true }],
      onClose: () => {
        const input = document.getElementById('plan-name');
        if (input && input.value.trim() && input.value.trim() !== p.name) {
          p.name = input.value.trim();
          GG.store.save();
          render(ui.root);
        }
      },
      onMount: (m, close) => {
        const name = m.querySelector('#plan-name');
        name.addEventListener('keydown', (e) => e.key === 'Enter' && close());
        m.addEventListener('click', async (e) => {
          const b = e.target.closest('[data-m]');
          if (!b) return;
          if (name.value.trim()) p.name = name.value.trim();
          if (b.dataset.m === 'dup') {
            close();
            const copy = GG.util.clone(p);
            copy.id = uid('plan');
            copy.name = `${p.name} (copy)`;
            copy.createdAt = Date.now();
            addPlan(copy);
          } else if (b.dataset.m === 'share') {
            GG.app.sharePlan(p);
          } else if (b.dataset.m === 'svg') {
            GG.util.download(`${slug(p.name)}.svg`, exportSvg(), 'image/svg+xml');
          } else if (b.dataset.m === 'del') {
            close();
            if (!(await GG.util.confirm('Delete this design?', `“${esc(p.name)}” will be gone for good.`, 'Delete', true))) return;
            S().plans = S().plans.filter((x) => x.id !== p.id);
            switchPlan(S().plans[0].id);
          }
        });
      },
    });
  }

  /* ================================================================== */
  /* Export                                                             */
  /* ================================================================== */

  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'design';

  function exportSvg() {
    const p = plan();
    const b = bounds(p, 2);
    const footer = 3; // space for title & scale bar
    const metric = S().unit === 'm';
    const scaleLen = metric ? 3.28084 * 2 : 5;
    const px = 24;
    let indoor = 0;
    p.rooms.forEach((r) => !r.outdoor && (indoor += r.w * r.h));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x} ${b.y} ${b.w} ${b.h + footer}" width="${Math.round(b.w * px)}" height="${Math.round((b.h + footer) * px)}">
      <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h + footer}" fill="#fffdf9"/>
      ${markup(p, { exporting: true })}
      <g font-family="ui-sans-serif, system-ui, Helvetica, Arial, sans-serif" fill="#3b3330">
        <text x="${b.x + 1}" y="${b.y + b.h + 1.6}" font-size="0.9" font-weight="700">${esc(p.name)}</text>
        <text x="${b.x + 1}" y="${b.y + b.h + 2.5}" font-size="0.55" fill="#6f665d">Gougou House · ${area(indoor)}</text>
        <line x1="${b.x + b.w - 1 - scaleLen}" y1="${b.y + b.h + 1.6}" x2="${b.x + b.w - 1}" y2="${b.y + b.h + 1.6}" stroke="#3b3330" stroke-width="0.12"/>
        <text x="${b.x + b.w - 1 - scaleLen / 2}" y="${b.y + b.h + 2.5}" font-size="0.55" text-anchor="middle">${metric ? '2 m' : '5 ft'}</text>
      </g>
    </svg>`;
  }

  function exportPng() {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([exportSvg()], { type: 'image/svg+xml' }));
    img.onload = () => {
      const scale = Math.min(2, 4000 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((blob) => GG.util.download(`${slug(plan().name)}.png`, blob));
      toast('📸 Picture saved!');
    };
    img.src = url;
  }

  /* ================================================================== */

  GG.dog.init({
    svg: () => ui.svg,
    plan,
    upp: unitsPerPx,
    enabled: () => S().dog && ui.svg && ui.svg.isConnected,
    isDragging: () => !!(ui.drag && ui.drag.mode !== 'pan') || !!(ui.tile && ui.tile.inPlan),
    redraw: draw,
  });

  GG.game = { render, addPlan };
})(window.GG);
