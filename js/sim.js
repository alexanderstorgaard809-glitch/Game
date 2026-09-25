// The running business: people moving around, who is on shift, where they work, and what's wrong.
// It runs all the time, also while you look at the city map. Positions are not saved:
// after a reload, staff on shift walk in through the entrance again.
(function () {
  const WALK = 0.9;       // walking speed in tiles per game minute
  const MAX_STEP = 0.5;   // longest simulation step in game minutes
  const FADE = 0.6;       // game minutes to fade in or out at the door
  const ENTRY = { x: Layout.ENTRANCE.x, y: Layout.ENTRANCE.y };

  const runtimes = new Map();

  function runtime(b) {
    let r = runtimes.get(b.id);
    if (!r) {
      r = { agents: [], issues: [], assignIn: 0 };
      runtimes.set(b.id, r);
    }
    return r;
  }

  const center = t => ({ x: t.x + 0.5, y: t.y + 0.5 });
  const itemName = type => Furniture.items[type].name.toLowerCase();

  // ---------- Staff agents ----------

  function spawnStaff(member) {
    return {
      kind: 'staff', id: member.id, role: member.role,
      x: ENTRY.x + 0.5, y: ENTRY.y + 0.5, tile: { x: ENTRY.x, y: ENTRY.y }, next: null,
      alpha: 0, leaving: false, gone: false, walk: 0, dir: [1, 0],
      station: null, problem: null, atStation: false,
      look: Business.lookFor(member.name),
    };
  }

  function syncShifts(b, r, hour) {
    for (const m of b.staff) {
      const a = r.agents.find(x => x.kind === 'staff' && x.id === m.id);
      const on = Business.onShift(m, hour);
      if (on && !a) { r.agents.push(spawnStaff(m)); r.assignIn = 0; }
      else if (on && a && a.leaving && !a.gone) { a.leaving = false; r.assignIn = 0; }
      else if (!on && a && !a.leaving) { a.leaving = true; a.station = null; a.problem = null; }
    }
    // People who were fired leave at once.
    r.agents = r.agents.filter(a => a.kind !== 'staff' || b.staff.some(m => m.id === a.id));
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
          const keep = a.station && a.station.itemId === it.id && a.station.tile.x === t.x && a.station.tile.y === t.y;
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
      a.station = { itemId: best.it.id, type: best.it.type, tile: { x: best.t.x, y: best.t.y } };
    }
  }

  // ---------- Movement ----------

  function goalTiles(a) {
    if (a.leaving) return [ENTRY];
    if (a.station) return [a.station.tile];
    return null;
  }

  // Walk along the shortest path, re-planning at every tile so new walls and doors are respected.
  function move(g, a, dt) {
    let budget = WALK * dt;
    let guard = 8;
    a.arrived = false;
    while (budget > 1e-6 && guard-- > 0) {
      const atCenter = Math.abs(a.x - (a.tile.x + 0.5)) < 1e-4 && Math.abs(a.y - (a.tile.y + 0.5)) < 1e-4;
      if (a.next && !g.canStep(a.tile.x, a.tile.y, a.next.x, a.next.y)) a.next = null; // blocked mid-step: turn back
      if (!a.next && atCenter) {
        const goal = goalTiles(a);
        if (!goal) return;
        if (goal.some(t => t.x === a.tile.x && t.y === a.tile.y)) { a.arrived = true; return; }
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

  // ---------- Status and warnings ----------

  function staffStatus(b, member, hour) {
    const r = runtime(b);
    const a = r.agents.find(x => x.kind === 'staff' && x.id === member.id);
    const shift = `${Business.fmtHour(member.start)}–${Business.fmtHour(member.end)}`;
    if (!a) return { kind: 'off', text: `Off duty · shift ${shift}` };
    if (a.leaving) return a.problem ? { kind: 'problem', text: a.problem.text } : { kind: 'off', text: 'Going home' };
    if (a.problem) return { kind: 'problem', text: a.problem.text };
    const what = itemName(Business.ROLES[member.role].station);
    if (a.atStation) return { kind: 'ok', text: `Working at the ${what}` };
    return { kind: 'walking', text: `Walking to the ${what}` };
  }

  function collectIssues(b, r) {
    const issues = [];
    for (const a of r.agents) {
      if (a.kind !== 'staff' || !a.problem) continue;
      const m = b.staff.find(s => s.id === a.id);
      if (m) issues.push({ level: 'error', staffId: m.id, text: `${m.name} (${Business.ROLES[m.role].name.toLowerCase()}): ${a.problem.text}` });
    }
    r.issues = issues;
  }

  // ---------- Main update ----------

  function step(state, b, dt) {
    const r = runtime(b);
    const hour = (state.time % 1440) / 60;
    syncShifts(b, r, hour);
    const g = Path.grid(b.layout);

    r.assignIn -= dt;
    if (r.assignIn <= 0) {
      assignStations(b, r, g);
      collectIssues(b, r);
      r.assignIn = 0.5;
    }

    for (const a of r.agents) {
      if (a.gone) { a.alpha -= dt / FADE; continue; }
      a.alpha = Math.min(1, a.alpha + dt / FADE);
      move(g, a, dt);
      if (a.kind === 'staff') {
        a.atStation = !!(a.station && a.arrived);
        if (a.leaving && a.arrived) a.gone = true;
        // Walled in on the way home: they wait inside until you open a way out.
        if (a.leaving) a.problem = a.lost ? { kind: 'trapped', text: 'Can\u2019t get out to go home. Check walls and doors.' } : null;
      }
    }
    r.agents = r.agents.filter(a => !(a.gone && a.alpha <= 0));

    // Wages are paid for every minute of a shift.
    for (const m of b.staff) {
      if (Business.onShift(m, hour)) state.money -= m.wage / 60 * dt;
    }
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

  // Something about the room changed: re-check stations right away.
  function layoutChanged(b) {
    const r = runtime(b);
    r.assignIn = 0;
    const g = Path.grid(b.layout);
    assignStations(b, r, g);
    collectIssues(b, r);
  }

  function reset() { runtimes.clear(); }

  window.Sim = {
    update, layoutChanged, reset, staffStatus,
    agents: b => runtime(b).agents,
    issues: b => runtime(b).issues,
    WALK,
  };
})();
