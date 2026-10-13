/* Gougou House — mood board: palettes you both heart + a pin board of photos, links, notes and colors. */
(function (GG) {
  const { esc, uid, toast } = GG.util;
  const D = GG.data;
  const I = GG.insights;
  const ROOMS = ['Whole home', 'Living', 'Kitchen', 'Bedroom', 'Bathroom', 'Office', 'Outdoor', 'Pet corner'];
  const ui = { room: 'all', root: null };

  function render(root) {
    ui.root = root;
    const s = GG.store.state;
    const me = GG.store.active();
    const blend = I.blend();
    const palettes = I.allPalettes();
    const shared = new Set(I.sharedPalettes().map((p) => p.id));
    const cards = s.mood.cards.filter((c) => ui.room === 'all' || c.room === ui.room).sort((a, b) => b.createdAt - a.createdAt);

    root.innerHTML = `
      <section class="page">
        <header class="page-head">
          <div>
            <p class="eyebrow">Step 4 · Set the mood</p>
            <h1>Mood Board</h1>
            <p class="lead">Heart the palettes you'd happily live with and pin anything that makes you go "ooh" — photos, links, notes, colors.
              Drag images straight in, or paste with <kbd>⌘/Ctrl V</kbd>.</p>
          </div>
        </header>

        ${blend ? `<div class="card blend-strip">
          <div><p class="eyebrow">From This or That</p><h3>${esc(blend.name)}</h3></div>
          <div class="swatches">${blend.palette.map((c) => `<span style="background:${c}" title="${c}" data-copy="${c}"></span>`).join('')}</div>
          <button class="btn sm" data-act="save-blend">Save as palette</button>
        </div>` : ''}

        <div class="section-head">
          <h2>Palettes</h2>
          <span class="muted small">${me.emoji} You're hearting as <b>${esc(me.name)}</b> · 💞 = you both love it</span>
          <span class="grow"></span>
          <button class="btn sm" data-act="new-palette">＋ Make your own</button>
        </div>
        <div class="palette-grid">
          ${palettes.map((p) => paletteCard(p, shared.has(p.id))).join('')}
        </div>

        <div class="section-head">
          <h2>Pin board</h2>
          <span class="grow"></span>
          <button class="btn sm primary" data-act="upload">📷 Upload photo</button>
          <button class="btn sm" data-act="link">🔗 Image link</button>
          <button class="btn sm" data-act="note">📝 Note</button>
          <button class="btn sm" data-act="color">🎨 Color</button>
        </div>
        <div class="seg room-filter">
          <button class="${ui.room === 'all' ? 'on' : ''}" data-room="all">Everything <span class="count">${s.mood.cards.length}</span></button>
          ${ROOMS.map((r) => {
            const n = s.mood.cards.filter((c) => c.room === r).length;
            return `<button class="${ui.room === r ? 'on' : ''}" data-room="${r}">${r}${n ? ` <span class="count">${n}</span>` : ''}</button>`;
          }).join('')}
        </div>
        <div class="board" id="board">
          ${cards.length ? cards.map(pinCard).join('') : `<div class="empty">${GG.util.mascot(72, 'sleepy')}<p>Nothing pinned ${ui.room === 'all' ? 'yet' : `for ${esc(ui.room)}`}. Drop a photo here, or try a note like <i>"big window seat for naps"</i>.</p></div>`}
        </div>
      </section>`;

    root.onclick = (e) => {
      const t = e.target.closest('[data-act],[data-like],[data-room],[data-react],[data-del],[data-copy],[data-del-pal]');
      if (!t) return;
      const d = t.dataset;
      if (d.copy) {
        navigator.clipboard?.writeText(d.copy);
        return toast(`Copied ${d.copy}`);
      }
      if (d.like) return toggleLike(d.like);
      if (d.room) {
        ui.room = d.room;
        return render(root);
      }
      if (d.react) return react(...d.react.split('|'));
      if (d.del) {
        s.mood.cards = s.mood.cards.filter((c) => c.id !== d.del);
        GG.store.save();
        return render(root);
      }
      if (d.delPal) {
        s.mood.customPalettes = s.mood.customPalettes.filter((p) => p.id !== d.delPal);
        GG.store.save();
        return render(root);
      }
      switch (d.act) {
        case 'save-blend':
          if (s.mood.customPalettes.some((p) => p.name === blend.name)) return toast('Already saved 👍');
          s.mood.customPalettes.push({ id: uid('pal'), name: blend.name, colors: blend.palette, custom: true });
          GG.store.save();
          return render(root);
        case 'new-palette': return paletteDialog();
        case 'upload': return upload();
        case 'link': return linkDialog();
        case 'note': return noteDialog();
        case 'color': return colorDialog();
      }
    };
    root.onchange = (e) => {
      const id = e.target.dataset.roomfor;
      if (!id) return;
      const c = s.mood.cards.find((x) => x.id === id);
      c.room = e.target.value;
      GG.store.save();
      render(root);
    };

    const board = root.querySelector('#board');
    board.addEventListener('dragover', (e) => {
      e.preventDefault();
      board.classList.add('drop');
    });
    board.addEventListener('dragleave', () => board.classList.remove('drop'));
    board.addEventListener('drop', async (e) => {
      e.preventDefault();
      board.classList.remove('drop');
      const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
      if (files.length) return addImages(files);
      const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
      if (/^https?:\/\//.test(url)) addCard({ type: 'image', src: url.trim(), text: '' });
    });
  }

  function paletteCard(p, both) {
    const s = GG.store.state;
    return `
      <div class="card palette ${both ? 'both' : ''}">
        <div class="swatches tall">${p.colors.map((c) => `<span style="background:${c}" data-copy="${c}" title="Copy ${c}"></span>`).join('')}</div>
        <div class="palette-foot">
          <b class="palette-name" title="${esc(p.name)}">${esc(p.name)}${both ? ' 💞' : ''}</b>
          ${s.partners.map((pp) => {
            const on = s.mood.likes[pp.id].includes(p.id);
            const mine = pp.id === s.activePartner;
            return `<button class="heart ${on ? 'on' : ''} ${mine ? '' : 'readonly'}" style="--pc:${pp.color}" ${mine ? `data-like="${p.id}"` : 'disabled'} title="${esc(pp.name)}${on ? ' loves this' : ''}">${pp.emoji}${on ? '❤️' : '🤍'}</button>`;
          }).join('')}
          ${p.custom ? `<button class="x" data-del-pal="${p.id}" title="Remove palette">×</button>` : ''}
        </div>
      </div>`;
  }

  function pinCard(c) {
    const s = GG.store.state;
    const by = GG.store.partner(c.by);
    let body = '';
    if (c.type === 'image') body = `<img src="${esc(c.src)}" alt="${esc(c.text || 'Inspiration')}" loading="lazy" onerror="this.closest('.pin').classList.add('broken')">`;
    if (c.type === 'color') body = `<div class="pin-color" style="background:${esc(c.color)}" data-copy="${esc(c.color)}"><span>${esc(c.color)}</span></div>`;
    if (c.type === 'note') body = `<div class="pin-note">${esc(c.text)}</div>`;
    return `
      <article class="pin pin-type-${c.type}">
        ${body}
        ${c.type !== 'note' && c.text ? `<p class="pin-caption">${esc(c.text)}</p>` : ''}
        ${c.url ? `<a class="pin-link small" href="${esc(c.url)}" target="_blank" rel="noopener">↗ source</a>` : ''}
        <div class="pin-foot">
          <select data-roomfor="${c.id}" aria-label="Room">${ROOMS.map((r) => `<option ${c.room === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
          <span class="grow"></span>
          ${s.partners.map((pp) => {
            const r = (c.reactions || {})[pp.id];
            const mine = pp.id === s.activePartner;
            return `<span class="reacts" style="--pc:${pp.color}" title="${esc(pp.name)}">${pp.emoji}
              ${mine
                ? `<button class="${r === 'love' ? 'on' : ''}" data-react="${c.id}|love">❤️</button><button class="${r === 'hmm' ? 'on' : ''}" data-react="${c.id}|hmm">🤔</button>`
                : `<i>${r === 'love' ? '❤️' : r === 'hmm' ? '🤔' : '·'}</i>`}
            </span>`;
          }).join('')}
          <button class="x" data-del="${c.id}" title="Remove">×</button>
        </div>
        ${by ? `<span class="pin-by" style="background:${by.color}" title="Pinned by ${esc(by.name)}">${by.emoji}</span>` : ''}
      </article>`;
  }

  function toggleLike(id) {
    const s = GG.store.state;
    const likes = s.mood.likes[s.activePartner];
    const i = likes.indexOf(id);
    i >= 0 ? likes.splice(i, 1) : likes.push(id);
    GG.store.save();
    GG.store.emit();
    if (i < 0 && s.mood.likes[GG.store.other().id].includes(id)) toast('💞 It’s a match! You both love this palette.');
    render(ui.root);
  }

  function react(id, kind) {
    const s = GG.store.state;
    const c = s.mood.cards.find((x) => x.id === id);
    c.reactions = c.reactions || {};
    c.reactions[s.activePartner] = c.reactions[s.activePartner] === kind ? undefined : kind;
    GG.store.save();
    render(ui.root);
  }

  function addCard(card) {
    const s = GG.store.state;
    s.mood.cards.push({
      id: uid('c'),
      room: ui.room === 'all' ? 'Whole home' : ui.room,
      by: s.activePartner,
      reactions: { [s.activePartner]: 'love' },
      createdAt: Date.now(),
      ...card,
    });
    GG.store.save();
    GG.store.emit();
    render(ui.root);
  }

  async function addImages(files) {
    for (const f of files) {
      try {
        addCard({ type: 'image', src: await GG.util.readImage(f), text: '' });
      } catch {
        toast('Could not read that image 😿');
      }
    }
  }

  async function upload() {
    const f = await GG.util.pickFile('image/*');
    if (f) addImages([f]);
  }

  function linkDialog() {
    GG.util.modal({
      title: 'Pin an image from the web',
      body: `
        <label class="lbl">Image address <input type="url" id="m-src" placeholder="https://…/photo.jpg"></label>
        <p class="muted small">Tip: on Pinterest or Instagram, right-click the picture → “Copy image address”.</p>
        <label class="lbl">Caption <input type="text" id="m-text" placeholder="Love this kitchen island!" maxlength="140"></label>
        <label class="lbl">Source page (optional) <input type="url" id="m-url" placeholder="https://…"></label>`,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Pin it',
          primary: true,
          onClick: (m) => {
            const src = m.querySelector('#m-src').value.trim();
            if (!/^https?:\/\//.test(src)) {
              toast('Paste an image address starting with https://');
              return false;
            }
            addCard({ type: 'image', src, text: m.querySelector('#m-text').value.trim(), url: m.querySelector('#m-url').value.trim() });
          },
        },
      ],
    });
  }

  function noteDialog() {
    GG.util.modal({
      title: 'Pin a note',
      body: `<textarea id="m-text" rows="4" maxlength="400" placeholder="A window seat big enough for both of us + the dog"></textarea>`,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Pin it',
          primary: true,
          onClick: (m) => {
            const text = m.querySelector('#m-text').value.trim();
            if (!text) return false;
            addCard({ type: 'note', text });
          },
        },
      ],
    });
  }

  function colorDialog() {
    GG.util.modal({
      title: 'Pin a color',
      body: `<div class="two"><label class="lbl">Color <input type="color" id="m-color" value="#8aa38b"></label>
        <label class="lbl">What for? <input type="text" id="m-text" placeholder="Bedroom accent wall" maxlength="80"></label></div>`,
      actions: [
        { label: 'Cancel' },
        { label: 'Pin it', primary: true, onClick: (m) => addCard({ type: 'color', color: m.querySelector('#m-color').value, text: m.querySelector('#m-text').value.trim() }) },
      ],
    });
  }

  function paletteDialog() {
    const start = ['#f4ede3', '#d9c7ae', '#a8b89a', '#d9825b', '#3e3229'];
    GG.util.modal({
      title: 'Make a palette',
      body: `
        <label class="lbl">Name <input type="text" id="m-name" placeholder="Our bedroom" maxlength="40"></label>
        <div class="color-row">${start.map((c, i) => `<input type="color" value="${c}" data-ci="${i}">`).join('')}</div>
        <p class="muted small">Tip: lightest for walls, mid-tones for big furniture, darkest for accents.</p>`,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Save palette',
          primary: true,
          onClick: (m) => {
            const s = GG.store.state;
            const colors = [...m.querySelectorAll('[data-ci]')].map((x) => x.value);
            const p = { id: uid('pal'), name: m.querySelector('#m-name').value.trim() || 'Our palette', colors, custom: true };
            s.mood.customPalettes.push(p);
            s.mood.likes[s.activePartner].push(p.id);
            GG.store.save();
            render(ui.root);
          },
        },
      ],
    });
  }

  // paste images from the clipboard while on the mood board
  document.addEventListener('paste', (e) => {
    if (GG.app.route() !== 'mood' || e.target.closest('input, textarea') || document.querySelector('.modal-backdrop')) return;
    const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (files.length) {
      e.preventDefault();
      addImages(files);
    }
  });

  GG.views = GG.views || {};
  GG.views.mood = { render };
})(window.GG);
