/* Gougou House — app shell: boot, settings & backups, design share links. */
(function (GG) {
  const { esc, toast, modal } = GG.util;
  const view = document.getElementById('view');

  function settings() {
    const s = GG.store.state;
    modal({
      title: 'Settings',
      body: `
        <div class="settings-row">
          <b>Units</b>
          <span class="seg small"><button type="button" class="${s.unit === 'ft' ? 'on' : ''}" data-u="ft">Feet</button><button type="button" class="${s.unit === 'm' ? 'on' : ''}" data-u="m">Meters</button></span>
        </div>
        <h3>Backups</h3>
        <p class="muted small">Your designs save automatically in this browser. Download a backup to move them to another device.</p>
        <div class="menu-list">
          <button type="button" class="btn" data-export>⬇ Download backup</button>
          <button type="button" class="btn" data-import>⬆ Open a backup</button>
          <button type="button" class="btn danger" data-reset>Start over (erase all designs)</button>
        </div>`,
      actions: [{ label: 'Done', primary: true }],
      onMount: (m, close) => {
        m.addEventListener('click', async (e) => {
          const t = e.target;
          if (t.dataset.u) {
            s.unit = t.dataset.u;
            GG.store.save();
            t.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === t));
            GG.game.render(view);
          } else if (t.closest('[data-export]')) {
            GG.util.download(`gougou-house-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(s, null, 1));
          } else if (t.closest('[data-import]')) {
            const f = await GG.util.pickFile('application/json,.json');
            if (!f) return;
            try {
              const data = JSON.parse(await f.text());
              if (!Array.isArray(data.plans)) throw new Error('no plans');
              close();
              GG.store.replace(data);
              GG.dog.reset();
              GG.game.render(view);
              toast(`Opened ${data.plans.length} design${data.plans.length === 1 ? '' : 's'} 🏡`);
            } catch {
              toast('That file doesn’t look like a Gougou House backup 🤔');
            }
          } else if (t.closest('[data-reset]')) {
            close();
            if (await GG.util.confirm('Start over?', 'This erases every design <b>on this device</b>.', 'Erase everything', true)) {
              GG.store.reset();
              GG.dog.reset();
              GG.game.render(view);
            }
          }
        });
      },
    });
  }

  /** Copy a link that carries one design; whoever opens it can add it to their own designs. */
  async function sharePlan(p) {
    const code = await GG.util.encodeShare({ kind: 'design', plan: p });
    const url = `${location.origin}${location.pathname}#design=${code}`;
    if (location.protocol === 'file:') toast('Tip: links work best once the game is online (see README).');
    if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
      try {
        return await navigator.share({ title: `Gougou House · ${p.name}`, url });
      } catch {
        /* fall back to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast('💌 Link copied — send it over!');
    } catch {
      modal({ title: 'Copy this link', body: `<textarea rows="5" readonly style="width:100%">${esc(url)}</textarea>` });
    }
  }

  async function checkHash() {
    const m = location.hash.match(/^#design=(.+)$/);
    if (!m) return;
    history.replaceState(null, '', location.pathname);
    try {
      const data = await GG.util.decodeShare(m[1]);
      const p = data.plan;
      if (!p || !Array.isArray(p.rooms)) throw new Error('bad link');
      modal({
        title: '💌 Someone sent you a design',
        body: `<p>Add <b>“${esc(p.name)}”</b> to your designs?</p>`,
        actions: [
          { label: 'No thanks' },
          {
            label: 'Add it',
            primary: true,
            onClick: () => {
              p.id = GG.util.uid('plan');
              GG.game.addPlan(p);
              toast('Added! 🏡');
            },
          },
        ],
      });
    } catch (e) {
      console.warn(e);
      toast('That link seems broken — ask for a new one 🙏');
    }
  }

  GG.app = { settings, sharePlan };
  GG.textures.init();
  GG.game.render(view);
  if (GG.store.fresh) setTimeout(() => GG.dog.say('Help me furnish our home! Drag things from the shelf 🛋️', 6000), 1500);
  checkHash();
  window.addEventListener('hashchange', checkHash);
})(window.GG);
