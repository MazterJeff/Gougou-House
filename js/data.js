/* Gougou House — static content: furniture catalog (real sizes), room types and starter spaces. */
(function (GG) {
  const D = (GG.data = {});

  /* ------------------------------------------------------------------ */
  /* Furniture catalog — real-world sizes in inches (w × d)              */
  /* ------------------------------------------------------------------ */
  const f = (group, kind, name, wIn, dIn, color, shape = 'rect', extra = {}) => ({
    group, kind, name, w: wIn / 12, h: dIn / 12, color, shape, ...extra,
  });
  D.furnitureGroups = ['Structure', 'Living', 'Bedroom', 'Dining', 'Kitchen', 'Bath', 'Work', 'Outdoor', 'Pets'];
  D.furniture = [
    f('Structure', 'door', 'Door', 32, 32, '#ffffff', 'door', { layer: 3 }),
    f('Structure', 'window', 'Window', 48, 6, '#cfe6f2', 'window', { layer: 3 }),
    f('Structure', 'closet', 'Closet', 72, 24, '#ece4d6'),
    f('Structure', 'stairs', 'Stairs', 36, 120, '#e7e1d8', 'stairs'),
    f('Structure', 'washer', 'Washer / dryer', 54, 30, '#f1f4f6'),
    f('Living', 'sofa', 'Sofa', 84, 36, '#c9b79c'),
    f('Living', 'sectional', 'Sectional', 112, 84, '#c9b79c', 'lshape'),
    f('Living', 'loveseat', 'Loveseat', 60, 34, '#c9b79c'),
    f('Living', 'armchair', 'Armchair', 32, 32, '#d8a47f'),
    f('Living', 'coffee', 'Coffee table', 48, 24, '#a68a6d'),
    f('Living', 'tv', 'TV console', 66, 18, '#5e5246'),
    f('Living', 'bookshelf', 'Bookshelf', 36, 12, '#a68a6d'),
    f('Living', 'rug', 'Rug 8×10', 120, 96, '#e8d9c4', 'rug', { layer: 0 }),
    f('Living', 'rugsm', 'Rug 5×8', 96, 60, '#e8d9c4', 'rug', { layer: 0 }),
    f('Living', 'plant', 'Plant', 20, 20, '#8aa38b', 'round'),
    f('Living', 'piano', 'Upright piano', 58, 24, '#3b3330'),
    f('Bedroom', 'king', 'King bed', 76, 80, '#e6e9f4'),
    f('Bedroom', 'queen', 'Queen bed', 60, 80, '#e6e9f4'),
    f('Bedroom', 'full', 'Full bed', 54, 75, '#e6e9f4'),
    f('Bedroom', 'nightstand', 'Nightstand', 20, 16, '#a68a6d'),
    f('Bedroom', 'dresser', 'Dresser', 60, 20, '#a68a6d'),
    f('Bedroom', 'wardrobe', 'Wardrobe', 40, 24, '#a68a6d'),
    f('Bedroom', 'crib', 'Crib', 52, 28, '#f6e7d7'),
    f('Dining', 'table4', 'Table (4)', 48, 32, '#a68a6d'),
    f('Dining', 'table6', 'Table (6)', 72, 38, '#a68a6d'),
    f('Dining', 'roundtable', 'Round table', 44, 44, '#a68a6d', 'round'),
    f('Dining', 'chair', 'Chair', 18, 20, '#d8c8b0'),
    f('Dining', 'barcart', 'Bar cart', 30, 18, '#e0a43a'),
    f('Kitchen', 'counter', 'Counter', 96, 25, '#e3dccf'),
    f('Kitchen', 'island', 'Island', 72, 36, '#e3dccf'),
    f('Kitchen', 'fridge', 'Fridge', 36, 30, '#dfe5ea'),
    f('Kitchen', 'range', 'Range', 30, 26, '#4b4741'),
    f('Kitchen', 'sink', 'Sink', 33, 22, '#dfe5ea'),
    f('Bath', 'toilet', 'Toilet', 20, 28, '#ffffff'),
    f('Bath', 'vanity', 'Vanity', 36, 21, '#e3dccf'),
    f('Bath', 'vanity2', 'Double vanity', 60, 21, '#e3dccf'),
    f('Bath', 'tub', 'Bathtub', 60, 30, '#ffffff', 'tub'),
    f('Bath', 'shower', 'Shower', 36, 36, '#dff0f2'),
    f('Work', 'desk', 'Desk', 60, 30, '#a68a6d'),
    f('Work', 'officechair', 'Desk chair', 24, 24, '#4b4741', 'round'),
    f('Work', 'yogamat', 'Yoga mat', 24, 72, '#b5c7a5', 'rug', { layer: 0 }),
    f('Outdoor', 'grill', 'Grill', 50, 24, '#4b4741'),
    f('Outdoor', 'patiotable', 'Patio table', 40, 40, '#b49a7a', 'round'),
    f('Outdoor', 'lounger', 'Lounger', 28, 76, '#efe6d6'),
    f('Outdoor', 'hammock', 'Hammock', 40, 120, '#d9a77c', 'rug', { layer: 0 }),
    f('Outdoor', 'planter', 'Planter', 48, 18, '#7c8b5a'),
    f('Pets', 'dogbed', 'Dog bed', 36, 28, '#e8a868', 'round'),
    f('Pets', 'crate', 'Dog crate', 42, 28, '#7c6a5a'),
    f('Pets', 'bowls', 'Food bowls', 18, 10, '#d9825b'),
    f('Pets', 'cattree', 'Cat tree', 24, 24, '#b49a7a'),
  ];
  D.furnitureByKind = Object.fromEntries(D.furniture.map((x) => [x.kind, x]));

  D.roomTypes = [
    { name: 'Living room', color: '#f6e7d7' },
    { name: 'Kitchen', color: '#e8efe1' },
    { name: 'Dining', color: '#f8e5e0' },
    { name: 'Bedroom', color: '#e6e9f4' },
    { name: 'Bathroom', color: '#dff0f2' },
    { name: 'Office', color: '#f3ecd9' },
    { name: 'Hallway', color: '#efedea' },
    { name: 'Closet', color: '#ece4d6' },
    { name: 'Laundry', color: '#eef1f3' },
    { name: 'Balcony', color: '#dcebd3', outdoor: true },
    { name: 'Yard', color: '#d3e6c8', outdoor: true },
  ];
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
        ['tv', 11.5, 0.3], ['armchair', 17, 8.5], ['table4', 1, 13.5], ['plant', 20, 0.5], ['dogbed', 1, 9.5],
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
        ['counter', 16.2, 0.2], ['range', 24.4, 0.2], ['fridge', 27.7, 0.2], ['island', 20.5, 5], ['table6', 20.5, 12.4],
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
        ['table6', 24, 15.5], ['washer', 9, 16.3], ['door', 0.3, 18.8],
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
    rooms: tpl.rooms.map(([name, x, y, w, h, outdoor]) => ({ id: uid('r'), name, x, y, w, h, color: roomColor(name), outdoor: !!outdoor })),
    items: tpl.items.filter(([kind]) => !empty || D.furnitureByKind[kind].layer === 3).map(([kind, x, y, rot = 0]) => {
      const c = D.furnitureByKind[kind];
      return { id: uid('i'), kind, name: c.name, x, y, w: c.w, h: c.h, rot, color: c.color };
    }),
  });
})(window.GG);
