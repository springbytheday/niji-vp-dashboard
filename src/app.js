const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw8CPk_LC7oF1oOxqwAQkT1wpztmXVG1HnxXIoz6cC1Qh8C4900zUkK3QQoHgQoVKrFxQ/exec';

// Remove the hardcoded LIVER_COLORS const entirely
let liverColors = {}; // now dynamic

function load() {
  const callbackName = 'jsonpCallback_' + Date.now();
  const script = document.createElement('script');
  script.src = `${SCRIPT_URL}?callback=${callbackName}`;

  window[callbackName] = function(data) {
    packs = data.packs;
    liverColors = data.liverColors || {};
    nextId = packs.length ? Math.max(...packs.map(p => p.id)) + 1 : 1;
    document.body.removeChild(script);
    delete window[callbackName];
    render();
  };

  script.onerror = function() {
    console.error('Failed to load from Google Sheets');
    document.body.removeChild(script);
    delete window[callbackName];
    render();
  };

  document.body.appendChild(script);
}

async function save(action, pack) {
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify({ action, pack }),
    });
  } catch (e) {
    console.error('Failed to save to Google Sheets:', e);
  }
}


/* ── State ── */
let packs = [];
let nextId = 1;
let activeType = '';
let editingId = null;

/* ── Helpers ── */
function liverColor(name) {
  if (liverColors[name]) return liverColors[name];
  if (!name) return '#888';
  // Auto-generate a consistent color from the name as fallback
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360},42%,52%)`;
}

function badgeClass(t) {
  return t === 'monthly' ? 'badge-monthly' : t === 'birthday' ? 'badge-birthday' : 'badge-limited';
}

function badgeLabel(t) {
  return t === 'monthly' ? 'Monthly' : t === 'birthday' ? 'Birthday' : 'Limited';
}

function fmtDate(d) {
  if (!d) return '';
  const [y, m, dy] = d.split('-');
  return `${dy}/${m}/${y}`;
}

/* ── Toast ── */
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

/* ── Filter & render ── */
function getFiltered() {
  const q     = document.getElementById('search').value.toLowerCase();
  const liver = document.getElementById('filter-liver').value;
  const owned = document.getElementById('filter-owned').value;

  return packs.filter(p => {
    if (activeType && p.type !== activeType) return false;
    if (liver && p.liver !== liver) return false;
    if (owned === 'owned' && !p.owned) return false;
    if (owned === 'not-owned' && p.owned) return false;
    if (q && !p.en.toLowerCase().includes(q) && !p.jp.includes(q) && !p.liver.toLowerCase().includes(q)) return false;
    return true;
  });
}

function updateStats() {
  document.getElementById('s-total').textContent  = packs.length;
  document.getElementById('s-owned').textContent  = packs.filter(p => p.owned).length;
  document.getElementById('s-not').textContent    = packs.filter(p => !p.owned).length;
  document.getElementById('s-livers').textContent = new Set(packs.map(p => p.liver)).size;
}

function populateLivers() {
  const sel = document.getElementById('filter-liver');
  const cur = sel.value;
  while (sel.options.length > 1) sel.remove(1);
  [...new Set(packs.map(p => p.liver))].sort().forEach(l => {
    const o = document.createElement('option');
    o.value = l;
    o.textContent = l;
    sel.appendChild(o);
  });
  sel.value = cur;

  const dl = document.getElementById('liver-list');
  dl.innerHTML = '';
  [...new Set(packs.map(p => p.liver))].sort().forEach(l => {
    const o = document.createElement('option');
    o.value = l;
    dl.appendChild(o);
  });
}

function render() {
  const filtered = getFiltered();
  const grid = document.getElementById('grid');
  updateStats();
  populateLivers();

  if (!filtered.length) {
    grid.innerHTML = '<div class="empty">No voicepacks match your filters.</div>';
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <div class="card ${p.owned ? 'owned' : 'not-owned'}" data-id="${p.id}" tabindex="0" role="button" aria-label="Edit ${p.en}">
      <div class="card-liver">
        <span class="liver-dot" style="background:${liverColor(p.liver)}"></span>
        ${p.liver}
      </div>
      <div class="card-en">${p.en}</div>
      <div class="card-jp">${p.jp}</div>
      ${p.date  ? `<div class="card-date">${fmtDate(p.date)}</div>` : ''}
      ${p.notes ? `<div class="card-notes">${p.notes}</div>` : ''}
      <div class="card-footer">
        <span class="badge ${badgeClass(p.type)}">${badgeLabel(p.type)}</span>
        <span class="${p.owned ? 'owned-pill' : 'not-owned-pill'}">${p.owned ? '✓ owned' : 'not owned'}</span>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.card').forEach(c => {
    const open = () => openModal(parseInt(c.dataset.id));
    c.addEventListener('click', open);
    c.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });
}

/* ── Modal ── */
function openModal(id) {
  editingId = id;
  const isNew = id === null;
  const p = isNew
    ? { en: '', jp: '', liver: '', type: 'monthly', owned: false, date: '', notes: '' }
    : packs.find(x => x.id === id);

  document.getElementById('modal-heading').textContent    = isNew ? 'Add voicepack' : 'Edit voicepack';
  document.getElementById('f-en').value                   = p.en;
  document.getElementById('f-jp').value                   = p.jp;
  document.getElementById('f-liver').value                = p.liver;
  document.getElementById('f-type').value                 = p.type;
  document.getElementById('f-date').value                 = p.date || '';
  document.getElementById('f-notes').value                = p.notes || '';
  document.getElementById('f-owned').checked              = p.owned;
  document.getElementById('btn-delete').style.display     = isNew ? 'none' : '';

  document.getElementById('overlay').classList.add('open');
  document.getElementById('f-en').focus();
}

function closeModal() {
  document.getElementById('overlay').classList.remove('open');
  editingId = null;
}

/* ── Event listeners ── */
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('btn-cancel').addEventListener('click', closeModal);

document.getElementById('overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('overlay')) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

document.getElementById('btn-save').addEventListener('click', async () => {
  const data = {
    en:    document.getElementById('f-en').value.trim(),
    jp:    document.getElementById('f-jp').value.trim(),
    liver: document.getElementById('f-liver').value.trim(),
    type:  document.getElementById('f-type').value,
    date:  document.getElementById('f-date').value,
    notes: document.getElementById('f-notes').value.trim(),
    owned: document.getElementById('f-owned').checked,
  };

  if (!data.en || !data.liver) {
    showToast('Title and liver name are required.');
    return;
  }

  if (editingId === null) {
    packs.push({ id: nextId++, ...data });
    await save('add', packs.at(-1));
    showToast('Pack added.');
  } else {
    const i = packs.findIndex(p => p.id === editingId);
    if (i > -1) packs[i] = { ...packs[i], ...data };
    await save('update', packs[i]);
    showToast('Saved.');
  }
  
  closeModal();
  render();
});

document.getElementById('btn-delete').addEventListener('click', async () => {
  if (editingId === null) return;
  packs = packs.filter(p => p.id !== editingId);
  packs = packs.filter(p => p.id !== editingId);
  await save('delete', { id: editingId });
  closeModal();
  render();
  showToast('Pack deleted.');
});

document.getElementById('btn-add').addEventListener('click', () => openModal(null));
document.getElementById('search').addEventListener('input', render);
document.getElementById('filter-liver').addEventListener('change', render);
document.getElementById('filter-owned').addEventListener('change', render);

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeType = tab.dataset.type;
    render();
  });
});

/* ── Boot ── */
load();
