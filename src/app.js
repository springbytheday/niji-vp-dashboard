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
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      //mode: 'no-cors',
      body: JSON.stringify({ action, pack }),
    });
        const data = await res.json();
    console.log('Apps Script response:', data);
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

function storeBadgeClass(store) {
  return store === 'EN' ? 'badge-en' : store === 'JP' ? 'badge-jp' : '';
}

function storeBadgeLabel(store) {
  return store === 'EN' ? 'EN Store' : store === 'JP' ? 'JP Store' : '';
}

function variantBadges(variant) {
  if (!variant) return '';
  return variant.split(',').map(v => {
    v = v.trim();
    if (v === 'EX') return `<span class="badge badge-ex">EX</span>`;
    if (v === 'EX Another') return `<span class="badge badge-ex-another">EX Another</span>`;
    return '';
  }).join('');
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
  const q      = document.getElementById('search').value.toLowerCase();
  const liver = document.getElementById('filter-liver').value;
  const store  = document.getElementById('filter-store').value;
  const sortBy = document.getElementById('sort-by').value;

  let result = packs.filter(p => {
    if (activeType && p.type !== activeType) return false;
    if (liver && p.liver !== liver) return false;
    if (store && p.store !== store) return false;
    if (q && !p.en.toLowerCase().includes(q) && !p.jp.includes(q) && !p.liver.toLowerCase().includes(q)) return false;
    return true;
  });

  if (sortBy === 'date-asc') {
    result.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  } else if (sortBy === 'date-desc') {
    result.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  } else if (sortBy === 'title-asc') {
    result.sort((a, b) => a.en.localeCompare(b.en));
  } else if (sortBy === 'title-desc') {
    result.sort((a, b) => b.en.localeCompare(a.en));
  }

  return result;
}

