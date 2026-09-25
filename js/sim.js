// The running business: staff and customers moving around, the kitchen, money and reputation.
// It runs all the time, also while you look at the city map. People's positions are not saved:
// after a reload, staff on shift walk in through the entrance again.
(function () {
  const WALK = 0.9;          // walking speed in tiles per game minute
  const MAX_STEP = 0.5;      // longest simulation step in game minutes
  const FADE = 0.6;          // game minutes to fade in or out at the door
  const ENTRY = { x: Layout.ENTRANCE.x, y: Layout.ENTRANCE.y };

  const PREP_WITH_COUNTER = 3;   // minutes to top a pizza at a kitchen counter
  const PREP_WITHOUT = 6;        // ... when the cook has no counter of their own
  const BAKE = 6;                // minutes in the oven
  const OVEN_SLOTS = 2;          // pizzas an oven bakes at once
  const ORDER_TIME = 1.2;        // minutes at the register
  const PATIENCE_QUEUE = 25;     // minutes a customer waits to order before leaving
  const PATIENCE_FOOD = 45;      // minutes a customer waits for food after ordering
  const MAX_CUSTOMERS = 18;
  const BASE_RATE = 7;           // customers per hour at 50 reputation, outside rush hours
  const SHIRTS = ['#d9644a', '#4f7fbf', '#e0b64a', '#6aa06a', '#9a6ab0', '#e38aa0', '#4aa6a6', '#c9c2b0', '#7a8a9a'];
  const PANTS = ['#34384a', '#4a3f35', '#2e4a6a', '#5a5a5a', '#6b4f3a'];

  const runtimes = new Map();
  let rand = Math.random;

  function runtime(b) {
    let r = runtimes.get(b.id);
    if (!r) {
      r = {
        agents: [], issues: [], assignIn: 0, orders: [], nextId: 1,
        queue: [], waiting: [], seats: new Map(), ovens: new Map(),
        spots: { queue: [], wait: [] }, register: null, events: [], floaters: [],
      };
      runtimes.set(b.id, r);
    }
    return r;
  }

  const center = t => ({ x: t.x + 0.5, y: t.y + 0.5 });
  const itemName = type => Furniture.items[type].name.toLowerCase();
  const same = (a, b) => a && b && a.x === b.x && a.y === b.y;
  const hourOf = time => (time % 1440) / 60;
  const pick = list => list[Math.floor(rand() * list.length)];
  const member = (b, a) => b.staff.find(s => s.id === a.id);

  // ---------- Staff: shifts and stations ----------

  function spawnStaff(m) {
    return {
      kind: 'staff', id: m.id, role: m.role,
      x: ENTRY.x + 0.5, y: ENTRY.y + 0.5, tile: { x: ENTRY.x, y: ENTRY.y }, next: null,
      alpha: 0, leaving: false, gone: false, walk: 0, dir: [1, 0],
      station: null, problem: null, atStation: false, job: null, task: null,
      look: Business.lookFor(m.name),
    };
  }

  function syncShifts(b, r, hour) {
    for (const m of b.staff) {
      const a = r.agents.find(x => x.kind === 'staff' && x.id === m.id);
      const on = Business.onShift(m, hour);
      if (on && !a) { r.agents.push(spawnStaff(m)); r.assignIn = 0; }
      else if (on && a && a.leaving && !a.gone) { a.leaving = false; a.problem = null; r.assignIn = 0; }
      else if (!on && a && !a.leaving) goHome(r, a);
    }
    // People who were fired leave at once.
    for (const a of r.agents) if (a.kind === 'staff' && !b.staff.some(m => m.id === a.id)) dropWork(r, a);
    r.agents = r.agents.filter(a => a.kind !== 'staff' || b.staff.some(m => m.id === a.id));
  }

  // Unfinished work goes back to the kitchen when someone stops working.
  function dropWork(r, a) {
    if (a.job) { const o = r.orders.find(x => x.id === a.job.orderId); if (o) o.stage = 'queued'; a.job = null; }
    if (a.task) { const o = r.orders.find(x => x.id === a.task.orderId); if (o && o.stage === 'delivering') o.stage = 'ready'; a.task = null; a.carrying = false; }
  }

  function goHome(r, a) {
    dropWork(r, a);
    a.leaving = true; a.station = null; a.problem = null; a.atStation = false;
  }

  // Give every working staff member a free station they can reach, or explain why not.
  function assignStations(b, r, g) {
    const layout = b.layout;
    const claimedItems = new Set();
    const claimedTiles = new Set();
    const working = b.staff
      .map(m => ({ m, a: r.agents.find(x => x.kind === 'staff' && x.id === m.id) }))
      .filter(p => p.a && !p.a.leaving);

    for (const { m, a } of working) {
      const role = Business.ROLES[m.role];
      const what = itemName(role.station);
      const items = layout.items.filter(i => i.type === role.station);
      const free = items.filter(i => !claimedItems.has(i.id));
      a.problem = null;
      if (!items.length) { a.station = null; a.problem = { kind: 'missing', text: `No ${what} to work at. Build one in build mode.` }; continue; }
      if (!free.length) { a.station = null; a.problem = { kind: 'taken', text: `Every ${what} is already in use. Build another one.` }; continue; }

      const exp = Path.explore(g, a.tile.x, a.tile.y);
      let best = null, anySpot = false;
      for (const it of free) {
        for (const t of Path.accessTiles(g, it, role.side)) {
          const k = Path.key(t.x, t.y);
          if (claimedTiles.has(k)) continue;
          anySpot = true;
          const d = exp.dist.get(k);
          if (d === undefined) continue;
          const keep = a.station && a.station.itemId === it.id && same(a.station.tile, t);
          const score = d + t.rank * 4 - (keep ? 3 : 0);
          if (!best || score < best.score) best = { it, t, score };
        }
      }
      if (!best) {
        a.station = null;
        a.problem = anySpot
          ? { kind: 'unreachable', text: `Can't reach the ${what}. Check walls and doors.` }
          : { kind: 'blocked', text: `There is no free spot next to the ${what}.` };
        continue;
      }
      claimedItems.add(best.it.id);
      claimedTiles.add(Path.key(best.t.x, best.t.y));
      if (a.station && a.station.itemId !== best.it.id) dropWork(r, a);
      a.station = { itemId: best.it.id, type: best.it.type, tile: { x: best.t.x, y: best.t.y } };
    }
    r.stationTiles = claimedTiles;
  }

  // ---------- Movement ----------

  // Walk along the shortest path, re-planning at every tile so new walls and doors are respected.
  function move(g, a, dt) {
    let budget = WALK * dt;
    let guard = 8;
    a.arrived = false;
    while (budget > 1e-6 && guard-- > 0) {
      const atCenter = Math.abs(a.x - (a.tile.x + 0.5)) < 1e-4 && Math.abs(a.y - (a.tile.y + 0.5)) < 1e-4;
      if (a.next && !g.canStep(a.tile.x, a.tile.y, a.next.x, a.next.y)) a.next = null; // blocked mid-step: turn back
      if (!a.next && atCenter) {
        const goal = a.goal;
        if (!goal || !goal.length) { a.lost = false; return; }
        if (goal.some(t => same(t, a.tile))) { a.arrived = true; a.lost = false; return; }
        const path = Path.find(g, a.tile, goal);
        a.lost = !path;
        if (!path || !path.length) return;
        a.next = path[0];
      }
      const target = center(a.next || a.tile);
      const dx = target.x - a.x, dy = target.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1e-6) a.dir = [Math.sign(Math.round(dx * 10)), Math.sign(Math.round(dy * 10))];
      if (dist <= budget) {
        a.x = target.x; a.y = target.y;
        budget -= dist;
        a.walk += dist;
        if (a.next) { a.tile = a.next; a.next = null; }
      } else {
        a.x += dx / dist * budget; a.y += dy / dist * budget;
        a.walk += budget;
        budget = 0;
      }
    }
  }

  // ---------- Places in the room ----------

  function workingAt(r, type) {
    return r.agents.filter(a => a.kind === 'staff' && !a.leaving && a.atStation && a.station && a.station.type === type);
  }

  // Where customers line up (in front of the register) and where takeaway customers wait (near the door).
  function computeSpots(b, r, g) {
    const regs = b.layout.items.filter(i => i.type === 'register');
    const manned = workingAt(r, 'register').map(a => a.station.itemId);
    const reg = regs.find(i => manned.includes(i.id)) || regs[0] || null;
    r.register = reg;
    r.spots = { queue: [], wait: [] };
    const blocked = new Set(r.stationTiles || []);
    blocked.add(Path.key(ENTRY.x, ENTRY.y));
    let front = null;
    if (reg) {
      front = Path.accessTiles(g, reg, 'front').find(t => !blocked.has(Path.key(t.x, t.y))) || null;
    }
    const fromEntry = Path.explore(g, ENTRY.x, ENTRY.y);
    r.registerReachable = !!(front && fromEntry.dist.has(Path.key(front.x, front.y)));
    if (front) {
      r.spots.queue.push(front);
      const exp = Path.explore(g, front.x, front.y);
      const order = [...exp.dist.entries()].sort((a, b) => a[1] - b[1]);
      for (const [k] of order) {
        if (r.spots.queue.length >= 12) break;
        if (blocked.has(k) || k === Path.key(front.x, front.y)) continue;
        const [x, y] = k.split(',').map(Number);
        r.spots.queue.push({ x, y });
      }
    }
    const inQueue = new Set(r.spots.queue.slice(0, r.queue.length + 2).map(t => Path.key(t.x, t.y)));
    const order = [...fromEntry.dist.entries()].sort((a, b) => a[1] - b[1]);
    for (const [k] of order) {
      if (r.spots.wait.length >= 10) break;
      if (blocked.has(k) || inQueue.has(k)) continue;
      const [x, y] = k.split(',').map(Number);
      r.spots.wait.push({ x, y });
    }
  }

  // Chairs next to a dining table.
  function seatsIn(layout) {
    const tables = new Set();
    for (const it of layout.items) if (it.type === 'table') tables.add(Path.key(it.x, it.y));
    return layout.items.filter(it => it.type === 'chair' &&
      [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tables.has(Path.key(it.x + dx, it.y + dy))));
  }

  function findSeat(b, r, g, c) {
    const exp = Path.explore(g, c.tile.x, c.tile.y);
    let best = null;
    for (const chair of seatsIn(b.layout)) {
      if (r.seats.has(chair.id)) continue;
      for (const t of Path.accessTiles(g, chair, 'any')) {
        const d = exp.dist.get(Path.key(t.x, t.y));
        if (d !== undefined && (!best || d < best.d)) best = { d, chair, t };
      }
    }
    if (!best) return null;
    r.seats.set(best.chair.id, c.id);
    return { itemId: best.chair.id, tile: { x: best.t.x, y: best.t.y }, pos: { x: best.chair.x + 0.5, y: best.chair.y + 0.5 } };
  }

  // ---------- Customers ----------

  function arrivalRate(b, hour) {
    const rep = 0.3 + 1.4 * (b.reputation / 100);
    const rush = hour >= 12 && hour < 14 ? 1.7 : hour >= 18 && hour < 21 ? 1.9 : 0.8;
    const ratio = b.menu.reduce((s, p) => s + Business.fairPrice(p) / p.price, 0) / b.menu.length;
    const price = Math.max(0.35, Math.min(1.6, ratio * ratio));
    return BASE_RATE * rep * rush * price;
  }

  function spawnCustomer(r, time) {
    const look = { skin: pick(['#f1c9a5', '#e0ac85', '#c68a62', '#9a6545', '#6e4630', '#f5d6bd']), hair: pick(['#2b1d16', '#4a3020', '#8a5a33', '#c9a06a', '#1c1c1c', '#a3452c', '#d8d0c4']), short: rand() < 0.5 };
    const c = {
      kind: 'customer', id: 'c' + r.nextId++,
      x: ENTRY.x + 0.5, y: ENTRY.y + 0.5, tile: { x: ENTRY.x, y: ENTRY.y }, next: null,
      alpha: 0, gone: false, walk: 0, dir: [1, 0], look, outfit: { shirt: pick(SHIRTS), pants: pick(PANTS) },
      state: 'queue', enteredAt: time, goal: null, t: 0, orderId: null, seat: null, mood: null,
    };
    r.agents.push(c);
    r.queue.push(c);
  }

  function choosePizza(b) {
    const weights = b.menu.map(p => Math.pow(Math.min(2, Business.fairPrice(p) / p.price), 3));
    let x = rand() * weights.reduce((s, w) => s + w, 0);
    for (let i = 0; i < b.menu.length; i++) { x -= weights[i]; if (x <= 0) return b.menu[i]; }
    return b.menu[b.menu.length - 1];
  }

  function placeOrder(b, r, g, c, time) {
    r.queue = r.queue.filter(x => x !== c);
    if (!b.menu.length) { leave(b, r, c, time, 'lost'); return; }
    const p = choosePizza(b);
    const cost = Business.pizzaCost(p);
    b.today.revenue += p.price;
    b.today.ingredients += cost;
    r.moneyDelta += p.price - cost;
    const reg = r.register;
    if (reg) r.floaters.push({ x: reg.x + 0.5, y: reg.y + 0.5, amount: p.price });
    const order = { id: 'o' + r.nextId++, customerId: c.id, pizzaId: p.id, name: p.name, price: p.price, fair: Business.fairPrice(p), stage: 'queued', placedAt: time, takeaway: false };
    r.orders.push(order);
    c.orderId = order.id;
    c.orderedAt = time;
    c.seat = findSeat(b, r, g, c);
    if (c.seat) c.state = 'toSeat';
    else { order.takeaway = true; c.state = 'waiting'; r.waiting.push(c); }
  }

  function releaseSeat(r, c) {
    if (c.seat) { r.seats.delete(c.seat.itemId); }
    if (c.seated) { c.seated = false; c.x = c.tile.x + 0.5; c.y = c.tile.y + 0.5; }
    c.seat = null;
  }

  // outcome: 'served' | 'lost' (left before ordering) | 'unserved' (paid but never got food)
  function leave(b, r, c, time, outcome) {
    const order = r.orders.find(o => o.id === c.orderId);
    let score;
    if (outcome === 'served') {
      const wait = (c.servedAt - c.enteredAt);
      const waitScore = Math.max(0, Math.min(100, 100 - (wait - 12) * 2.5));
      const priceScore = order ? Math.max(0, Math.min(100, 70 + (order.fair - order.price) / order.fair * 150)) : 70;
      score = 0.6 * waitScore + 0.4 * priceScore;
      b.today.served++;
      b.today.waitSum += wait;
    } else if (outcome === 'unserved') {
      score = 0;
      b.today.lost++;
      if (order) { b.today.revenue -= order.price; r.moneyDelta -= order.price; } // money back
    } else {
      score = 15;
      b.today.lost++;
    }
    if (order && order.stage !== 'served') order.stage = 'cancelled';
    b.reputation = Math.max(0, Math.min(100, b.reputation + (score - b.reputation) * 0.05));
    c.mood = score >= 60 ? 'happy' : score >= 35 ? 'ok' : 'angry';
    c.score = score;
    releaseSeat(r, c);
    r.queue = r.queue.filter(x => x !== c);
    r.waiting = r.waiting.filter(x => x !== c);
    c.state = 'leaving';
    c.carrying = outcome === 'served' && order && order.takeaway;
  }

  function updateCustomer(b, r, g, c, dt, time) {
    const order = c.orderId ? r.orders.find(o => o.id === c.orderId) : null;
    switch (c.state) {
      case 'queue': {
        const i = r.queue.indexOf(c);
        c.goal = i >= 0 && i < r.spots.queue.length ? [r.spots.queue[i]] : null;
        const cashier = r.register && workingAt(r, 'register').find(a => a.station.itemId === r.register.id);
        if (i === 0 && c.arrived && cashier) {
          c.state = 'ordering';
          c.t = ORDER_TIME / Business.speed(member(b, cashier));
        } else if (time - c.enteredAt > PATIENCE_QUEUE) leave(b, r, c, time, 'lost');
        break;
      }
      case 'ordering': {
        c.goal = null;
        // The cashier has to stay at the register until the order is done.
        const cashier = r.register && workingAt(r, 'register').find(a => a.station.itemId === r.register.id);
        if (!cashier) { c.state = 'queue'; break; }
        c.t -= dt;
        if (c.t <= 0) placeOrder(b, r, g, c, time);
        break;
      }
      case 'toSeat':
      case 'seated': {
        // The chair or its table may have been removed meanwhile.
        const chair = c.seat && b.layout.items.find(i => i.id === c.seat.itemId);
        if (!chair || !seatsIn(b.layout).includes(chair)) {
          releaseSeat(r, c);
          c.seat = findSeat(b, r, g, c);
          if (!c.seat) { c.state = 'waiting'; if (order) order.takeaway = true; r.waiting.push(c); break; }
          c.state = 'toSeat';
        }
        if (c.state === 'toSeat') {
          c.goal = [c.seat.tile];
          if (c.arrived) { c.state = 'seated'; c.seated = true; c.x = c.seat.pos.x; c.y = c.seat.pos.y; }
        } else c.goal = null;
        if (time - c.orderedAt > PATIENCE_FOOD) leave(b, r, c, time, 'unserved');
        break;
      }
      case 'waiting': {
        const i = r.waiting.indexOf(c);
        c.goal = i >= 0 && i < r.spots.wait.length ? [r.spots.wait[i]] : null;
        if (order && order.stage === 'ready') { order.stage = 'served'; c.servedAt = time; leave(b, r, c, time, 'served'); }
        else if (time - c.orderedAt > PATIENCE_FOOD) leave(b, r, c, time, 'unserved');
        break;
      }
      case 'eating':
        c.goal = null;
        c.t -= dt;
        if (c.t <= 0) leave(b, r, c, time, 'served');
        break;
      case 'leaving':
        c.goal = [ENTRY];
        if (c.arrived) c.gone = true;
        break;
    }
  }

  // ---------- Kitchen and service ----------

  function updateKitchen(b, r, dt, time) {
    // Ovens bake even if the cook walks away.
    for (const [ovenId, slots] of r.ovens) {
      for (const s of slots) {
        s.t -= dt;
        if (s.t <= 0) {
          const o = r.orders.find(x => x.id === s.orderId);
          if (o && o.stage === 'bake') { o.stage = 'ready'; o.readyAt = time; }
        }
      }
      r.ovens.set(ovenId, slots.filter(s => s.t > 0));
      if (!b.layout.items.some(i => i.id === ovenId)) r.ovens.delete(ovenId);
    }
    const cooks = workingAt(r, 'oven');
    const counters = b.layout.items.filter(i => i.type === 'counter').length;
    cooks.forEach((a, i) => {
      const m = member(b, a);
      const slots = r.ovens.get(a.station.itemId) || [];
      r.ovens.set(a.station.itemId, slots);
      if (!a.job) {
        const o = r.orders.filter(x => x.stage === 'queued').sort((x, y) => x.placedAt - y.placedAt)[0];
        if (o) {
          o.stage = 'prep';
          a.job = { orderId: o.id, t: (i < counters ? PREP_WITH_COUNTER : PREP_WITHOUT) / Business.speed(m) };
        }
        return;
      }
      a.job.t -= dt;
      const o = r.orders.find(x => x.id === a.job.orderId);
      if (!o || o.stage === 'cancelled') { a.job = null; return; }
      if (a.job.t <= 0 && slots.length < OVEN_SLOTS) {
        slots.push({ orderId: o.id, t: BAKE });
        o.stage = 'bake';
        a.job = null;
      }
    });
    // Cooks who stopped working give their pizza back to the queue.
    for (const a of r.agents) {
      if (a.kind === 'staff' && a.job && !cooks.includes(a)) dropWork(r, a);
    }
  }

  function chairFor(b, c) { return c.seat && b.layout.items.find(i => i.id === c.seat.itemId); }

  function updateWaiter(b, r, g, a) {
    if (a.task) {
      const c = r.agents.find(x => x.id === a.task.customerId);
      const o = r.orders.find(x => x.id === a.task.orderId);
      const chair = c && chairFor(b, c);
      if (!c || !o || c.state !== 'seated' || !chair) {
        // The guest left or moved: take the pizza back to the counter.
        if (o && o.stage === 'delivering') o.stage = c && c.state !== 'leaving' ? 'ready' : 'cancelled';
        a.task = null; a.carrying = false;
        return;
      }
      a.task.tiles = Path.accessTiles(g, chair, 'any');
      if (a.arrived && a.task.tiles.some(t => same(t, a.tile))) {
        o.stage = 'served';
        c.state = 'eating';
        c.servedAt = r.now;
        c.t = 12 + rand() * 8;
        a.task = null; a.carrying = false;
      }
      return;
    }
    if (!a.atStation) return;
    const waiting = r.orders.filter(o => o.stage === 'ready' && !o.takeaway).sort((x, y) => x.readyAt - y.readyAt);
    for (const o of waiting) {
      const c = r.agents.find(x => x.id === o.customerId);
      if (!c || c.state !== 'seated') continue;
      o.stage = 'delivering';
      a.task = { orderId: o.id, customerId: c.id, tiles: [] };
      a.carrying = true;
      break;
    }
  }

  // ---------- Status and warnings ----------

  function staffStatus(b, m, hour) {
    const r = runtime(b);
    const a = r.agents.find(x => x.kind === 'staff' && x.id === m.id);
    const shift = `${Business.fmtHour(m.start)}–${Business.fmtHour(m.end)}`;
    if (!a) return { kind: 'off', text: `Off duty · shift ${shift}` };
    if (a.leaving) return a.problem ? { kind: 'problem', text: a.problem.text } : { kind: 'off', text: 'Going home' };
    if (a.problem) return { kind: 'problem', text: a.problem.text };
    if (a.task) {
      const o = r.orders.find(x => x.id === a.task.orderId);
      return { kind: 'ok', text: `Serving ${o ? o.name : 'a pizza'} to a guest` };
    }
    const what = itemName(Business.ROLES[m.role].station);
    if (a.atStation) {
      if (a.job) { const o = r.orders.find(x => x.id === a.job.orderId); return { kind: 'ok', text: `Making a ${o ? o.name : 'pizza'}` }; }
      return { kind: 'ok', text: `Working at the ${what}` };
    }
    return { kind: 'walking', text: `Walking to the ${what}` };
  }

  function customerStatus(b, c) {
    const r = runtime(b);
    const o = c.orderId && r.orders.find(x => x.id === c.orderId);
    const mins = t => `${Math.max(0, Math.round(r.now - t))} min`;
    switch (c.state) {
      case 'queue': return `Waiting to order (${mins(c.enteredAt)})`;
      case 'ordering': return 'Ordering at the register';
      case 'toSeat': return `Going to a table with a ${o ? o.name : 'pizza'} on order`;
      case 'seated': return `Waiting for a ${o ? o.name : 'pizza'} (${mins(c.orderedAt)})`;
      case 'waiting': return `Waiting for a takeaway ${o ? o.name : 'pizza'} (${mins(c.orderedAt)})`;
      case 'eating': return `Eating a ${o ? o.name : 'pizza'}`;
      case 'leaving': return c.mood === 'happy' ? 'Leaving happy' : c.mood === 'angry' ? 'Leaving unhappy' : c.mood ? 'Leaving' : 'Leaving';
    }
    return '';
  }

  function collectIssues(b, r, hour) {
    const issues = [];
    for (const a of r.agents) {
      if (a.kind !== 'staff' || !a.problem) continue;
      const m = member(b, a);
      if (m) issues.push({ level: 'error', tab: 'staff', text: `${m.name} (${Business.ROLES[m.role].name.toLowerCase()}): ${a.problem.text}` });
    }
    const trapped = r.agents.filter(a => a.kind === 'customer' && a.problem).length;
    if (trapped) issues.push({ level: 'error', tab: null, text: `${trapped === 1 ? 'A guest is' : trapped + ' guests are'} walled in and can’t reach the exit. Check walls and doors.` });
    const has = type => b.layout.items.some(i => i.type === type);
    if (!b.menu.length) issues.push({ level: 'warn', tab: 'menu', text: 'Your menu is empty, so customers stay away. Add a pizza in the menu window (M).' });
    if (!has('register')) issues.push({ level: 'warn', tab: null, text: 'Customers can’t order without a cash register. Build one in build mode (B).' });
    else if (!r.registerReachable) issues.push({ level: 'error', tab: null, text: 'Customers can’t reach the cash register from the entrance. Check walls and doors.' });
    if (Business.isOpenAt(b, hour) && b.menu.length && has('register')) {
      if (!workingAt(r, 'register').length) issues.push({ level: 'warn', tab: 'staff', text: 'No cashier at the register, so customers can’t order.' });
      if (!workingAt(r, 'oven').length) issues.push({ level: 'warn', tab: 'staff', text: 'No cook at a pizza oven, so no pizzas are being made.' });
      const seats = seatsIn(b.layout).length;
      if (!seats) issues.push({ level: 'info', tab: null, text: 'No seats: put chairs next to dining tables. Until then every order is takeaway.' });
      else if (!r.agents.some(a => a.kind === 'staff' && !a.leaving && Business.ROLES[a.role].station === 'counter' && (a.atStation || a.task))) {
        issues.push({ level: 'warn', tab: 'staff', text: 'No waiter on duty, so seated guests don’t get their pizza.' });
      }
    }
    r.issues = issues;
  }

  // ---------- Main update ----------

  function rollDay(b, r, time) {
    const day = Math.floor(time / 1440) + 1;
    if (b.today.day === day) return;
    const d = b.today;
    if (d.day < day && (d.revenue || d.wages || d.served || d.lost)) {
      b.history.push(d);
      if (b.history.length > 14) b.history.shift();
      r.events.push({ type: 'day', business: b, summary: d });
    }
    b.today = Business.emptyDay(day);
  }

  function step(state, b, dt) {
    const r = runtime(b);
    const time = state.time;
    const hour = hourOf(time);
    r.now = time;
    r.moneyDelta = 0;
    rollDay(b, r, time);
    syncShifts(b, r, hour);
    const g = Path.grid(b.layout);

    r.assignIn -= dt;
    if (r.assignIn <= 0) { assignStations(b, r, g); r.assignIn = 0.5; }
    computeSpots(b, r, g);

    // New customers while open
    const open = Business.isOpenAt(b, hour) && b.menu.length && r.register && r.registerReachable;
    const inside = r.agents.filter(a => a.kind === 'customer').length;
    if (open && inside < MAX_CUSTOMERS && rand() < 1 - Math.exp(-arrivalRate(b, hour) / 60 * dt)) spawnCustomer(r, time);

    updateKitchen(b, r, dt, time);
    for (const a of r.agents) {
      if (a.kind === 'customer') updateCustomer(b, r, g, a, dt, time);
      else if (!a.leaving && a.role === 'waiter') updateWaiter(b, r, g, a);
    }

    for (const a of r.agents) {
      if (a.gone) { a.alpha -= dt / FADE; continue; }
      a.alpha = Math.min(1, a.alpha + dt / FADE);
      if (a.kind === 'staff') a.goal = a.leaving ? [ENTRY] : a.task ? a.task.tiles : a.station ? [a.station.tile] : null;
      if (!a.seated) move(g, a, dt);
      if (a.kind === 'staff') {
        a.atStation = !!(a.station && !a.task && a.arrived && same(a.tile, a.station.tile));
        if (a.leaving && a.arrived) a.gone = true;
        // Walled in on the way home: they wait inside until you open a way out.
        if (a.leaving) a.problem = a.lost ? { kind: 'trapped', text: 'Can’t get out to go home. Check walls and doors.' } : null;
      } else {
        // A guest walled in on the way out: warn, and after an hour they give up and slip away.
        a.lostFor = a.state === 'leaving' && a.lost ? (a.lostFor || 0) + dt : 0;
        a.problem = a.lostFor > 0 ? { kind: 'trapped' } : null;
        if (a.lostFor > 60) a.gone = true;
      }
    }
    r.agents = r.agents.filter(a => !(a.gone && a.alpha <= 0));
    r.orders = r.orders.filter(o => o.stage !== 'served' && o.stage !== 'cancelled');

    // Wages are paid for every minute of a shift.
    for (const m of b.staff) {
      if (Business.onShift(m, hour)) {
        const w = m.wage / 60 * dt;
        r.moneyDelta -= w;
        b.today.wages += w;
      }
    }
    state.money += r.moneyDelta;

    r.issuesIn = (r.issuesIn || 0) - dt;
    if (r.issuesIn <= 0) { collectIssues(b, r, hour); r.issuesIn = 0.5; }
    if (r.floaters.length > 20) r.floaters.splice(0, r.floaters.length - 20);
  }

  function update(state, minutes) {
    let left = minutes;
    while (left > 1e-9) {
      const dt = Math.min(MAX_STEP, left);
      for (const b of state.businesses) step(state, b, dt);
      state.time += dt;
      left -= dt;
    }
  }

  // Something about the room or staff changed: re-check right away.
  function layoutChanged(b, state) {
    const r = runtime(b);
    const g = Path.grid(b.layout);
    syncShifts(b, r, hourOf(r.now || (state ? state.time : 0)));
    assignStations(b, r, g);
    computeSpots(b, r, g);
    collectIssues(b, r, hourOf(r.now || (state ? state.time : 0)));
    r.assignIn = 0.5;
  }

  // Pizzas per hour the kitchen can make right now, and what limits it.
  function capacity(b) {
    const r = runtime(b);
    const cooks = workingAt(r, 'oven');
    const counters = b.layout.items.filter(i => i.type === 'counter').length;
    let perHour = 0;
    cooks.forEach((a, i) => {
      const m = member(b, a);
      const prep = (i < counters ? PREP_WITH_COUNTER : PREP_WITHOUT) / Business.speed(m);
      perHour += Math.min(60 / prep, OVEN_SLOTS * 60 / BAKE);
    });
    return { perHour: Math.round(perHour), cooks: cooks.length, ovens: b.layout.items.filter(i => i.type === 'oven').length, counters };
  }

  function readyCount(b) { return runtime(b).orders.filter(o => o.stage === 'ready' && !o.takeaway).length; }
  function bakingIn(b, ovenId) { const s = runtime(b).ovens.get(ovenId); return s ? s.length : 0; }

  function drainEvents() {
    const out = [];
    for (const r of runtimes.values()) { out.push(...r.events); r.events = []; }
    return out;
  }

  function reset() { runtimes.clear(); }

  window.Sim = {
    update, layoutChanged, reset, staffStatus, customerStatus, capacity, readyCount, bakingIn, drainEvents, seatsIn,
    agents: b => runtime(b).agents,
    issues: b => runtime(b).issues,
    // Sales since the last call, for the "+$12" labels over the register.
    drainFloaters(b) { const r = runtime(b); const f = r.floaters; r.floaters = []; return f; },
    runtime,
    setRandom(fn) { rand = fn; },
    WALK, PREP_WITH_COUNTER, PREP_WITHOUT, BAKE, OVEN_SLOTS,
  };
})();
