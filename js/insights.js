/* Gougou House — derived insights: style scores, agreement, blends, wishlist summaries. */
(function (GG) {
  const D = GG.data;
  const S = () => GG.store.state;
  const VOTE_SCORE = Object.fromEntries(D.votes.map((v) => [v.id, v.score]));

  const I = (GG.insights = {});

  I.quizProgress = (pid) => Object.keys(S().quiz[pid] || {}).filter((k) => D.quiz.some((q) => q.id === k)).length;
  I.quizDone = (pid) => I.quizProgress(pid) === D.quiz.length;

  /** Normalized style scores for a partner, sorted high → low. */
  I.styleScores = (pid) => {
    const totals = Object.fromEntries(Object.keys(D.styles).map((k) => [k, 0]));
    const answers = S().quiz[pid] || {};
    D.quiz.forEach((q) => {
      const pick = answers[q.id];
      if (pick === undefined) return;
      Object.entries(q.options[pick].styles).forEach(([k, w]) => (totals[k] += w));
    });
    const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(totals)
      .map(([key, v]) => ({ key, score: v / sum, ...D.styles[key] }))
      .sort((a, b) => b.score - a.score);
  };

  I.topStyle = (pid) => (I.quizProgress(pid) ? I.styleScores(pid)[0] : null);

  /** Same-answer rate for questions both partners answered. */
  I.quizAgreement = () => {
    const a = S().quiz.a, b = S().quiz.b;
    const both = D.quiz.filter((q) => a[q.id] !== undefined && b[q.id] !== undefined);
    const same = both.filter((q) => a[q.id] === b[q.id]);
    return { both: both.length, same: same.length, pct: both.length ? same.length / both.length : null, agree: same, differ: both.filter((q) => a[q.id] !== b[q.id]) };
  };

  /** The household style: blend of both partners' combined scores. */
  I.blend = () => {
    if (!I.quizProgress('a') && !I.quizProgress('b')) return null;
    const sa = Object.fromEntries(I.styleScores('a').map((s) => [s.key, s.score]));
    const sb = Object.fromEntries(I.styleScores('b').map((s) => [s.key, s.score]));
    const combined = Object.keys(D.styles)
      .map((k) => ({ key: k, score: (sa[k] || 0) + (sb[k] || 0), ...D.styles[k] }))
      .sort((x, y) => y.score - x.score);
    const [first, second] = combined;
    const pure = second.score < first.score * 0.6;
    const key = [first.key, second.key].sort().join('+');
    const name = pure ? `Pure ${first.name}` : D.blendNames[key] || `${first.name} × ${second.name}`;
    // palette: interleave the two style palettes, light → dark
    const palette = pure
      ? first.palette
      : [first.palette[0], second.palette[1], first.palette[2], second.palette[3], first.palette[4]];
    return { name, primary: first, secondary: pure ? null : second, palette, combined };
  };

  /* ---------- wishlist ---------- */
  I.allWishItems = () => [...D.wishItems, ...S().wishlist.custom];

  I.wishProgress = (pid) => {
    const votes = S().wishlist.votes[pid] || {};
    return I.allWishItems().filter((it) => votes[it.id]).length;
  };

  /** Classify an item by both partners' votes. */
  I.wishStatus = (item) => {
    const va = S().wishlist.votes.a[item.id], vb = S().wishlist.votes.b[item.id];
    if (!va || !vb) return { kind: 'pending', va, vb };
    const sa = VOTE_SCORE[va], sb = VOTE_SCORE[vb];
    const diff = Math.abs(sa - sb);
    let kind = 'fine';
    if (sa === 3 && sb === 3) kind = 'shared';
    else if (diff === 3) kind = 'conflict';
    else if (diff === 2) kind = 'discuss';
    else if (sa + sb <= 1) kind = 'skip';
    else if (sa + sb >= 5) kind = 'shared-ish';
    return { kind, va, vb, diff, total: sa + sb };
  };

  I.wishSummary = () => {
    const out = { shared: [], sharedish: [], conflict: [], discuss: [], skip: [], fine: [], pending: [], both: 0, agree: 0 };
    I.allWishItems().forEach((it) => {
      const st = I.wishStatus(it);
      if (st.kind !== 'pending') {
        out.both++;
        if (st.diff <= 1) out.agree++;
      }
      const bucket = st.kind === 'shared-ish' ? 'sharedish' : st.kind;
      out[bucket].push({ ...it, ...st });
    });
    out.pct = out.both ? out.agree / out.both : null;
    return out;
  };

  /* ---------- mood ---------- */
  I.allPalettes = () => [...D.palettes, ...S().mood.customPalettes];
  I.sharedPalettes = () => {
    const la = new Set(S().mood.likes.a), lb = new Set(S().mood.likes.b);
    return I.allPalettes().filter((p) => la.has(p.id) && lb.has(p.id));
  };

  /* ---------- planner ---------- */
  I.planArea = (plan) => {
    let indoor = 0, outdoor = 0;
    plan.rooms.forEach((r) => (r.outdoor ? (outdoor += r.w * r.h) : (indoor += r.w * r.h)));
    return { indoor, outdoor };
  };

  /** Overall "how far along are we" checklist used on the home page. */
  I.journey = () => {
    const s = S();
    const [A, B] = s.partners;
    const ws = I.wishSummary();
    return [
      { id: 'names', label: 'Tell Gougou who you are', done: s.onboarded, href: '#settings' },
      { id: 'quizA', label: `${A.name} plays This or That`, done: I.quizDone('a'), href: '#quiz', partner: 'a' },
      { id: 'quizB', label: `${B.name} plays This or That`, done: I.quizDone('b'), href: '#quiz', partner: 'b' },
      { id: 'wishA', label: `${A.name} rates the wishlist`, done: I.wishProgress('a') >= 20, href: '#wishlist', partner: 'a' },
      { id: 'wishB', label: `${B.name} rates the wishlist`, done: I.wishProgress('b') >= 20, href: '#wishlist', partner: 'b' },
      { id: 'talk', label: 'Talk through your conflicts', done: ws.both >= 20 && (s.talkDone || []).length >= 3, href: '#home', hint: 'Use 3 conversation cards' },
      { id: 'palette', label: 'Find a palette you both ❤️', done: I.sharedPalettes().length > 0, href: '#mood' },
      { id: 'board', label: 'Pin 5 inspiration cards', done: s.mood.cards.length >= 5, href: '#mood' },
      { id: 'plan', label: 'Sketch a floor plan', done: s.plans.some((p) => p.rooms.length && p.createdAt && p.edited), href: '#planner' },
      { id: 'compare', label: 'Heart a plan together', done: s.plans.some((p) => p.hearts && p.hearts.a && p.hearts.b), href: '#planner' },
      { id: 'budget', label: 'Add 5 items to the budget', done: s.budget.items.length >= 5, href: '#budget' },
    ];
  };
})(window.GG);
