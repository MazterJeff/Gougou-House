/* Gougou House — small shared helpers. Loaded first; everything hangs off window.GG. */
window.GG = window.GG || {};

(function (GG) {
  const U = (GG.util = {});

  U.esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  U.uid = (prefix = 'id') => `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

  U.clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  U.clone = (o) => JSON.parse(JSON.stringify(o));

  U.debounce = (fn, ms) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  /* ---------- lengths: designs are stored in feet, displayed in ft or m ---------- */
  const FT_PER_M = 3.28084;
  U.unit = () => (GG.store && GG.store.state.unit) || 'ft';

  U.len = (ft) => {
    if (U.unit() === 'm') return `${(ft / FT_PER_M).toFixed(2)} m`;
    const inches = Math.round(ft * 12);
    const f = Math.floor(inches / 12);
    const i = inches % 12;
    return i ? `${f}′${i}″` : `${f}′`;
  };

  U.area = (sqft) =>
    U.unit() === 'm' ? `${(sqft / (FT_PER_M * FT_PER_M)).toFixed(1)} m²` : `${Math.round(sqft).toLocaleString('en-US')} sq ft`;

  /** feet -> number shown in a form field for the current unit */
  U.toUnit = (ft) => (U.unit() === 'm' ? +(ft / FT_PER_M).toFixed(2) : +ft.toFixed(2));
  /** number typed in a form field -> feet */
  U.fromUnit = (v) => (U.unit() === 'm' ? Number(v) * FT_PER_M : Number(v));

  /* ---------- toast ---------- */
  let toastTimer;
  U.toast = (msg) => {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  };

  /* ---------- modal ---------- */
  U.modal = ({ title, body, actions = [], onMount, onClose, wide = false }) => {
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${U.esc(title)}">
        <div class="modal-head">
          <h2>${U.esc(title)}</h2>
          <button class="icon-btn" data-close aria-label="Close">✕</button>
        </div>
        <div class="modal-body">${body}</div>
        ${
          actions.length
            ? `<div class="modal-actions">${actions
                .map((a, i) => `<button class="btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''}" data-action-idx="${i}">${U.esc(a.label)}</button>`)
                .join('')}</div>`
            : ''
        }
      </div>`;
    const close = () => {
      if (!wrap.isConnected) return;
      wrap.remove();
      document.removeEventListener('keydown', onKey);
      if (onClose) onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.closest('[data-close]')) return close();
      const btn = e.target.closest('[data-action-idx]');
      if (btn) {
        const action = actions[Number(btn.dataset.actionIdx)];
        const keepOpen = action.onClick && action.onClick(wrap.querySelector('.modal')) === false;
        if (!keepOpen) close();
      }
    });
    document.addEventListener('keydown', onKey);
    root.appendChild(wrap);
    if (onMount) onMount(wrap.querySelector('.modal'), close);
    const first = wrap.querySelector('input, textarea, select');
    if (first) first.focus();
    return close;
  };

  U.confirm = (title, text, okLabel = 'Yes', danger = false) =>
    new Promise((resolve) => {
      let ok = false;
      U.modal({
        title,
        body: `<p>${text}</p>`,
        actions: [{ label: 'Cancel' }, { label: okLabel, primary: !danger, danger, onClick: () => { ok = true; } }],
        onClose: () => resolve(ok),
      });
    });

  /* ---------- files ---------- */
  U.download = (filename, content, type = 'application/json') => {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  };

  U.pickFile = (accept) =>
    new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = () => resolve(input.files[0] || null);
      input.click();
    });

  /* ---------- share links: JSON -> deflate -> base64url ---------- */
  const toB64Url = (bytes) => {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const fromB64Url = (str) => {
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  };

  U.encodeShare = async (obj) => {
    const json = JSON.stringify(obj);
    if (!window.CompressionStream) return 'j' + toB64Url(new TextEncoder().encode(json));
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return 'z' + toB64Url(new Uint8Array(await new Response(stream).arrayBuffer()));
  };

  U.decodeShare = async (str) => {
    const kind = str[0];
    const bytes = fromB64Url(str.slice(1));
    if (kind === 'j') return JSON.parse(new TextDecoder().decode(bytes));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return JSON.parse(await new Response(stream).text());
  };

  /* ---------- the Gougou mascot: a little pup peeking out of a house ---------- */
  U.mascot = (size = 44, mood = 'happy') => `
    <svg class="mascot" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">
      <path d="M14 56 L60 16 L106 56 L106 108 L14 108 Z" fill="#fff4e6" stroke="#2f2a26" stroke-width="5" stroke-linejoin="round"/>
      <path d="M6 60 L60 12 L114 60" fill="none" stroke="#d9825b" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="80" y="20" width="12" height="22" rx="2" fill="#d9825b" stroke="#2f2a26" stroke-width="4"/>
      <g transform="translate(60 78)">
        <path d="M-30 -14 L-24 -40 L-8 -24 Z" fill="#e8a868" stroke="#2f2a26" stroke-width="4" stroke-linejoin="round"/>
        <path d="M30 -14 L24 -40 L8 -24 Z" fill="#e8a868" stroke="#2f2a26" stroke-width="4" stroke-linejoin="round"/>
        <ellipse cx="0" cy="0" rx="32" ry="27" fill="#e8a868" stroke="#2f2a26" stroke-width="4"/>
        <ellipse cx="0" cy="9" rx="19" ry="14" fill="#fff4e6"/>
        ${
          mood === 'sleepy'
            ? '<path d="M-17 -5 q5 4 10 0 M7 -5 q5 4 10 0" stroke="#2f2a26" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
            : '<circle cx="-12" cy="-5" r="4" fill="#2f2a26"/><circle cx="12" cy="-5" r="4" fill="#2f2a26"/><circle cx="-10.5" cy="-6.5" r="1.3" fill="#fff"/><circle cx="13.5" cy="-6.5" r="1.3" fill="#fff"/>'
        }
        <ellipse cx="0" cy="4" rx="5" ry="3.6" fill="#2f2a26"/>
        <path d="M-6 11 q6 6 12 0" stroke="#2f2a26" stroke-width="3" fill="none" stroke-linecap="round"/>
        <circle cx="-22" cy="7" r="4.5" fill="#f2a5a0" opacity=".8"/>
        <circle cx="22" cy="7" r="4.5" fill="#f2a5a0" opacity=".8"/>
      </g>
    </svg>`;
})(window.GG);
