/* Gougou House — app shell: routing, the "who's here?" switcher, settings, sharing. */
(function (GG) {
  const { esc, toast, modal } = GG.util;
  const ROUTES = ['home', 'quiz', 'wishlist', 'planner', 'mood', 'budget'];
  const TITLES = { home: 'Home', quiz: 'This or That', wishlist: 'Wishlist', planner: 'Floor Plans', mood: 'Mood Board', budget: 'Budget' };
  const view = document.getElementById('view');
  let current = null;

  const route = () => {
    const h = location.hash.slice(1).split(/[?=]/)[0];
    return ROUTES.includes(h) ? h : 'home';
  };

  function show() {
    const r = route();
    view.onclick = view.onchange = view.oninput = view.onkeydown = null;
    GG.views[r].render(view);
    document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${r}`));
    document.title = `${TITLES[r]} · Gougou House`;
    document.body.dataset.route = r;
    if (r !== current) window.scrollTo(0, 0);
    current = r;
  }

  function renderHeader() {
    const s = GG.store.state;
    document.getElementById('brand-mascot').innerHTML = GG.util.mascot(34);
    document.getElementById('whoami').innerHTML = `
      <span class="muted small who-label">Who's here?</span>
      ${s.partners.map((p) => `<button class="who-btn ${p.id === s.activePartner ? 'on' : ''}" style="--pc:${p.color}" data-who="${p.id}" title="Switch to ${esc(p.name)}">
        <span>${p.emoji}</span><b>${esc(p.name)}</b></button>`).join('')}
      <button class="icon-btn" data-settings title="Settings, sharing & backup" aria-label="Settings">⚙️</button>`;
  }

  function setActive(pid) {
    const s = GG.store.state;
    if (s.activePartner === pid) return;
    s.activePartner = pid;
    GG.store.save();
    renderHeader();
    show();
    const p = GG.store.partner(pid);
    toast(`${p.emoji} Hi ${p.name}!`);
  }

  document.getElementById('whoami').addEventListener('click', (e) => {
    const who = e.target.closest('[data-who]');
    if (who) return setActive(who.dataset.who);
    if (e.target.closest('[data-settings]')) settings();
  });

  /* ------------------------------------------------------------------ */
  /* Welcome & settings                                                  */
  /* ------------------------------------------------------------------ */
  const EMOJIS = ['🐻', '🐰', '🐱', '🐶', '🦊', '🐼', '🐨', '🐯', '🐸', '🐧', '🦄', '🐝', '🌸', '🌻', '⭐️', '🍑'];
  const COLORS = ['#d9825b', '#5d8ca3', '#8aa38b', '#b9739a', '#7c6fa0', '#c9a227', '#3f7f6e', '#c0583a'];

  function partnerFields(p, i) {
    return `
      <fieldset class="partner-fields" style="--pc:${p.color}">
        <legend>${i === 0 ? 'You' : 'Your partner'}</legend>
        <label class="lbl">Name <input type="text" data-pf="${p.id}|name" value="${/^Partner [AB]$/.test(p.name) ? '' : esc(p.name)}" placeholder="${i === 0 ? 'Your name' : 'Their name'}" maxlength="24"></label>
        <div class="lbl">Avatar
          <div class="emoji-pick">${EMOJIS.map((e) => `<button type="button" class="${e === p.emoji ? 'on' : ''}" data-pe="${p.id}|${e}">${e}</button>`).join('')}</div>
        </div>
        <div class="lbl">Color
          <div class="color-pick">${COLORS.map((c) => `<button type="button" class="${c === p.color ? 'on' : ''}" style="background:${c}" data-pc="${p.id}|${c}" aria-label="${c}"></button>`).join('')}</div>
        </div>
      </fieldset>`;
  }

  function bindPartnerFields(m) {
    const s = GG.store.state;
    const draft = GG.util.clone(s.partners);
    m.addEventListener('click', (e) => {
      const em = e.target.closest('[data-pe]'), co = e.target.closest('[data-pc]');
      const btn = em || co;
      if (!btn) return;
      const [pid, val] = (em ? em.dataset.pe : co.dataset.pc).split('|');
      const p = draft.find((x) => x.id === pid);
      if (em) p.emoji = val;
      else p.color = val;
      btn.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btn));
      btn.closest('fieldset').style.setProperty('--pc', p.color);
    });
    return () => {
      m.querySelectorAll('[data-pf]').forEach((input) => {
        const [pid] = input.dataset.pf.split('|');
        const p = draft.find((x) => x.id === pid);
        p.name = input.value.trim() || (pid === 'a' ? 'Partner A' : 'Partner B');
      });
      s.partners = draft;
    };
  }

  function welcome() {
    const s = GG.store.state;
    let commit;
    modal({
      title: 'Woof! Who is designing this home? 🐶',
      wide: true,
      body: `<p class="muted">Gougou keeps your answers apart so you can each give honest opinions, then shows you where you agree.</p>
        <div class="two">${s.partners.map(partnerFields).join('')}</div>`,
      actions: [
        {
          label: 'Let’s go!',
          primary: true,
          onClick: () => {
            commit();
            s.onboarded = true;
            s.activePartner = 'a';
            GG.store.save();
            renderHeader();
            show();
          },
        },
      ],
      onMount: (m) => (commit = bindPartnerFields(m)),
    });
  }

  function settings() {
    const s = GG.store.state;
    let commit;
    const isFile = location.protocol === 'file:';
    modal({
      title: 'Settings & sharing',
      wide: true,
      body: `
        <div class="two">${s.partners.map(partnerFields).join('')}</div>
        <div class="settings-row">
          <span><b>Units</b></span>
          <span class="seg small"><button type="button" class="${s.unit === 'ft' ? 'on' : ''}" data-u="ft">Feet</button><button type="button" class="${s.unit === 'm' ? 'on' : ''}" data-u="m">Meters</button></span>
        </div>
        <h3>💌 Share with your partner</h3>
        <p class="muted small">Each of you can use your own phone. Send your copy over and the other person picks <b>“Merge”</b> —
          Gougou brings in the sender’s quiz &amp; wishlist answers plus any new plans, pins and budget items. Uploaded photos only travel in backup files.</p>
        <div class="row wrap">
          <button type="button" class="btn primary" data-share>🔗 Copy share link</button>
          <button type="button" class="btn" data-export>⬇ Download backup file</button>
          <button type="button" class="btn" data-import>⬆ Open a backup / partner file</button>
        </div>
        ${isFile ? '<p class="muted small">You opened Gougou House as a local file, so share links only work if your partner has the files too. Backup files always work — or host it on GitHub Pages (see README).</p>' : ''}
        <h3>Danger zone</h3>
        <button type="button" class="btn danger" data-reset>Start over (erase everything on this device)</button>`,
      actions: [
        { label: 'Close' },
        {
          label: 'Save',
          primary: true,
          onClick: () => {
            commit();
            s.onboarded = true;
            GG.store.save();
            renderHeader();
            show();
          },
        },
      ],
      onMount: (m, close) => {
        commit = bindPartnerFields(m);
        m.addEventListener('click', async (e) => {
          const t = e.target;
          if (t.dataset.u) {
            s.unit = t.dataset.u;
            GG.store.save();
            t.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === t));
            show();
          } else if (t.closest('[data-share]')) {
            commit();
            GG.store.save();
            shareLink();
          } else if (t.closest('[data-export]')) {
            commit();
            const date = new Date().toISOString().slice(0, 10);
            GG.util.download(`gougou-house-${GG.store.active().name.toLowerCase().replace(/\W+/g, '-')}-${date}.json`, JSON.stringify(GG.store.snapshot(), null, 1));
          } else if (t.closest('[data-import]')) {
            const f = await GG.util.pickFile('application/json,.json');
            if (!f) return;
            try {
              const data = JSON.parse(await f.text());
              close();
              offerImport(data);
            } catch {
              toast('That file doesn’t look like a Gougou House backup 🤔');
            }
          } else if (t.closest('[data-reset]')) {
            close();
            if (await GG.util.confirm('Start over?', 'This erases all answers, plans, pins and budget items <b>on this device</b>. Download a backup first if you might want them.', 'Erase everything', true)) {
              GG.store.reset();
              location.hash = '#home';
              renderHeader();
              show();
              welcome();
            }
          }
        });
      },
    });
  }

  /* ------------------------------------------------------------------ */
  /* Sharing                                                             */
  /* ------------------------------------------------------------------ */
  async function shareLink() {
    const code = await GG.util.encodeShare(GG.store.snapshot({ forLink: true }));
    const url = `${location.origin}${location.pathname}#share=${code}`;
    const me = GG.store.active();
    if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
      try {
        await navigator.share({ title: 'Our Gougou House', text: `${me.emoji} ${me.name} updated our future home!`, url });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast(`🔗 Link copied (${Math.round(url.length / 1024)} KB) — send it to your partner!`);
    } catch {
      modal({ title: 'Copy this link', body: `<textarea rows="5" readonly style="width:100%">${esc(url)}</textarea>` });
    }
  }

  function offerImport(data) {
    if (!data || !Array.isArray(data.partners)) return toast('That doesn’t look like a Gougou House 🤔');
    const from = data.partners.find((p) => p.id === data.sharedBy) || data.partners[0];
    modal({
      title: `💌 ${from.emoji} ${from.name} sent you their Gougou House`,
      body: `<p><b>Merge</b> brings in ${esc(from.name)}’s quiz and wishlist answers and adds any plans, pins and budget items you don’t have yet. Your own answers stay as they are.</p>
        <p class="muted small"><b>Replace</b> throws away what’s on this device and uses their copy exactly.</p>`,
      actions: [
        { label: 'Not now' },
        {
          label: 'Replace mine',
          danger: true,
          onClick: () => {
            GG.store.replace(data);
            renderHeader();
            show();
            toast('Replaced with the shared copy');
          },
        },
        {
          label: 'Merge (recommended)',
          primary: true,
          onClick: () => {
            const pid = GG.store.merge(data);
            renderHeader();
            show();
            toast(`Merged ${GG.store.partner(pid).name}’s answers 💞`);
          },
        },
      ],
    });
  }

  async function checkShareHash() {
    const m = location.hash.match(/^#share=(.+)$/);
    if (!m) return false;
    history.replaceState(null, '', `${location.pathname}#home`);
    try {
      offerImport(await GG.util.decodeShare(m[1]));
    } catch (e) {
      console.warn(e);
      toast('That share link seems broken — ask for a new one 🙏');
    }
    return true;
  }

  /* ------------------------------------------------------------------ */
  GG.app = { route, setActive, settings, welcome, refresh: show };

  GG.store.subscribe(renderHeader);
  window.addEventListener('hashchange', async () => {
    if (await checkShareHash()) return show();
    show();
  });

  renderHeader();
  checkShareHash().then((shared) => {
    show();
    if (!shared && !GG.store.state.onboarded) welcome();
  });
})(window.GG);
