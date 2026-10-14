/*
 * Gougou House — AI helper. A chat panel backed by Claude (official Anthropic SDK, vendored) that can
 * read the current design and change it through tools: rooms, furniture, doors & windows, floors.
 * Runs entirely in the browser with the user's own API key (kept in this browser's localStorage).
 */
(function (GG) {
  const { esc, uid, toast } = GG.util;
  const D = GG.data;
  const MODEL = 'claude-opus-5-5';
  const KEY_STORE = 'gougou-house-anthropic-key';
  const MAX_TOOL_ROUNDS = 12;
  const r2 = (v) => Math.round(v * 100) / 100;

  const A = () => GG.game.ai;
  const S = () => GG.store.state;

  /* ================================================================== */
  /* Plan snapshot & geometry helpers                                   */
  /* ================================================================== */

  const roomOf = (p, o) => {
    const f = A().foot(o);
    const cx = o.x + f.w / 2, cy = o.y + f.h / 2;
    // smallest room containing the piece's centre
    return p.rooms.filter((r) => cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h).sort((a, b) => a.w * a.h - b.w * b.h)[0] || null;
  };

  function snapshot() {
    const p = A().plan();
    let indoor = 0;
    p.rooms.forEach((r) => !r.outdoor && (indoor += r.w * r.h));
    return {
      design: p.name,
      indoor_area_sqft: Math.round(indoor),
      rooms: p.rooms.map((r) => ({ id: r.id, name: r.name, x: r2(r.x), y: r2(r.y), width: r2(r.w), length: r2(r.h), floor: r.floor, outdoor: !!r.outdoor })),
      furniture: p.items.map((o) => {
        const f = A().foot(o);
        const room = roomOf(p, o);
        return { id: o.id, kind: o.kind, name: o.name, x: r2(o.x), y: r2(o.y), footprint_w: r2(f.w), footprint_d: r2(f.h), rotation: o.rot || 0, color: o.color, room: room ? room.name : null };
      }),
    };
  }

  /** Where a door's opening edge sits (mirrors the 3D wall cutter). */
  function doorEdge(i) {
    const f = A().foot(i);
    const cx = i.x + f.w / 2, cy = i.y + f.h / 2;
    const t = ((i.rot || 0) * Math.PI) / 180;
    const mx = -(i.h / 2) * Math.sin(t), my = (i.h / 2) * Math.cos(t);
    const horiz = Math.abs(Math.cos(t)) > 0.5;
    const mid = horiz ? cx + mx : cy + my;
    return { horiz, line: horiz ? cy + my : cx + mx, a: mid - i.w / 2, b: mid + i.w / 2 };
  }

  const solid = (o) => (A().cat(o).layer ?? 1) === 1;
  const boxOf = (o, x = o.x, y = o.y) => {
    const f = A().foot(o);
    return { x, y, w: f.w, h: f.h };
  };
  const hits = (a, b, m = 0) => a.x - m < b.x + b.w && b.x - m < a.x + a.w && a.y - m < b.y + b.h && b.y - m < a.y + a.h;

  /** Find a free spot for a piece inside a room: along the walls first (backs to the wall), then anywhere. */
  function findSpot(room, o) {
    const p = A().plan();
    const others = p.items.filter((i) => i !== o && solid(i)).map((i) => boxOf(i));
    const inset = 0.35;
    const fits = (b) =>
      b.x >= room.x + inset - 1e-6 && b.y >= room.y + inset - 1e-6 && b.x + b.w <= room.x + room.w - inset + 1e-6 && b.y + b.h <= room.y + room.h - inset + 1e-6 &&
      !others.some((q) => hits(b, q, 0.3));
    const kind = o.kind;
    const c = A().cat(o);
    if (c.layer === 0) {
      // rugs: centred in the room
      o.rot = o.w > o.h === room.w > room.h ? 0 : 90;
      const f = A().foot(o);
      return { x: r2(room.x + (room.w - f.w) / 2), y: r2(room.y + (room.h - f.h) / 2), rot: o.rot };
    }
    const companion = companionSpot(room, o, others);
    if (companion) return companion;
    if (['table4', 'table6', 'roundtable', 'island', 'pouf'].includes(kind)) {
      // tables float in the middle of the room so chairs fit all around
      o.rot = o.w >= o.h === room.w >= room.h ? 0 : 90;
      const f = A().foot(o);
      const cx = room.x + (room.w - f.w) / 2, cy = room.y + (room.h - f.h) / 2;
      const cands = [];
      for (let y = room.y + inset; y <= room.y + room.h - f.h - inset + 1e-6; y += 0.5)
        for (let x = room.x + inset; x <= room.x + room.w - f.w - inset + 1e-6; x += 0.5) cands.push({ x, y, w: f.w, h: f.h });
      cands.unshift({ x: cx, y: cy, w: f.w, h: f.h });
      cands.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
      const hit = cands.find(fits);
      if (hit) return { x: r2(hit.x), y: r2(hit.y), rot: o.rot };
    }
    const tries = [];
    const walls = [
      ['north', 0], ['south', 180], ['west', 270], ['east', 90],
    ];
    const cornerFirst = ['plant', 'plantbig', 'floorlamp', 'cattree'].includes(kind);
    for (const [wall, rot] of walls) {
      o.rot = rot;
      const f = A().foot(o);
      const along = wall === 'north' || wall === 'south';
      const span = along ? room.w : room.h;
      const size = along ? f.w : f.h;
      const steps = [];
      for (let t = inset; t <= span - size - inset + 1e-6; t += 0.5) steps.push(t);
      // centre of the wall first (sofas, beds, TVs look best centred), then outwards; corners first for plants
      const mid = (span - size) / 2;
      steps.sort((a, b) => (cornerFirst ? Math.abs(b - mid) - Math.abs(a - mid) : Math.abs(a - mid) - Math.abs(b - mid)));
      for (const t of steps) {
        const b = along
          ? { x: room.x + t, y: wall === 'north' ? room.y + inset : room.y + room.h - inset - f.h, w: f.w, h: f.h }
          : { x: wall === 'west' ? room.x + inset : room.x + room.w - inset - f.w, y: room.y + t, w: f.w, h: f.h };
        tries.push({ b, rot });
      }
    }
    o.rot = 0;
    const f0 = A().foot(o);
    for (let y = room.y + inset; y <= room.y + room.h - f0.h - inset + 1e-6; y += 0.5)
      for (let x = room.x + inset; x <= room.x + room.w - f0.w - inset + 1e-6; x += 0.5) tries.push({ b: { x, y, w: f0.w, h: f0.h }, rot: 0 });
    for (const t of tries) if (fits(t.b)) return { x: r2(t.b.x), y: r2(t.b.y), rot: t.rot };
    return null;
  }

  /**
   * Pieces that belong next to another piece: desk chair at the desk, dining chairs around the table,
   * nightstands at the head of the bed. Positions are computed in the anchor's own (rotated) frame.
   */
  const COMPANIONS = {
    officechair: { anchors: ['desk'], spots: (a, o) => [[0, a.h / 2 + o.h / 2 - 0.35, 180]] },
    chair: {
      anchors: ['table6', 'table4', 'roundtable', 'desk'],
      spots: (a, o) => {
        const out = [];
        const n = Math.max(1, Math.floor((a.w - 0.4) / 2));
        for (let k = 0; k < n; k++) {
          const lx = -a.w / 2 + (a.w / n) * (k + 0.5);
          out.push([lx, -(a.h / 2 + o.h / 2 + 0.05), 0], [lx, a.h / 2 + o.h / 2 + 0.05, 180]);
        }
        out.push([-(a.w / 2 + o.h / 2 + 0.05), 0, 90], [a.w / 2 + o.h / 2 + 0.05, 0, 270]);
        return out;
      },
    },
    coffee: { anchors: ['sofa', 'sectional', 'loveseat'], spots: (a, o) => [[a.kind === 'sectional' ? a.w * 0.15 : 0, a.h / 2 + o.h / 2 + 1.4, 0]] },
    nightstand: { anchors: ['king', 'queen', 'full'], spots: (a, o) => [[-(a.w / 2 + o.w / 2 + 0.1), -a.h / 2 + o.h / 2 + 0.05, 0], [a.w / 2 + o.w / 2 + 0.1, -a.h / 2 + o.h / 2 + 0.05, 0]] },
  };

  function companionSpot(room, o, others) {
    const rule = COMPANIONS[o.kind];
    if (!rule) return null;
    const p = A().plan();
    const anchors = p.items.filter((i) => rule.anchors.includes(i.kind) && roomOf(p, i) === room).sort((a, b) => rule.anchors.indexOf(a.kind) - rule.anchors.indexOf(b.kind));
    for (const a of anchors) {
      const fa = A().foot(a);
      const acx = a.x + fa.w / 2, acy = a.y + fa.h / 2;
      const t = ((a.rot || 0) * Math.PI) / 180;
      for (const [lx, ly, lrot] of rule.spots(a, o)) {
        const rot = ((a.rot || 0) + lrot) % 360;
        o.rot = rot;
        const f = A().foot(o);
        const cx = acx + lx * Math.cos(t) - ly * Math.sin(t), cy = acy + lx * Math.sin(t) + ly * Math.cos(t);
        const b = { x: cx - f.w / 2, y: cy - f.h / 2, w: f.w, h: f.h };
        const inRoom = b.x >= room.x + 0.2 && b.y >= room.y + 0.2 && b.x + b.w <= room.x + room.w - 0.2 && b.y + b.h <= room.y + room.h - 0.2;
        // a desk chair may tuck under its desk; everything else must stay clear of other pieces
        const blockers = o.kind === 'officechair' ? others.filter((q) => !(Math.abs(q.x - a.x) < 1e-6 && Math.abs(q.y - a.y) < 1e-6)) : others;
        if (inRoom && !blockers.some((q) => hits(b, q, 0.02))) return { x: r2(b.x), y: r2(b.y), rot };
      }
    }
    o.rot = 0;
    return null;
  }

  /** Other rooms a room now overlaps (shared edges are fine). */
  const roomClashes = (r) => A().plan().rooms.filter((q) => q !== r && hits({ x: r.x, y: r.y, w: r.w, h: r.h }, { x: q.x, y: q.y, w: q.w, h: q.h }, -0.05)).map((q) => `${q.name} (${q.id})`);

  /* ================================================================== */
  /* Tools                                                              */
  /* ================================================================== */
  const FURNITURE_KINDS = D.furniture.filter((f) => f.layer !== 3).map((f) => f.kind);
  const FLOORS = GG.textures.floors;
  const num = (description) => ({ type: 'number', description });
  const str = (description) => ({ type: 'string', description });

  const TOOLS = [
    {
      name: 'get_plan',
      description: 'Return the current design: every room (id, name, position, size, floor) and every piece of furniture, door and window (id, kind, position, footprint, rotation, color, room). Use it after making several changes if you need fresh coordinates.',
      input_schema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'add_room',
      description: 'Add a room (or outdoor space) as a rectangle. x/y is the top-left (north-west) corner in feet. Walls are drawn automatically along room edges; rooms that share an edge share a wall, so place new rooms flush against existing ones (e.g. x = other.x + other.width).',
      input_schema: {
        type: 'object',
        properties: {
          name: str('Room name, e.g. "Office", "Bedroom 2", "Balcony"'),
          x: num('West edge, feet'),
          y: num('North edge, feet'),
          width: num('East-west size in feet (min 3)'),
          length: num('North-south size in feet (min 3)'),
          floor: { type: 'string', enum: FLOORS, description: 'Floor finish (defaults by room type)' },
          outdoor: { type: 'boolean', description: 'True for balconies, yards and patios (no walls, not counted as floor area)' },
        },
        required: ['name', 'x', 'y', 'width', 'length'],
        additionalProperties: false,
      },
    },
    {
      name: 'update_room',
      description: 'Rename, move, resize or re-floor a room. When moving, the furniture inside moves with it unless move_furniture is false. Resizing keeps the north-west corner fixed unless you also pass x/y.',
      input_schema: {
        type: 'object',
        properties: {
          room_id: str('Room id from the plan'),
          name: str('New name'),
          x: num('New west edge, feet'),
          y: num('New north edge, feet'),
          width: num('New east-west size, feet'),
          length: num('New north-south size, feet'),
          floor: { type: 'string', enum: FLOORS },
          outdoor: { type: 'boolean' },
          move_furniture: { type: 'boolean', description: 'Move the furniture inside along with the room (default true)' },
        },
        required: ['room_id'],
        additionalProperties: false,
      },
    },
    {
      name: 'delete_room',
      description: 'Remove a room. Its furniture, doors and windows are removed too unless keep_furniture is true.',
      input_schema: {
        type: 'object',
        properties: { room_id: str('Room id'), keep_furniture: { type: 'boolean' } },
        required: ['room_id'],
        additionalProperties: false,
      },
    },
    {
      name: 'add_furniture',
      description: 'Add one or more pieces of furniture or decor. Give room_id (and optionally x/y/rotation). Without x/y the piece is placed automatically in a free spot in that room, back against a wall; rugs are centred. Returns where each piece landed. Rotation: 0 = back of the piece faces north (top), 90 = faces east, 180 = south, 270 = west.',
      input_schema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: FURNITURE_KINDS, description: 'Catalog kind' },
          room_id: str('Room to put it in'),
          x: num('West edge of the footprint, feet (optional)'),
          y: num('North edge of the footprint, feet (optional)'),
          rotation: { type: 'integer', enum: [0, 90, 180, 270] },
          color: str('Hex color like #8f9e86 (optional; fabric, wood finish or rug color)'),
          name: str('Custom label (optional)'),
          count: { type: 'integer', minimum: 1, maximum: 8, description: 'How many to add (auto-placed), default 1' },
        },
        required: ['kind'],
        additionalProperties: false,
      },
    },
    {
      name: 'update_furniture',
      description: 'Move, rotate, resize, recolor or rename a piece. Pass room_id without x/y to move it into another room at a free spot.',
      input_schema: {
        type: 'object',
        properties: {
          item_id: str('Furniture id from the plan'),
          x: num('New west edge of the footprint, feet'),
          y: num('New north edge of the footprint, feet'),
          rotation: { type: 'integer', enum: [0, 90, 180, 270] },
          width: num('New width in feet (the piece\'s own width, before rotation)'),
          depth: num('New depth in feet (before rotation)'),
          color: str('Hex color'),
          name: str('New label'),
          room_id: str('Move into this room (auto-placed)'),
        },
        required: ['item_id'],
        additionalProperties: false,
      },
    },
    {
      name: 'delete_furniture',
      description: 'Remove furniture, doors or windows by id.',
      input_schema: {
        type: 'object',
        properties: { item_ids: { type: 'array', items: { type: 'string' }, minItems: 1 } },
        required: ['item_ids'],
        additionalProperties: false,
      },
    },
    {
      name: 'add_opening',
      description: 'Add a door or window in one wall of a room. The 3D walls get the opening cut out automatically. offset is the distance in feet from the wall\'s west end (north/south walls) or north end (east/west walls) to the start of the opening; omit it to centre the opening.',
      input_schema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['door', 'window'] },
          room_id: str('Room id'),
          wall: { type: 'string', enum: ['north', 'south', 'east', 'west'] },
          offset: num('Feet from the start of the wall (optional)'),
          width: num('Opening width in feet (door default 2.67, window default 4)'),
        },
        required: ['type', 'room_id', 'wall'],
        additionalProperties: false,
      },
    },
    {
      name: 'check_layout',
      description: 'Inspect the design for problems: overlapping furniture, furniture outside any room, tight walkways (< 2 ft) between large pieces, rooms without a door, bedrooms without a window. Use it after larger changes and when the user asks for advice.',
      input_schema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'new_design',
      description: 'Start a new design from a starter space and switch to it (the current design is kept in the design list).',
      input_schema: {
        type: 'object',
        properties: {
          template: { type: 'string', enum: D.templates.map((t) => t.id), description: D.templates.map((t) => `${t.id} = ${t.name}`).join('; ') },
          furnished: { type: 'boolean', description: 'Include starter furniture (default false: empty rooms)' },
          name: str('Name for the design'),
        },
        required: ['template'],
        additionalProperties: false,
      },
    },
    {
      name: 'set_view',
      description: 'Switch between the 3D dollhouse view and the 2D floor plan, and choose how walls are shown in 3D.',
      input_schema: {
        type: 'object',
        properties: { view: { type: 'string', enum: ['3d', '2d'] }, walls: { type: 'string', enum: ['cut', 'up', 'down'] } },
        additionalProperties: false,
      },
    },
  ].map((t) => ({ ...t, eager_input_streaming: true }));

  /** Minimal JSON-schema check for our tool inputs (eager streaming means the server no longer validates them). */
  function validate(schema, input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return 'input must be an object';
    for (const k of schema.required || []) if (input[k] === undefined) return `missing "${k}"`;
    for (const [k, v] of Object.entries(input)) {
      const s = schema.properties[k];
      if (!s) return `unknown field "${k}"`;
      if (s.type === 'number' && (typeof v !== 'number' || !isFinite(v))) return `"${k}" must be a number`;
      if (s.type === 'integer' && !Number.isInteger(v)) return `"${k}" must be an integer`;
      if (s.type === 'string' && typeof v !== 'string') return `"${k}" must be a string`;
      if (s.type === 'boolean' && typeof v !== 'boolean') return `"${k}" must be true or false`;
      if (s.type === 'array' && (!Array.isArray(v) || v.some((x) => typeof x !== 'string'))) return `"${k}" must be a list of ids`;
      if (s.enum && !s.enum.includes(v)) return `"${k}" must be one of ${s.enum.join(', ')}`;
    }
    return null;
  }

  class ToolError extends Error {}
  const need = (cond, msg) => {
    if (!cond) throw new ToolError(msg);
  };
  const getRoom = (id) => {
    const r = A().plan().rooms.find((x) => x.id === id);
    need(r, `No room with id ${id}. Call get_plan to see room ids.`);
    return r;
  };
  const getItem = (id) => {
    const o = A().plan().items.find((x) => x.id === id);
    need(o, `No furniture with id ${id}. Call get_plan to see ids.`);
    return o;
  };
  const isHex = (c) => /^#[0-9a-f]{6}$/i.test(c);

  const RUN = {
    get_plan: () => ({ result: snapshot() }),

    add_room(i) {
      need(i.width >= 3 && i.length >= 3 && i.width <= 200 && i.length <= 200, 'Rooms must be between 3 and 200 ft on each side.');
      const t = D.roomTypes.find((rt) => i.name.toLowerCase().startsWith(rt.name.toLowerCase())) || {};
      const outdoor = i.outdoor ?? !!t.outdoor;
      const r = { id: uid('r'), name: i.name, x: r2(i.x), y: r2(i.y), w: r2(i.width), h: r2(i.length), color: t.color || '#f2efe9', floor: i.floor || D.floorFor(i.name, outdoor), outdoor };
      A().plan().rooms.push(r);
      return { result: { added_room: r.id, name: r.name, overlaps_rooms: roomClashes(r) }, note: `🚪 Added ${r.name} (${r.w}′ × ${r.h}′)` };
    },

    update_room(i) {
      const r = getRoom(i.room_id);
      const p = A().plan();
      const inside = i.move_furniture === false ? [] : p.items.filter((o) => roomOf(p, o) === r);
      const nx = i.x ?? r.x, ny = i.y ?? r.y;
      const dx = nx - r.x, dy = ny - r.y;
      if (i.width !== undefined || i.length !== undefined) need((i.width ?? r.w) >= 3 && (i.length ?? r.h) >= 3, 'Rooms must be at least 3 ft on each side.');
      inside.forEach((o) => {
        o.x = r2(o.x + dx);
        o.y = r2(o.y + dy);
      });
      Object.assign(r, { x: r2(nx), y: r2(ny), w: r2(i.width ?? r.w), h: r2(i.length ?? r.h) });
      if (i.name) r.name = i.name;
      if (i.floor) r.floor = i.floor;
      if (i.outdoor !== undefined) r.outdoor = i.outdoor;
      return { result: { updated_room: r.id, x: r.x, y: r.y, width: r.w, length: r.h, floor: r.floor, moved_furniture: inside.length, overlaps_rooms: roomClashes(r) }, note: `📐 Updated ${r.name}` };
    },

    delete_room(i) {
      const r = getRoom(i.room_id);
      const p = A().plan();
      let removed = 0;
      if (!i.keep_furniture) {
        const before = p.items.length;
        p.items = p.items.filter((o) => {
          if (roomOf(p, o) === r) return false;
          if (A().cat(o).layer === 3) {
            const f = A().foot(o);
            const cx = o.x + f.w / 2, cy = o.y + f.h / 2;
            const onEdge = cx >= r.x - 0.6 && cx <= r.x + r.w + 0.6 && cy >= r.y - 0.6 && cy <= r.y + r.h + 0.6;
            const sharedWithOther = p.rooms.some((q) => q !== r && cx >= q.x - 0.6 && cx <= q.x + q.w + 0.6 && cy >= q.y - 0.6 && cy <= q.y + q.h + 0.6);
            if (onEdge && !sharedWithOther) return false;
          }
          return true;
        });
        removed = before - p.items.length;
      }
      p.rooms = p.rooms.filter((x) => x !== r);
      return { result: { deleted_room: r.name, removed_furniture: removed }, note: `🗑 Removed ${r.name}` };
    },

    add_furniture(i) {
      const p = A().plan();
      const count = i.count || 1;
      need(!(count > 1 && (i.x !== undefined || i.y !== undefined)), 'Use count only with automatic placement (no x/y).');
      let room = i.room_id ? getRoom(i.room_id) : null;
      if (!room && (i.x === undefined || i.y === undefined)) {
        room = [...p.rooms].filter((r) => !r.outdoor).sort((a, b) => b.w * b.h - a.w * a.h)[0];
        need(room, 'There are no rooms yet. Add a room first.');
      }
      if (i.color) need(isHex(i.color), 'color must be a hex code like #8f9e86');
      const placed = [];
      for (let n = 0; n < count; n++) {
        const o = A().makeItem(i.kind);
        if (i.name) o.name = count > 1 ? `${i.name} ${n + 1}` : i.name;
        if (i.color) o.color = i.color;
        if (i.x !== undefined && i.y !== undefined) {
          o.rot = i.rotation || 0;
          o.x = r2(i.x);
          o.y = r2(i.y);
        } else {
          const spot = findSpot(room, o);
          if (!spot) {
            if (!placed.length) throw new ToolError(`No free spot for a ${o.name} in ${room.name}. Make the room bigger, move something, or give x/y.`);
            break;
          }
          o.x = spot.x;
          o.y = spot.y;
          o.rot = i.rotation ?? spot.rot;
        }
        p.items.push(o);
        const where = roomOf(p, o);
        placed.push({ id: o.id, name: o.name, x: o.x, y: o.y, rotation: o.rot, room: where ? where.name : null });
      }
      const bad = A().overlaps();
      return {
        result: { added: placed, now_overlapping: placed.filter((x) => bad.has(x.id)).map((x) => x.id) },
        note: `🛋️ Added ${placed.length > 1 ? `${placed.length} × ` : ''}${placed[0].name}${placed[0].room ? ` to ${placed[0].room}` : ''}`,
      };
    },

    update_furniture(i) {
      const o = getItem(i.item_id);
      if (i.color) need(isHex(i.color), 'color must be a hex code like #8f9e86');
      if (i.width !== undefined) need(i.width > 0.2 && i.width < 40, 'width out of range');
      if (i.depth !== undefined) need(i.depth > 0.2 && i.depth < 40, 'depth out of range');
      if (i.width !== undefined) o.w = r2(i.width);
      if (i.depth !== undefined) o.h = r2(i.depth);
      if (i.color) o.color = i.color;
      if (i.name) o.name = i.name;
      if (i.rotation !== undefined) {
        // rotate around the centre, like the R key
        const before = A().foot(o);
        const cx = o.x + before.w / 2, cy = o.y + before.h / 2;
        o.rot = i.rotation;
        const after = A().foot(o);
        o.x = r2(cx - after.w / 2);
        o.y = r2(cy - after.h / 2);
      }
      if (i.room_id && i.x === undefined && i.y === undefined) {
        const room = getRoom(i.room_id);
        const spot = findSpot(room, o);
        need(spot, `No free spot for ${o.name} in ${room.name}.`);
        Object.assign(o, { x: spot.x, y: spot.y, rot: i.rotation ?? spot.rot });
      }
      if (i.x !== undefined) o.x = r2(i.x);
      if (i.y !== undefined) o.y = r2(i.y);
      const room = roomOf(A().plan(), o);
      return { result: { updated: o.id, x: o.x, y: o.y, rotation: o.rot, room: room ? room.name : null, overlapping: A().overlaps().has(o.id) }, note: `✏️ Updated ${o.name}` };
    },

    delete_furniture(i) {
      const p = A().plan();
      const gone = p.items.filter((o) => i.item_ids.includes(o.id));
      need(gone.length, 'None of those ids exist. Call get_plan.');
      p.items = p.items.filter((o) => !i.item_ids.includes(o.id));
      return { result: { deleted: gone.map((o) => o.name) }, note: `🗑 Removed ${gone.length === 1 ? gone[0].name : `${gone.length} pieces`}` };
    },

    add_opening(i) {
      const r = getRoom(i.room_id);
      const o = A().makeItem(i.type);
      const horizWall = i.wall === 'north' || i.wall === 'south';
      const span = horizWall ? r.w : r.h;
      const width = i.width ?? (i.type === 'door' ? 32 / 12 : 4);
      need(width >= 1.5 && width <= span - 0.5, `Opening must be between 1.5 ft and ${r2(span - 0.5)} ft wide on that wall.`);
      const offset = i.offset ?? (span - width) / 2;
      need(offset >= 0 && offset + width <= span + 1e-6, `offset must be between 0 and ${r2(span - width)} ft on the ${i.wall} wall of ${r.name}.`);
      if (i.type === 'door') {
        o.w = o.h = r2(width);
        o.rot = { north: 180, south: 0, east: 270, west: 90 }[i.wall];
        if (horizWall) {
          o.x = r2(r.x + offset);
          o.y = r2(i.wall === 'north' ? r.y : r.y + r.h - width);
        } else {
          o.y = r2(r.y + offset);
          o.x = r2(i.wall === 'west' ? r.x : r.x + r.w - width);
        }
      } else {
        o.w = r2(width);
        o.rot = horizWall ? 0 : 90;
        if (horizWall) {
          o.x = r2(r.x + offset);
          o.y = r2((i.wall === 'north' ? r.y : r.y + r.h) - o.h / 2);
        } else {
          o.y = r2(r.y + offset);
          o.x = r2((i.wall === 'west' ? r.x : r.x + r.w) - o.h / 2);
        }
      }
      A().plan().items.push(o);
      return { result: { added: o.id, type: i.type, room: r.name, wall: i.wall, offset: r2(offset), width: r2(width) }, note: `${i.type === 'door' ? '🚪' : '🪟'} Added a ${i.type} on the ${i.wall} wall of ${r.name}` };
    },

    check_layout() {
      const p = A().plan();
      const bad = A().overlaps();
      const overlaps = [];
      const solids = p.items.filter(solid);
      for (let a = 0; a < solids.length; a++)
        for (let b = a + 1; b < solids.length; b++) {
          if (bad.has(solids[a].id) && bad.has(solids[b].id) && hits(boxOf(solids[a]), boxOf(solids[b]), -0.05)) overlaps.push([solids[a].name, solids[a].id, solids[b].name, solids[b].id]);
        }
      const outside = p.items.filter((o) => A().cat(o).layer !== 3 && !roomOf(p, o)).map((o) => `${o.name} (${o.id})`);
      const BIG = new Set(['sofa', 'sectional', 'loveseat', 'king', 'queen', 'full', 'table4', 'table6', 'roundtable', 'desk', 'counter', 'island', 'dresser', 'wardrobe', 'bookshelf', 'tv', 'piano', 'coffee', 'armchair']);
      const PAIRS = [['king', 'nightstand'], ['queen', 'nightstand'], ['full', 'nightstand'], ['desk', 'officechair'], ['table4', 'chair'], ['table6', 'chair'], ['roundtable', 'chair'], ['counter', 'range'], ['counter', 'fridge'], ['counter', 'sink'], ['sofa', 'coffee'], ['sectional', 'coffee'], ['loveseat', 'coffee'], ['armchair', 'coffee']];
      const paired = (a, b) => PAIRS.some(([x, y]) => (a.kind === x && b.kind === y) || (a.kind === y && b.kind === x));
      const tight = [];
      const big = solids.filter((o) => BIG.has(o.kind));
      for (let a = 0; a < big.length; a++)
        for (let b = a + 1; b < big.length; b++) {
          const A1 = boxOf(big[a]), B1 = boxOf(big[b]);
          if (hits(A1, B1) || paired(big[a], big[b])) continue;
          const gx = Math.max(A1.x, B1.x) - Math.min(A1.x + A1.w, B1.x + B1.w);
          const gy = Math.max(A1.y, B1.y) - Math.min(A1.y + A1.h, B1.y + B1.h);
          const gap = Math.max(gx, gy);
          const facing = (gx > 0 && gy < -0.5) || (gy > 0 && gx < -0.5);
          if (facing && gap > 0.05 && gap < 2 && roomOf(p, big[a]) === roomOf(p, big[b])) tight.push(`${big[a].name} ↔ ${big[b].name}: ${r2(gap)} ft`);
        }
      const doors = p.items.filter((o) => o.kind === 'door').map(doorEdge);
      const onRoomEdge = (r, e) =>
        e.horiz
          ? (Math.abs(e.line - r.y) < 0.7 || Math.abs(e.line - (r.y + r.h)) < 0.7) && e.b > r.x && e.a < r.x + r.w
          : (Math.abs(e.line - r.x) < 0.7 || Math.abs(e.line - (r.x + r.w)) < 0.7) && e.b > r.y && e.a < r.y + r.h;
      const noDoor = p.rooms.filter((r) => !r.outdoor && !doors.some((e) => onRoomEdge(r, e))).map((r) => r.name);
      const windows = p.items.filter((o) => o.kind === 'window');
      const noWindow = p.rooms
        .filter((r) => /bed/i.test(r.name))
        .filter((r) => !windows.some((w) => { const f = A().foot(w); const cx = w.x + f.w / 2, cy = w.y + f.h / 2; return cx >= r.x - 0.6 && cx <= r.x + r.w + 0.6 && cy >= r.y - 0.6 && cy <= r.y + r.h + 0.6; }))
        .map((r) => r.name);
      return {
        result: {
          overlapping_pairs: overlaps.map(([a, ai, b, bi]) => `${a} (${ai}) overlaps ${b} (${bi})`),
          outside_any_room: outside,
          tight_walkways: tight,
          rooms_without_a_door: noDoor,
          bedrooms_without_a_window: noWindow,
          note: 'Doors between rooms count for both rooms. Rooms that share an open edge with another room are still separated by a wall in 3D unless a door is placed there.',
        },
        note: '🔍 Checked the layout',
      };
    },

    new_design(i) {
      const tpl = D.templates.find((t) => t.id === i.template);
      const p = GG.store.newPlan(tpl.id, i.name || tpl.name, !i.furnished);
      A().addPlan(p);
      return { result: { created: p.name, design: snapshot() }, note: `🏡 Started “${p.name}”`, switched: true };
    },

    set_view(i) {
      if (i.walls) A().setWalls(i.walls);
      if (i.view) A().setView(i.view);
      return { result: { view: A().view(), walls: S().walls }, note: `👀 Switched to ${A().view().toUpperCase()}` };
    },
  };

  function runTool(name, input) {
    const def = TOOLS.find((t) => t.name === name);
    if (!def) return { error: `Unknown tool ${name}` };
    const problem = validate(def.input_schema, input);
    if (problem) return { error: `Invalid input: ${problem}`, invalid: true };
    try {
      return RUN[name](input);
    } catch (e) {
      if (e instanceof ToolError) return { error: e.message };
      console.error(e);
      return { error: `Something went wrong: ${e.message}` };
    }
  }

  /* ================================================================== */
  /* System prompt (stable, so it caches)                               */
  /* ================================================================== */
  const SYSTEM = `You are the design helper inside Gougou House, a cozy game where a couple decorates their future home in 2D and 3D. You can see the current design and change it with tools.

Coordinates: everything is in feet. x grows to the east (right), y grows to the south (down); a room's x/y is its north-west corner. A piece's x/y is the north-west corner of its footprint; at rotation 90 or 270 its footprint swaps width and depth. Walls are generated from room edges (rooms sharing an edge share one wall), and doors/windows sit on those edges.

Furniture catalog (kind: name, width × depth in feet):
${D.furniture.filter((f) => f.layer !== 3).map((f) => `- ${f.kind}: ${f.name}, ${r2(f.w)} × ${r2(f.h)}`).join('\n')}
Doors and windows are added with add_opening, not add_furniture.

Floors: ${FLOORS.map((f) => `${f} (${GG.textures.label(f)})`).join(', ')}.
Room types with default floors: ${D.roomTypes.map((r) => `${r.name} → ${r.floor}${r.outdoor ? ' (outdoor)' : ''}`).join('; ')}.

Good-layout rules of thumb: ~3 ft walkways; 2–2.5 ft beside a bed on the sides people get in; 3 ft behind dining chairs; 1.5 ft between sofa and coffee table; TV opposite the sofa; desks near windows; bedrooms need a door and ideally a window; nightstands flank the bed's head; rugs go under the front legs of the sofa or under the dining table.

How to work:
- Act, don't just describe: when asked for a change, make it with the tools, then reply in 1–3 short sentences saying what changed (rooms by name, not ids). The user can undo any change with the ↶ button.
- Each user message starts with a <current_plan> snapshot; trust it over memory, since the user may have moved things by hand.
- For structural changes (new rooms, resizing), keep rooms flush with neighbours and avoid overlapping rooms unless asked. add_room and update_room report overlaps_rooms; if it is not empty, shift or shrink the neighbour (or the room) so they only share an edge, and explain.
- Let automatic placement position furniture unless the user is specific; after adding several pieces or changing structure, call check_layout and fix obvious problems (overlaps, blocked doors).
- Ask a short clarifying question only when the request is truly ambiguous (for example which of two bedrooms). Otherwise pick sensible defaults.
- You are friendly and practical, like a good interior designer. Don't use markdown headings; short lists are fine.`;

  /* ================================================================== */
  /* Chat panel                                                         */
  /* ================================================================== */
  const ui = { el: null, log: null, input: null, busy: false, stream: null, convo: [] };
  const SUGGESTIONS = [
    'Furnish the living room',
    'Add a home office next to the bedroom',
    'Make the kitchen 2 ft wider',
    'Add a window to every bedroom',
    'Check my layout for problems',
    'Make it cozier with rugs, plants and lamps',
  ];

  const getKey = () => localStorage.getItem(KEY_STORE) || '';

  function build() {
    const el = document.createElement('aside');
    el.className = 'ai-panel';
    el.hidden = true;
    el.innerHTML = `
      <header class="ai-head">
        <span class="ai-title">✨ AI helper</span>
        <span class="grow"></span>
        <button class="btn sm ghost" data-ai="new" title="Start a new conversation">New chat</button>
        <button class="icon-btn" data-ai="key" title="API key">🔑</button>
        <button class="icon-btn" data-ai="close" title="Close">✕</button>
      </header>
      <div class="ai-log" aria-live="polite"></div>
      <div class="ai-chips"></div>
      <form class="ai-form">
        <textarea rows="2" placeholder="Ask for a change, e.g. “add a reading nook by the window”" aria-label="Message"></textarea>
        <button class="btn primary sm" type="submit" data-ai="send">Send</button>
      </form>`;
    document.body.appendChild(el);
    ui.el = el;
    ui.log = el.querySelector('.ai-log');
    ui.input = el.querySelector('textarea');
    el.querySelector('.ai-chips').innerHTML = SUGGESTIONS.map((s) => `<button class="chip" data-suggest="${esc(s)}">${esc(s)}</button>`).join('');
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-ai],[data-suggest]');
      if (!t) return;
      if (t.dataset.suggest) return send(t.dataset.suggest);
      switch (t.dataset.ai) {
        case 'close': return toggle(false);
        case 'new': return reset(true);
        case 'key': return showKeyForm();
        case 'stop': return ui.stream && ui.stream.abort();
        case 'save-key': {
          const v = el.querySelector('#ai-key').value.trim();
          if (!/^sk-ant-/.test(v)) return toast('That doesn’t look like an Anthropic API key (it starts with sk-ant-).');
          localStorage.setItem(KEY_STORE, v);
          ui.log.innerHTML = '';
          return greet();
        }
        case 'forget-key':
          localStorage.removeItem(KEY_STORE);
          return showKeyForm();
      }
    });
    el.querySelector('.ai-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (ui.busy) return;
      send(ui.input.value);
    });
    ui.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!ui.busy) send(ui.input.value);
      }
    });
  }

  function toggle(force) {
    if (!ui.el) build();
    const open = force ?? ui.el.hidden;
    ui.el.hidden = !open;
    document.body.classList.toggle('ai-open', open);
    window.dispatchEvent(new Event('resize'));
    if (open) {
      if (!getKey()) showKeyForm();
      else if (!ui.log.children.length) greet();
      setTimeout(() => ui.input.focus(), 50);
    }
  }

  function greet() {
    bubble('assistant', `Hi! I can change your home for you — add or resize rooms, put in doors and windows, furnish a room, swap floors, or check the layout. What should we do with <b>${esc(A().plan().name)}</b>?`, true);
  }

  function showKeyForm() {
    const has = !!getKey();
    ui.log.innerHTML = `
      <div class="ai-key">
        <p><b>Connect Claude</b> to use the AI helper.</p>
        <p class="small muted">Paste an Anthropic API key from <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>.
        It’s stored only in this browser and sent only to Anthropic. Anyone using this browser could see it, so use a key with a spending limit.</p>
        <input type="password" id="ai-key" placeholder="sk-ant-…" autocomplete="off" value="">
        <div class="row">
          <button class="btn primary sm" data-ai="save-key">Save key</button>
          ${has ? '<button class="btn sm danger" data-ai="forget-key">Forget saved key</button>' : ''}
        </div>
      </div>`;
  }

  /** Very small formatter: escapes everything, then **bold**, `code` and line breaks. */
  const fmt = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>');

  function bubble(role, html, raw = false) {
    const div = document.createElement('div');
    div.className = `ai-msg ${role}`;
    div.innerHTML = raw ? html : fmt(html);
    ui.log.appendChild(div);
    ui.log.scrollTop = ui.log.scrollHeight;
    return div;
  }

  function note(text, kind = '') {
    const div = document.createElement('div');
    div.className = `ai-note ${kind}`;
    div.textContent = text;
    ui.log.appendChild(div);
    ui.log.scrollTop = ui.log.scrollHeight;
  }

  function setBusy(on) {
    ui.busy = on;
    const btn = ui.el.querySelector('[data-ai="send"],[data-ai="stop"]');
    btn.dataset.ai = on ? 'stop' : 'send';
    btn.type = on ? 'button' : 'submit';
    btn.textContent = on ? 'Stop' : 'Send';
    ui.el.querySelector('.ai-chips').hidden = on || ui.convo.length > 0;
  }

  function reset(announce) {
    if (ui.stream) ui.stream.abort();
    ui.convo = [];
    if (!ui.el) return;
    ui.log.innerHTML = '';
    ui.el.querySelector('.ai-chips').hidden = false;
    if (announce && getKey()) greet();
  }

  /* ================================================================== */
  /* The agent loop                                                     */
  /* ================================================================== */
  async function send(text) {
    text = (text || '').trim();
    if (!text || ui.busy) return;
    const key = getKey();
    if (!key) return showKeyForm();
    ui.input.value = '';
    bubble('user', text);
    ui.convo.push({ role: 'user', content: [{ type: 'text', text: `<current_plan>\n${JSON.stringify(snapshot())}\n</current_plan>\n\n${text}` }] });
    setBusy(true);
    const client = new window.Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
    let changed = 0;
    let jsonRetries = 0;
    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const out = bubble('assistant', '<span class="ai-typing"><i></i><i></i><i></i></span>', true);
        let streamed = '';
        const stream = (ui.stream = client.beta.messages.stream({
          model: MODEL,
          max_tokens: 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          thinking: { type: 'adaptive' },
          output_config: { effort: 'medium' },
          system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
          tools: TOOLS,
          messages: ui.convo,
        }));
        stream.on('text', (delta) => {
          streamed += delta;
          out.innerHTML = fmt(streamed);
          ui.log.scrollTop = ui.log.scrollHeight;
        });
        let message;
        try {
          message = await stream.finalMessage();
          jsonRetries = 0;
        } catch (err) {
          // A tool input that could not be parsed at all: re-issue the turn (API errors are rethrown).
          if (err instanceof window.Anthropic.APIError || err instanceof window.Anthropic.APIUserAbortError || jsonRetries++ >= 2) throw err;
          out.remove();
          continue;
        }
        if (!streamed.trim()) out.remove();

        if (message.stop_reason === 'refusal') {
          note('Claude declined that request. Try rephrasing it as a home-design change.', 'warn');
          break;
        }
        const toolUses = message.content.filter((b) => b.type === 'tool_use');
        if (message.stop_reason === 'max_tokens' && toolUses.length) {
          note('That answer got cut off — try asking for a smaller change.', 'warn');
          break;
        }
        ui.convo.push({ role: 'assistant', content: message.content });
        if (message.stop_reason === 'pause_turn') continue;
        if (!toolUses.length) break;

        const results = [];
        let switched = false;
        for (const tu of toolUses) {
          const r = runTool(tu.name, tu.input);
          if (r.error) {
            if (!r.invalid) note(`⚠️ ${r.error}`, 'warn');
            results.push({ type: 'tool_result', tool_use_id: tu.id, is_error: true, content: r.invalid ? JSON.stringify({ INVALID_JSON: JSON.stringify(tu.input), problem: r.error }) : r.error });
          } else {
            if (r.note) note(r.note);
            if (!['get_plan', 'check_layout', 'set_view'].includes(tu.name)) changed++;
            if (r.switched) switched = true;
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(r.result) });
          }
        }
        // one undo step per batch of edits
        if (changed && !switched) A().commit();
        ui.convo.push({ role: 'user', content: results });
        if (round === MAX_TOOL_ROUNDS - 1) note('Stopping here — that was a lot of steps. Ask me to continue if needed.', 'warn');
      }
      if (changed) note('↶ Undo reverts these changes', 'hint');
    } catch (err) {
      ui.log.querySelectorAll('.ai-typing').forEach((n) => n.closest('.ai-msg').remove());
      const E = window.Anthropic;
      if (err instanceof E.APIUserAbortError) note('Stopped.', 'hint');
      else if (err instanceof E.AuthenticationError) {
        note('Your API key was rejected. Check it with 🔑.', 'warn');
      } else if (err instanceof E.PermissionDeniedError) note('This API key isn’t allowed to use that model.', 'warn');
      else if (err instanceof E.RateLimitError) note('Too many requests right now — wait a moment and try again.', 'warn');
      else if (err instanceof E.APIConnectionError) note('Couldn’t reach Anthropic. Check your internet connection.', 'warn');
      else if (err instanceof E.APIError) note(`The AI service returned an error (${err.status || 'unknown'}). Try again in a moment.`, 'warn');
      else {
        console.error(err);
        note(`Something went wrong: ${err.message}`, 'warn');
      }
      // keep the conversation valid: drop a trailing user turn the model never answered
      while (ui.convo.length && ui.convo[ui.convo.length - 1].role === 'user' && ui.convo[ui.convo.length - 1].content.some((b) => b.type === 'text')) ui.convo.pop();
      if (changed) A().commit();
    } finally {
      ui.stream = null;
      setBusy(false);
    }
  }

  GG.assistant = {
    toggle,
    /** A different design was opened: the old conversation no longer applies. */
    planChanged() {
      if (!ui.busy) reset(!!(ui.el && !ui.el.hidden));
    },
    /** For tests and power users. */
    _tools: TOOLS,
    _run: runTool,
    _snapshot: snapshot,
  };
})(window.GG);