function updateStats() {
  document.getElementById('s-total').textContent  = packs.length;
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
    <div class="card" data-id="${p.id}" tabindex="0" role="button" aria-label="Edit ${p.en}" style="--liver-color: ${liverColor(p.liver)}">
      <div class="card-liver">
        <span class="liver-dot" style="background:${liverColor(p.liver)}"></span>
        ${p.liver}
      </div>
      <div class="card-en">${p.en}</div>
      <div class="card-jp">${p.jp}</div>
      ${p.date ? `<div class="card-date">${fmtDate(p.date)}</div>` : ''}
      ${p.variant ? `<div class="card-variant-row">${variantBadges(p.variant)}</div>` : ''}
      ${p.notes ? `<div class="card-notes">${p.notes}</div>` : ''}
      <div class="card-footer">
        <div style="display:flex;gap:4px">
          <span class="badge ${badgeClass(p.type)}">${badgeLabel(p.type)}</span>
          ${p.store ? `<span class="badge ${storeBadgeClass(p.store)}">${storeBadgeLabel(p.store)}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.card').forEach(c => {
    const open = () => openModal(Number(c.dataset.id));
    c.addEventListener('click', open);
    c.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });
}

/* ── Modal ── */
function setModalMode(mode) {
  const isEdit = mode === 'edit';
  document.getElementById('view-mode').style.display = isEdit ? 'none' : '';
  document.getElementById('edit-mode').style.display = isEdit ? '' : 'none';
  document.getElementById('btn-save').style.display  = isEdit ? '' : 'none';
  document.getElementById('btn-delete').style.display = isEdit && editingId !== null ? '' : 'none';
  document.getElementById('btn-cancel').textContent  = isEdit ? 'Cancel' : 'Close';
  document.getElementById('btn-edit-mode').style.display = isEdit ? 'none' : '';
}

function openModal(id) {
  editingId = id;
  const isNew = id === null;
  const p = isNew
    ? { en: '', jp: '', liver: '', type: 'monthly', owned: false, date: '', notes: '' }
    : packs.find(x => Number(x.id) === Number(id));

  console.log('clicked id:', id, '| type:', typeof id);
  console.log('packs ids:', packs.map(x => ({ id: x.id, type: typeof x.id })));
  console.log('pack found:', p);
  
  // Populate view mode
  document.getElementById('v-liver').textContent  = p.liver;
  document.getElementById('v-jp').textContent = p.jp;

  const vVariant = document.getElementById('v-variant-badge');
  vVariant.innerHTML = variantBadges(p.variant);
  vVariant.style.display = p.variant ? '' : 'none';

  const vBadge = document.getElementById('v-badge');
  vBadge.textContent  = badgeLabel(p.type);
  vBadge.className    = `badge ${badgeClass(p.type)}`;

  const dateRow = document.getElementById('v-date-row');
  dateRow.style.display = p.date ? '' : 'none';
  document.getElementById('v-date').textContent = fmtDate(p.date);

  const notesRow = document.getElementById('v-notes-row');
  notesRow.style.display = p.notes ? '' : 'none';
  document.getElementById('v-notes').textContent = p.notes;

  const vStore = document.getElementById('v-store-badge');
  if (p.store) {
    vStore.textContent  = storeBadgeLabel(p.store);
    vStore.className    = `badge ${storeBadgeClass(p.store)}`;
    vStore.style.display = '';
  } else {
    vStore.style.display = 'none';
  } 

  // Populate edit mode
  document.getElementById('f-en').value      = p.en;
  document.getElementById('f-jp').value      = p.jp;
  document.getElementById('f-liver').value   = p.liver;
  document.getElementById('f-type').value    = p.type;
  document.getElementById('f-date').value    = p.date || '';
  document.getElementById('f-notes').value = p.notes || '';
  document.getElementById('f-store').value = p.store || '';

  const variants = (p.variant || '').split(',').map(v => v.trim());
  document.getElementById('f-variant-ex').checked         = variants.includes('EX');
  document.getElementById('f-variant-ex-another').checked = variants.includes('EX Another');

  // New packs go straight to edit, existing ones show view first
  setModalMode(isNew ? 'edit' : 'view');

  document.getElementById('modal-heading').textContent = isNew ? 'Add voicepack' : p.en;
  document.getElementById('overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('overlay').classList.remove('open');
  editingId = null;
}

// Switch to edit mode when edit button clicked
document.getElementById('btn-edit-mode').addEventListener('click', () => {
  setModalMode('edit');
  document.getElementById('modal-heading').textContent = 'Edit voicepack';
  document.getElementById('f-en').focus();
});

// Cancel goes back to view if editing existing, closes if new
document.getElementById('btn-cancel').addEventListener('click', () => {
  if (editingId !== null && document.getElementById('edit-mode').style.display !== 'none') {
    setModalMode('view');
    const p = packs.find(x => x.id === editingId);
    document.getElementById('modal-heading').textContent = p.en;
  } else {
    closeModal();
  }
});

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
  const variantParts = [];
  if (document.getElementById('f-variant-ex').checked)         variantParts.push('EX');
  if (document.getElementById('f-variant-ex-another').checked) variantParts.push('EX Another');
  
  const data = {
    en:    document.getElementById('f-en').value.trim(),
    jp:    document.getElementById('f-jp').value.trim(),
    liver: document.getElementById('f-liver').value.trim(),
    type:  document.getElementById('f-type').value,
    date:  document.getElementById('f-date').value,
    notes: document.getElementById('f-notes').value.trim(),
    store: document.getElementById('f-store').value,
    variant: variantParts.join(', '),
  };
  console.log('saving data:', data);

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
  await save('delete', { id: editingId });
  closeModal();
  render();
  showToast('Pack deleted.');
});

document.getElementById('btn-add').addEventListener('click', () => openModal(null));
document.getElementById('search').addEventListener('input', render);
document.getElementById('filter-liver').addEventListener('change', render);
document.getElementById('filter-store').addEventListener('change', render);
document.getElementById('sort-by').addEventListener('change', render);

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
