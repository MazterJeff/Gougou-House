/*
 * Gougou House — the 3D view (three.js). World units are feet: plan x → world x, plan y → world z, y is up.
 * The game owns the data; this view mirrors it, lets you orbit, select and drag pieces across the floor.
 */
(function (GG) {
  const THREE = window.THREE;
  const D = GG.data;
  const WALL_H = 8, WALL_T = 0.42;
  const CUT_H = 1.1; // how tall walls are when cut away

  const v = {
    on: false, api: null, host: null, renderer: null, scene: null, camera: null, controls: null,
    items: new Map(), roomsKey: '', roomsGroup: null, walls: [], selBox: null, badBoxes: [],
    raf: 0, drag: null, pending: null, dog: null, bubble: null, center: new THREE.Vector3(), extent: 20, wallMode: 'cut',
    ray: new THREE.Raycaster(), floorPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), lastT: 0, dirtyShadow: true,
  };

  const cat = (o) => D.furnitureByKind[o.kind] || {};
  const foot = (o) => (o.kind && o.rot % 180 !== 0 ? { w: o.h, h: o.w } : { w: o.w, h: o.h });

  /* ------------------------------------------------------------------ */
  /* Setup                                                               */
  /* ------------------------------------------------------------------ */
  function mount(host, api) {
    v.api = api;
    v.host = host;
    if (!v.renderer) create();
    host.appendChild(v.renderer.domElement);
    host.appendChild(v.bubble);
    v.on = true;
    v.roomsKey = '';
    resize();
    v.ro = new ResizeObserver(resize);
    v.ro.observe(host);
    sync();
    if (!v.framed) fit();
    loop(performance.now());
  }

  function unmount() {
    v.on = false;
    cancelAnimationFrame(v.raf);
    if (v.ro) v.ro.disconnect();
  }

  function create() {
    const r = (v.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }));
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.domElement.className = 'v3d-canvas';

    const s = (v.scene = new THREE.Scene());
    s.background = new THREE.Color('#e9e6e1');
    s.fog = new THREE.Fog('#e9e6e1', 120, 260);
    v.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 600);

    s.add(new THREE.HemisphereLight('#fffaf0', '#cbbfae', 1.6));
    const sun = (v.sun = new THREE.DirectionalLight('#fff3df', 2.6));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 4;
    s.add(sun, sun.target);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshStandardMaterial({ color: '#e4e0d9', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    ground.receiveShadow = true;
    ground.userData.ground = true;
    s.add(ground);
    v.ground = ground;

    v.controls = new THREE.OrbitControls(v.camera, r.domElement);
    v.controls.enableDamping = true;
    v.controls.dampingFactor = 0.12;
    v.controls.maxPolarAngle = 1.42;
    v.controls.minDistance = 5;
    v.controls.maxDistance = 220;
    v.controls.screenSpacePanning = false;

    v.selBox = new THREE.Box3Helper(new THREE.Box3(), '#d9825b');
    v.selBox.visible = false;
    v.selBox.material.depthTest = false;
    v.selBox.renderOrder = 10;
    s.add(v.selBox);

    v.dog = GG.models3d.dog();
    v.dog.visible = false;
    s.add(v.dog);

    v.bubble = document.createElement('div');
    v.bubble.className = 'bubble3d';
    v.bubble.hidden = true;

    GG.models3d.onTextureReady(() => (v.dirtyShadow = true));

    const el = r.domElement;
    el.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    el.addEventListener('dblclick', () => v.api.focusName());
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function resize() {
    if (!v.host) return;
    const w = v.host.clientWidth || 1, h = v.host.clientHeight || 1;
    v.renderer.setSize(w, h, false);
    v.camera.aspect = w / h;
    v.camera.updateProjectionMatrix();
  }

  /* ------------------------------------------------------------------ */
  /* Rooms: floors + walls with door/window openings                     */
  /* ------------------------------------------------------------------ */
  function openingsOf(p) {
    const out = [];
    p.items.forEach((i) => {
      if (i.kind !== 'door' && i.kind !== 'window') return;
      const f = foot(i);
      const cx = i.x + f.w / 2, cy = i.y + f.h / 2;
      if (i.kind === 'window') {
        const horiz = f.w >= f.h;
        out.push({ type: 'window', horiz, line: horiz ? cy : cx, a: horiz ? i.x : i.y, b: horiz ? i.x + f.w : i.y + f.h });
      } else {
        // the door's opening is its local bottom edge, rotated with the piece
        const t = ((i.rot || 0) * Math.PI) / 180;
        const mx = -(i.h / 2) * Math.sin(t), my = (i.h / 2) * Math.cos(t);
        const horiz = Math.abs(Math.cos(t)) > 0.5;
        const mid = horiz ? cx + mx : cy + my;
        out.push({ type: 'door', horiz, line: horiz ? cy + my : cx + mx, a: mid - i.w / 2, b: mid + i.w / 2 });
      }
    });
    return out;
  }

  /** Merge every indoor room edge into wall lines, then cut doorways and windows out of them. */
  function wallSegments(p) {
    const lines = new Map();
    const add = (horiz, line, a, b) => {
      const key = `${horiz ? 'h' : 'v'}${line.toFixed(2)}`;
      if (!lines.has(key)) lines.set(key, { horiz, line, spans: [] });
      lines.get(key).spans.push([a, b]);
    };
    p.rooms.filter((r) => !r.outdoor).forEach((r) => {
      add(true, r.y, r.x, r.x + r.w);
      add(true, r.y + r.h, r.x, r.x + r.w);
      add(false, r.x, r.y, r.y + r.h);
      add(false, r.x + r.w, r.y, r.y + r.h);
    });
    const openings = openingsOf(p);
    const segs = [];
    lines.forEach((L) => {
      L.spans.sort((s, t) => s[0] - t[0]);
      const merged = [];
      L.spans.forEach(([a, b]) => {
        const last = merged[merged.length - 1];
        if (last && a <= last[1] + 0.01) last[1] = Math.max(last[1], b);
        else merged.push([a, b]);
      });
      const cuts = openings.filter((o) => o.horiz === L.horiz && Math.abs(o.line - L.line) < 0.9);
      merged.forEach(([a, b]) => {
        let pieces = [[a, b]];
        cuts.forEach((c) => {
          const next = [];
          pieces.forEach(([s, e]) => {
            if (c.b <= s || c.a >= e) return next.push([s, e]);
            if (c.a > s) next.push([s, c.a]);
            if (c.b < e) next.push([c.b, e]);
            const ca = Math.max(s, c.a), cb = Math.min(e, c.b);
            if (cb - ca > 0.05) {
              if (c.type === 'window') segs.push({ horiz: L.horiz, line: L.line, a: ca, b: cb, y0: 0, y1: 3 });
              segs.push({ horiz: L.horiz, line: L.line, a: ca, b: cb, y0: c.type === 'window' ? 7 : 7, y1: WALL_H, lintel: true });
            }
          });
          pieces = next;
        });
        pieces.forEach(([s, e]) => e - s > 0.02 && segs.push({ horiz: L.horiz, line: L.line, a: s, b: e, y0: 0, y1: WALL_H }));
      });
    });
    return segs;
  }

  const wallMat = [
    new THREE.MeshStandardMaterial({ color: '#f4f1ec', roughness: 0.92 }),
    new THREE.MeshStandardMaterial({ color: '#3a3531', roughness: 0.8 }),
  ];

  function rebuildRooms(p) {
    if (v.roomsGroup) {
      v.scene.remove(v.roomsGroup);
      v.roomsGroup.traverse((m) => m.isMesh && m.geometry.dispose());
    }
    const G = (v.roomsGroup = new THREE.Group());
    p.rooms.forEach((r, idx) => {
      const name = r.floor || D.floorFor(r.name, r.outdoor);
      const tex = GG.models3d.floorTexture(name);
      const geo = new THREE.PlaneGeometry(r.w, r.h);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r.w, uv.getY(i) * r.h);
      const m = new THREE.Mesh(geo, floorMat(name, tex));
      m.rotation.x = -Math.PI / 2;
      m.position.set(r.x + r.w / 2, 0.002 * (idx % 5), r.y + r.h / 2);
      m.receiveShadow = true;
      m.userData.roomId = r.id;
      G.add(m);
    });
    v.walls = [];
    wallSegments(p).forEach((s) => {
      const len = s.b - s.a + (s.lintel ? 0 : WALL_T);
      const h = s.y1 - s.y0;
      const geo = s.horiz ? new THREE.BoxGeometry(len, h, WALL_T) : new THREE.BoxGeometry(WALL_T, h, len);
      geo.translate(0, h / 2 + s.y0, 0);
      geo.clearGroups();
      // top face (index 2) gets the dark "section cut" color, all other faces are painted wall
      for (let f = 0; f < 6; f++) geo.addGroup(f * 6, 6, f === 2 ? 1 : 0);
      const m = new THREE.Mesh(geo, wallMat);
      const mid = (s.a + s.b) / 2;
      if (s.horiz) m.position.set(mid, 0, s.line);
      else m.position.set(s.line, 0, mid);
      m.castShadow = m.receiveShadow = true;
      m.userData.wall = { mid: s.horiz ? new THREE.Vector2(mid, s.line) : new THREE.Vector2(s.line, mid), lintel: !!s.lintel, y0: s.y0 };
      G.add(m);
      v.walls.push(m);
    });
    v.scene.add(G);

    // frame the sun's shadow camera around the plan
    const b = bounds(p);
    v.center.set(b.x + b.w / 2, 0, b.y + b.h / 2);
    v.extent = Math.max(b.w, b.h) / 2 + 2;
    const sun = v.sun;
    sun.position.set(v.center.x - v.extent * 0.8, v.extent * 2.2 + 30, v.center.z - v.extent * 0.5);
    sun.target.position.copy(v.center);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -v.extent * 1.4;
    sc.right = sc.top = v.extent * 1.4;
    sc.near = 1;
    sc.far = v.extent * 6 + 80;
    sc.updateProjectionMatrix();
  }

  const floorMats = {};
  function floorMat(name, tex) {
    if (!floorMats[name]) {
      const rough = { marble: 0.18, tile: 0.3, checker: 0.3, terracotta: 0.6, concrete: 0.7, carpet: 1, grass: 1, deck: 0.8 }[name] ?? 0.45;
      floorMats[name] = new THREE.MeshStandardMaterial({ map: tex, roughness: rough });
    }
    return floorMats[name];
  }

  function bounds(p) {
    const els = [...p.rooms, ...p.items];
    if (!els.length) return { x: -2, y: -2, w: 30, h: 24 };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    els.forEach((o) => {
      const f = foot(o);
      x0 = Math.min(x0, o.x); y0 = Math.min(y0, o.y);
      x1 = Math.max(x1, o.x + f.w); y1 = Math.max(y1, o.y + f.h);
    });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /* ------------------------------------------------------------------ */
  /* Sync furniture with the plan                                        */
  /* ------------------------------------------------------------------ */
  function sync() {
    if (!v.on) return;
    const p = v.api.plan();
    const rk = JSON.stringify([p.rooms.map((r) => [r.x, r.y, r.w, r.h, r.floor, r.outdoor]), p.items.filter((i) => cat(i).layer === 3).map((i) => [i.x, i.y, i.w, i.h, i.rot])]);
    if (rk !== v.roomsKey) {
      v.roomsKey = rk;
      rebuildRooms(p);
    }
    const seen = new Set();
    let lamps = 0;
    p.items.forEach((o) => {
      seen.add(o.id);
      const key = [o.kind, o.w, o.h, o.color].join('|');
      let e = v.items.get(o.id);
      if (!e || e.key !== key) {
        if (e) disposeObj(e.obj);
        const isLamp = o.kind === 'floorlamp';
        const obj = GG.models3d.build(o, { lights: !isLamp || lamps < 4 });
        obj.userData.itemId = o.id;
        obj.traverse((m) => (m.userData.itemId = o.id));
        v.scene.add(obj);
        e = { obj, key };
        v.items.set(o.id, e);
      }
      if (o.kind === 'floorlamp') lamps++;
      const f = foot(o);
      e.obj.position.set(o.x + f.w / 2, 0, o.y + f.h / 2);
      e.obj.rotation.y = -((o.rot || 0) * Math.PI) / 180;
    });
    v.items.forEach((e, id) => {
      if (!seen.has(id)) {
        disposeObj(e.obj);
        v.items.delete(id);
      }
    });
    updateHelpers();
  }

  function disposeObj(obj) {
    v.scene.remove(obj);
    obj.traverse((m) => {
      if (m.isMesh && m.material && m.material.map && m.material.map.isCanvasTexture && m.material.userData.own) m.material.dispose();
    });
  }

  function updateHelpers() {
    const selId = v.api.sel();
    v.badBoxes.forEach((h) => v.scene.remove(h));
    v.badBoxes = [];
    v.api.overlaps().forEach((id) => {
      const e = v.items.get(id);
      if (!e) return;
      const h = new THREE.Box3Helper(new THREE.Box3().setFromObject(e.obj), '#d64545');
      h.material.depthTest = false;
      h.renderOrder = 9;
      v.scene.add(h);
      v.badBoxes.push(h);
    });
    const e = selId && v.items.get(selId);
    if (e) {
      v.selBox.box.setFromObject(e.obj);
      v.selBox.box.expandByScalar(0.08);
      v.selBox.visible = true;
    } else if (selId) {
      const r = v.api.find(selId);
      if (r && !r.kind) {
        v.selBox.box.set(new THREE.Vector3(r.x, 0, r.y), new THREE.Vector3(r.x + r.w, 0.3, r.y + r.h));
        v.selBox.visible = true;
      } else v.selBox.visible = false;
    } else v.selBox.visible = false;
  }

  /* ------------------------------------------------------------------ */
  /* Camera                                                              */
  /* ------------------------------------------------------------------ */
  function fit() {
    const p = v.api.plan();
    const b = bounds(p);
    const c = new THREE.Vector3(b.x + b.w / 2, 0, b.y + b.h / 2);
    // distance at which the plan's bounding circle fits the narrower side of the view
    const radius = Math.max(8, Math.hypot(b.w, b.h) / 2 + 1);
    const vfov = (v.camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * v.camera.aspect);
    const dist = (radius / Math.sin(Math.min(vfov, hfov) / 2)) * 0.92;
    const dir = new THREE.Vector3(0.18, 0.86, 0.72).normalize();
    v.controls.target.copy(c);
    v.camera.position.copy(c).addScaledVector(dir, dist);
    v.controls.update();
    v.framed = true;
  }

  function zoom(f) {
    const off = v.camera.position.clone().sub(v.controls.target).multiplyScalar(f);
    const len = THREE.MathUtils.clamp(off.length(), v.controls.minDistance, v.controls.maxDistance);
    v.camera.position.copy(v.controls.target).add(off.setLength(len));
    v.controls.update();
  }

  /* ------------------------------------------------------------------ */
  /* Picking & dragging                                                  */
  /* ------------------------------------------------------------------ */
  function ndc(e) {
    const r = v.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  /** Plan coordinates (feet) under the pointer, on the floor. */
  function pick(e) {
    if (!v.on) return null;
    v.ray.setFromCamera(ndc(e), v.camera);
    const hit = new THREE.Vector3();
    return v.ray.ray.intersectPlane(v.floorPlane, hit) ? { x: hit.x, y: hit.z } : null;
  }

  function hitTest(e) {
    v.ray.setFromCamera(ndc(e), v.camera);
    const targets = [...[...v.items.values()].map((x) => x.obj), v.roomsGroup, v.dog].filter(Boolean);
    const hits = v.ray.intersectObjects(targets, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.itemId && !o.userData.roomId && o !== v.dog && !o.userData.wall) o = o.parent;
      if (!o || o.userData.wall) continue;
      if (o === v.dog) return { dog: true };
      if (o.userData.itemId) {
        // rugs sit under everything: prefer whatever stands on top of them
        const it = v.api.find(o.userData.itemId);
        if (it && cat(it).layer === 0) {
          const better = hits.find((hh) => {
            let q = hh.object;
            while (q && !q.userData.itemId) q = q.parent;
            const qi = q && v.api.find(q.userData.itemId);
            return qi && cat(qi).layer !== 0;
          });
          if (better) {
            let q = better.object;
            while (!q.userData.itemId) q = q.parent;
            return { item: q.userData.itemId };
          }
        }
        return { item: o.userData.itemId };
      }
      if (o.userData.roomId) return { room: o.userData.roomId };
    }
    return null;
  }

  function onDown(e) {
    if (!v.on || e.button !== 0) return;
    const hit = hitTest(e);
    if (hit && hit.dog) {
      GG.dog.poke();
      return;
    }
    const sel = v.api.sel();
    if (hit && (hit.item || (hit.room && hit.room === sel))) {
      const id = hit.item || hit.room;
      const o = v.api.find(id);
      const pt = pick(e);
      if (!o || !pt) return;
      v.controls.enabled = false;
      const carry = !o.kind && !e.altKey
        ? v.api.plan().items.filter((i) => {
            const f = foot(i), cx = i.x + f.w / 2, cy = i.y + f.h / 2;
            return cx > o.x && cx < o.x + o.w && cy > o.y && cy < o.y + o.h;
          }).map((i) => ({ i, x: i.x, y: i.y }))
        : [];
      v.drag = { o, ox: o.x - pt.x, oy: o.y - pt.y, sx: e.clientX, sy: e.clientY, moved: false, start: { x: o.x, y: o.y }, carry };
      if (id !== sel) v.api.select(id);
      e.stopPropagation();
      return;
    }
    v.pending = { x: e.clientX, y: e.clientY, hit };
  }

  function onMove(e) {
    const d = v.drag;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
    const pt = pick(e);
    if (!pt) return;
    if (!d.moved) {
      d.moved = true;
      v.api.dragStart();
    }
    const step = e.shiftKey ? 1 : d.o.kind ? 0.25 : 0.5;
    d.o.x = Math.round((pt.x + d.ox) / step) * step;
    d.o.y = Math.round((pt.y + d.oy) / step) * step;
    const mx = d.o.x - d.start.x, my = d.o.y - d.start.y;
    d.carry.forEach((c) => {
      c.i.x = Math.round((c.x + mx) * 100) / 100;
      c.i.y = Math.round((c.y + my) * 100) / 100;
    });
    v.api.dragMove();
  }

  function onUp(e) {
    if (v.drag) {
      const d = v.drag;
      v.drag = null;
      v.controls.enabled = true;
      v.api.dragEnd(d.moved);
      return;
    }
    const p = v.pending;
    v.pending = null;
    if (!p || !v.on || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 5) return;
    v.api.select(p.hit && p.hit.room ? p.hit.room : null);
  }

  /** Screen rectangle (client px) covered by a piece, for keeping the panel out of the way. */
  function screenBox(id) {
    if (!v.on) return null;
    const e = v.items.get(id);
    let box;
    if (e) box = new THREE.Box3().setFromObject(e.obj);
    else {
      const r = v.api.find(id);
      if (!r) return null;
      box = new THREE.Box3(new THREE.Vector3(r.x, 0, r.y), new THREE.Vector3(r.x + r.w, 0.2, r.y + r.h));
    }
    const rect = v.renderer.domElement.getBoundingClientRect();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(v.camera);
      const sx = rect.left + ((p.x + 1) / 2) * rect.width, sy = rect.top + ((1 - p.y) / 2) * rect.height;
      x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
    }
    return { left: x0, top: y0, right: x1, bottom: y1, width: x1 - x0, height: y1 - y0 };
  }

  /* ------------------------------------------------------------------ */
  /* Frame loop: cutaway walls, Gougou, rendering                        */
  /* ------------------------------------------------------------------ */
  function updateWalls(dt) {
    const cam = new THREE.Vector2(v.camera.position.x - v.center.x, v.camera.position.z - v.center.z).normalize();
    const isLow = (x, z) => v.wallMode === 'down' || (v.wallMode === 'cut' && new THREE.Vector2(x - v.center.x, z - v.center.z).dot(cam) > -v.extent * 0.55); // only far walls stay up, like a dollhouse
    // windows live in walls: hide them when their wall is cut down
    v.items.forEach((e, id) => {
      const o = v.api.find(id);
      if (o && o.kind === 'window') e.obj.visible = !isLow(e.obj.position.x, e.obj.position.z);
    });
    v.walls.forEach((m) => {
      const w = m.userData.wall;
      const low = isLow(w.mid.x, w.mid.y);
      const target = low ? CUT_H / WALL_H : 1;
      m.scale.y += (target - m.scale.y) * Math.min(1, dt * 10);
      m.visible = !(w.lintel && m.scale.y < 0.9);
    });
  }

  function updateDog(t) {
    const st = GG.dog.state();
    v.dog.visible = !!st.visible;
    if (!st.visible) {
      v.bubble.hidden = true;
      return;
    }
    const { awake, asleep, legs, tail } = v.dog.userData;
    v.dog.position.set(st.x, 0, st.y);
    v.dog.rotation.y = -st.angle;
    awake.visible = st.mode !== 'sleep';
    asleep.visible = st.mode === 'sleep';
    const walking = st.mode === 'walk';
    const s = t / 1000;
    legs.forEach((l, i) => (l.rotation.z = walking ? Math.sin(s * 14 + (i % 3 ? Math.PI : 0)) * 0.5 : 0));
    tail.rotation.x = Math.sin(s * 9) * 0.35;
    awake.position.y = walking ? Math.abs(Math.sin(s * 14)) * 0.05 : 0;
    asleep.scale.y = 1 + Math.sin(s * 2.4) * 0.03;
    const text = st.hearts ? `❤️ ${st.bubble || ''}` : st.bubble;
    if (text) {
      const p = new THREE.Vector3(st.x, st.mode === 'sleep' ? 1.4 : 2.4, st.y).project(v.camera);
      v.bubble.hidden = false;
      v.bubble.textContent = text;
      v.bubble.style.transform = `translate(${((p.x + 1) / 2) * v.host.clientWidth}px, ${((1 - p.y) / 2) * v.host.clientHeight}px) translate(-50%, -100%)`;
    } else v.bubble.hidden = true;
  }

  function loop(t) {
    if (!v.on) return;
    v.raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    const dt = Math.min(0.05, (t - (v.lastT || t)) / 1000);
    v.lastT = t;
    v.controls.update();
    updateWalls(dt);
    updateDog(t);
    v.renderer.render(v.scene, v.camera);
  }

  function snapshot() {
    v.selBox.visible = false;
    v.renderer.render(v.scene, v.camera);
    const url = v.renderer.domElement.toDataURL('image/png');
    updateHelpers();
    return url;
  }

  GG.view3d = {
    mount, unmount, sync, fit, zoom, pick, screenBox, snapshot,
    /** Plan point the camera is looking at. */
    target: () => ({ x: v.controls.target.x, y: v.controls.target.z }),
    get active() {
      return v.on;
    },
    setWallMode(m) {
      v.wallMode = m;
    },
  };
})(window.GG);
