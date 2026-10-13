/* Gougou House — budget: monthly housing cost calculator + move-in shopping budget. */
(function (GG) {
  const { esc, uid, money, pct, toast } = GG.util;
  const D = GG.data;
  const CAT = Object.fromEntries(D.budgetCategories.map((c) => [c.id, c]));
  const STATUS = [
    { id: 'idea', label: '💭 Idea' },
    { id: 'planned', label: '📝 Planned' },
    { id: 'bought', label: '✅ Bought' },
  ];
  /** Ballpark mid-range prices (USD) used when importing furniture from a floor plan. */
  const TYPICAL = {
    sofa: 1400, sectional: 2200, loveseat: 900, armchair: 550, coffee: 300, tv: 400, bookshelf: 200, rug: 450, rugsm: 250,
    plant: 60, piano: 3500, king: 1600, queen: 1200, full: 900, nightstand: 150, dresser: 700, wardrobe: 600, crib: 350,
    table4: 450, table6: 900, roundtable: 500, chair: 120, barcart: 180, island: 1500, fridge: 1800, range: 1100,
    washer: 1600, desk: 400, officechair: 300, yogamat: 40, dogbed: 90, crate: 120, bowls: 30, cattree: 110, closet: 400,
    vanity: 700, grill: 450, patiotable: 300, lounger: 250, hammock: 120, planter: 90, vanity2: 1400, tub: 1200, shower: 2000, toilet: 300, sink: 350, counter: 1200,
  };
  const catFor = (kind) => {
    if (['fridge', 'range', 'washer'].includes(kind)) return 'appliances';
    if (['dogbed', 'crate', 'bowls', 'cattree'].includes(kind)) return 'pets';
    if (['rug', 'rugsm', 'plant', 'yogamat'].includes(kind)) return 'decor';
    if (['vanity', 'vanity2', 'tub', 'shower', 'toilet', 'sink', 'counter', 'island', 'closet'].includes(kind)) return 'reno';
    return 'furniture';
  };

  function monthly(c) {
    if (c.mode === 'rent') return { total: +c.rent || 0, parts: [['Rent', +c.rent || 0]] };
    const loan = c.price * (1 - c.downPct / 100);
    const r = c.rate / 100 / 12;
    const n = c.years * 12;
    const pi = r ? (loan * r) / (1 - Math.pow(1 + r, -n)) : loan / n;
    const tax = (c.price * (c.taxPct / 100)) / 12;
    const parts = [['Mortgage (principal + interest)', pi], ['Property tax', tax], ['Home insurance', +c.insurance || 0], ['HOA', +c.hoa || 0]];
    return { total: parts.reduce((a, [, v]) => a + v, 0), parts, loan, down: c.price * (c.downPct / 100), closing: c.price * 0.03 };
  }

  function render(root) {
    const s = GG.store.state;
    const b = s.budget;
    const c = b.calc;
    const [A, B] = s.partners;
    const m = monthly(c);
    const income = (+c.incomeA || 0) + (+c.incomeB || 0);
    const ratio = income ? m.total / income : null;
    const tone = ratio === null ? '' : ratio <= 0.3 ? 'good' : ratio <= 0.4 ? 'ok' : 'bad';
    const shareA = income ? (+c.incomeA || 0) / income : 0.5;

    const spent = b.items.reduce((a, it) => a + (+it.cost || 0), 0);
    const byCat = D.budgetCategories.map((cat) => ({ ...cat, sum: b.items.filter((it) => it.cat === cat.id).reduce((a, it) => a + (+it.cost || 0), 0) })).filter((x) => x.sum > 0);
    const scale = Math.max(b.total || 0, spent) || 1;

    const num = (key, label, step = 1, prefix = '', suffix = '') =>
      `<label class="lbl">${label}<span class="affix">${prefix ? `<i>${prefix}</i>` : ''}<input type="number" min="0" step="${step}" data-calc="${key}" value="${c[key]}">${suffix ? `<i>${suffix}</i>` : ''}</span></label>`;

    root.innerHTML = `
      <section class="page">
        <header class="page-head">
          <div>
            <p class="eyebrow">Step 5 · Make it add up</p>
            <h1>Budget</h1>
            <p class="lead">What will home cost per month, how do we split it fairly, and what do we need to buy to move in?</p>
          </div>
        </header>

        <div class="grid-2">
          <div class="card">
            <div class="section-head tight">
              <h2>Monthly housing cost</h2><span class="grow"></span>
              <span class="seg small">
                <button class="${c.mode === 'buy' ? 'on' : ''}" data-mode="buy">🏡 Buy</button>
                <button class="${c.mode === 'rent' ? 'on' : ''}" data-mode="rent">🔑 Rent</button>
              </span>
            </div>
            ${c.mode === 'buy'
              ? `<div class="form-grid">
                  ${num('price', 'Home price', 5000, '$')}
                  ${num('downPct', 'Down payment', 1, '', '%')}
                  ${num('rate', 'Interest rate', 0.125, '', '%')}
                  ${num('years', 'Loan term', 5, '', 'yrs')}
                  ${num('taxPct', 'Property tax / yr', 0.1, '', '%')}
                  ${num('insurance', 'Insurance / mo', 10, '$')}
                  ${num('hoa', 'HOA / mo', 10, '$')}
                </div>`
              : `<div class="form-grid">${num('rent', 'Monthly rent', 50, '$')}</div>`}
            <div class="calc-out">
              <div class="big-number">${money(m.total)}<small>/month</small></div>
              <ul class="parts">${m.parts.map(([k, v]) => `<li><span>${k}</span><b>${money(v)}</b></li>`).join('')}</ul>
              ${c.mode === 'buy' ? `<p class="muted small">Cash to close ≈ <b>${money(m.down + m.closing)}</b> (${money(m.down)} down + ~3% closing costs). Loan: ${money(m.loan)}.</p>` : ''}
            </div>
          </div>

          <div class="card">
            <h2>Can we afford it — and who pays what?</h2>
            <div class="form-grid">
              ${num('incomeA', `${A.emoji} ${esc(A.name)} take-home / mo`, 100, '$')}
              ${num('incomeB', `${B.emoji} ${esc(B.name)} take-home / mo`, 100, '$')}
            </div>
            ${income
              ? `<div class="afford ${tone}">
                  <div class="ring" style="--p:${Math.min(1, ratio)}"><span>${pct(ratio)}</span></div>
                  <div><b>${tone === 'good' ? 'Comfortable 😌' : tone === 'ok' ? 'A bit tight 😬' : 'Stretching it 😰'}</b><br>
                  <span class="muted small">Housing takes ${pct(ratio)} of your combined take-home pay. Many planners aim for ≤ 30%.</span></div>
                </div>
                <table class="cmp split">
                  <thead><tr><th></th><th>${A.emoji} ${esc(A.name)}</th><th>${B.emoji} ${esc(B.name)}</th></tr></thead>
                  <tbody>
                    <tr><td>50 / 50</td><td>${money(m.total / 2)}</td><td>${money(m.total / 2)}</td></tr>
                    <tr><td>By income (${Math.round(shareA * 100)} / ${100 - Math.round(shareA * 100)})</td><td>${money(m.total * shareA)}</td><td>${money(m.total * (1 - shareA))}</td></tr>
                    <tr class="muted"><td>Left over each month</td><td>${money((+c.incomeA || 0) - m.total * shareA)}</td><td>${money((+c.incomeB || 0) - m.total * (1 - shareA))}</td></tr>
                  </tbody>
                </table>
                <p class="muted small">Splitting by income means you each spend the same <i>share</i> of what you earn. There's no right answer — just pick one together.</p>`
              : '<p class="muted">Add your monthly take-home pay to see how comfortable this is and compare a 50/50 vs. income-based split. (It stays on this device.)</p>'}
          </div>
        </div>

        <div class="card">
          <div class="section-head tight">
            <h2>Move-in budget</h2>
            <span class="grow"></span>
            <label class="lbl inline">Total budget <span class="affix"><i>$</i><input type="number" min="0" step="500" data-total value="${b.total}"></span></label>
          </div>
          <div class="stack-bar" title="${money(spent)} of ${money(b.total)}">
            ${byCat.map((x) => `<i style="width:${(x.sum / scale) * 100}%;background:${x.color}" title="${x.label}: ${money(x.sum)}"></i>`).join('')}
          </div>
          <div class="row wrap legend-row">
            ${byCat.map((x) => `<span class="tag"><i class="dot-i" style="background:${x.color}"></i>${x.emoji} ${x.label} ${money(x.sum)}</span>`).join('')}
            <span class="grow"></span>
            <b class="${spent > b.total ? 'warn-text' : ''}">${money(spent)} of ${money(b.total)} · ${spent > b.total ? `${money(spent - b.total)} over 😬` : `${money(b.total - spent)} left`}</b>
          </div>

          <table class="items">
            <thead><tr><th>Item</th><th>Category</th><th>Status</th><th class="num">Cost</th><th></th></tr></thead>
            <tbody>
              ${b.items.map((it) => `<tr>
                <td><input type="text" value="${esc(it.name)}" data-item="${it.id}|name" maxlength="80"></td>
                <td><select data-item="${it.id}|cat">${D.budgetCategories.map((cc) => `<option value="${cc.id}" ${cc.id === it.cat ? 'selected' : ''}>${cc.emoji} ${cc.label}</option>`).join('')}</select></td>
                <td><select data-item="${it.id}|status">${STATUS.map((st) => `<option value="${st.id}" ${st.id === it.status ? 'selected' : ''}>${st.label}</option>`).join('')}</select></td>
                <td class="num"><span class="affix"><i>$</i><input type="number" min="0" step="10" value="${it.cost}" data-item="${it.id}|cost"></span></td>
                <td><button class="x" data-del="${it.id}" title="Remove">×</button></td>
              </tr>`).join('')}
              <tr class="add">
                <td><input type="text" id="new-name" placeholder="e.g. Cloud sofa" maxlength="80"></td>
                <td><select id="new-cat">${D.budgetCategories.map((cc) => `<option value="${cc.id}">${cc.emoji} ${cc.label}</option>`).join('')}</select></td>
                <td><select id="new-status">${STATUS.map((st) => `<option value="${st.id}">${st.label}</option>`).join('')}</select></td>
                <td class="num"><span class="affix"><i>$</i><input type="number" min="0" step="10" id="new-cost" placeholder="0"></span></td>
                <td><button class="btn sm primary" data-act="add">Add</button></td>
              </tr>
            </tbody>
          </table>
          <div class="row wrap" style="margin-top:12px">
            <button class="btn sm" data-act="import">🪑 Import furniture from “${esc((s.plans.find((p) => p.id === s.activePlan) || s.plans[0]).name)}”</button>
            <button class="btn sm ghost" data-act="starter">📦 Add moving essentials</button>
          </div>
        </div>
      </section>`;

    const rerender = () => {
      const y = window.scrollY;
      render(root);
      window.scrollTo(0, y);
    };
    const debouncedRerender = GG.util.debounce(() => {
      const focused = document.activeElement && document.activeElement.dataset;
      const key = focused && (focused.calc || focused.item || (focused.total !== undefined ? 'total' : null));
      rerender();
      if (key) {
        const sel = focused.calc ? `[data-calc="${key}"]` : focused.item ? `[data-item="${key}"]` : '[data-total]';
        const el = root.querySelector(sel);
        if (el) {
          el.focus();
          if (el.type === 'text') el.setSelectionRange(el.value.length, el.value.length);
        }
      }
    }, 450);

    root.onclick = (e) => {
      const t = e.target.closest('[data-act],[data-del],[data-mode]');
      if (!t) return;
      if (t.dataset.mode) {
        c.mode = t.dataset.mode;
        GG.store.save();
        return rerender();
      }
      if (t.dataset.del) {
        b.items = b.items.filter((it) => it.id !== t.dataset.del);
        GG.store.save();
        return rerender();
      }
      if (t.dataset.act === 'add') return addFromForm(root, rerender);
      if (t.dataset.act === 'import') return importPlan(rerender);
      if (t.dataset.act === 'starter') return addStarter(rerender);
    };
    root.onkeydown = (e) => {
      if (e.key === 'Enter' && e.target.closest('tr.add')) addFromForm(root, rerender);
    };
    root.oninput = (e) => {
      const d = e.target.dataset;
      if (d.calc) c[d.calc] = Number(e.target.value) || 0;
      else if (d.total !== undefined) b.total = Number(e.target.value) || 0;
      else if (d.item) {
        const [id, field] = d.item.split('|');
        const it = b.items.find((x) => x.id === id);
        it[field] = field === 'cost' ? Number(e.target.value) || 0 : e.target.value;
        if (field === 'name') return GG.store.save();
      } else return;
      GG.store.save();
      debouncedRerender();
    };
  }

  function addFromForm(root, rerender) {
    const name = root.querySelector('#new-name').value.trim();
    if (!name) return root.querySelector('#new-name').focus();
    GG.store.state.budget.items.push({
      id: uid('b'),
      name,
      cat: root.querySelector('#new-cat').value,
      status: root.querySelector('#new-status').value,
      cost: Number(root.querySelector('#new-cost').value) || 0,
    });
    GG.store.save();
    GG.store.emit();
    rerender();
    root.querySelector('#new-name').focus();
  }

  function importPlan(rerender) {
    const s = GG.store.state;
    const p = s.plans.find((x) => x.id === s.activePlan) || s.plans[0];
    const have = new Set(s.budget.items.map((it) => it.fromItem).filter(Boolean));
    const fresh = p.items.filter((i) => TYPICAL[i.kind] !== undefined && !have.has(i.id));
    fresh.forEach((i) => s.budget.items.push({ id: uid('b'), name: i.name, cat: catFor(i.kind), status: 'idea', cost: TYPICAL[i.kind], fromItem: i.id }));
    GG.store.save();
    GG.store.emit();
    toast(fresh.length ? `Added ${fresh.length} pieces with ballpark prices — tweak away!` : 'Everything from this plan is already in the budget 👍');
    rerender();
  }

  function addStarter(rerender) {
    const s = GG.store.state;
    const starter = [
      ['Movers / truck rental', 'moving', 1200], ['Security deposit', 'moving', 2500], ['Boxes & packing supplies', 'moving', 150],
      ['Cleaning supplies', 'other', 120], ['Kitchen basics (pots, knives, dishes)', 'decor', 400], ['Bedding & towels', 'decor', 350],
      ['Toolkit & lightbulbs', 'other', 100], ['Curtains & rods', 'decor', 300], ['Welcome-home dinner 🥂', 'other', 120],
    ];
    const names = new Set(s.budget.items.map((i) => i.name));
    let n = 0;
    starter.forEach(([name, cat, cost]) => {
      if (names.has(name)) return;
      n++;
      s.budget.items.push({ id: uid('b'), name, cat, status: 'idea', cost });
    });
    GG.store.save();
    GG.store.emit();
    toast(n ? `Added ${n} moving essentials` : 'Already there 👍');
    rerender();
  }

  GG.views = GG.views || {};
  GG.views.budget = { render };
})(window.GG);
