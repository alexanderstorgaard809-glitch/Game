// The management window for a business: staff (hire, fire, shifts) and more tabs later.
(function () {
  const TABS = [
    { id: 'staff', label: 'Staff', key: 'P' },
  ];

  let api = null;   // { business(), day(), hour(), changed(), money() }
  let current = 'staff';
  let isOpen = false;
  let confirmFire = null;
  const el = {};
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);

  function init(gameApi) {
    api = gameApi;
    el.root = document.getElementById('manage');
    el.body = document.getElementById('manage-body');
    el.tabs = document.getElementById('manage-tabs');
    el.title = document.getElementById('manage-title');
    el.tabs.innerHTML = TABS.map(t => `<button class="tab" data-tab="${t.id}">${t.label} <kbd>${t.key}</kbd></button>`).join('');
    el.tabs.addEventListener('click', e => {
      const b = e.target.closest('[data-tab]');
      if (b) show(b.dataset.tab);
    });
    document.getElementById('manage-close').addEventListener('click', close);
    el.root.addEventListener('mousedown', e => { if (e.target === el.root) close(); });
    el.body.addEventListener('click', onClick);
    el.body.addEventListener('change', onChange);
  }

  function show(tab) {
    current = tab;
    isOpen = true;
    confirmFire = null;
    el.root.classList.remove('hidden');
    render();
  }

  function toggle(tab) {
    if (isOpen && current === tab) close();
    else show(tab);
  }

  function close() {
    isOpen = false;
    el.root.classList.add('hidden');
  }

  function render() {
    const b = api.business();
    el.title.textContent = b.name;
    el.tabs.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === current));
    if (current === 'staff') renderStaff(b);
    el.body.querySelectorAll('canvas[data-portrait]').forEach(c => {
      People.drawPortrait(c, { look: Business.lookFor(c.dataset.name), role: c.dataset.role });
    });
  }

  // ---------- Staff tab ----------

  function hourOptions(from, to, selected) {
    let html = '';
    for (let h = from; h <= to; h++) html += `<option value="${h}"${h === selected ? ' selected' : ''}>${Business.fmtHour(h)}</option>`;
    return html;
  }

  function staffRow(b, m) {
    const role = Business.ROLES[m.role];
    const st = Sim.staffStatus(b, m, api.hour());
    const hours = Business.shiftHours(m);
    const fire = confirmFire === m.id
      ? `<span class="confirm">Fire ${esc(m.name.split(' ')[0])}? <button class="link danger" data-action="fire-yes" data-id="${m.id}">Yes</button> <button class="link" data-action="fire-no">No</button></span>`
      : `<button class="btn small ghost" data-action="fire" data-id="${m.id}">Fire</button>`;
    return `<div class="staff-row">
      <canvas class="portrait" data-portrait data-name="${esc(m.name)}" data-role="${m.role}"></canvas>
      <div class="who"><b>${esc(m.name)}</b><span>${role.name} <span class="stars" title="Skill ${m.skill} of 5">${stars(m.skill)}</span></span></div>
      <label class="shift">
        <span class="sr">Shift for ${esc(m.name)}</span>
        <select data-shift="start" data-id="${m.id}" aria-label="Shift start">${hourOptions(0, 23, m.start)}</select>
        <span>to</span>
        <select data-shift="end" data-id="${m.id}" aria-label="Shift end">${hourOptions(1, 24, m.end)}</select>
        <span class="muted">${hours} h</span>
      </label>
      <div class="wage">${fmt.format(m.wage)}/h<small>${fmt.format(m.wage * hours)} a day</small></div>
      <div class="status status-${st.kind}" data-status-for="${m.id}"><i></i><span>${esc(st.text)}</span></div>
      <div class="row-actions">${fire}</div>
    </div>`;
  }

  function renderStaff(b) {
    const day = api.day();
    const candidates = Business.candidatesFor(b, day);
    const daily = b.staff.reduce((sum, m) => sum + m.wage * Business.shiftHours(m), 0);
    const team = b.staff.length
      ? b.staff.map(m => staffRow(b, m)).join('')
      : `<p class="empty">No staff yet. Hire a cook, a cashier and a waiter below, then build a pizza oven, a cash register and a kitchen counter for them to work at.</p>`;

    const cols = Business.ROLE_ORDER.map(role => {
      const r = Business.ROLES[role];
      const have = b.staff.filter(m => m.role === role).length;
      const cards = candidates.filter(c => c.role === role).map(c => `
        <div class="candidate">
          <canvas class="portrait" data-portrait data-name="${esc(c.name)}" data-role="${role}"></canvas>
          <div class="who"><b>${esc(c.name)}</b><span class="stars" title="Skill ${c.skill} of 5">${stars(c.skill)}</span><span class="muted">${fmt.format(c.wage)}/h</span></div>
          <button class="btn small primary" data-action="hire" data-id="${c.id}">Hire</button>
        </div>`).join('') || '<p class="empty small">No more applicants today.</p>';
      return `<div class="hire-col">
        <h4>${r.name}s <span class="muted">· you have ${have}</span></h4>
        <p class="muted small">The ${r.name.toLowerCase()} ${r.does}.</p>
        ${cards}
      </div>`;
    }).join('');

    el.body.innerHTML = `
      <section class="m-section">
        <div class="m-head"><h3>Your team</h3><span class="muted">Wages at these shifts: <b>${fmt.format(daily)}</b> a day</span></div>
        <div class="staff-list">${team}</div>
      </section>
      <section class="m-section">
        <div class="m-head"><h3>Hire</h3><span class="muted">New people apply every morning. Wages are paid for every hour of a shift.</span></div>
        <div class="hire-grid">${cols}</div>
      </section>`;
  }

  // Keep the status column live without re-rendering (which would close open dropdowns).
  function refreshLive() {
    if (!isOpen || current !== 'staff') return;
    const b = api.business();
    for (const m of b.staff) {
      const cell = el.body.querySelector(`[data-status-for="${m.id}"]`);
      if (!cell) continue;
      const st = Sim.staffStatus(b, m, api.hour());
      cell.className = `status status-${st.kind}`;
      const span = cell.querySelector('span');
      if (span.textContent !== st.text) span.textContent = st.text;
    }
    // A new day brings new applicants.
    if (b.candidates && b.candidates.day !== api.day()) render();
  }

  function onClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const b = api.business();
    const id = btn.dataset.id;
    switch (btn.dataset.action) {
      case 'hire': {
        const m = Business.hire(b, id);
        if (m) api.changed(`Hired ${m.name}`);
        break;
      }
      case 'fire': confirmFire = id; break;
      case 'fire-no': confirmFire = null; break;
      case 'fire-yes': {
        const m = b.staff.find(s => s.id === id);
        Business.fire(b, id);
        confirmFire = null;
        if (m) api.changed(`${m.name} was let go`);
        break;
      }
    }
    render();
  }

  function onChange(e) {
    const sel = e.target.closest('select[data-shift]');
    if (!sel) return;
    const b = api.business();
    const m = b.staff.find(s => s.id === sel.dataset.id);
    if (!m) return;
    const v = Number(sel.value);
    if (sel.dataset.shift === 'start') m.start = v; else m.end = v;
    // A shift needs at least one hour.
    if (m.start % 24 === m.end % 24) m.end = m.start + 1;
    api.changed();
    render();
  }

  window.Manage = {
    init, show, toggle, close, refreshLive,
    get isOpen() { return isOpen; },
  };
})();
