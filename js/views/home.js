/* Gougou House — home dashboard: the journey, what you've learned so far, and conversation cards. */
(function (GG) {
  const { esc, pct } = GG.util;
  const D = GG.data;
  const I = GG.insights;
  const ui = { card: null };

  function pickCard() {
    const done = new Set(GG.store.state.talkDone || []);
    const open = D.talkCards.map((_, i) => i).filter((i) => !done.has(i) && i !== ui.card);
    const pool = open.length ? open : D.talkCards.map((_, i) => i).filter((i) => i !== ui.card);
    ui.card = pool[Math.floor(Math.random() * pool.length)];
  }

  function render(root) {
    const s = GG.store.state;
    const [A, B] = s.partners;
    const steps = I.journey();
    const doneN = steps.filter((x) => x.done).length;
    const blend = I.blend();
    const qa = I.quizAgreement();
    const ws = I.wishSummary();
    const fav = s.plans.find((p) => p.hearts?.a && p.hearts?.b) || s.plans.find((p) => p.id === s.activePlan) || s.plans[0];
    const nextStep = steps.find((x) => !x.done);
    if (ui.card === null) pickCard();
    const talked = (s.talkDone || []).includes(ui.card);

    root.innerHTML = `
      <section class="page home">
        <div class="hero card">
          <div class="hero-mascot">${GG.util.mascot(132)}</div>
          <div class="hero-text">
            <p class="eyebrow">Gougou House</p>
            <h1>${s.onboarded ? `Hi ${esc(A.name)} ${A.emoji} & ${esc(B.name)} ${B.emoji}` : 'Let’s design your future home, together.'}</h1>
            <p class="lead">${s.onboarded
              ? 'One cozy decision at a time. Here’s where your future home stands.'
              : 'Discover your shared style, decide what really matters, sketch floor plans with real furniture, and make the money add up — with a little help from Gougou 🐶.'}</p>
            <div class="row wrap">
              ${s.onboarded
                ? nextStep ? `<button class="btn primary" data-go="${nextStep.href}" data-partner="${nextStep.partner || ''}">Next: ${esc(nextStep.label)} →</button>` : '<span class="pill good">🎉 Every step done — go find that home!</span>'
                : '<button class="btn primary" data-act="welcome">Let’s start →</button>'}
            </div>
          </div>
          <div class="hero-progress">
            <div class="ring big" style="--p:${doneN / steps.length}"><span>${doneN}/${steps.length}</span></div>
            <span class="muted small">steps done</span>
          </div>
        </div>

        <div class="home-grid">
          <div class="card journey">
            <h2>Your journey</h2>
            <ol class="steps">
              ${steps.map((st) => `<li class="${st.done ? 'done' : ''}">
                <button data-go="${st.href}" data-partner="${st.partner || ''}">
                  <span class="check">${st.done ? '✓' : ''}</span>
                  <span>${esc(st.label)}${st.hint && !st.done ? ` <span class="muted small">· ${esc(st.hint)}</span>` : ''}</span>
                  ${st.partner ? `<span class="who" style="background:${GG.store.partner(st.partner).color}">${GG.store.partner(st.partner).emoji}</span>` : ''}
                </button>
              </li>`).join('')}
            </ol>
          </div>

          <div class="stack">
            <div class="card">
              <h2>Our style</h2>
              ${blend
                ? `<h3 class="blend-name sm">${esc(blend.name)}</h3>
                   <div class="swatches">${blend.palette.map((c) => `<span style="background:${c}"></span>`).join('')}</div>
                   <p class="small">${esc(blend.primary.blurb)}</p>`
                : `<p class="muted">Play <a href="#quiz">This or That</a> to discover your shared style.</p>`}
              <div class="meters">
                ${meter('Taste match', qa.pct, `${qa.same}/${qa.both} same picks`)}
                ${meter('Wishlist agreement', ws.pct, `${ws.both} features rated by both`)}
              </div>
            </div>

            <div class="card talk-card">
              <p class="eyebrow">💬 Conversation card · ${(s.talkDone || []).length}/${D.talkCards.length} talked about</p>
              <blockquote>${esc(D.talkCards[ui.card])}</blockquote>
              <div class="row">
                <button class="btn sm ${talked ? 'good' : 'primary'}" data-act="talked">${talked ? '✓ We talked about it' : 'We talked about this ✓'}</button>
                <button class="btn sm ghost" data-act="next-card">Another card ↻</button>
              </div>
              <p class="muted small">Great for car rides, dinner, or a lazy Sunday. No wrong answers.</p>
            </div>
          </div>

          <div class="card">
            <h2>💞 Shared must-haves</h2>
            ${ws.shared.length
              ? `<div class="row wrap">${ws.shared.map((x) => `<span class="tag good">${x.emoji} ${esc(x.label)}</span>`).join('')}</div>`
              : `<p class="muted">Nothing yet — both of you mark ❤️ on the <a href="#wishlist">Wishlist</a>.</p>`}
            ${ws.conflict.length || ws.discuss.length
              ? `<h3 style="margin-top:16px">💬 To talk about</h3>
                 <div class="row wrap">${[...ws.conflict, ...ws.discuss].slice(0, 10).map((x) => `<span class="tag ${x.kind === 'conflict' ? 'warn' : ''}">${x.kind === 'conflict' ? '⚠️' : ''} ${x.emoji} ${esc(x.label)}</span>`).join('')}</div>`
              : ''}
          </div>

          <div class="card plan-card">
            <div class="section-head tight"><h2>${fav.hearts?.a && fav.hearts?.b ? '💞 Favorite plan' : '📐 Current plan'}</h2><span class="grow"></span><a href="#planner" class="btn sm ghost">Open →</a></div>
            <a href="#planner" class="plan-thumb">${GG.views.planner.thumb(fav)}</a>
            <p class="small"><b>${esc(fav.name)}</b> · ${GG.util.area(I.planArea(fav).indoor)} · ${s.plans.length} option${s.plans.length === 1 ? '' : 's'} sketched</p>
          </div>
        </div>

        <div class="card privacy">
          <div>${GG.util.mascot(40, 'sleepy')}</div>
          <p class="small muted">Everything you enter stays in this browser. To get your partner's answers onto your device, open <b>⚙️ Settings → Share with ${esc(B.name)}</b>,
          or download a backup file. Nothing is uploaded anywhere.</p>
        </div>
      </section>`;

    root.onclick = (e) => {
      const t = e.target.closest('[data-go],[data-act]');
      if (!t) return;
      if (t.dataset.go) {
        if (t.dataset.go === '#settings') return GG.app.settings();
        if (t.dataset.partner) GG.store.state.activePartner = t.dataset.partner;
        GG.store.save();
        location.hash = t.dataset.go;
        if (t.dataset.go === '#home') GG.app.refresh();
        return;
      }
      if (t.dataset.act === 'welcome') return GG.app.welcome();
      if (t.dataset.act === 'next-card') {
        pickCard();
        return render(root);
      }
      if (t.dataset.act === 'talked') {
        s.talkDone = s.talkDone || [];
        if (!s.talkDone.includes(ui.card)) {
          s.talkDone.push(ui.card);
          GG.store.save();
          GG.util.toast('Gougou is proud of you two 🐶💕');
        }
        return render(root);
      }
    };
  }

  function meter(label, value, sub) {
    return `<div class="meter">
      <div class="ring" style="--p:${value ?? 0}"><span>${value === null ? '—' : pct(value)}</span></div>
      <div><b>${label}</b><br><span class="muted small">${value === null ? 'Not enough answers yet' : sub}</span></div>
    </div>`;
  }

  GG.views = GG.views || {};
  GG.views.home = { render };
})(window.GG);
