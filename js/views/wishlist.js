/* Gougou House — wishlist: both partners rate features; Gougou finds shared musts and conflicts. */
(function (GG) {
  const { esc, uid, pct } = GG.util;
  const D = GG.data;
  const I = GG.insights;
  const ui = { filter: 'all', reveal: false };
  const VOTE = Object.fromEntries(D.votes.map((v) => [v.id, v]));

  const STATUS = {
    shared: { icon: '💞', label: 'Shared must-have' },
    'shared-ish': { icon: '😊', label: 'You both want this' },
    conflict: { icon: '⚠️', label: 'Big talk needed' },
    discuss: { icon: '💬', label: 'Worth discussing' },
    skip: { icon: '🍃', label: 'Easy skip' },
    fine: { icon: '·', label: '' },
    pending: { icon: '', label: '' },
  };

  function render(root) {
    const s = GG.store.state;
    const me = GG.store.active();
    const other = GG.store.other();
    const sum = I.wishSummary();
    const total = I.allWishItems().length;
    const filters = [
      ['all', 'All', total],
      ['todo', `To rate (${me.emoji})`, total - I.wishProgress(me.id)],
      ['shared', '💞 Shared musts', sum.shared.length],
      ['conflict', '⚠️ Big talks', sum.conflict.length],
      ['discuss', '💬 Discuss', sum.discuss.length],
    ];

    root.innerHTML = `
      <section class="page">
        <header class="page-head">
          <div>
            <p class="eyebrow">Step 2 · Decide what matters</p>
            <h1>Our Wishlist</h1>
            <p class="lead">Rate every feature on your own. You'll only see ${esc(other.name)}'s answer once you've given yours —
            then Gougou sorts out your shared must-haves and the stuff you need to talk about.</p>
          </div>
          <div class="progress-pair">
            ${s.partners.map((p) => {
              const n = I.wishProgress(p.id);
              return `<div class="pchip" style="--pc:${p.color}"><span class="pchip-emoji">${p.emoji}</span>
                <div><b>${esc(p.name)}</b><div class="bar"><i style="width:${(n / total) * 100}%"></i></div></div>
                <span class="muted">${n}/${total}</span></div>`;
            }).join('')}
          </div>
        </header>

        <div class="stat-row">
          ${stat('💞', sum.shared.length, 'shared must-haves')}
          ${stat('⚠️', sum.conflict.length, 'big talks')}
          ${stat('💬', sum.discuss.length, 'to discuss')}
          ${stat('🍃', sum.skip.length, 'easy skips')}
          ${stat('🤝', sum.pct === null ? '—' : pct(sum.pct), 'agreement')}
        </div>

        ${sum.conflict.length ? `<div class="card callout warn">
          <b>⚠️ Talk about these before you house-hunt:</b>
          ${sum.conflict.map((x) => `<span class="tag">${x.emoji} ${esc(x.label)}</span>`).join(' ')}
          <p class="muted small">One of you marked it a must-have, the other would rather not. Try: "What would having / not having this mean to you?"</p>
        </div>` : ''}

        <div class="toolbar">
          <div class="seg">
            ${filters.map(([id, label, n]) => `<button class="${ui.filter === id ? 'on' : ''}" data-filter="${id}">${label} <span class="count">${n}</span></button>`).join('')}
          </div>
          <label class="switch"><input type="checkbox" data-act="reveal" ${ui.reveal ? 'checked' : ''}> Show answers I haven't rated yet</label>
        </div>

        <div class="wish-grid">
          ${D.wishGroups.map((g) => groupCard(g, me, other)).join('')}
        </div>
      </section>`;

    root.onclick = (e) => {
      const t = e.target.closest('[data-vote],[data-filter],[data-del],[data-add]');
      if (!t) return;
      if (t.dataset.vote) {
        const [itemId, vote] = t.dataset.vote.split('|');
        const votes = s.wishlist.votes[me.id];
        votes[itemId] = votes[itemId] === vote ? undefined : vote;
        if (!votes[itemId]) delete votes[itemId];
        GG.store.save();
        GG.store.emit();
      } else if (t.dataset.filter) {
        ui.filter = t.dataset.filter;
      } else if (t.dataset.del) {
        s.wishlist.custom = s.wishlist.custom.filter((x) => x.id !== t.dataset.del);
        GG.store.save();
      } else if (t.dataset.add) {
        return addCustom(root, t.dataset.add);
      }
      const y = window.scrollY;
      render(root);
      window.scrollTo(0, y);
    };
    root.onchange = (e) => {
      if (e.target.dataset.act === 'reveal') {
        ui.reveal = e.target.checked;
        render(root);
      }
    };
    root.onkeydown = (e) => {
      if (e.key === 'Enter' && e.target.dataset.newfor) addCustom(root, e.target.dataset.newfor);
    };
  }

  const stat = (icon, n, label) => `<div class="stat"><span class="stat-icon">${icon}</span><b>${n}</b><span>${label}</span></div>`;

  function visible(item, me) {
    const st = I.wishStatus(item);
    const mine = GG.store.state.wishlist.votes[me.id][item.id];
    switch (ui.filter) {
      case 'todo': return !mine;
      case 'shared': return st.kind === 'shared';
      case 'conflict': return st.kind === 'conflict';
      case 'discuss': return st.kind === 'discuss';
      default: return true;
    }
  }

  function groupCard(g, me, other) {
    const items = I.allWishItems().filter((it) => it.group === g.id && visible(it, me));
    if (!items.length && ui.filter !== 'all') return '';
    return `
      <div class="card wish-group">
        <h3>${g.emoji} ${esc(g.label)}</h3>
        <ul class="wish-list">
          ${items.map((it) => row(it, me, other)).join('')}
        </ul>
        ${ui.filter === 'all' ? `<div class="add-row">
          <input type="text" placeholder="Add your own…" data-newfor="${g.id}" maxlength="80">
          <button class="btn sm" data-add="${g.id}">Add</button>
        </div>` : ''}
      </div>`;
  }

  function row(it, me, other) {
    const votes = GG.store.state.wishlist.votes;
    const mine = votes[me.id][it.id];
    const theirs = votes[other.id][it.id];
    const st = I.wishStatus(it);
    const showTheirs = mine || ui.reveal;
    const theirBadge = !theirs
      ? `<span class="their none" title="${esc(other.name)} hasn't rated this yet">…</span>`
      : showTheirs
        ? `<span class="their" style="--pc:${other.color}" title="${esc(other.name)}: ${VOTE[theirs].label}">${other.emoji}${VOTE[theirs].emoji}</span>`
        : `<span class="their hidden" title="Rate it to see ${esc(other.name)}'s answer">${other.emoji}🙈</span>`;
    const status = STATUS[st.kind];
    return `
      <li class="wish-item st-${st.kind}">
        <span class="wi-label">${it.emoji} ${esc(it.label)}${it.custom ? ` <button class="x" data-del="${it.id}" title="Remove">×</button>` : ''}</span>
        <span class="wi-votes" style="--pc:${me.color}">
          ${D.votes.map((v) => `<button class="vote ${mine === v.id ? 'on' : ''}" data-vote="${it.id}|${v.id}" title="${v.label}">${v.emoji}</button>`).join('')}
        </span>
        ${theirBadge}
        <span class="wi-status" title="${status.label}">${showTheirs ? status.icon : ''}</span>
      </li>`;
  }

  function addCustom(root, groupId) {
    const input = root.querySelector(`[data-newfor="${groupId}"]`);
    const label = input.value.trim();
    if (!label) return input.focus();
    const emojiMatch = label.match(/^(\p{Extended_Pictographic}️?)\s*/u);
    GG.store.state.wishlist.custom.push({
      id: uid('w'),
      group: groupId,
      emoji: emojiMatch ? emojiMatch[1] : '⭐️',
      label: emojiMatch ? label.slice(emojiMatch[0].length) : label,
      custom: true,
    });
    GG.store.save();
    render(root);
    root.querySelector(`[data-newfor="${groupId}"]`)?.focus();
  }

  GG.views = GG.views || {};
  GG.views.wishlist = { render };
})(window.GG);
