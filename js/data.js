/* Gougou House — static content: furniture catalog (real sizes), room types and starter spaces. */
(function (GG) {
  const D = (GG.data = {});

  /* ------------------------------------------------------------------ */
  /* Furniture catalog — real-world sizes in inches (w × d)              */
  /* ------------------------------------------------------------------ */
  const f = (group, kind, name, wIn, dIn, color, shape, extra = {}) => ({
    group, kind, name, w: wIn / 12, h: dIn / 12, color, shape, ...extra,
  });
  D.furnitureGroups = ['Structure', 'Living', 'Decor', 'Bedroom', 'Dining', 'Kitchen', 'Bath', 'Work', 'Outdoor', 'Pets'];
  // mat decides which color swatches the piece offers: fabric | wood | rug | other
  D.furniture = [
    f('Structure', 'door', 'Door', 32, 32, '#b08a62', 'door', { layer: 3, mat: 'wood' }),
    f('Structure', 'window', 'Window', 48, 6, '#ffffff', 'window', { layer: 3, mat: 'other' }),
    f('Structure', 'closet', 'Closet', 72, 24, '#c9a77c', 'rect', { mat: 'wood' }),
    f('Structure', 'stairs', 'Stairs', 36, 120, '#b9905f', 'stairs', { mat: 'wood' }),
    f('Structure', 'washer', 'Washer / dryer', 54, 30, '#f4f4f2', 'rect', { mat: 'other' }),
    f('Living', 'sofa', 'Sofa', 84, 36, '#b8ad9c', 'rect', { mat: 'fabric' }),
    f('Living', 'sectional', 'Sectional', 112, 84, '#8f8a83', 'lshape', { mat: 'fabric' }),
    f('Living', 'loveseat', 'Loveseat', 60, 34, '#8f9e86', 'rect', { mat: 'fabric' }),
    f('Living', 'armchair', 'Armchair', 32, 32, '#8a5a3b', 'rect', { mat: 'fabric' }),
    f('Living', 'coffee', 'Coffee table', 48, 24, '#a67c52', 'rect', { mat: 'wood' }),
    f('Living', 'tv', 'TV console', 66, 18, '#6b4a33', 'rect', { mat: 'wood' }),
    f('Living', 'bookshelf', 'Bookshelf', 36, 12, '#a67c52', 'rect', { mat: 'wood' }),
    f('Living', 'piano', 'Upright piano', 58, 24, '#1f1b19', 'rect', { mat: 'other' }),
    f('Decor', 'rug', 'Persian rug 8×10', 120, 96, '#8c2f2a', 'rug', { layer: 0, mat: 'rug' }),
    f('Decor', 'rugsm', 'Berber rug 5×8', 96, 60, '#ece4d6', 'rug', { layer: 0, mat: 'rug' }),
    f('Decor', 'rugstripe', 'Striped rug 8×10', 120, 96, '#d8d0c2', 'rug', { layer: 0, mat: 'rug' }),
    f('Decor', 'rugshag', 'Shag rug 6×9', 108, 72, '#e9e3d8', 'rug', { layer: 0, mat: 'rug' }),
    f('Decor', 'rugjute', 'Round jute rug', 72, 72, '#c8a97a', 'rug', { layer: 0, mat: 'rug' }),
    f('Decor', 'runner', 'Kilim runner', 30, 96, '#a8513a', 'rug', { layer: 0, mat: 'rug' }),
    f('Decor', 'plant', 'Plant', 20, 20, '#b5653f', 'round', { mat: 'pot' }),
    f('Decor', 'plantbig', 'Fiddle leaf fig', 32, 32, '#efebe4', 'round', { mat: 'pot' }),
    f('Decor', 'floorlamp', 'Floor lamp', 18, 18, '#f1ece2', 'round', { mat: 'fabric' }),
    f('Decor', 'pouf', 'Pouf', 20, 20, '#c8b49a', 'round', { mat: 'fabric' }),
    f('Bedroom', 'king', 'King bed', 76, 80, '#e7e1d6', 'rect', { mat: 'fabric' }),
    f('Bedroom', 'queen', 'Queen bed', 60, 80, '#dfe3e6', 'rect', { mat: 'fabric' }),
    f('Bedroom', 'full', 'Full bed', 54, 75, '#e9dfd3', 'rect', { mat: 'fabric' }),
    f('Bedroom', 'nightstand', 'Nightstand', 20, 16, '#a67c52', 'rect', { mat: 'wood' }),
    f('Bedroom', 'dresser', 'Dresser', 60, 20, '#a67c52', 'rect', { mat: 'wood' }),
    f('Bedroom', 'wardrobe', 'Wardrobe', 40, 24, '#c9a77c', 'rect', { mat: 'wood' }),
    f('Bedroom', 'crib', 'Crib', 52, 28, '#f2efe9', 'rect', { mat: 'wood' }),
    f('Dining', 'table4', 'Table (4)', 48, 32, '#a67c52', 'rect', { mat: 'wood' }),
    f('Dining', 'table6', 'Table (6)', 72, 38, '#a67c52', 'rect', { mat: 'wood' }),
    f('Dining', 'roundtable', 'Round table', 44, 44, '#c9a77c', 'round', { mat: 'wood' }),
    f('Dining', 'chair', 'Chair', 18, 20, '#a67c52', 'rect', { mat: 'wood' }),
    f('Dining', 'barcart', 'Bar cart', 30, 18, '#c9a23a', 'rect', { mat: 'other' }),
    f('Kitchen', 'counter', 'Counter', 96, 25, '#f1efeb', 'rect', { mat: 'other' }),
    f('Kitchen', 'island', 'Island', 72, 36, '#f1efeb', 'rect', { mat: 'other' }),
    f('Kitchen', 'fridge', 'Fridge', 36, 30, '#c8ccd0', 'rect', { mat: 'other' }),
    f('Kitchen', 'range', 'Range', 30, 26, '#2a2a2b', 'rect', { mat: 'other' }),
    f('Kitchen', 'sink', 'Sink', 33, 22, '#f1efeb', 'rect', { mat: 'other' }),
    f('Bath', 'toilet', 'Toilet', 20, 28, '#ffffff', 'rect', { mat: 'other' }),
    f('Bath', 'vanity', 'Vanity', 36, 21, '#f1efeb', 'rect', { mat: 'other' }),
    f('Bath', 'vanity2', 'Double vanity', 60, 21, '#f1efeb', 'rect', { mat: 'other' }),
    f('Bath', 'tub', 'Bathtub', 60, 30, '#ffffff', 'tub', { mat: 'other' }),
    f('Bath', 'shower', 'Shower', 36, 36, '#dfe9ec', 'rect', { mat: 'other' }),
    f('Work', 'desk', 'Desk', 60, 30, '#c9a77c', 'rect', { mat: 'wood' }),
    f('Work', 'officechair', 'Desk chair', 24, 24, '#6f6b66', 'round', { mat: 'fabric' }),
    f('Work', 'yogamat', 'Yoga mat', 24, 72, '#8f9e86', 'rug', { layer: 0, mat: 'fabric' }),
    f('Outdoor', 'grill', 'Grill', 50, 24, '#2a2a2b', 'rect', { mat: 'other' }),
    f('Outdoor', 'patiotable', 'Patio table', 40, 40, '#a07850', 'round', { mat: 'wood' }),
    f('Outdoor', 'lounger', 'Lounger', 28, 76, '#efe8dc', 'rect', { mat: 'fabric' }),
    f('Outdoor', 'hammock', 'Hammock', 40, 120, '#d8c3a0', 'rug', { layer: 0, mat: 'fabric' }),
    f('Outdoor', 'planter', 'Planter', 48, 18, '#8a6a4a', 'rect', { mat: 'wood' }),
    f('Pets', 'dogbed', 'Dog bed', 36, 28, '#a39e97', 'round', { mat: 'fabric' }),
    f('Pets', 'crate', 'Dog crate', 42, 28, '#2f2f30', 'rect', { mat: 'other' }),
    f('Pets', 'bowls', 'Food bowls', 18, 10, '#c8ccd0', 'rect', { mat: 'other' }),
    f('Pets', 'cattree', 'Cat tree', 24, 24, '#d8cdb9', 'round', { mat: 'fabric' }),
  ];
  D.furnitureByKind = Object.fromEntries(D.furniture.map((x) => [x.kind, x]));

  /** Swatches offered in the inspector, by material. */
  D.swatches = {
    fabric: ['#efe8dc', '#d8cfc0', '#b8ad9c', '#a39e97', '#6f6b66', '#3b3b3d', '#8a5a3b', '#b5653f', '#c9a23a', '#8f9e86', '#4f6b58', '#2f3e55', '#7d8fa3', '#d9b1a3'],
    wood: ['#e8d5b5', '#c9a77c', '#a67c52', '#8a6038', '#6b4a33', '#3e2a1e', '#f2efe9', '#2b2b2b'],
    rug: ['#8c2f2a', '#2f3e55', '#4f6b58', '#a8513a', '#c9a23a', '#ece4d6', '#d8d0c2', '#e9e3d8', '#c8a97a', '#6f6b66', '#d9b1a3', '#3b3b3d'],
    pot: ['#b5653f', '#efebe4', '#3b3b3d', '#c8a97a', '#8f9e86'],
    other: ['#ffffff', '#f1efeb', '#c8ccd0', '#2a2a2b', '#c9a23a', '#8f9e86'],
  };

  D.roomTypes = [
    { name: 'Living room', color: '#f6e7d7', floor: 'oak' },
    { name: 'Kitchen', color: '#e8efe1', floor: 'tile' },
    { name: 'Dining', color: '#f8e5e0', floor: 'oak' },
    { name: 'Bedroom', color: '#e6e9f4', floor: 'oak' },
    { name: 'Bathroom', color: '#dff0f2', floor: 'marble' },
    { name: 'Office', color: '#f3ecd9', floor: 'walnut' },
    { name: 'Hallway', color: '#efedea', floor: 'oak' },
    { name: 'Closet', color: '#ece4d6', floor: 'carpet' },
    { name: 'Laundry', color: '#eef1f3', floor: 'checker' },
    { name: 'Studio', color: '#f6e7d7', floor: 'ashgray' },
    { name: 'Balcony', color: '#dcebd3', floor: 'deck', outdoor: true },
    { name: 'Yard', color: '#d3e6c8', floor: 'grass', outdoor: true },
  ];
  /** Default floor for a room, based on its name. */
  D.floorFor = (name, outdoor) => (D.roomTypes.find((r) => name.startsWith(r.name)) || {}).floor || (outdoor ? 'deck' : 'oak');

  const roomColor = (name) => (D.roomTypes.find((r) => name.startsWith(r.name)) || {}).color || '#f2efe9';

  /* ------------------------------------------------------------------ */
  /* Starter spaces (feet). [name, x, y, w, h, outdoor?]                 */
  /* items: [kind, x, y, rot?]                                           */
  /* ------------------------------------------------------------------ */
  D.templates = [
    {
      id: 'studio',
      name: 'Studio loft',
      emoji: '🛋️',
      blurb: 'One big open room, a kitchen nook and a bathroom. ~560 sq ft.',
      rooms: [
        ['Studio', 0, 0, 22, 18],
        ['Bathroom', 22, 0, 7, 8],
        ['Kitchen', 22, 8, 7, 10],
      ],
      items: [
        ['queen', 0.5, 0.5], ['nightstand', 5.7, 0.5], ['rug', 9, 5.5], ['sofa', 10.5, 14.5], ['coffee', 12, 9.5],
        ['tv', 11.5, 0.3], ['armchair', 17, 8.5], ['table4', 1, 13.5], ['chair', 1.5, 11.86], ['chair', 1.5, 16.2, 180], ['chair', 3.0, 11.86], ['chair', 3.0, 16.2, 180], ['plant', 20, 0.5], ['dogbed', 1, 9.5],
        ['toilet', 22.4, 0.3], ['vanity', 25.6, 0.3], ['shower', 25.6, 4.6],
        ['counter', 26.6, 8.2, 90], ['fridge', 22.3, 8.2], ['range', 22.3, 10.9],
        ['window', 6, -0.25], ['window', 14, 17.75], ['door', 22.3, 15],
      ],
    },
    {
      id: 'studio1br',
      name: 'Cozy 1-bedroom',
      emoji: '🏢',
      blurb: '~700 sq ft city apartment with a balcony.',
      rooms: [
        ['Kitchen', 0, 0, 10, 10],
        ['Living room', 10, 0, 15, 15],
        ['Hallway', 0, 10, 10, 5],
        ['Bedroom', 0, 15, 13, 13],
        ['Bathroom', 13, 15, 8, 8],
        ['Closet', 13, 23, 8, 5],
        ['Balcony', 25, 0, 6, 15, true],
      ],
      items: [
        ['counter', 0.2, 0.2, 90], ['fridge', 6.8, 0.2], ['range', 3.6, 0.2], ['table4', 4.5, 5.8], ['door', 0.2, 11.6],
        ['rug', 13.5, 4.5], ['sofa', 14.5, 11.5], ['coffee', 16, 7.5], ['tv', 14.8, 0.3], ['window', 24.75, 5.5, 90],
        ['queen', 4, 15.3], ['nightstand', 2.2, 15.3], ['nightstand', 9.2, 15.3], ['dresser', 4, 26.1],
        ['toilet', 13.4, 15.3], ['vanity', 17.6, 15.3], ['tub', 13.3, 20.3], ['dogbed', 21.3, 1], ['plant', 23, 13],
      ],
    },
    {
      id: 'apt2br',
      name: '2-bedroom apartment',
      emoji: '🏙️',
      blurb: '~930 sq ft with a home office and a laundry nook.',
      rooms: [
        ['Living room', 0, 0, 16, 14],
        ['Kitchen', 16, 0, 15, 10],
        ['Dining', 16, 10, 15, 8],
        ['Hallway', 0, 14, 16, 4],
        ['Bedroom', 0, 18, 13, 12],
        ['Bathroom', 13, 18, 7, 8],
        ['Laundry', 13, 26, 7, 4],
        ['Office', 20, 18, 11, 12],
      ],
      items: [
        ['rug', 3, 3], ['sofa', 4.5, 10.5], ['coffee', 6, 6.5], ['tv', 5, 0.3], ['armchair', 0.5, 5.5], ['plant', 0.4, 11.8],
        ['counter', 16.2, 0.2], ['range', 24.4, 0.2], ['fridge', 27.7, 0.2], ['island', 20.5, 5], ['table6', 20.5, 12.4], ['chair', 20.8, 10.72], ['chair', 20.8, 15.6, 180], ['chair', 22.75, 10.72], ['chair', 22.75, 15.6, 180], ['chair', 24.7, 10.72], ['chair', 24.7, 15.6, 180],
        ['queen', 4, 18.3], ['nightstand', 2.2, 18.3], ['nightstand', 9.2, 18.3], ['dresser', 4, 28.1],
        ['toilet', 13.4, 18.3], ['vanity', 16.2, 18.3], ['shower', 16.8, 22.8], ['washer', 13.6, 27.3],
        ['desk', 20.3, 18.3], ['desk', 25.6, 18.3], ['officechair', 21.8, 21.2], ['officechair', 27.1, 21.2], ['dogbed', 27.5, 27.2],
        ['door', 0.3, 14.3], ['window', -0.25, 21.5, 90],
      ],
    },
    {
      id: 'house',
      name: 'Little house with a yard',
      emoji: '🏡',
      blurb: '~1,300 sq ft single-story with a primary suite and backyard.',
      rooms: [
        ['Living room', 0, 0, 18, 16],
        ['Kitchen', 18, 0, 18, 12],
        ['Dining', 18, 12, 18, 10],
        ['Hallway', 0, 16, 8, 6],
        ['Laundry', 8, 16, 10, 6],
        ['Bedroom (primary)', 0, 22, 15, 14],
        ['Bathroom (primary)', 15, 22, 9, 8],
        ['Closet', 15, 30, 9, 6],
        ['Bedroom 2', 24, 22, 12, 14],
        ['Yard', 0, 36, 36, 14, true],
      ],
      items: [
        ['rug', 4, 3.5], ['sectional', 4.5, 5], ['tv', 6, 0.3], ['plant', 0.4, 0.4], ['bookshelf', 14.5, 0.3], ['armchair', 14.5, 11],
        ['counter', 18.2, 0.2], ['counter', 26.2, 0.2], ['fridge', 32.8, 3], ['island', 24, 5.5],
        ['table6', 24, 15.5], ['chair', 24.3, 13.82], ['chair', 24.3, 18.7, 180], ['chair', 26.25, 13.82], ['chair', 26.25, 18.7, 180], ['chair', 28.2, 13.82], ['chair', 28.2, 18.7, 180], ['washer', 9, 16.3], ['door', 0.3, 18.8],
        ['king', 4.5, 22.3], ['nightstand', 2.7, 22.3], ['nightstand', 10.9, 22.3], ['dresser', 4.5, 33.9],
        ['toilet', 15.4, 22.3], ['vanity2', 18.5, 22.3], ['tub', 15.3, 27.2],
        ['full', 27, 22.3], ['nightstand', 31.6, 22.3], ['desk', 30.6, 33.3], ['dogbed', 0.6, 32.5], ['crate', 1, 16.5],
        ['grill', 30, 38], ['plant', 2, 38], ['plant', 4.5, 38],
      ],
    },
    {
      id: 'blank',
      name: 'Blank canvas',
      emoji: '📄',
      blurb: 'Start from nothing and draw every room yourselves.',
      rooms: [],
      items: [],
    },
  ];

  /** Build a plan's rooms + items from a template. `empty` keeps only rooms, doors and windows. */
  D.instantiateTemplate = (tpl, uid, empty = false) => ({
    rooms: tpl.rooms.map(([name, x, y, w, h, outdoor]) => ({ id: uid('r'), name, x, y, w, h, color: roomColor(name), floor: D.floorFor(name, outdoor), outdoor: !!outdoor })),
    items: tpl.items.filter(([kind]) => !empty || D.furnitureByKind[kind].layer === 3).map(([kind, x, y, rot = 0]) => {
      const c = D.furnitureByKind[kind];
      return { id: uid('i'), kind, name: c.name, x, y, w: c.w, h: c.h, rot, color: c.color };
    }),
  });
})(window.GG);
