/* Gougou House — app state, persisted to localStorage. Views mutate GG.store.state then call save(). */
(function (GG) {
  const { uid, clone, debounce, toast } = GG.util;
  const KEY = 'gougou-house-v1';

  function newPlan(templateId = 'apt2br', name) {
    const tpl = GG.data.templates.find((t) => t.id === templateId) || GG.data.templates[0];
    return {
      id: uid('plan'),
      name: name || tpl.name,
      ...GG.data.instantiateTemplate(tpl, uid),
      notes: '',
      hearts: {},
      createdAt: Date.now(),
    };
  }

  function defaults() {
    const plan = newPlan('apt2br', 'Option A · 2-bedroom');
    return {
      version: 1,
      partners: [
        { id: 'a', name: 'Partner A', emoji: '🐻', color: '#d9825b' },
        { id: 'b', name: 'Partner B', emoji: '🐰', color: '#5d8ca3' },
      ],
      activePartner: 'a',
      onboarded: false,
      unit: 'ft',
      quiz: { a: {}, b: {} },
      wishlist: { custom: [], votes: { a: {}, b: {} } },
      plans: [plan],
      activePlan: plan.id,
      mood: { customPalettes: [], likes: { a: [], b: [] }, cards: [] },
      budget: {
        total: 15000,
        items: [],
        calc: { mode: 'buy', price: 450000, downPct: 20, rate: 6.5, years: 30, taxPct: 1.8, hoa: 250, insurance: 120, rent: 2600, incomeA: 0, incomeB: 0 },
      },
      talkDone: [],
      createdAt: Date.now(),
    };
  }

  /** Fill in any keys a saved/imported state is missing (older versions, partial imports). */
  function hydrate(saved) {
    const base = defaults();
    const out = { ...base, ...saved };
    for (const k of ['quiz', 'wishlist', 'mood', 'budget']) out[k] = { ...base[k], ...(saved[k] || {}) };
    out.budget.calc = { ...base.budget.calc, ...((saved.budget || {}).calc || {}) };
    for (const pid of ['a', 'b']) {
      out.quiz[pid] = out.quiz[pid] || {};
      out.wishlist.votes = out.wishlist.votes || {};
      out.wishlist.votes[pid] = out.wishlist.votes[pid] || {};
      out.mood.likes = out.mood.likes || {};
      out.mood.likes[pid] = out.mood.likes[pid] || [];
    }
    if (!Array.isArray(out.plans) || !out.plans.length) {
      out.plans = base.plans;
      out.activePlan = base.activePlan;
    }
    if (!out.plans.some((p) => p.id === out.activePlan)) out.activePlan = out.plans[0].id;
    return out;
  }

  let state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? hydrate(JSON.parse(raw)) : defaults();
  } catch (e) {
    console.warn('Could not read saved house, starting fresh', e);
    state = defaults();
  }

  let warned = false;
  const persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      if (!warned) {
        warned = true;
        toast('⚠️ Browser storage is full — remove some photos or export a backup.');
      }
    }
  };
  const save = debounce(persist, 200);
  window.addEventListener('beforeunload', persist);

  const listeners = new Set();

  GG.store = {
    get state() {
      return state;
    },
    save,
    newPlan,
    /** Notify global listeners (header etc.) that something cross-cutting changed. */
    emit() {
      listeners.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    partner(id) {
      return state.partners.find((p) => p.id === id);
    },
    active() {
      return this.partner(state.activePartner);
    },
    other() {
      return state.partners.find((p) => p.id !== state.activePartner);
    },
    replace(next) {
      state = hydrate(next);
      persist();
      this.emit();
    },
    reset() {
      state = defaults();
      persist();
      this.emit();
    },
    /** Snapshot for sharing. Uploaded photos are dropped from links to keep them short. */
    snapshot({ forLink = false } = {}) {
      const s = clone(state);
      s.sharedBy = state.activePartner;
      s.sharedAt = Date.now();
      if (forLink) s.mood.cards = s.mood.cards.filter((c) => !(c.type === 'image' && String(c.src).startsWith('data:')));
      return s;
    },
    /**
     * Merge a partner's copy into ours: take the sender's own quiz + wishlist answers,
     * add any plans / mood cards / budget items / palettes we don't have yet, and
     * union palette likes & plan hearts.
     */
    merge(incoming) {
      const inc = hydrate(incoming);
      const from = incoming.sharedBy || (state.activePartner === 'a' ? 'b' : 'a');
      state.quiz[from] = { ...state.quiz[from], ...inc.quiz[from] };
      state.wishlist.votes[from] = { ...state.wishlist.votes[from], ...inc.wishlist.votes[from] };
      state.mood.likes[from] = [...new Set([...(state.mood.likes[from] || []), ...inc.mood.likes[from]])];
      const sender = inc.partners.find((p) => p.id === from);
      const mine = state.partners.find((p) => p.id === from);
      if (sender && mine && /^Partner [AB]$/.test(mine.name)) Object.assign(mine, sender);

      const addMissing = (mineArr, theirs) => {
        const ids = new Set(mineArr.map((x) => x.id));
        theirs.forEach((x) => !ids.has(x.id) && mineArr.push(x));
      };
      addMissing(state.wishlist.custom, inc.wishlist.custom);
      addMissing(state.mood.cards, inc.mood.cards);
      addMissing(state.mood.customPalettes, inc.mood.customPalettes);
      addMissing(state.budget.items, inc.budget.items);
      const myPlans = new Map(state.plans.map((p) => [p.id, p]));
      inc.plans.forEach((p) => {
        const m = myPlans.get(p.id);
        if (!m) state.plans.push(p);
        else m.hearts = { ...m.hearts, ...p.hearts };
      });
      persist();
      this.emit();
      return from;
    },
  };
})(window.GG);
