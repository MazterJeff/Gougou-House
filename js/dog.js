/* Gougou House — Gougou the pup: wanders the rooms, paths around furniture, naps on the dog bed, chats. */
(function (GG) {
  const { esc } = GG.util;
  const D = GG.data;
  const CELL = 0.5; // pathfinding grid size in feet
  const WALK = 3.2; // ft per second
  const RUN = 8;

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const rand = (a, b) => a + Math.random() * (b - a);

  const LINES = {
    add: {
      sofa: ['A sofa! Dibs on the middle.', 'Ooh, so squishy!'],
      sectional: ['That sofa is HUGE. Room for me!', 'Nap headquarters!'],
      loveseat: ['Cozy! Is there room for three?'],
      armchair: ['My new throne?'],
      king: ['A big bed means room for me too, right?', 'I call the foot of the bed!'],
      queen: ['Bed! *jumps on it*', 'I promise I won’t shed. Much.'],
      full: ['Comfy-looking bed!'],
      crib: ['A tiny bed… for a tiny human? 👀'],
      dogbed: ['Is that… for ME?! 🥹', 'MY BED! Best day ever!'],
      crate: ['A little house inside the house!'],
      bowls: ['Food bowls!! When is dinner?', '🦴🦴🦴'],
      fridge: ['The snack box! 😍', 'I can smell the cheese from here.'],
      range: ['Cook something yummy, please!'],
      island: ['Great for dropping crumbs on 😋'],
      table4: ['I’ll be under the table. Waiting.'],
      table6: ['Dinner party? I’ll greet everyone!'],
      roundtable: ['Round table, round tummy.'],
      tub: ['Oh no. Is that for bath time?', 'I don’t like where this is going… 🛁'],
      shower: ['Splishy splashy. Not for me.'],
      plant: ['I promise not to dig in it. Probably.', 'A plant! 🌱'],
      rug: ['Soft floor! Zoomies time!', 'Perfect for rolling on.'],
      rugsm: ['Rug! *rolls around*'],
      desk: ['Work? Boring. Pet me instead.'],
      piano: ['Play me a song! 🎵'],
      grill: ['I smell sausages already 🌭'],
      door: ['A door! Walkies?!', 'Is someone home?!'],
      window: ['A window to watch the squirrels!'],
      tv: ['Can we watch dog videos?'],
      bookshelf: ['So many things to chew—I mean read.'],
      cattree: ['…a cat? Hmm. 😾'],
      washer: ['Spinny machine is scary.'],
      lounger: ['Sunbathing spot, yes please.'],
      patiotable: ['Outdoor dinners! I’ll guard the food.'],
      hammock: ['Swing me!'],
    },
    addAny: ['Ooh, nice!', 'Woof! I like it.', 'Can I sit on that?', 'Looking cozy!', 'Fancy!'],
    room: ['A new room to explore!', 'More space for zoomies!', 'Let me sniff it out.'],
    remove: ['Bye bye, {name}!', 'Where did the {name} go?'],
    poke: ['Woof!', 'Hehe, that tickles!', 'Pet me more!', 'Treat? 🦴', 'I love our new home!', 'You’re my favorite humans.', '*wags tail*'],
    idle: ['*sniff sniff*', 'Nice spot.', 'Hmm…', '*yawn*', 'Where’s my ball?'],
    squished: ['Hey, watch it! 😮', 'Whoa! I was standing there!'],
    zoomies: ['ZOOMIES!!', 'Can’t stop won’t stop!'],
    wake: ['*stretch* Good nap.', 'I’m up! I’m up!'],
  };

  const dog = {
    x: 0, y: 0, angle: 0, mode: 'idle', path: [], wait: 1, speed: WALK, bubble: null, hearts: 0,
    placed: false, grid: null, dirty: true, el: null, raf: 0, last: 0,
  };
  let env = null; // { svg, plan(), upp(), enabled() }

  /* ------------------------------------------------------------------ */
  /* Walkable grid + A*                                                  */
  /* ------------------------------------------------------------------ */
  const foot = (o) => (o.rot % 180 === 0 ? { w: o.w, h: o.h } : { w: o.h, h: o.w });
  const PASSABLE = new Set(['dogbed', 'bowls', 'yogamat']);

  function buildGrid(p) {
    if (!p.rooms.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    p.rooms.forEach((r) => {
      x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y);
      x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
    });
    const cols = Math.ceil((x1 - x0) / CELL), rows = Math.ceil((y1 - y0) / CELL);
    const inside = (px, py) => p.rooms.some((r) => px > r.x && px < r.x + r.w && py > r.y && py < r.y + r.h);
    const m = 0.4; // keep away from outside walls; shared walls between rooms stay passable
    const solids = p.items
      .filter((i) => (D.furnitureByKind[i.kind]?.layer ?? 1) === 1 && !PASSABLE.has(i.kind))
      .map((i) => ({ ...foot(i), x: i.x, y: i.y }));
    const walk = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = x0 + (c + 0.5) * CELL, cy = y0 + (r + 0.5) * CELL;
        if (!(inside(cx - m, cy - m) && inside(cx + m, cy - m) && inside(cx - m, cy + m) && inside(cx + m, cy + m))) continue;
        if (solids.some((s) => cx > s.x - 0.25 && cx < s.x + s.w + 0.25 && cy > s.y - 0.25 && cy < s.y + s.h + 0.25)) continue;
        walk[r * cols + c] = 1;
      }
    }
    const cells = [];
    for (let i = 0; i < walk.length; i++) if (walk[i]) cells.push(i);
    return { x0, y0, cols, rows, walk, cells };
  }

  const cellOf = (g, x, y) => {
    const c = Math.floor((x - g.x0) / CELL), r = Math.floor((y - g.y0) / CELL);
    return c < 0 || r < 0 || c >= g.cols || r >= g.rows ? -1 : r * g.cols + c;
  };
  const center = (g, i) => ({ x: g.x0 + ((i % g.cols) + 0.5) * CELL, y: g.y0 + (Math.floor(i / g.cols) + 0.5) * CELL });

  function nearestWalkable(g, start) {
    if (start >= 0 && g.walk[start]) return start;
    let best = -1, bestD = Infinity;
    const s = start >= 0 ? center(g, start) : { x: dog.x, y: dog.y };
    for (const i of g.cells) {
      const c = center(g, i);
      const d = (c.x - s.x) ** 2 + (c.y - s.y) ** 2;
      if (d < bestD) [best, bestD] = [i, d];
    }
    return best;
  }

  /** A* over the grid with 8-way moves (no corner cutting). Returns a list of points. */
  function findPath(g, from, to) {
    if (from < 0 || to < 0) return null;
    const n = g.walk.length;
    const gScore = new Float32Array(n).fill(Infinity);
    const came = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const tc = to % g.cols, tr = Math.floor(to / g.cols);
    const h = (i) => {
      const dx = Math.abs((i % g.cols) - tc), dy = Math.abs(Math.floor(i / g.cols) - tr);
      return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
    };
    const heap = [[h(from), from]];
    gScore[from] = 0;
    const push = (item) => {
      heap.push(item);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0], end = heap.pop();
      if (heap.length) {
        heap[0] = end;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    while (heap.length) {
      const [, cur] = pop();
      if (cur === to) {
        const out = [];
        for (let i = to; i !== -1; i = came[i]) out.push(center(g, i));
        return out.reverse();
      }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cc = cur % g.cols, cr = Math.floor(cur / g.cols);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nc = cc + dx, nr = cr + dy;
          if (nc < 0 || nr < 0 || nc >= g.cols || nr >= g.rows) continue;
          const ni = nr * g.cols + nc;
          if (!g.walk[ni] || closed[ni]) continue;
          if (dx && dy && (!g.walk[cr * g.cols + nc] || !g.walk[nr * g.cols + cc])) continue;
          const t = gScore[cur] + (dx && dy ? Math.SQRT2 : 1);
          if (t < gScore[ni]) {
            gScore[ni] = t;
            came[ni] = cur;
            push([t + h(ni), ni]);
          }
        }
      }
    }
    return null;
  }

  /** Drop intermediate grid points that lie on a straight line, so walking looks smooth. */
  function simplify(pts) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (Math.abs(cross) > 1e-6) out.push(b);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Behaviour                                                           */
  /* ------------------------------------------------------------------ */
  function goTo(x, y, speed = WALK) {
    const g = dog.grid;
    const from = nearestWalkable(g, cellOf(g, dog.x, dog.y));
    const to = nearestWalkable(g, cellOf(g, x, y));
    const path = findPath(g, from, to);
    if (!path) return false;
    dog.path = simplify(path).slice(1);
    dog.speed = speed;
    dog.target = { x, y };
    setMode('walk');
    return true;
  }

  function wander() {
    const g = dog.grid;
    if (!g || !g.cells.length) return;
    const p = env.plan();
    const bed = p.items.find((i) => i.kind === 'dogbed');
    if (bed && Math.random() < 0.3) {
      const f = foot(bed);
      if (goTo(bed.x + f.w / 2, bed.y + f.h / 2)) return (dog.goal = 'nap');
    }
    if (Math.random() < 0.08) {
      say(pick(LINES.zoomies), 1800);
      dog.goal = 'zoomies';
      dog.zoomies = 3;
    } else dog.goal = 'stroll';
    for (let tries = 0; tries < 8; tries++) {
      const c = center(g, pick(g.cells));
      if (Math.hypot(c.x - dog.x, c.y - dog.y) < 3 && tries < 7) continue;
      if (goTo(c.x, c.y, dog.goal === 'zoomies' ? RUN : WALK)) return;
    }
    dog.wait = 2;
  }

  function arrive() {
    if (dog.goal === 'zoomies' && --dog.zoomies > 0) {
      const c = center(dog.grid, pick(dog.grid.cells));
      if (goTo(c.x, c.y, RUN)) return;
    }
    if (dog.goal === 'nap') {
      setMode('sleep');
      dog.wait = rand(8, 14);
      return;
    }
    setMode('idle');
    dog.wait = rand(1.5, 4.5);
    if (Math.random() < 0.25) say(pick(LINES.idle), 1800);
  }

  function setMode(m) {
    if (dog.mode === m) return;
    dog.mode = m;
    paint();
  }

  function say(text, ms = 2800) {
    dog.bubble = { text, until: performance.now() + ms };
    paint();
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */
  /** Realistic top-down shiba, facing +x, sized ~2.3 ft nose to tail. */
  const FUR = 'url(#g-dogfur)';
  function awakeSprite() {
    const paw = (cls, x, y) => `<ellipse class="leg ${cls}" cx="${x}" cy="${y}" rx="0.13" ry="0.085" fill="#efdcc0" stroke="#a8692f" stroke-opacity=".4" stroke-width="0.015"/>`;
    return `
      <ellipse cx="0.05" cy="0.1" rx="1.15" ry="0.5" fill="#1c140c" opacity=".25" filter="url(#f-blur)"/>
      ${paw('a', 0.62, -0.3)}${paw('b', 0.62, 0.3)}${paw('b', -0.6, -0.32)}${paw('a', -0.6, 0.32)}
      <g class="dog-body">
        <ellipse cx="-0.1" cy="0" rx="0.8" ry="0.39" fill="${FUR}"/>
        <ellipse cx="-0.15" cy="0" rx="0.62" ry="0.13" fill="#9e5626" opacity=".35"/>
        <ellipse cx="-0.1" cy="0" rx="0.8" ry="0.39" fill="${GG.textures.use('o-fabric')}" opacity=".6"/>
        <g class="dog-tail">
          <circle cx="-0.72" cy="-0.02" r="0.27" fill="${FUR}"/>
          <path d="M-0.72 -0.02 m-0.17 0 a0.17 0.17 0 1 1 0.17 0.17 a0.09 0.09 0 1 1 -0.06 -0.12" fill="none" stroke="#f3e2c6" stroke-width="0.07" stroke-linecap="round"/>
        </g>
        <path d="M0.6 -0.14 L0.47 -0.38 L0.74 -0.26 Z" fill="#b8692f"/><path d="M0.6 -0.17 L0.52 -0.32 L0.69 -0.25 Z" fill="#f0c9a2"/>
        <path d="M0.6 0.14 L0.47 0.38 L0.74 0.26 Z" fill="#b8692f"/><path d="M0.6 0.17 L0.52 0.32 L0.69 0.25 Z" fill="#f0c9a2"/>
        <ellipse cx="0.74" cy="0" rx="0.31" ry="0.29" fill="${FUR}"/>
        <ellipse cx="0.98" cy="0" rx="0.18" ry="0.15" fill="#f2e2c8"/>
        <ellipse cx="1.12" cy="0" rx="0.055" ry="0.05" fill="#1f1a17"/>
        <circle cx="0.86" cy="-0.115" r="0.032" fill="#1f1a17"/><circle cx="0.86" cy="0.115" r="0.032" fill="#1f1a17"/>
      </g>`;
  }
  function sleepSprite() {
    return `
      <ellipse cx="0.05" cy="0.08" rx="0.75" ry="0.66" fill="#1c140c" opacity=".25" filter="url(#f-blur)"/>
      <g class="dog-body">
        <ellipse cx="0" cy="0" rx="0.62" ry="0.55" fill="${FUR}"/>
        <ellipse cx="0" cy="0" rx="0.62" ry="0.55" fill="${GG.textures.use('o-fabric')}" opacity=".6"/>
        <path d="M-0.45 0.35 Q0 0.75 0.45 0.32" fill="none" stroke="${FUR}" stroke-width="0.24" stroke-linecap="round"/>
        <path d="M-0.4 0.38 Q0 0.68 0.4 0.36" fill="none" stroke="#f3e2c6" stroke-width="0.06" stroke-linecap="round"/>
        <g transform="translate(0.28 0.08) rotate(70)">
          <path d="M-0.1 -0.15 L-0.25 -0.36 L0.02 -0.27 Z" fill="#b8692f"/><path d="M-0.1 0.15 L-0.25 0.36 L0.02 0.27 Z" fill="#b8692f"/>
          <ellipse cx="0" cy="0" rx="0.27" ry="0.26" fill="${FUR}"/>
          <ellipse cx="0.2" cy="0" rx="0.15" ry="0.13" fill="#f2e2c8"/>
          <ellipse cx="0.33" cy="0" rx="0.045" ry="0.04" fill="#1f1a17"/>
          <path d="M0.1 -0.13 q0.04 0.03 0.08 0 M0.1 0.13 q0.04 -0.03 0.08 0" fill="none" stroke="#1f1a17" stroke-width="0.02" stroke-linecap="round"/>
        </g>
      </g>`;
  }

  function inner() {
    const sleeping = dog.mode === 'sleep';
    const upp = env.upp();
    let bubble = '';
    if (dog.bubble && performance.now() < dog.bubble.until) {
      const fs = Math.max(0.42, 12.5 * upp);
      const w = Math.max(2.5, [...dog.bubble.text].length * fs * 0.54 + fs * 1.6);
      const h = fs * 2;
      const by = -1.3 - h;
      bubble = `<g class="dog-bubble" pointer-events="none" filter="url(#f-shadow-low)">
        <rect x="${-w / 2}" y="${by}" width="${w}" height="${h}" rx="${h / 2}" fill="#ffffff" fill-opacity=".96"/>
        <path d="M${-fs * 0.35} ${by + h - 0.01} L0 ${by + h + fs * 0.5} L${fs * 0.35} ${by + h - 0.01} Z" fill="#ffffff" fill-opacity=".96"/>
        <text x="0" y="${by + h / 2 + fs * 0.35}" font-size="${fs}" text-anchor="middle" fill="#2f2c29" font-weight="600" font-family="ui-sans-serif, system-ui, sans-serif">${esc(dog.bubble.text)}</text>
      </g>`;
    }
    const hearts = dog.hearts > performance.now()
      ? `<g class="dog-hearts" pointer-events="none" font-size="0.6"><text x="-1.3" y="-0.6">❤️</text><text x="0.8" y="-0.9">💕</text><text x="1" y="0.1">❤️</text></g>`
      : '';
    const zzz = sleeping ? `<g class="dog-zzz" pointer-events="none" font-family="Georgia, serif" font-style="italic" fill="#ffffff" stroke="#2f2c29" stroke-opacity=".35" stroke-width="0.02"><text x="0.55" y="-0.6" font-size="0.4">z</text><text x="0.85" y="-0.95" font-size="0.5">z</text><text x="1.2" y="-1.35" font-size="0.62">z</text></g>` : '';
    return `
      <g class="dog-rot" transform="rotate(${((dog.angle * 180) / Math.PI).toFixed(1)})">
        <g class="dog-sprite ${dog.mode}">${sleeping ? sleepSprite() : awakeSprite()}</g>
      </g>
      ${zzz}${hearts}${bubble}`;
  }

  function markup() {
    if (!env || !env.enabled() || !dog.grid) return '';
    return `<g id="gg-dog" data-dog="1" transform="translate(${dog.x.toFixed(2)} ${dog.y.toFixed(2)})" style="cursor:pointer">${inner()}</g>`;
  }

  function paint() {
    if (!dog.el || !dog.el.isConnected) dog.el = env && env.svg().querySelector('#gg-dog');
    if (dog.el) dog.el.innerHTML = inner();
  }

  /* ------------------------------------------------------------------ */
  /* Main loop                                                           */
  /* ------------------------------------------------------------------ */
  function rebuild() {
    dog.dirty = false;
    const wasMissing = !dog.grid;
    dog.grid = buildGrid(env.plan());
    const g = dog.grid;
    if (!g || !g.cells.length) return;
    const here = cellOf(g, dog.x, dog.y);
    if (!dog.placed || here < 0 || wasMissing) {
      // start in the middle of the biggest room
      const big = [...env.plan().rooms].filter((r) => !r.outdoor).sort((a, b) => b.w * b.h - a.w * a.h)[0] || env.plan().rooms[0];
      const c = center(g, nearestWalkable(g, cellOf(g, big.x + big.w / 2, big.y + big.h / 2)));
      Object.assign(dog, c, { placed: true, path: [], wait: 1.2 });
      setMode('idle');
      return env.redraw();
    }
    if (!g.walk[here]) {
      // furniture landed on Gougou: hop to the nearest free spot
      Object.assign(dog, center(g, nearestWalkable(g, here)));
      if (dog.mode === 'sleep') setMode('idle');
      say(pick(LINES.squished), 2000);
    }
    if (dog.path.length && dog.target) {
      if (!goTo(dog.target.x, dog.target.y, dog.speed)) {
        dog.path = [];
        dog.wait = 0.5;
        setMode('idle');
      }
    }
  }

  function tick(t) {
    dog.raf = requestAnimationFrame(tick);
    if (!env || !env.enabled() || document.hidden) return (dog.last = t);
    const dt = Math.min(0.05, (t - (dog.last || t)) / 1000);
    dog.last = t;
    if (dog.dirty) rebuild();
    if (!dog.grid || !dog.grid.cells.length) return;
    if (env.isDragging()) return; // stay still while the humans move things

    if (dog.path.length) {
      let step = dog.speed * dt;
      while (step > 0 && dog.path.length) {
        const n = dog.path[0];
        const dx = n.x - dog.x, dy = n.y - dog.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01) dog.heading = Math.atan2(dy, dx);
        if (d <= step) {
          dog.x = n.x;
          dog.y = n.y;
          dog.path.shift();
          step -= d;
        } else {
          dog.x += (dx / d) * step;
          dog.y += (dy / d) * step;
          step = 0;
        }
      }
      if (!dog.path.length) arrive();
    } else if ((dog.wait -= dt) <= 0) {
      if (dog.mode === 'sleep' && Math.random() < 0.5) say(pick(LINES.wake), 1800);
      wander();
    }

    if (dog.bubble && t > dog.bubble.until) {
      dog.bubble = null;
      paint();
    }
    if (dog.hearts && t > dog.hearts) {
      dog.hearts = 0;
      paint();
    }
    // turn smoothly toward the direction of travel
    if (dog.heading !== undefined && dog.mode !== 'sleep') {
      let diff = dog.heading - dog.angle;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      dog.angle += diff * Math.min(1, dt * 9);
    }
    if (!dog.el || !dog.el.isConnected) dog.el = env.svg().querySelector('#gg-dog');
    if (dog.el) {
      dog.el.setAttribute('transform', `translate(${dog.x.toFixed(2)} ${dog.y.toFixed(2)})`);
      const rot = dog.el.querySelector('.dog-rot');
      if (rot) rot.setAttribute('transform', `rotate(${((dog.angle * 180) / Math.PI).toFixed(1)})`);
    }
  }

  GG.dog = {
    /** env: { svg(), plan(), upp(), enabled(), isDragging(), redraw() } */
    init(e) {
      env = e;
      if (!dog.raf) dog.raf = requestAnimationFrame(tick);
    },
    markup,
    /** Call whenever rooms or furniture change. */
    invalidate() {
      dog.dirty = true;
    },
    /** New plan loaded: start fresh. */
    reset() {
      Object.assign(dog, { placed: false, path: [], bubble: null, grid: null, dirty: true, mode: 'idle', goal: null });
    },
    say,
    poke() {
      dog.hearts = performance.now() + 1400;
      say(pick(LINES.poke), 2000);
      if (dog.mode === 'sleep') {
        setMode('idle');
        dog.wait = 1;
      }
    },
    reactAdd(item) {
      if (Math.random() < 0.7) say(pick(LINES.add[item.kind] || LINES.addAny).replace('{name}', item.name));
    },
    reactRoom() {
      say(pick(LINES.room));
    },
    reactRemove(o) {
      if (Math.random() < 0.5) say(pick(LINES.remove).replace('{name}', o.name.toLowerCase()));
    },
    /** Come over to a point (e.g. where something was just placed). */
    visit(x, y) {
      if (dog.grid && dog.mode !== 'sleep') {
        dog.goal = 'stroll';
        goTo(x, y);
      }
    },
  };
})(window.GG);
