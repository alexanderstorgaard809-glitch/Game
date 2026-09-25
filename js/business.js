// Business data that gets saved: staff, candidates for hire, and helpers around them.
(function () {
  const ROLES = {
    cook: { name: 'Cook', station: 'oven', side: 'front', baseWage: 18, does: 'makes the pizzas at the pizza oven' },
    cashier: { name: 'Cashier', station: 'register', side: 'back', baseWage: 13, does: 'takes orders behind the cash register' },
    waiter: { name: 'Waiter', station: 'counter', side: 'front', baseWage: 12, does: 'waits by the kitchen counter and serves tables' },
  };
  const ROLE_ORDER = ['cook', 'cashier', 'waiter'];

  const FIRST = ['Marco', 'Giulia', 'Sam', 'Aisha', 'Leo', 'Nina', 'Omar', 'Chloe', 'Tariq', 'Freya', 'Diego', 'Mei',
    'Jonas', 'Priya', 'Luca', 'Sofia', 'Kofi', 'Hannah', 'Mateo', 'Yuki', 'Ivan', 'Zara', 'Felix', 'Amara'];
  const LAST = ['Rossi', 'Bianchi', 'Carter', 'Haddad', 'Novak', 'Jensen', 'Okafor', 'Silva', 'Kim', 'Moreau',
    'Larsen', 'Costa', 'Patel', 'Weber', 'Nakamura', 'Russo', 'Ahmed', 'Lindqvist', 'Mendes', 'Walsh'];

  const CANDIDATES_PER_ROLE = 2;

  function wageFor(role, skill) { return ROLES[role].baseWage + (skill - 3) * 2; }

  // Deterministic candidates for a given day, so they stay the same until tomorrow.
  function makeCandidates(day, taken) {
    const rand = Iso.rng(day * 7919 + 17);
    // No two people share a first name, so everyone is easy to tell apart.
    const used = new Set(taken.map(n => n.split(' ')[0]));
    const list = [];
    for (const role of ROLE_ORDER) {
      for (let i = 0; i < CANDIDATES_PER_ROLE; i++) {
        let first;
        let tries = 0;
        do { first = FIRST[Math.floor(rand() * FIRST.length)]; } while (used.has(first) && tries++ < 50);
        used.add(first);
        const name = first + ' ' + LAST[Math.floor(rand() * LAST.length)];
        const skill = 1 + Math.floor(rand() * 5);
        list.push({ id: `c${day}-${role}-${i}`, name, role, skill, wage: wageFor(role, skill) });
      }
    }
    return list;
  }

  // Refresh the hiring list once per game day.
  function candidatesFor(business, day) {
    if (!business.candidates || business.candidates.day !== day) {
      business.candidates = { day, list: makeCandidates(day, business.staff.map(s => s.name)) };
    }
    return business.candidates.list;
  }

  function hire(business, candidateId) {
    const list = business.candidates ? business.candidates.list : [];
    const c = list.find(x => x.id === candidateId);
    if (!c) return null;
    const member = { id: 's' + business.nextStaffId++, name: c.name, role: c.role, skill: c.skill, wage: c.wage, start: 10, end: 22 };
    business.staff.push(member);
    business.candidates.list = list.filter(x => x !== c);
    return member;
  }

  function fire(business, staffId) {
    business.staff = business.staff.filter(s => s.id !== staffId);
  }

  // Is this shift running at the given hour of the day (0-24, fractional)?
  function onShift(member, hour) {
    const { start, end } = member;
    if (start === end) return false;
    return start < end ? hour >= start && hour < end : hour >= start || hour < end;
  }

  function shiftHours(member) {
    const h = member.end - member.start;
    return h > 0 ? h : h + 24;
  }

  function fmtHour(h) { return String(h).padStart(2, '0') + ':00'; }

  // A stable look for each person, derived from their name.
  function lookFor(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
    const r = Iso.rng(h);
    const skins = ['#f1c9a5', '#e0ac85', '#c68a62', '#9a6545', '#6e4630', '#f5d6bd'];
    const hairs = ['#2b1d16', '#4a3020', '#8a5a33', '#c9a06a', '#1c1c1c', '#a3452c', '#d8d0c4'];
    return { skin: skins[Math.floor(r() * skins.length)], hair: hairs[Math.floor(r() * hairs.length)], short: r() < 0.5 };
  }

  // ---------- Saving ----------

  function defaults() {
    return { staff: [], nextStaffId: 1, candidates: null };
  }

  const isInt = v => Number.isInteger(v);

  // Fill in business fields from saved data, keeping only valid values.
  function restore(business, saved) {
    Object.assign(business, defaults());
    if (!saved) return business;
    if (Array.isArray(saved.staff)) {
      for (const s of saved.staff) {
        if (!s || typeof s.name !== 'string' || !ROLES[s.role]) continue;
        const start = isInt(s.start) && s.start >= 0 && s.start < 24 ? s.start : 10;
        const end = isInt(s.end) && s.end >= 0 && s.end <= 24 ? s.end : 22;
        const skill = isInt(s.skill) ? Math.max(1, Math.min(5, s.skill)) : 3;
        const wage = typeof s.wage === 'number' && isFinite(s.wage) && s.wage > 0 ? s.wage : wageFor(s.role, skill);
        business.staff.push({ id: typeof s.id === 'string' ? s.id : 's' + business.nextStaffId, name: s.name, role: s.role, skill, wage, start, end });
        business.nextStaffId++;
      }
    }
    if (isInt(saved.nextStaffId)) business.nextStaffId = Math.max(business.nextStaffId, saved.nextStaffId);
    const c = saved.candidates;
    if (c && isInt(c.day) && Array.isArray(c.list)) {
      business.candidates = { day: c.day, list: c.list.filter(x => x && ROLES[x.role] && typeof x.name === 'string' && typeof x.id === 'string') };
    }
    return business;
  }

  window.Business = {
    ROLES, ROLE_ORDER, defaults, restore, candidatesFor, hire, fire, onShift, shiftHours, fmtHour, lookFor, wageFor,
  };
})();
