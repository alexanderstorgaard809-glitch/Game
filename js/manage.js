// The management window for a business: staff (hire, fire, shifts) and more tabs later.
(function () {
  const TABS = [
    { id: 'staff', label: 'Staff', key: 'P' },
    { id: 'menu', label: 'Menu', key: 'M' },
    { id: 'finances', label: 'Finances', key: 'F' },
  ];

  let api = null;   // { business(), day(), hour(), changed(), money() }
  let current = 'staff';
  let isOpen = false;
  let confirmFire = null;
  const draft = { name: '', toppings: new Set(['mozzarella']) };
  const cents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    el.body.addEventListener('input', onInput);
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
    else if (current === 'menu') renderMenu(b);
    else renderFinances(b);
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

  // ---------- Menu tab ----------

  function priceLabel(price, fair) {
    const r = price / fair;
    if (r < 0.85) return ['cheap', 'Cheap'];
    if (r <= 1.1) return ['fair', 'Fair price'];
    if (r <= 1.35) return ['pricey', 'Pricey'];
    return ['steep', 'Too expensive'];
  }

  function chips(toppings) {
    return toppings.map(t => `<span class="chip">${Business.TOPPINGS[t].name}</span>`).join('');
  }

  function capacityHtml(b) {
    const cap = Sim.capacity(b);
    const why = `A cook at a pizza oven tops a pizza in ${Sim.PREP_WITH_COUNTER} minutes when they have a kitchen counter (${Sim.PREP_WITHOUT} without one), and each oven bakes ${Sim.OVEN_SLOTS} pizzas at a time in ${Sim.BAKE} minutes. Skilled cooks are faster.`;
    const now = `Right now: ${cap.cooks} cook${cap.cooks === 1 ? '' : 's'} working, ${cap.ovens} oven${cap.ovens === 1 ? '' : 's'}, ${cap.counters} kitchen counter${cap.counters === 1 ? '' : 's'}.`;
    return `<div class="capacity"><div class="big-number" data-live="capacity">${cap.perHour}</div><div><b>pizzas per hour</b> the kitchen can make right now<p class="muted small" data-live="capacity-note">${now}</p><p class="muted small">${why}</p></div></div>`;
  }

  function draftSummary(b) {
    const p = { toppings: [...draft.toppings] };
    const fair = Business.fairPrice(p);
    return `Ingredients ${cents.format(Business.pizzaCost(p))} · customers find about ${cents.format(fair)} fair`;
  }

  function renderMenu(b) {
    const hoursOpen = Business.shiftHours({ start: b.hours.open, end: b.hours.close });
    const rows = b.menu.map(p => {
      const cost = Business.pizzaCost(p), fair = Business.fairPrice(p);
      const [cls, label] = priceLabel(p.price, fair);
      return `<div class="menu-row">
        <div class="pz"><b>${esc(p.name)}</b><span class="chips">${chips(p.toppings) || '<span class="muted small">Just tomato sauce</span>'}</span></div>
        <div class="num"><small>Ingredients</small>${cents.format(cost)}</div>
        <div class="num"><small>Fair price</small>${cents.format(fair)}</div>
        <div class="price-edit">
          <button class="btn small" data-action="price" data-id="${p.id}" data-step="-0.5" aria-label="Lower the price of ${esc(p.name)}">−</button>
          <b>${cents.format(p.price)}</b>
          <button class="btn small" data-action="price" data-id="${p.id}" data-step="0.5" aria-label="Raise the price of ${esc(p.name)}">+</button>
        </div>
        <div class="num"><small>Profit each</small><span class="${p.price - cost < 0 ? 'neg' : ''}">${cents.format(p.price - cost)}</span></div>
        <span class="pill pill-${cls}">${label}</span>
        <button class="btn small ghost" data-action="remove-pizza" data-id="${p.id}">Remove</button>
      </div>`;
    }).join('') || '<p class="empty">The menu is empty. Customers only come when there is something to order.</p>';

    const toppingButtons = Object.keys(Business.TOPPINGS).map(t =>
      `<button class="chip toggle${draft.toppings.has(t) ? ' on' : ''}" data-action="topping" data-id="${t}" aria-pressed="${draft.toppings.has(t)}">${Business.TOPPINGS[t].name}</button>`).join('');
    const full = b.menu.length >= Business.MAX_PIZZAS;

    el.body.innerHTML = `
      <section class="m-section">
        <div class="m-head"><h3>Opening hours</h3><span class="muted">Customers come in during these hours. Set staff shifts to cover them.</span></div>
        <div class="shift">
          <select id="hours-open" data-hours="open" aria-label="Opening time">${hourOptions(0, 23, b.hours.open)}</select>
          <span>to</span>
          <select id="hours-close" data-hours="close" aria-label="Closing time">${hourOptions(1, 24, b.hours.close)}</select>
          <span class="muted">${hoursOpen} h a day</span>
        </div>
      </section>
      <section class="m-section">
        <div class="m-head"><h3>Kitchen</h3></div>
        ${capacityHtml(b)}
      </section>
      <section class="m-section">
        <div class="m-head"><h3>Menu</h3><span class="muted">${b.menu.length} of ${Business.MAX_PIZZAS} pizzas · ingredients are bought automatically for each order</span></div>
        <div class="menu-list">${rows}</div>
      </section>
      <section class="m-section">
        <div class="m-head"><h3>New pizza</h3><span class="muted" id="draft-summary">${draftSummary(b)}</span></div>
        <div class="new-pizza">
          <input id="new-pizza-name" type="text" maxlength="24" placeholder="Name, e.g. Funghi" value="${esc(draft.name)}" aria-label="Pizza name">
          <div class="chips">${toppingButtons}</div>
          <button id="add-pizza" class="btn primary" data-action="add-pizza" ${full || !draft.name.trim() ? 'disabled' : ''}>${full ? 'Menu is full' : 'Add to menu'}</button>
        </div>
      </section>`;
  }

  // ---------- Finances tab ----------

  function renderFinances(b) {
    const t = b.today;
    const profit = t.revenue - t.ingredients - t.wages;
    const avg = t.served ? Math.round(t.waitSum / t.served) + ' min' : '–';
    const rep = Math.round(b.reputation);
    const starsN = Math.round(b.reputation / 20 * 2) / 2;
    const starStr = '★'.repeat(Math.floor(starsN)) + (starsN % 1 ? '½' : '') + '☆'.repeat(5 - Math.ceil(starsN));
    const kpi = (label, value, cls) => `<div class="kpi"><small>${label}</small><b class="${cls || ''}">${value}</b></div>`;
    const rows = b.history.slice().reverse().map(d => {
      const p = d.revenue - d.ingredients - d.wages;
      return `<tr><td>Day ${d.day}</td><td>${fmt.format(d.revenue)}</td><td>${fmt.format(d.ingredients)}</td><td>${fmt.format(d.wages)}</td>
        <td class="${p < 0 ? 'neg' : 'pos'}">${p < 0 ? '−' : ''}${fmt.format(Math.abs(p))}</td><td>${d.served}</td><td>${d.lost}</td><td>${d.served ? Math.round(d.waitSum / d.served) + ' min' : '–'}</td></tr>`;
    }).join('');
    el.body.innerHTML = `
      <section class="m-section">
        <div class="m-head"><h3>Reputation</h3></div>
        <div class="rep"><span class="stars big">${starStr}</span><b>${rep}</b><span class="muted">/ 100</span></div>
        <p class="muted small">Guests who get their pizza quickly at a fair price raise your reputation. Long waits, high prices and people walking out lower it. A better reputation brings more customers.</p>
      </section>
      <section class="m-section">
        <div class="m-head"><h3>Today · Day ${t.day}</h3><span class="muted">So far today</span></div>
        <div class="kpis">
          ${kpi('Sales', fmt.format(t.revenue))}
          ${kpi('Ingredients', '−' + fmt.format(t.ingredients))}
          ${kpi('Wages', '−' + fmt.format(t.wages))}
          ${kpi('Profit', (profit < 0 ? '−' : '') + fmt.format(Math.abs(profit)), profit < 0 ? 'neg' : 'pos')}
          ${kpi('Guests served', t.served)}
          ${kpi('Walked out', t.lost, t.lost ? 'neg' : '')}
          ${kpi('Average wait', avg)}
        </div>
      </section>
      <section class="m-section">
        <div class="m-head"><h3>Previous days</h3></div>
        ${rows ? `<div class="table-wrap"><table class="ledger"><thead><tr><th>Day</th><th>Sales</th><th>Ingredients</th><th>Wages</th><th>Profit</th><th>Served</th><th>Walked out</th><th>Avg. wait</th></tr></thead><tbody>${rows}</tbody></table></div>`
          : '<p class="empty">Each finished day is listed here.</p>'}
      </section>`;
  }

  // Keep the status column live without re-rendering (which would close open dropdowns).
  function refreshLive() {
    if (!isOpen) return;
    if (current === 'finances') {
      // Nothing here takes input, so a full refresh is fine.
      if (!el.body.contains(document.activeElement) || document.activeElement === document.body) renderFinances(api.business());
      return;
    }
    if (current === 'menu') {
      const cap = Sim.capacity(api.business());
      const n = el.body.querySelector('[data-live="capacity"]');
      if (n && n.textContent !== String(cap.perHour)) n.textContent = cap.perHour;
      return;
    }
    if (current !== 'staff') return;
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
      case 'price': {
        const p = b.menu.find(x => x.id === id);
        if (p) { p.price = Math.max(1, Math.min(40, Math.round((p.price + Number(btn.dataset.step)) * 2) / 2)); api.changed(); }
        break;
      }
      case 'remove-pizza':
        b.menu = b.menu.filter(x => x.id !== id);
        api.changed();
        break;
      case 'topping':
        if (draft.toppings.has(id)) draft.toppings.delete(id); else draft.toppings.add(id);
        break;
      case 'add-pizza': {
        const name = draft.name.trim();
        if (!name) return;
        const toppings = [...draft.toppings];
        const fair = Business.fairPrice({ toppings });
        // Start at the fair price, rounded to 50 cents.
        if (Business.addPizza(b, name, toppings, Math.round(fair * 2) / 2)) {
          draft.name = '';
          api.changed(`${name} added to the menu`);
        }
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

  function onInput(e) {
    if (e.target.id !== 'new-pizza-name') return;
    draft.name = e.target.value;
    const add = document.getElementById('add-pizza');
    const b = api.business();
    if (add) add.disabled = !draft.name.trim() || b.menu.length >= Business.MAX_PIZZAS;
  }

  function onChange(e) {
    const hours = e.target.closest('select[data-hours]');
    if (hours) {
      const b = api.business();
      const v = Number(hours.value);
      b.hours[hours.dataset.hours] = v;
      if (b.hours.open % 24 === b.hours.close % 24) b.hours.close = b.hours.open + 1;
      api.changed();
      render();
      return;
    }
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
    get tab() { return current; },
  };
})();
