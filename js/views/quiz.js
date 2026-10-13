/* Gougou House — "This or That": a blind style quiz each partner takes separately. */
(function (GG) {
  const { esc, pct } = GG.util;
  const D = GG.data;
  const I = GG.insights;
  const ui = { idx: {}, peek: false };

  const firstUnanswered = (pid) => {
    const ans = GG.store.state.quiz[pid];
    const i = D.quiz.findIndex((q) => ans[q.id] === undefined);
    return i === -1 ? D.quiz.length : i;
  };

  function render(root) {
    const s = GG.store.state;
    const me = GG.store.active();
    const other = GG.store.other();
    if (ui.idx[me.id] === undefined) ui.idx[me.id] = firstUnanswered(me.id);
    const idx = ui.idx[me.id];
    const bothDone = I.quizDone('a') && I.quizDone('b');
    const showResults = bothDone || ui.peek;

    root.innerHTML = `
      <section class="page">
        <header class="page-head">
          <div>
            <p class="eyebrow">Step 1 · Discover your style</p>
            <h1>This or That</h1>
            <p class="lead">${D.quiz.length} quick choices. Go with your gut, answer <b>separately</b> — no peeking at each other's screen 🙈.
            Gougou will work out your style and where you two see the world the same way.</p>
          </div>
          <div class="progress-pair">
            ${s.partners.map((p) => progressChip(p)).join('')}
          </div>
        </header>

        ${idx < D.quiz.length ? questionCard(me, idx) : doneCard(me, other)}

        ${showResults ? results() : waitingCard(other)}
      </section>`;

    root.onclick = (e) => {
      const t = e.target.closest('[data-pick],[data-nav],[data-jump],[data-act]');
      if (!t) return;
      const d = t.dataset;
      if (d.pick !== undefined) return pick(root, me.id, Number(d.pick));
      if (d.nav !== undefined) ui.idx[me.id] = Math.max(0, Math.min(D.quiz.length, idx + Number(d.nav)));
      if (d.jump !== undefined) ui.idx[me.id] = Number(d.jump);
      if (d.act === 'retake') ui.idx[me.id] = 0;
      if (d.act === 'peek') ui.peek = true;
      if (d.act === 'switch') return GG.app.setActive(other.id);
      render(root);
    };
  }

  function progressChip(p) {
    const n = I.quizProgress(p.id);
    return `<div class="pchip" style="--pc:${p.color}">
      <span class="pchip-emoji">${p.emoji}</span>
      <div><b>${esc(p.name)}</b><div class="bar"><i style="width:${(n / D.quiz.length) * 100}%"></i></div></div>
      <span class="muted">${n}/${D.quiz.length}</span>
    </div>`;
  }

  function questionCard(me, idx) {
    const q = D.quiz[idx];
    const ans = GG.store.state.quiz[me.id][q.id];
    return `
      <div class="card quiz-card" style="--pc:${me.color}">
        <div class="quiz-top">
          <span class="pill" style="background:${me.color}22;color:${me.color}">${me.emoji} ${esc(me.name)}'s turn</span>
          <span class="muted">Question ${idx + 1} of ${D.quiz.length}</span>
        </div>
        <h2 class="quiz-prompt">${esc(q.prompt)}</h2>
        <div class="quiz-options">
          ${q.options
            .map(
              (o, i) => `
            <button class="quiz-opt ${ans === i ? 'picked' : ''}" data-pick="${i}">
              <span class="quiz-emoji">${o.emoji}</span>
              <span class="quiz-title">${esc(o.title)}</span>
              <span class="quiz-sub">${esc(o.sub)}</span>
              <span class="quiz-key">${i === 0 ? '← or A' : 'B or →'}</span>
            </button>
            ${i === 0 ? '<div class="quiz-or">or</div>' : ''}`
            )
            .join('')}
        </div>
        <div class="quiz-nav">
          <button class="btn ghost sm" data-nav="-1" ${idx === 0 ? 'disabled' : ''}>← Back</button>
          <div class="dots">${D.quiz
            .map((qq, i) => `<button class="dot ${GG.store.state.quiz[me.id][qq.id] !== undefined ? 'on' : ''} ${i === idx ? 'cur' : ''}" data-jump="${i}" aria-label="Question ${i + 1}"></button>`)
            .join('')}</div>
          <button class="btn ghost sm" data-nav="1">Skip →</button>
        </div>
      </div>`;
  }

  function doneCard(me, other) {
    const top = I.styleScores(me.id).slice(0, 3);
    return `
      <div class="card done-card" style="--pc:${me.color}">
        <div class="done-mascot">${GG.util.mascot(88)}</div>
        <div>
          <p class="eyebrow">${me.emoji} ${esc(me.name)}, your style is…</p>
          <h2>${top[0].emoji} ${esc(top[0].name)}</h2>
          <p>${esc(top[0].blurb)}</p>
          <div class="row wrap">
            ${top.map((t) => `<span class="tag">${t.emoji} ${esc(t.name)} · ${pct(t.score)}</span>`).join('')}
          </div>
          <div class="row" style="margin-top:14px">
            ${!I.quizDone(other.id) ? `<button class="btn primary" data-act="switch">Hand the phone to ${other.emoji} ${esc(other.name)} →</button>` : ''}
            <button class="btn ghost" data-act="retake">Review my answers</button>
          </div>
        </div>
      </div>`;
  }

  function waitingCard(other) {
    const n = I.quizProgress(other.id);
    const me = GG.store.active();
    if (!I.quizDone(me.id)) return '';
    return `
      <div class="card waiting">
        <p>💌 Results unlock when <b>${esc(other.name)}</b> finishes too (${n}/${D.quiz.length} so far).</p>
        <div class="row">
          <button class="btn primary" data-act="switch">Switch to ${other.emoji} ${esc(other.name)}</button>
          <button class="btn ghost" data-act="peek">Peek anyway</button>
        </div>
        <p class="muted small">On different phones? Use <b>Share</b> in ⚙️ Settings to send your answers over.</p>
      </div>`;
  }

  function results() {
    const s = GG.store.state;
    const [A, B] = s.partners;
    const ag = I.quizAgreement();
    const blend = I.blend();
    const sa = I.styleScores('a'), sb = I.styleScores('b');
    const max = Math.max(...sa.map((x) => x.score), ...sb.map((x) => x.score), 0.01);
    const answerOf = (pid, q) => {
      const v = s.quiz[pid][q.id];
      return v === undefined ? '—' : `${q.options[v].emoji} ${esc(q.options[v].title)}`;
    };
    return `
      <div class="results">
        <div class="card blend-card">
          <p class="eyebrow">Your home's style</p>
          <h2 class="blend-name">${esc(blend.name)}</h2>
          <div class="swatches big">${blend.palette.map((c) => `<span style="background:${c}" title="${c}"></span>`).join('')}</div>
          <p>${esc(blend.primary.blurb)}${blend.secondary ? ` Mixed with a dash of <b>${esc(blend.secondary.name)}</b>: ${esc(blend.secondary.blurb.toLowerCase())}` : ''}</p>
          <p class="muted small">Ideas: ${[...blend.primary.ideas, ...(blend.secondary ? blend.secondary.ideas.slice(0, 2) : [])].map(esc).join(' · ')}</p>
          ${
            ag.pct !== null
              ? `<div class="agree-meter"><div class="ring" style="--p:${ag.pct}"><span>${pct(ag.pct)}</span></div><div><b>Taste match</b><br><span class="muted">You picked the same answer on ${ag.same} of ${ag.both} questions.</span></div></div>`
              : ''
          }
        </div>

        <div class="card">
          <h3>Style breakdown</h3>
          <div class="style-bars">
            ${Object.keys(D.styles)
              .map((k) => {
                const a = sa.find((x) => x.key === k).score, b = sb.find((x) => x.key === k).score;
                return `<div class="sb-row">
                  <span class="sb-label">${D.styles[k].emoji} ${esc(D.styles[k].name)}</span>
                  <span class="sb-bars">
                    <i style="width:${(a / max) * 100}%;background:${A.color}" title="${esc(A.name)} ${pct(a)}"></i>
                    <i style="width:${(b / max) * 100}%;background:${B.color}" title="${esc(B.name)} ${pct(b)}"></i>
                  </span>
                </div>`;
              })
              .join('')}
          </div>
          <div class="legend"><span style="--c:${A.color}">${A.emoji} ${esc(A.name)}</span><span style="--c:${B.color}">${B.emoji} ${esc(B.name)}</span></div>
        </div>

        <div class="card span-2">
          <h3>Where you differ — talk about these 💬</h3>
          ${
            ag.differ.length
              ? `<table class="cmp"><thead><tr><th>Topic</th><th>${A.emoji} ${esc(A.name)}</th><th>${B.emoji} ${esc(B.name)}</th></tr></thead><tbody>
                ${ag.differ.map((q) => `<tr><td><b>${esc(q.topic)}</b></td><td>${answerOf('a', q)}</td><td>${answerOf('b', q)}</td></tr>`).join('')}
              </tbody></table>`
              : '<p class="muted">Nothing! You two are suspiciously in sync. 🐶💕</p>'
          }
          ${ag.agree.length ? `<h3 style="margin-top:18px">You already agree on 🤝</h3><div class="row wrap">${ag.agree.map((q) => `<span class="tag good">${q.options[s.quiz.a[q.id]].emoji} ${esc(q.topic)}: ${esc(q.options[s.quiz.a[q.id]].title)}</span>`).join('')}</div>` : ''}
        </div>
      </div>`;
  }

  function pick(root, pid, i) {
    const s = GG.store.state;
    const q = D.quiz[ui.idx[pid]];
    s.quiz[pid][q.id] = i;
    GG.store.save();
    const card = root.querySelector('.quiz-card');
    card.querySelectorAll('.quiz-opt')[i].classList.add('picked', 'pop');
    setTimeout(() => {
      // advance to the next unanswered question (or the end)
      let n = ui.idx[pid] + 1;
      while (n < D.quiz.length && s.quiz[pid][D.quiz[n].id] !== undefined) n++;
      ui.idx[pid] = n;
      if (n >= D.quiz.length && !I.quizDone(pid)) ui.idx[pid] = firstUnanswered(pid);
      render(root);
      GG.store.emit();
    }, 260);
  }

  function onKey(e) {
    if (GG.app.route() !== 'quiz' || e.target.closest('input, textarea, select')) return;
    const k = e.key.toLowerCase();
    const i = k === 'arrowleft' || k === 'a' ? 0 : k === 'arrowright' || k === 'b' ? 1 : -1;
    const btn = i >= 0 && document.querySelectorAll('.quiz-opt')[i];
    if (btn) btn.click();
  }
  document.addEventListener('keydown', onKey);

  GG.views = GG.views || {};
  GG.views.quiz = { render };
})(window.GG);
