/* Gougou House — saved designs, persisted to localStorage. Mutate GG.store.state then call save(). */
(function (GG) {
  const { uid, debounce, toast } = GG.util;
  const KEY = 'gougou-house-v1';

  function newPlan(templateId = 'apt2br', name, empty = false) {
    const tpl = GG.data.templates.find((t) => t.id === templateId) || GG.data.templates[0];
    return { id: uid('plan'), name: name || tpl.name, ...GG.data.instantiateTemplate(tpl, uid, empty), createdAt: Date.now() };
  }

  function defaults() {
    const plan = newPlan('studio1br', 'Our first home', true);
    return { version: 2, unit: 'ft', dog: true, plans: [plan], activePlan: plan.id };
  }

  /** Keep only what the game uses; older saves (v1) also carried quiz/wishlist/etc. */
  function hydrate(saved) {
    const base = defaults();
    const plans = Array.isArray(saved.plans) && saved.plans.length ? saved.plans : base.plans;
    plans.forEach((p) => {
      p.rooms = p.rooms || [];
      p.items = p.items || [];
      p.rooms.forEach((r) => (r.floor = r.floor || GG.data.floorFor(r.name, r.outdoor)));
    });
    return {
      version: 2,
      unit: saved.unit === 'm' ? 'm' : 'ft',
      dog: saved.dog !== false,
      plans,
      activePlan: plans.some((p) => p.id === saved.activePlan) ? saved.activePlan : plans[0].id,
    };
  }

  let state;
  let fresh = false;
  try {
    const raw = localStorage.getItem(KEY);
    fresh = !raw;
    state = raw ? hydrate(JSON.parse(raw)) : defaults();
  } catch (e) {
    console.warn('Could not read saved designs, starting fresh', e);
    state = defaults();
  }

  let warned = false;
  const persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      if (!warned) {
        warned = true;
        toast('⚠️ Browser storage is full — download a backup from ⚙️.');
      }
    }
  };
  const save = debounce(persist, 200);
  window.addEventListener('beforeunload', persist);

  GG.store = {
    get state() {
      return state;
    },
    save,
    newPlan,
    /** True on the very first visit (nothing saved yet). */
    fresh,
    replace(next) {
      state = hydrate(next);
      persist();
    },
    reset() {
      state = defaults();
      persist();
    },
  };
})(window.GG);
