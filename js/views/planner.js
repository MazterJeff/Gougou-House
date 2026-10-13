/* Gougou House — floor plan sketcher. Everything is stored in feet; SVG user units = feet. */
(function (GG) {
  const { esc, uid, clamp, len, area, toUnit, fromUnit, toast } = GG.util;
  const D = GG.data;
  const I = GG.insights;
  const SNAP = 0.25;
  const snap = (v, step = SNAP) => Math.round(v / step) * step;
  const r2 = (v) => Math.round(v * 100) / 100;

  const ui = { sel: null, view: null, drag: null, svg: null, root: null, cat: 'Living', raf: 0 };

  const S = () => GG.store.state;
  const plan = () => S().plans.find((p) => p.id === S().activePlan) || S().plans[0];
  const find = (id) => id && (plan().rooms.find((r) => r.id === id) || plan().items.find((i) => i.id === id));
  const isRoom = (o) => !o.kind;
  const cat = (o) => D.furnitureByKind[o.kind] || {};
  /** footprint on the plan (items rotated by 90/270 swap width & depth) */
  const foot = (o) => (isRoom(o) || o.rot % 180 === 0 ? { w: o.w, h: o.h } : { w: o.h, h: o.w });
  const touch = () => {
    plan().edited = true;
    GG.store.save();
  };

  /* ================================================================== */
  /* Rendering                                                          */
  /* ================================================================== */

  function render(root) {
    ui.root = root;
    const s = S();
    const p = plan();
    if (ui.sel && !find(ui.sel)) ui.sel = null;

    root.innerHTML = `
      <section class="page planner-page">
        <header class="page-head compact">
          <div>
            <p class="eyebrow">Step 3 · Make it real</p>
            <h1>Floor Plans</h1>
            <p class="lead">Sketch layouts with real furniture sizes. Make a few options, then each of you hearts your favorite.</p>
          </div>
        </header>
        <div class="planner">
          <aside class="pl-left">
            <div class="card">
              <label class="lbl" for="pl-select">Floor plan</label>
              <select id="pl-select" data-act="plan">
                ${s.plans.map((x) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}${x.hearts?.a && x.hearts?.b ? ' 💞' : ''}</option>`).join('')}
              </select>
              <div class="row wrap tight">
                <button class="btn sm primary" data-act="new-plan">＋ New</button>
                <button class="btn sm" data-act="dup-plan">Duplicate</button>
                <button class="btn sm" data-act="rename-plan">Rename</button>
                <button class="btn sm ghost" data-act="del-plan" ${s.plans.length < 2 ? 'disabled' : ''}>Delete</button>
              </div>
              <div class="hearts">
                <span class="muted small">Love this one?</span>
                ${s.partners.map((pp) => `<button class="heart ${p.hearts?.[pp.id] ? 'on' : ''}" style="--pc:${pp.color}" data-heart="${pp.id}" title="${esc(pp.name)}">${pp.emoji} ${p.hearts?.[pp.id] ? '❤️' : '🤍'}</button>`).join('')}
              </div>
            </div>
            <div class="card">
              <h3>Add a room</h3>
              <div class="row wrap tight">
                ${D.roomTypes.map((r, i) => `<button class="chip" style="background:${r.color}" data-room="${i}">${esc(r.name)}</button>`).join('')}
              </div>
              <h3 style="margin-top:16px">Add furniture</h3>
              <div class="cat-tabs">
                ${D.furnitureGroups.map((g) => `<button class="${ui.cat === g ? 'on' : ''}" data-cat="${g}">${g === 'Pets' ? '🐶 Pets' : g}</button>`).join('')}
              </div>
              <div class="cat-grid">
                ${D.furniture.filter((f) => f.group === ui.cat).map(catalogTile).join('')}
              </div>
            </div>
          </aside>

          <div class="pl-stage card">
            <div class="pl-toolbar">
              <button class="icon-btn" data-act="zoom-out" title="Zoom out">−</button>
              <button class="btn sm ghost" data-act="fit" title="Fit plan to screen">Fit</button>
              <button class="icon-btn" data-act="zoom-in" title="Zoom in">＋</button>
              <span class="seg small">
                <button class="${s.unit === 'ft' ? 'on' : ''}" data-unit="ft">ft</button>
                <button class="${s.unit === 'm' ? 'on' : ''}" data-unit="m">m</button>
              </span>
              <span class="grow"></span>
              <button class="btn sm ghost" data-act="export-png">⬇ PNG</button>
              <button class="btn sm ghost" data-act="export-svg">⬇ SVG</button>
            </div>
            <svg id="pl-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"></svg>
            <div class="pl-hint">Drag to move (rooms carry their furniture; hold <kbd>Alt</kbd> to move a room alone) · drag the dot to resize ·
              scroll or ± to zoom · drag empty space to pan · <kbd>R</kbd> rotate · <kbd>Del</kbd> delete · <kbd>⌘/Ctrl D</kbd> duplicate · arrows nudge</div>
          </div>

          <aside class="pl-right">
            <div class="card" id="pl-props"></div>
            <div class="card" id="pl-stats"></div>
            <div class="card">
              <h3>Notes on this option</h3>
              <textarea data-act="notes" rows="4" placeholder="e.g. Love the light in the office, but is the kitchen big enough for two cooks?">${esc(p.notes || '')}</textarea>
            </div>
          </aside>
        </div>
      </section>`;

    ui.svg = root.querySelector('#pl-svg');
    bindSvg(ui.svg);
    bindPanel(root);
    if (!ui.view || ui.viewPlan !== p.id) fit();
    else applyView();
    draw();
    renderProps();
    renderStats();
  }

  function catalogTile(f) {
    const w = f.w, h = f.h;
    const pad = 0.6;
    return `<button class="cat-tile" data-add="${f.kind}" title="${esc(f.name)} · ${len(w)} × ${len(h)}">
      <svg viewBox="${-w / 2 - pad} ${-h / 2 - pad} ${w + 2 * pad} ${h + 2 * pad}" preserveAspectRatio="xMidYMid meet">${shape({ ...f, rot: 0 }, false)}</svg>
      <span>${esc(f.name)}</span>
      <small>${len(w)} × ${len(h)}</small>
    </button>`;
  }

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
      detail = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => `<circle cx="${a * w / 4.5}" cy="${b * h / 4.5}" r="${Math.min(w, h) / 6}" fill="none" stroke="#fff" stroke-width="0.05"/>`).join('');
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
    // rooms: floor fill + walls
    out += p.rooms
      .map((r) => `<g data-id="${r.id}" class="el room">
        <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.color}" ${r.outdoor ? 'fill-opacity=".8"' : ''}
          stroke="${r.outdoor ? '#7c8b5a' : '#3b3330'}" stroke-width="${r.outdoor ? 0.15 : 0.35}" ${r.outdoor ? 'stroke-dasharray="0.6 0.4"' : ''} stroke-linejoin="miter"/>
      </g>`)
      .join('');
    // furniture
    out += items
      .map((o) => {
        const f = foot(o);
        const cx = o.x + f.w / 2, cy = o.y + f.h / 2;
        return `<g data-id="${o.id}" class="el item" transform="translate(${r2(cx)} ${r2(cy)}) rotate(${o.rot || 0})">${shape(o, bad.has(o.id))}</g>`;
      })
      .join('');
    // labels on top, never catching the pointer
    out += `<g pointer-events="none" font-family="ui-sans-serif, system-ui, Helvetica, Arial, sans-serif">`;
    out += items
      .map((o) => {
        const c = cat(o);
        if (['door', 'window'].includes(c.shape)) return '';
        const f = foot(o);
        const fs = Math.min(0.55, (f.w * 1.7) / Math.max(o.name.length, 3), f.h * 0.42);
        if (fs < 0.22) return '';
        const ink = isDark(o.color || c.color) ? '#fffdf9' : '#3b3330';
        // rugs usually sit under a table, so label them along their bottom edge instead of the middle
        const ty = c.shape === 'rug' && f.h > 2 ? o.y + f.h - 0.5 : o.y + f.h / 2 + fs * 0.35;
        return `<text x="${r2(o.x + f.w / 2)}" y="${r2(ty)}" font-size="${r2(fs)}" text-anchor="middle" fill="${ink}" fill-opacity=".9">${esc(o.name)}</text>`;
      })
      .join('');
    out += p.rooms.map((r) => roomLabel(r, p.items)).join('');
    out += `</g>`;
    // selection
    const sel = !exporting && find(ui.sel);
    if (sel) {
      const f = foot(sel);
      const upp = unitsPerPx();
      const pad = 0.15;
      out += `<rect x="${sel.x - pad}" y="${sel.y - pad}" width="${f.w + 2 * pad}" height="${f.h + 2 * pad}" fill="none" stroke="#d9825b" stroke-width="${upp * 2}" stroke-dasharray="${upp * 6} ${upp * 4}" pointer-events="none"/>
        <circle data-handle="1" cx="${sel.x + f.w}" cy="${sel.y + f.h}" r="${upp * 8}" fill="#d9825b" stroke="#fff" stroke-width="${upp * 2.5}" style="cursor:nwse-resize"/>
        <text x="${sel.x + f.w / 2}" y="${sel.y - pad - upp * 8}" font-size="${upp * 13}" text-anchor="middle" fill="#d9825b" font-weight="700" pointer-events="none" font-family="ui-sans-serif, system-ui, sans-serif">${len(f.w)} × ${len(f.h)}</text>`;
    }
    return out;
  }

  /** True for fills dark enough that labels should be light. */
  function isDark(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return false;
    const n = parseInt(m[1], 16);
    const lum = 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
    return lum < 120;
  }

  /**
   * Room name + size, placed in whichever corner/edge of the room is least covered by furniture,
   * so labels don't sit on top of the TV console or the kitchen counter.
   */
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
        cost += ox * oy * ((cat(o).layer ?? 1) === 0 ? 0.15 : 1);
      });
      if (cost < bestCost) [best, bestCost] = [[x, y], cost];
    });
    const [x, y] = best;
    return `<text x="${r2(x + 0.1)}" y="${r2(y + fs)}" font-size="${r2(fs)}" font-weight="700" fill="#3b3330" paint-order="stroke" stroke="#fffdf9" stroke-width="${r2(fs * 0.22)}" stroke-linejoin="round">${esc(r.name)}</text>
      <text x="${r2(x + 0.1)}" y="${r2(y + 0.2 + fs * 1.95)}" font-size="${r2(fs * 0.68)}" fill="#6f665d" paint-order="stroke" stroke="#fffdf9" stroke-width="${r2(fs * 0.18)}">${dims}</text>`;
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

  /* ================================================================== */
  /* Interaction                                                        */
  /* ================================================================== */

  function bindSvg(svg) {
    svg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const pt = toPlan(e);
      const handle = e.target.closest('[data-handle]');
      const el = e.target.closest('[data-id]');
      if (handle && find(ui.sel)) {
        const o = find(ui.sel);
        ui.drag = { mode: 'resize', start: pt, orig: { ...foot(o) }, o };
      } else if (el) {
        const o = find(el.dataset.id);
        ui.sel = o.id;
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
      renderProps();
    });

    svg.addEventListener('pointermove', (e) => {
      const d = ui.drag;
      if (!d) return;
      d.moved = true;
      if (d.mode === 'pan') {
        ui.view = { ...d.orig, x: d.orig.x - (e.clientX - d.sx) * d.upp, y: d.orig.y - (e.clientY - d.sy) * d.upp };
        applyView();
        return;
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
        const fw = Math.max(0.5, snap(d.orig.w + dx, step));
        const fh = Math.max(0.5, snap(d.orig.h + dy, step));
        setFoot(d.o, fw, fh);
      }
      drawSoon();
      renderPropsLive();
    });

    const end = () => {
      if (!ui.drag) return;
      const moved = ui.drag.moved && ui.drag.mode !== 'pan';
      ui.drag = null;
      svg.classList.remove('panning');
      if (moved) {
        touch();
        renderProps();
        renderStats();
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
      if (ui.sel) {
        const input = ui.root.querySelector('#pl-props [data-prop="name"]');
        if (input) {
          input.focus();
          input.select();
        }
      }
    });
  }

  function setFoot(o, fw, fh) {
    if (isRoom(o) || o.rot % 180 === 0) {
      o.w = fw;
      o.h = fh;
    } else {
      o.w = fh;
      o.h = fw;
    }
  }

  function addItem(kind) {
    const c = D.furnitureByKind[kind];
    const v = ui.view;
    const o = { id: uid('i'), kind, name: c.name, w: c.w, h: c.h, rot: 0, color: c.color };
    o.x = snap(v.x + v.w / 2 - o.w / 2);
    o.y = snap(v.y + v.h / 2 - o.h / 2);
    plan().items.push(o);
    ui.sel = o.id;
    touch();
    refresh();
  }

  function addRoom(i) {
    const t = D.roomTypes[i];
    const sizes = { Closet: [6, 4], Bathroom: [8, 7], Hallway: [4, 12], Balcony: [12, 5], Laundry: [6, 6], Yard: [30, 15], Kitchen: [12, 10] };
    const [w, h] = sizes[t.name] || [12, 12];
    const v = ui.view;
    const count = plan().rooms.filter((r) => r.name.startsWith(t.name)).length;
    const r = {
      id: uid('r'),
      name: count ? `${t.name} ${count + 1}` : t.name,
      x: snap(v.x + v.w / 2 - w / 2, 0.5),
      y: snap(v.y + v.h / 2 - h / 2, 0.5),
      w, h, color: t.color, outdoor: !!t.outdoor,
    };
    plan().rooms.push(r);
    ui.sel = r.id;
    touch();
    refresh();
  }

  function rotate(o) {
    if (!o || isRoom(o)) return;
    const before = foot(o);
    const cx = o.x + before.w / 2, cy = o.y + before.h / 2;
    o.rot = ((o.rot || 0) + 90) % 360;
    const after = foot(o);
    o.x = snap(cx - after.w / 2);
    o.y = snap(cy - after.h / 2);
    touch();
    refresh();
  }

  function duplicate(o) {
    if (!o) return;
    const copy = { ...o, id: uid(isRoom(o) ? 'r' : 'i'), x: o.x + 1, y: o.y + 1 };
    (isRoom(o) ? plan().rooms : plan().items).push(copy);
    ui.sel = copy.id;
    touch();
    refresh();
  }

  function remove(o) {
    if (!o) return;
    const p = plan();
    p.rooms = p.rooms.filter((r) => r.id !== o.id);
    p.items = p.items.filter((i) => i.id !== o.id);
    ui.sel = null;
    touch();
    refresh();
  }

  function refresh() {
    draw();
    renderProps();
    renderStats();
  }

  function bindPanel(root) {
    root.onclick = async (e) => {
      const t = e.target.closest('[data-act],[data-add],[data-room],[data-cat],[data-unit],[data-heart],[data-pick]');
      if (!t) return;
      const d = t.dataset;
      const o = find(ui.sel);
      if (d.add) return addItem(d.add);
      if (d.room) return addRoom(Number(d.room));
      if (d.pick) {
        ui.sel = d.pick;
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
      if (d.heart) {
        const p = plan();
        p.hearts = p.hearts || {};
        p.hearts[d.heart] = !p.hearts[d.heart];
        GG.store.save();
        if (p.hearts.a && p.hearts.b) toast('💞 You both love this plan!');
        return render(root);
      }
      switch (d.act) {
        case 'zoom-in': return zoom(1 / 1.25);
        case 'zoom-out': return zoom(1.25);
        case 'fit': fit(); return draw();
        case 'rotate': return rotate(o);
        case 'dup': return duplicate(o);
        case 'del': return remove(o);
        case 'new-plan': return newPlanDialog();
        case 'dup-plan': {
          const src = plan();
          const copy = GG.util.clone(src);
          copy.id = uid('plan');
          copy.name = `${src.name} (copy)`;
          copy.hearts = {};
          copy.createdAt = Date.now();
          S().plans.push(copy);
          S().activePlan = copy.id;
          GG.store.save();
          return render(root);
        }
        case 'rename-plan': return renamePlan();
        case 'del-plan': {
          if (S().plans.length < 2) return;
          if (!(await GG.util.confirm('Delete this plan?', `“${esc(plan().name)}” will be gone for good.`, 'Delete', true))) return;
          S().plans = S().plans.filter((p) => p.id !== S().activePlan);
          S().activePlan = S().plans[0].id;
          GG.store.save();
          return render(root);
        }
        case 'export-svg':
          return GG.util.download(`${slug(plan().name)}.svg`, exportSvg(), 'image/svg+xml');
        case 'export-png':
          return exportPng();
      }
    };

    root.onchange = (e) => {
      const t = e.target;
      if (t.dataset.act === 'plan') {
        S().activePlan = t.value;
        ui.sel = null;
        GG.store.save();
        render(root);
      } else if (t.dataset.prop) {
        renderProps();
        renderStats();
      }
    };

    root.oninput = (e) => {
      const t = e.target;
      if (t.dataset.act === 'notes') {
        plan().notes = t.value;
        return GG.store.save();
      }
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
      touch();
      draw();
    };
  }

  function onKey(e) {
    if (GG.app.route() !== 'planner' || e.target.closest('input, textarea, select') || document.querySelector('.modal-backdrop')) return;
    const o = find(ui.sel);
    if (!o) return;
    const k = e.key;
    if (k === 'Delete' || k === 'Backspace') {
      e.preventDefault();
      remove(o);
    } else if (k === 'r' || k === 'R') rotate(o);
    else if ((e.metaKey || e.ctrlKey) && k.toLowerCase() === 'd') {
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
      touch();
      draw();
    }
  }
  document.addEventListener('keydown', onKey);
  window.addEventListener(
    'resize',
    GG.util.debounce(() => {
      if (GG.app && GG.app.route() === 'planner' && ui.svg && ui.svg.isConnected) {
        fit();
        draw();
      }
    }, 150)
  );

  /* ================================================================== */
  /* Side panels                                                        */
  /* ================================================================== */

  function renderProps() {
    const el = ui.root && ui.root.querySelector('#pl-props');
    if (!el) return;
    const o = find(ui.sel);
    if (!o) {
      el.innerHTML = `
        <h3>Nothing selected</h3>
        <p class="muted small">Click a room or piece of furniture to edit it. New pieces drop into the middle of the view.</p>
        <ul class="tips">
          <li>🛋️ Leave ~36″ (3 ft) walkways between furniture.</li>
          <li>🛏️ Give beds 24–30″ of space on each side you get in from.</li>
          <li>🍽️ Allow 36″ behind dining chairs so people can pass.</li>
          <li>🐶 Pick a dog-bed spot that can see the front door — pups love a lookout.</li>
        </ul>`;
      return;
    }
    const f = foot(o);
    const u = S().unit;
    el.innerHTML = `
      <h3>${isRoom(o) ? (o.outdoor ? '🌳 Outdoor space' : '🚪 Room') : '🪑 Furniture'}</h3>
      <label class="lbl">Name <input type="text" data-prop="name" value="${esc(o.name)}" maxlength="40"></label>
      <div class="two">
        <label class="lbl">Width (${u}) <input type="number" min="0.5" step="${u === 'm' ? 0.05 : 0.25}" data-prop="fw" value="${toUnit(f.w)}"></label>
        <label class="lbl">${isRoom(o) ? 'Length' : 'Depth'} (${u}) <input type="number" min="0.5" step="${u === 'm' ? 0.05 : 0.25}" data-prop="fh" value="${toUnit(f.h)}"></label>
      </div>
      <div class="two">
        <label class="lbl">Color <input type="color" data-prop="color" value="${o.color || '#dddddd'}"></label>
        <div class="lbl">Size<div class="readout" id="pl-readout">${len(f.w)} × ${len(f.h)}<br><span class="muted">${area(f.w * f.h)}</span></div></div>
      </div>
      ${isRoom(o) ? `<label class="switch"><input type="checkbox" data-prop="outdoor" ${o.outdoor ? 'checked' : ''}> Outdoor (not counted in floor area)</label>` : ''}
      <div class="row wrap tight" style="margin-top:12px">
        ${isRoom(o) ? '' : '<button class="btn sm" data-act="rotate">⟳ Rotate</button>'}
        <button class="btn sm" data-act="dup">Duplicate</button>
        <button class="btn sm danger" data-act="del">Delete</button>
      </div>`;
  }

  function renderPropsLive() {
    const o = find(ui.sel);
    const el = ui.root && ui.root.querySelector('#pl-readout');
    if (!o || !el) return;
    const f = foot(o);
    el.innerHTML = `${len(f.w)} × ${len(f.h)}<br><span class="muted">${area(f.w * f.h)}</span>`;
    const fw = ui.root.querySelector('[data-prop="fw"]'), fh = ui.root.querySelector('[data-prop="fh"]');
    if (fw) fw.value = toUnit(f.w);
    if (fh) fh.value = toUnit(f.h);
  }

  /** Cross-check the plan against what you both said you want on the wishlist. */
  function wishChecks(p) {
    const sum = I.wishSummary();
    const wanted = new Set([...sum.shared, ...sum.sharedish].map((x) => x.id));
    const rooms = (re) => p.rooms.filter((r) => re.test(r.name)).length;
    const has = (...kinds) => p.items.some((i) => kinds.includes(i.kind));
    const checks = [
      ['office', 'a home office', () => rooms(/office|study/i) > 0],
      ['twodesks', 'two desks', () => p.items.filter((i) => i.kind === 'desk').length >= 2],
      ['guestroom', 'a guest room', () => rooms(/bed|guest/i) >= 2],
      ['secondbath', 'a second bathroom', () => rooms(/bath/i) >= 2],
      ['balcony', 'a balcony', () => rooms(/balcony|terrace/i) > 0],
      ['yard', 'a yard', () => rooms(/yard|garden/i) > 0],
      ['walkin', 'a walk-in closet', () => rooms(/closet/i) > 0],
      ['kingbed', 'a king bed', () => has('king')],
      ['tub', 'a soaking tub', () => has('tub')],
      ['twosinks', 'a double vanity', () => has('vanity2')],
      ['island', 'a kitchen island', () => has('island')],
      ['dining', 'a table for 6+', () => has('table6')],
      ['inunit', 'a washer & dryer', () => has('washer') || rooms(/laundry/i) > 0],
      ['dognook', 'a dog bed spot', () => has('dogbed', 'crate')],
      ['reading', 'a reading nook', () => has('armchair')],
      ['gymroom', 'a workout corner', () => has('yogamat')],
      ['music', 'room for instruments', () => has('piano')],
    ];
    return checks.filter(([id]) => wanted.has(id)).map(([, label, ok]) => ({ label, ok: ok() }));
  }

  function renderStats() {
    const el = ui.root && ui.root.querySelector('#pl-stats');
    if (!el) return;
    const p = plan();
    const { indoor, outdoor } = I.planArea(p);
    const bad = overlaps(p);
    const beds = p.rooms.filter((r) => /bed/i.test(r.name)).length;
    const baths = p.rooms.filter((r) => /bath/i.test(r.name)).length;
    const checks = wishChecks(p);
    el.innerHTML = `
      <h3>This plan</h3>
      <div class="big-number">${area(indoor)}</div>
      <p class="muted small">${beds} bed · ${baths} bath${outdoor ? ` · plus ${area(outdoor)} outdoors` : ''} · ${p.items.length} pieces</p>
      ${bad.size ? `<p class="warn-text">⚠️ ${bad.size} pieces overlap (outlined in red).</p>` : ''}
      <ul class="room-list">
        ${[...p.rooms].sort((a, b) => b.w * b.h - a.w * a.h).map((r) => `<li><button data-pick="${r.id}" class="${r.id === ui.sel ? 'on' : ''}"><i style="background:${r.color}"></i>${esc(r.name)}<span>${area(r.w * r.h)}</span></button></li>`).join('')}
      </ul>
      ${checks.length ? `<h3 style="margin-top:14px">Wishlist check</h3>
        <ul class="checks">${checks.map((c) => `<li class="${c.ok ? 'ok' : 'miss'}">${c.ok ? '✅' : '◻️'} You both want ${esc(c.label)}</li>`).join('')}</ul>` : ''}`;
  }

  /* ================================================================== */
  /* Plan management                                                    */
  /* ================================================================== */

  function newPlanDialog() {
    GG.util.modal({
      title: 'Start a new floor plan',
      wide: true,
      body: `<p class="muted">Pick a starting point — you can change everything afterwards.</p>
        <div class="tpl-grid">${D.templates.map((t) => `<button class="tpl" data-tpl="${t.id}"><span class="tpl-emoji">${t.emoji}</span><b>${esc(t.name)}</b><span class="muted small">${esc(t.blurb)}</span></button>`).join('')}</div>`,
      onMount: (modal, close) => {
        modal.addEventListener('click', (e) => {
          const b = e.target.closest('[data-tpl]');
          if (!b) return;
          const n = S().plans.length;
          const tpl = D.templates.find((t) => t.id === b.dataset.tpl);
          const p = GG.store.newPlan(tpl.id, `Option ${String.fromCharCode(65 + (n % 26))} · ${tpl.name}`);
          S().plans.push(p);
          S().activePlan = p.id;
          GG.store.save();
          close();
          ui.sel = null;
          render(ui.root);
        });
      },
    });
  }

  function renamePlan() {
    GG.util.modal({
      title: 'Rename plan',
      body: `<input type="text" id="plan-name" value="${esc(plan().name)}" maxlength="60" style="width:100%">`,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Save',
          primary: true,
          onClick: (m) => {
            const v = m.querySelector('#plan-name').value.trim();
            if (v) {
              plan().name = v;
              GG.store.save();
              render(ui.root);
            }
          },
        },
      ],
      onMount: (m, close) => m.querySelector('#plan-name').addEventListener('keydown', (e) => e.key === 'Enter' && m.querySelector('.btn.primary').click()),
    });
  }

  /* ================================================================== */
  /* Export                                                             */
  /* ================================================================== */

  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plan';

  function exportSvg() {
    const p = plan();
    const b = bounds(p, 2);
    const footer = 3; // space for title & scale bar
    const scaleLen = S().unit === 'm' ? 3.28084 * 2 : 5;
    const scaleLabel = S().unit === 'm' ? '2 m' : '5 ft';
    const px = 24;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x} ${b.y} ${b.w} ${b.h + footer}" width="${Math.round(b.w * px)}" height="${Math.round((b.h + footer) * px)}">
      <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h + footer}" fill="#fffdf9"/>
      ${markup(p, { exporting: true })}
      <g font-family="ui-sans-serif, system-ui, Helvetica, Arial, sans-serif" fill="#3b3330">
        <text x="${b.x + 1}" y="${b.y + b.h + 1.6}" font-size="0.9" font-weight="700">${esc(p.name)}</text>
        <text x="${b.x + 1}" y="${b.y + b.h + 2.5}" font-size="0.55" fill="#6f665d">Gougou House · ${area(I.planArea(p).indoor)}</text>
        <line x1="${b.x + b.w - 1 - scaleLen}" y1="${b.y + b.h + 1.6}" x2="${b.x + b.w - 1}" y2="${b.y + b.h + 1.6}" stroke="#3b3330" stroke-width="0.12"/>
        <text x="${b.x + b.w - 1 - scaleLen / 2}" y="${b.y + b.h + 2.5}" font-size="0.55" text-anchor="middle">${scaleLabel}</text>
      </g>
    </svg>`;
  }

  function exportPng() {
    const svgText = exportSvg();
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
    img.onload = () => {
      const scale = Math.min(2, 4000 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((blob) => GG.util.download(`${slug(plan().name)}.png`, blob));
    };
    img.src = url;
  }

  GG.views = GG.views || {};
  GG.views.planner = {
    render,
    /** Static preview of a plan, used on the home page. */
    thumb(p) {
      const b = bounds(p, 1);
      return `<svg viewBox="${b.x} ${b.y} ${b.w} ${b.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(p.name)}">${markup(p, { exporting: true })}</svg>`;
    },
  };
})(window.GG);
