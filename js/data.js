/* Gougou House — static content: styles, quiz, wishlist catalog, furniture, plan templates, palettes. */
(function (GG) {
  const D = (GG.data = {});

  /* ------------------------------------------------------------------ */
  /* Interior style archetypes                                           */
  /* ------------------------------------------------------------------ */
  D.styles = {
    japandi: {
      name: 'Japandi',
      emoji: '🍵',
      blurb: 'Japanese calm meets Scandinavian warmth: low furniture, natural wood, linen, and lots of breathing room.',
      palette: ['#f2ede4', '#d8c8b0', '#a68a6d', '#5e5246', '#2e2a26'],
      ideas: ['Low platform bed', 'Paper or linen lamp shades', 'Handmade ceramics', 'Closed storage to hide the clutter'],
    },
    scandi: {
      name: 'Scandinavian',
      emoji: '🌲',
      blurb: 'Bright, airy and practical — white walls, pale woods and hygge textiles for long winters.',
      palette: ['#ffffff', '#eceae4', '#c9b79c', '#8fa3a8', '#3b4a52'],
      ideas: ['Sheepskin throws', 'Pale oak floors', 'Candles everywhere', 'Sheer white curtains'],
    },
    midcentury: {
      name: 'Mid-Century Modern',
      emoji: '🪑',
      blurb: 'Tapered legs, walnut, graphic shapes and a pop of mustard or teal. Retro but timeless.',
      palette: ['#f4e9d8', '#e0a43a', '#c0583a', '#2f6f73', '#4a3428'],
      ideas: ['Walnut credenza', 'Globe pendant lights', 'Statement lounge chair', 'Geometric rug'],
    },
    industrial: {
      name: 'Industrial Loft',
      emoji: '🏭',
      blurb: 'Exposed brick, concrete, black steel and leather — big windows and city-loft energy.',
      palette: ['#e6e2dd', '#a39e97', '#7a4b35', '#3c3c3c', '#1d1d1d'],
      ideas: ['Black-framed glass partitions', 'Cognac leather sofa', 'Exposed bulb pendants', 'Open metal shelving'],
    },
    boho: {
      name: 'Boho',
      emoji: '🌿',
      blurb: 'Layered textiles, rattan, plants and travel finds — relaxed, colorful and full of life.',
      palette: ['#f3e3cf', '#d9a77c', '#b5653f', '#7c8b5a', '#3f4a3a'],
      ideas: ['Rattan accent chair', 'Layered vintage rugs', 'Hanging plants', 'Floor cushions'],
    },
    farmhouse: {
      name: 'Modern Farmhouse',
      emoji: '🌾',
      blurb: 'Big farmhouse table, cozy textures, black-and-white contrast with warm reclaimed wood.',
      palette: ['#faf8f3', '#e3dccf', '#b49a7a', '#5c6b5d', '#2b2b2b'],
      ideas: ['Farmhouse sink', 'Long dining table with a bench', 'Open pantry shelves', 'Mudroom with hooks'],
    },
    coastal: {
      name: 'Coastal',
      emoji: '🌊',
      blurb: 'Breezy whites, sandy neutrals, washed blues and natural fibers. Vacation every day.',
      palette: ['#ffffff', '#efe6d6', '#bcd4dc', '#5d8ca3', '#2c4b5e'],
      ideas: ['Slipcovered sofa', 'Jute rugs', 'Linen bedding', 'Blue-and-white ceramics'],
    },
    modern: {
      name: 'Warm Minimalist',
      emoji: '◻️',
      blurb: 'Clean lines, hidden storage and a few perfect pieces. Calm, precise and quietly luxurious.',
      palette: ['#f7f6f3', '#dcd8d0', '#9c958b', '#4b4741', '#151515'],
      ideas: ['Handle-less cabinetry', 'Microcement or plaster walls', 'One statement light', 'Built-in everything'],
    },
  };

  /** Hand-picked names for style blends (order-independent keys). */
  D.blendNames = {
    'japandi+scandi': 'Nordic Zen',
    'japandi+modern': 'Quiet Luxury',
    'japandi+midcentury': 'Tokyo Mid-Century',
    'japandi+boho': 'Wabi-Sabi Boho',
    'japandi+industrial': 'Zen Loft',
    'japandi+farmhouse': 'Rustic Zen',
    'japandi+coastal': 'Driftwood Calm',
    'scandi+modern': 'Nordic Minimal',
    'scandi+boho': 'Hygge Boho',
    'scandi+farmhouse': 'Cabin Hygge',
    'scandi+coastal': 'Nordic Seaside',
    'scandi+midcentury': 'Danish Modern',
    'scandi+industrial': 'Copenhagen Loft',
    'midcentury+boho': 'Desert Modern',
    'midcentury+industrial': 'Brooklyn Mid-Century',
    'midcentury+modern': 'Modern Classic',
    'midcentury+farmhouse': 'Retro Ranch',
    'midcentury+coastal': 'Palm Springs',
    'industrial+modern': 'Urban Minimal',
    'industrial+farmhouse': 'Warehouse Farmhouse',
    'industrial+boho': 'Bohemian Loft',
    'industrial+coastal': 'Harbor Loft',
    'boho+coastal': 'Beach Boho',
    'boho+farmhouse': 'Cottagecore',
    'boho+modern': 'Organic Modern',
    'farmhouse+coastal': 'Coastal Cottage',
    'farmhouse+modern': 'Modern Barn',
    'coastal+modern': 'Mediterranean Minimal',
  };

  /* ------------------------------------------------------------------ */
  /* This or That quiz. Each option carries style weights + a topic.     */
  /* ------------------------------------------------------------------ */
  D.quiz = [
    {
      id: 'sunday',
      prompt: 'Perfect Sunday morning at home…',
      topic: 'Morning ritual',
      options: [
        { emoji: '☕️', title: 'Coffee in a sunny breakfast nook', sub: 'Garden view, slow pancakes', styles: { farmhouse: 2, scandi: 1, coastal: 1 } },
        { emoji: '🏙️', title: 'Brunch on a balcony above the city', sub: 'Skyline, people-watching', styles: { industrial: 2, midcentury: 1, modern: 1 } },
      ],
    },
    {
      id: 'floors',
      prompt: 'Under your bare feet…',
      topic: 'Flooring',
      options: [
        { emoji: '🪵', title: 'Warm wood floors', sub: 'Oak, walnut, herringbone', styles: { scandi: 2, japandi: 1, midcentury: 1, farmhouse: 1 } },
        { emoji: '🪨', title: 'Polished concrete or stone', sub: 'Cool, seamless, durable', styles: { industrial: 2, modern: 2 } },
      ],
    },
    {
      id: 'layout',
      prompt: 'How should the main living space flow?',
      topic: 'Open vs. closed layout',
      options: [
        { emoji: '🌬️', title: 'Open plan', sub: 'Kitchen, dining & living as one big room', styles: { modern: 1, industrial: 1, scandi: 1 } },
        { emoji: '🚪', title: 'Cozy distinct rooms', sub: 'Doors, nooks, places to retreat', styles: { farmhouse: 1, boho: 1, japandi: 1 } },
      ],
    },
    {
      id: 'walls',
      prompt: 'Pick the walls',
      topic: 'Wall color',
      options: [
        { emoji: '🤍', title: 'Crisp white & airy', sub: 'A bright gallery for life', styles: { scandi: 2, coastal: 1, modern: 1 } },
        { emoji: '🍷', title: 'Moody & rich', sub: 'Deep green, terracotta, ink blue', styles: { boho: 2, midcentury: 1, industrial: 1 } },
      ],
    },
    {
      id: 'stuff',
      prompt: 'Your shelves look like…',
      topic: 'Minimal vs. collected',
      options: [
        { emoji: '🧘', title: 'Less is more', sub: 'Hidden storage, clear surfaces', styles: { modern: 2, japandi: 2 } },
        { emoji: '📚', title: 'Collected treasures', sub: 'Books, art, souvenirs everywhere', styles: { boho: 2, midcentury: 1, farmhouse: 1 } },
      ],
    },
    {
      id: 'plants',
      prompt: 'Plant situation?',
      topic: 'Plants',
      options: [
        { emoji: '🌴', title: 'Urban jungle', sub: 'Monstera in every corner', styles: { boho: 3, midcentury: 1 } },
        { emoji: '🎍', title: 'A few sculptural plants', sub: 'One olive tree, done', styles: { japandi: 2, modern: 2 } },
      ],
    },
    {
      id: 'furniture',
      prompt: 'Which sofa makes you want to sit down?',
      topic: 'Furniture shapes',
      options: [
        { emoji: '🛋️', title: 'Low, deep & natural', sub: 'Linen, boucle, solid wood', styles: { japandi: 2, scandi: 1, coastal: 1 } },
        { emoji: '🟠', title: 'Iconic & curvy', sub: 'Tapered legs, velvet, bold shapes', styles: { midcentury: 3, boho: 1 } },
      ],
    },
    {
      id: 'light',
      prompt: 'Evenings at home are lit by…',
      topic: 'Lighting mood',
      options: [
        { emoji: '🌞', title: 'Huge windows & daylight', sub: 'Sheer curtains, golden hour', styles: { scandi: 1, coastal: 2, modern: 1 } },
        { emoji: '🕯️', title: 'Warm lamps & candles', sub: 'Dim, cozy pools of light', styles: { japandi: 1, boho: 1, farmhouse: 1, industrial: 1 } },
      ],
    },
    {
      id: 'kitchen',
      prompt: 'Where should the square footage go?',
      topic: 'Kitchen vs. living space',
      options: [
        { emoji: '👩‍🍳', title: "A chef's kitchen with an island", sub: 'Cooking is the main event', styles: { farmhouse: 2, modern: 1 } },
        { emoji: '🛋️', title: 'Compact kitchen, bigger living room', sub: 'More room to lounge', styles: { midcentury: 1, boho: 1, industrial: 1 } },
      ],
    },
    {
      id: 'bath',
      prompt: 'Bathroom must-have',
      topic: 'Tub vs. shower',
      options: [
        { emoji: '🛁', title: 'Deep soaking tub', sub: 'Bubble baths & a book', styles: { japandi: 2, farmhouse: 1, coastal: 1 } },
        { emoji: '🚿', title: 'Walk-in rain shower', sub: 'Glass, tile, spa vibes', styles: { modern: 2, industrial: 1 } },
      ],
    },
    {
      id: 'where',
      prompt: 'Where do we live?',
      topic: 'City vs. quiet',
      options: [
        { emoji: '🚇', title: 'Walkable city neighborhood', sub: 'Cafés downstairs, no car needed', styles: { industrial: 2, midcentury: 1, modern: 1 } },
        { emoji: '🏡', title: 'Quiet place with a yard', sub: 'Trees, grill, room for the dog', styles: { farmhouse: 2, coastal: 1, scandi: 1 } },
      ],
    },
    {
      id: 'metal',
      prompt: 'Pick the hardware finish',
      topic: 'Metal finishes',
      options: [
        { emoji: '✨', title: 'Brass & warm gold', sub: 'Soft glow, a bit glam', styles: { midcentury: 2, boho: 1 } },
        { emoji: '🖤', title: 'Matte black', sub: 'Graphic and crisp', styles: { industrial: 2, farmhouse: 1, modern: 1 } },
      ],
    },
    {
      id: 'textiles',
      prompt: 'On the couch there is…',
      topic: 'Textiles & pattern',
      options: [
        { emoji: '🧺', title: 'Linen & cotton in soft neutrals', sub: 'Texture over pattern', styles: { japandi: 1, scandi: 1, coastal: 1, modern: 1 } },
        { emoji: '🧶', title: 'Pattern, color & macramé', sub: 'Kilim pillows, fringe, rattan', styles: { boho: 3 } },
      ],
    },
    {
      id: 'bedroom',
      prompt: 'The bedroom should feel like…',
      topic: 'Bedroom feel',
      options: [
        { emoji: '🏨', title: 'A calm boutique hotel', sub: 'Crisp, uncluttered, serene', styles: { modern: 2, japandi: 1 } },
        { emoji: '🪺', title: 'A cozy nest', sub: 'Mountains of pillows & throws', styles: { boho: 1, farmhouse: 1, scandi: 1 } },
      ],
    },
    {
      id: 'getaway',
      prompt: 'Your house would rather be…',
      topic: 'Getaway vibe',
      options: [
        { emoji: '🏖️', title: 'A beach house', sub: 'Salt air, white linen, blue', styles: { coastal: 3 } },
        { emoji: '🏔️', title: 'A mountain cabin', sub: 'Fireplace, wool, timber', styles: { farmhouse: 1, scandi: 2, industrial: 1 } },
      ],
    },
    {
      id: 'weekend',
      prompt: 'Saturday night we are…',
      topic: 'Hosting vs. nesting',
      options: [
        { emoji: '🥂', title: 'Hosting a dinner party', sub: 'Big table, open bar cart', styles: { farmhouse: 1, midcentury: 1, industrial: 1 } },
        { emoji: '🍿', title: 'Movie night for two (+ the dog)', sub: 'Giant sofa, blankets, snacks', styles: { scandi: 1, boho: 1, japandi: 1 } },
      ],
    },
    {
      id: 'age',
      prompt: 'Which building has our name on it?',
      topic: 'New build vs. character',
      options: [
        { emoji: '🏗️', title: 'A brand-new build', sub: 'Everything works, nothing to fix', styles: { modern: 2, coastal: 1 } },
        { emoji: '🏛️', title: 'An old building with character', sub: 'Moldings, creaky floors, a story', styles: { industrial: 1, farmhouse: 1, boho: 1, midcentury: 1 } },
      ],
    },
    {
      id: 'work',
      prompt: 'Working from home looks like…',
      topic: 'Home office',
      options: [
        { emoji: '🖥️', title: 'A real home office with a door', sub: 'Zoom-proof and focused', styles: { modern: 1, midcentury: 1 } },
        { emoji: '💻', title: 'Laptop wherever the light is', sub: 'Sofa, café table, balcony', styles: { boho: 1, coastal: 1, scandi: 1 } },
      ],
    },
  ];

  /* ------------------------------------------------------------------ */
  /* Wishlist catalog                                                    */
  /* ------------------------------------------------------------------ */
  D.wishGroups = [
    { id: 'location', label: 'Location & building', emoji: '📍' },
    { id: 'kitchen', label: 'Kitchen & dining', emoji: '🍳' },
    { id: 'living', label: 'Living spaces', emoji: '🛋️' },
    { id: 'bedroom', label: 'Bedrooms & storage', emoji: '🛏️' },
    { id: 'bath', label: 'Bathrooms', emoji: '🛁' },
    { id: 'work', label: 'Work & hobbies', emoji: '🎨' },
    { id: 'outdoor', label: 'Outdoor', emoji: '🌳' },
    { id: 'pets', label: 'Pet life', emoji: '🐶' },
    { id: 'comfort', label: 'Comfort & tech', emoji: '🔌' },
  ];

  D.wishItems = [
    ['location', 'walkable', '🚶', 'Walkable to cafés, groceries & restaurants'],
    ['location', 'transit', '🚇', 'Close to public transit'],
    ['location', 'commute', '⏱️', 'Under 30 min commute for both of us'],
    ['location', 'park', '🌲', 'Park or green space nearby'],
    ['location', 'quiet', '🤫', 'Quiet street'],
    ['location', 'elevator', '🛗', 'Elevator / no 4th-floor walk-ups'],
    ['location', 'doorman', '📦', 'Doorman or secure package room'],
    ['location', 'parking', '🚗', 'Dedicated parking spot'],
    ['location', 'gym', '🏋️', 'Gym in the building'],
    ['kitchen', 'island', '🏝️', 'Kitchen island with seating'],
    ['kitchen', 'gasrange', '🔥', 'Gas range'],
    ['kitchen', 'dishwasher', '🍽️', 'Dishwasher'],
    ['kitchen', 'pantry', '🥫', 'Walk-in pantry'],
    ['kitchen', 'dining', '🪑', 'Dining table that seats 6+'],
    ['kitchen', 'coffeebar', '☕️', 'Coffee / tea station'],
    ['living', 'fireplace', '🔥', 'Fireplace'],
    ['living', 'highceil', '⬆️', 'High ceilings'],
    ['living', 'sunlight', '🌞', 'South-facing light'],
    ['living', 'movie', '🎬', 'Movie corner with projector'],
    ['living', 'guestsleep', '🛋️', 'Sleeper sofa for guests'],
    ['living', 'reading', '📖', 'Reading nook'],
    ['bedroom', 'kingbed', '👑', 'King-size bed'],
    ['bedroom', 'walkin', '👗', 'Walk-in closet'],
    ['bedroom', 'guestroom', '🧳', 'Dedicated guest room'],
    ['bedroom', 'blackout', '🌑', 'Blackout curtains'],
    ['bedroom', 'nursery', '🍼', 'Room that could become a nursery'],
    ['bedroom', 'storage', '📦', 'Lots of built-in storage'],
    ['bath', 'twosinks', '🚰', 'Double vanity (two sinks!)'],
    ['bath', 'tub', '🛁', 'Soaking tub'],
    ['bath', 'rainshower', '🚿', 'Rain shower'],
    ['bath', 'secondbath', '🚽', 'Second bathroom'],
    ['bath', 'heatedfloor', '♨️', 'Heated bathroom floors'],
    ['work', 'office', '🖥️', 'Home office with a door'],
    ['work', 'twodesks', '👩‍💻', 'Two desks so we can both work'],
    ['work', 'gymroom', '🧘', 'Yoga / workout corner'],
    ['work', 'craft', '🎨', 'Hobby or craft space'],
    ['work', 'music', '🎹', 'Room for instruments'],
    ['outdoor', 'balcony', '🌇', 'Balcony'],
    ['outdoor', 'yard', '🌳', 'Private yard'],
    ['outdoor', 'garden', '🥕', 'Vegetable or herb garden'],
    ['outdoor', 'grill', '🍖', 'Space to grill'],
    ['outdoor', 'rooftop', '🌃', 'Rooftop access'],
    ['pets', 'dogpark', '🐕', 'Dog park within walking distance'],
    ['pets', 'petwash', '🧼', 'Pet washing station'],
    ['pets', 'petfloors', '🐾', 'Scratch-proof floors'],
    ['pets', 'dognook', '🦴', 'Built-in dog bed nook'],
    ['pets', 'fenced', '🚧', 'Fenced outdoor area'],
    ['comfort', 'inunit', '🧺', 'In-unit washer & dryer'],
    ['comfort', 'ac', '❄️', 'Central air conditioning'],
    ['comfort', 'smarthome', '🏠', 'Smart lights & thermostat'],
    ['comfort', 'solar', '☀️', 'Solar / energy efficient'],
    ['comfort', 'soundproof', '🔇', 'Good soundproofing'],
    ['comfort', 'fiber', '📶', 'Fast fiber internet'],
  ].map(([group, id, emoji, label]) => ({ group, id, emoji, label }));

  D.votes = [
    { id: 'must', emoji: '❤️', label: 'Must have', score: 3 },
    { id: 'nice', emoji: '👍', label: 'Nice to have', score: 2 },
    { id: 'meh', emoji: '🤷', label: "Don't care", score: 1 },
    { id: 'no', emoji: '🙅', label: 'Rather not', score: 0 },
  ];

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
  /* Starter plans (feet). [name, x, y, w, h, outdoor?]                  */
  /* items: [kind, x, y, rot?]                                           */
  /* ------------------------------------------------------------------ */
  D.templates = [
    {
      id: 'blank',
      name: 'Blank canvas',
      emoji: '📄',
      blurb: 'Start from nothing and draw every room yourselves.',
      rooms: [],
      items: [],
    },
    {
      id: 'studio1br',
      name: 'Cozy 1-bedroom',
      emoji: '🏢',
      blurb: '~700 sq ft city apartment with a balcony. Perfect first place together.',
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
      blurb: '~930 sq ft with a home office. Room for guests, work and a pup.',
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
  ];

  D.instantiateTemplate = (tpl, uid) => ({
    rooms: tpl.rooms.map(([name, x, y, w, h, outdoor]) => ({ id: uid('r'), name, x, y, w, h, color: roomColor(name), outdoor: !!outdoor })),
    items: tpl.items.map(([kind, x, y, rot = 0]) => {
      const c = D.furnitureByKind[kind];
      return { id: uid('i'), kind, name: c.name, x, y, w: c.w, h: c.h, rot, color: c.color };
    }),
  });

  /* ------------------------------------------------------------------ */
  /* Curated palettes for the mood board                                 */
  /* ------------------------------------------------------------------ */
  D.palettes = [
    { id: 'p-oat', name: 'Oat Milk Latte', colors: ['#f4ede3', '#e2d3bf', '#c5a988', '#8c6e54', '#3e3229'] },
    { id: 'p-sage', name: 'Sage Morning', colors: ['#f5f3ec', '#d9dfcf', '#a8b89a', '#6e8366', '#34402f'] },
    { id: 'p-terra', name: 'Terracotta Sun', colors: ['#f7ebe1', '#efc9a8', '#d9825b', '#a8513a', '#4a2a22'] },
    { id: 'p-sea', name: 'Sea Glass', colors: ['#f6f8f6', '#d6e6e3', '#a3c4c4', '#5c8d93', '#2a4b53'] },
    { id: 'p-ink', name: 'Midnight Ink', colors: ['#eeeae4', '#b9b4ad', '#5c6878', '#2e3a4d', '#141a24'] },
    { id: 'p-peach', name: 'Peach Fuzz', colors: ['#fff6ef', '#ffd9c2', '#f5a983', '#c7745a', '#5a3a33'] },
    { id: 'p-forest', name: 'Forest Cabin', colors: ['#efe9df', '#bfae8f', '#6f7d5c', '#3b4a35', '#1f2620'] },
    { id: 'p-retro', name: '70s Lounge', colors: ['#f4e9d8', '#e0a43a', '#c0583a', '#2f6f73', '#4a3428'] },
    { id: 'p-blush', name: 'Blush & Plaster', colors: ['#faf3ef', '#f0d9d0', '#d9b1a3', '#a07d72', '#4d3b36'] },
    { id: 'p-mono', name: 'Gallery White', colors: ['#ffffff', '#ededeb', '#c6c4bf', '#6f6c66', '#1a1a1a'] },
    { id: 'p-lav', name: 'Lavender Haze', colors: ['#f7f5fa', '#e2dbee', '#b9aed3', '#7c6fa0', '#3a3350'] },
    { id: 'p-shiba', name: 'Gougou Gold', colors: ['#fff4e6', '#f6d7aa', '#e8a868', '#b06f3c', '#2f2a26'] },
  ];

  /* ------------------------------------------------------------------ */
  /* Conversation cards — prompts for talking about home                 */
  /* ------------------------------------------------------------------ */
  D.talkCards = [
    'Describe the favorite room you have ever been in. What made it feel that way?',
    'What did your childhood home get right — and what will we never repeat?',
    'Walk me through our perfect lazy Sunday, hour by hour. Which rooms are we in?',
    'What is one thing you own that must have a place of honor in our home?',
    'How tidy is "tidy enough"? Show me with a number from 1 to 10.',
    'When we argue, where in the house do you want to go to cool off?',
    'How often do we want guests to stay over? Who sleeps where?',
    'What sound do you want to hear when you walk in the door?',
    'If we could only splurge on ONE room, which one and why?',
    'Pets: how many, how big, and are they allowed on the sofa?',
    'Where does the dog sleep? Be honest.',
    'What should our home smell like?',
    'Morning person or night owl — how should the bedroom handle both of us?',
    'Where will we be in 5 years? Does this home still work then?',
    'What is the commute you can live with, in minutes, without getting grumpy?',
    'What part of a home makes you feel safe?',
    'Rent or buy — what scares you about each?',
    'Do we eat at a table, at the counter, or on the sofa?',
    'What tradition do you want our home to be the place for?',
    'Plants: will you actually water them? (We will remember this answer.)',
    'Which chore do you secretly enjoy, and which one do you dread?',
    'Describe our front door. Color, sound, what is next to it.',
  ];

  D.budgetCategories = [
    { id: 'furniture', label: 'Furniture', emoji: '🛋️', color: '#d9825b' },
    { id: 'appliances', label: 'Appliances', emoji: '🧊', color: '#5d8ca3' },
    { id: 'reno', label: 'Renovation', emoji: '🔨', color: '#8c6e54' },
    { id: 'decor', label: 'Decor & textiles', emoji: '🪴', color: '#8aa38b' },
    { id: 'moving', label: 'Moving & fees', emoji: '📦', color: '#b9aed3' },
    { id: 'pets', label: 'Pet stuff', emoji: '🐶', color: '#e8a868' },
    { id: 'other', label: 'Other', emoji: '✨', color: '#9c958b' },
  ];
})(window.GG);
