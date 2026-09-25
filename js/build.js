// Build mode inside a business: pick a tool, preview it under the mouse, buy or sell.
(function () {
  const W = Layout.W, D = Layout.D;
  const P = Furniture.PRICES;
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  const TOOLS = [
    { id: 'wall', name: 'Wall', price: P.wall, group: 'Structure' },
    { id: 'door', name: 'Door', price: P.door, group: 'Structure' },
    { id: 'remove', name: 'Remove', price: null, group: 'Structure' },
    ...Object.keys(Furniture.items).map(id => ({ id, name: Furniture.items[id].name, price: Furniture.items[id].price, group: Furniture.items[id].group })),
  ];

  const HINTS = {
    none: 'Pick something from the catalog to start building.',
    item: 'Click to place · R to rotate · right-click to put it away',
    wall: 'Click, or drag along the floor lines, to build walls · right-click to stop',
    door: 'Click a wall to put a door in it · right-click to stop',
    remove: 'Click a wall, door or item to sell it back for half its price',
  };

  const B = {
    active: false,
    tool: null,
    rot: 0,
    pointer: null,   // grid position under the mouse { x, y }
    drag: null,      // wall drag start edge
    preview: null,
    info: null,      // what the tooltip should say
    floaters: [],
  };

  let api = null;    // { layout(), money(), spend(n), earn(n), changed() }
  const el = {};

  // ---------- Helpers ----------

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Edge under the mouse. Pointing at the back walls themselves also works.
  function edgeAt(g, allowWallFaces) {
    if (allowWallFaces) {
      if (g.x < 0 && g.x > -3.2 && g.y - g.x >= 0 && g.y - g.x < D) return { o: 'v', x: 0, y: Math.floor(g.y - g.x), onFace: true };
      if (g.y < 0 && g.y > -3.2 && g.x - g.y >= 0 && g.x - g.y < W) return { o: 'h', x: Math.floor(g.x - g.y), y: 0, onFace: true };
    }
    if (g.x < -0.3 || g.y < -0.3 || g.x > W + 0.3 || g.y > D + 0.3) return null;
    const rx = Math.round(g.x), ry = Math.round(g.y);
    const dx = Math.abs(g.x - rx), dy = Math.abs(g.y - ry);
    if (dx < dy) return { o: 'v', x: rx, y: clamp(Math.floor(g.y), 0, D - 1), dist: dx };
    return { o: 'h', x: clamp(Math.floor(g.x), 0, W - 1), y: ry, dist: dy };
  }

  function edgeCenter(e) { return e.o === 'h' ? { x: e.x + 0.5, y: e.y } : { x: e.x, y: e.y + 0.5 }; }

  function floater(x, y, amount) {
    B.floaters.push({ x, y, text: (amount < 0 ? '-' : '+') + money.format(Math.abs(amount)), color: amount < 0 ? '#ff9b85' : '#8fdc7a', age: 0, life: 1.3 });
  }

  function refundOf(price) { return Math.round(price * Furniture.REFUND); }

  // ---------- Preview ----------

  function wallSegments() {
    const g = B.pointer;
    const cur = edgeAt(g, false);
    if (!B.drag) return cur ? [cur] : [];
    const s = B.drag;
    const segs = [];
    if (s.o === 'h') {
      const x1 = clamp(Math.floor(g.x), 0, W - 1);
      for (let x = Math.min(s.x, x1); x <= Math.max(s.x, x1); x++) segs.push({ o: 'h', x, y: s.y });
    } else {
      const y1 = clamp(Math.floor(g.y), 0, D - 1);
      for (let y = Math.min(s.y, y1); y <= Math.max(s.y, y1); y++) segs.push({ o: 'v', x: s.x, y });
    }
    return segs;
  }

  // Works out what the current tool would do at the mouse position.
  function computePreview() {
    const p = { footprints: [], ghostItems: [], ghostWalls: [], outerDoor: null, removeItem: null, removeEdge: null };
    B.preview = p;
    B.info = null;
    const g = B.pointer;
    if (!B.active || !B.tool || !g) return;
    const layout = api.layout();
    const cash = api.money();
    const t = B.tool;

    if (Furniture.items[t]) {
      const def = Furniture.items[t];
      const size = Layout.footprint(t, 0, 0, B.rot);
      if (g.x < -3 || g.y < -3 || g.x > W + 3 || g.y > D + 3) return;
      const x = Math.floor(g.x - size.w / 2 + 0.5), y = Math.floor(g.y - size.d / 2 + 0.5);
      let check = Layout.canPlaceItem(layout, t, x, y, B.rot);
      if (check.ok && cash < def.price) check = { ok: false, reason: 'Not enough cash' };
      p.footprints.push({ x, y, w: size.w, d: size.d, ok: check.ok });
      p.ghostItems.push({ type: t, x, y, rot: B.rot, ok: check.ok });
      B.info = { title: def.name, amount: -def.price, ok: check.ok, reason: check.reason, action: 'place', x, y };
      return;
    }

    if (t === 'wall') {
      const segs = wallSegments();
      if (!segs.length) return;
      let reason = null, count = 0;
      for (const s of segs) {
        if (Layout.hasWall(layout, s.o, s.x, s.y)) continue; // already built: free, not shown
        const c = Layout.canPlaceWall(layout, s.o, s.x, s.y);
        if (c.ok) count++; else reason = reason || c.reason;
        p.ghostWalls.push({ o: s.o, x: s.x, y: s.y, ok: c.ok });
      }
      const cost = count * P.wall;
      let ok = count > 0;
      if (ok && cost > cash) { ok = false; reason = 'Not enough cash'; p.ghostWalls.forEach(w => { w.ok = false; }); }
      if (!p.ghostWalls.length) reason = 'There is already a wall here';
      B.info = { title: count > 1 ? `Wall × ${count}` : 'Wall', amount: -cost, ok, reason: ok ? null : reason, action: 'build' };
      return;
    }

    if (t === 'door') {
      const e = edgeAt(g, true);
      if (!e) return;
      let c = Layout.canPlaceDoor(layout, e.o, e.x, e.y);
      if (c.ok && cash < P.door) c = { ok: false, reason: 'Not enough cash' };
      if (Layout.isOuterWall(e.o, e.x, e.y)) p.outerDoor = { o: e.o, x: e.x, y: e.y, ok: c.ok };
      else p.ghostWalls.push({ o: e.o, x: e.x, y: e.y, ok: c.ok, door: true });
      B.info = { title: 'Door', amount: -P.door, ok: c.ok, reason: c.reason, action: 'build' };
      return;
    }

    if (t === 'remove') {
      const e = edgeAt(g, true);
      const onFloor = g.x >= 0 && g.y >= 0 && g.x < W && g.y < D;
      const item = onFloor ? Layout.itemAt(layout, Math.floor(g.x), Math.floor(g.y)) : null;
      const nearEdge = e && (e.onFace || e.dist < 0.2 || !item);
      if (nearEdge && Layout.isEntrance(e.o, e.x, e.y)) {
        p.removeEdge = e;
        B.info = { title: 'Entrance', ok: false, reason: 'The entrance can’t be removed' };
        return;
      }
      if (nearEdge && Layout.doorAt(layout, e.o, e.x, e.y)) {
        p.removeEdge = e;
        B.info = { title: 'Door', amount: refundOf(P.door), ok: true, action: 'sell' };
        return;
      }
      if (nearEdge && Layout.hasWall(layout, e.o, e.x, e.y)) {
        p.removeEdge = e;
        B.info = { title: 'Wall', amount: refundOf(P.wall), ok: true, action: 'sell' };
        return;
      }
      if (item) {
        const fp = Layout.footprint(item.type, item.x, item.y, item.rot);
        p.removeItem = item;
        p.footprints.push(Object.assign({}, fp, { ok: false }));
        B.info = { title: Furniture.items[item.type].name, amount: refundOf(Furniture.items[item.type].price), ok: true, action: 'sell' };
        return;
      }
      if (e && e.onFace) B.info = { title: 'Outer wall', ok: false, reason: 'Outer walls can’t be removed' };
    }
  }

  // ---------- Actions ----------

  function commit() {
    const layout = api.layout();
    const info = B.info;
    const p = B.preview;
    if (!info || !info.ok) return false;
    const t = B.tool;

    if (Furniture.items[t]) {
      const g = p.ghostItems[0];
      const def = Furniture.items[t];
      Layout.addItem(layout, t, g.x, g.y, g.rot);
      api.spend(def.price);
      const fp = Layout.footprint(t, g.x, g.y, g.rot);
      floater(fp.x + fp.w / 2, fp.y + fp.d / 2, -def.price);
    } else if (t === 'wall') {
      const segs = p.ghostWalls.filter(w => w.ok);
      for (const s of segs) Layout.addWall(layout, s.o, s.x, s.y);
      api.spend(segs.length * P.wall);
      const mid = edgeCenter(segs[Math.floor(segs.length / 2)]);
      floater(mid.x, mid.y, -segs.length * P.wall);
    } else if (t === 'door') {
      const e = p.outerDoor || p.ghostWalls[0];
      Layout.addDoor(layout, e.o, e.x, e.y);
      api.spend(P.door);
      const c = edgeCenter(e);
      floater(c.x, c.y, -P.door);
    } else if (t === 'remove') {
      if (p.removeItem) {
        const it = p.removeItem;
        const fp = Layout.footprint(it.type, it.x, it.y, it.rot);
        Layout.removeItem(layout, it);
        api.earn(info.amount);
        floater(fp.x + fp.w / 2, fp.y + fp.d / 2, info.amount);
      } else if (p.removeEdge) {
        const e = p.removeEdge;
        if (Layout.doorAt(layout, e.o, e.x, e.y)) Layout.removeDoor(layout, e.o, e.x, e.y);
        else Layout.removeWall(layout, e.o, e.x, e.y);
        api.earn(info.amount);
        const c = edgeCenter(e);
        floater(c.x, c.y, info.amount);
      }
    }
    api.changed();
    computePreview();
    return true;
  }

  // ---------- Input (called by main.js) ----------

  function onMove(g) {
    B.pointer = g;
    computePreview();
  }

  function onDown(g, button) {
    B.pointer = g;
    if (button === 2) {
      if (B.drag) B.drag = null;
      else setTool(null);
      computePreview();
      return;
    }
    if (B.tool === 'wall') {
      const e = edgeAt(g, false);
      if (e) B.drag = { o: e.o, x: e.x, y: e.y };
      computePreview();
      return;
    }
    computePreview();
    commit();
  }

  function onUp(g) {
    if (B.tool === 'wall' && B.drag) {
      B.pointer = g;
      computePreview();
      commit();
      B.drag = null;
      computePreview();
    }
  }

  function rotate() {
    B.rot = (B.rot + 1) % 4;
    computePreview();
  }

  function update(dt) {
    for (const f of B.floaters) f.age += dt;
    B.floaters = B.floaters.filter(f => f.age < f.life);
  }

  // Esc: stop the current tool first, then leave build mode. Returns true if it did something.
  function cancel() {
    if (B.drag) { B.drag = null; computePreview(); return true; }
    if (B.tool) { setTool(null); return true; }
    if (B.active) { setActive(false); return true; }
    return false;
  }

  // ---------- UI ----------

  function setTool(id) {
    B.tool = id;
    B.drag = null;
    el.tools.forEach((btn) => btn.classList.toggle('active', btn.dataset.tool === id));
    const kind = !id ? 'none' : Furniture.items[id] ? 'item' : id;
    el.hint.textContent = HINTS[kind];
    el.rotate.disabled = !(id && Furniture.items[id]);
    computePreview();
  }

  function setActive(on) {
    B.active = on;
    B.drag = null;
    if (!on) { B.tool = null; B.info = null; B.preview = null; }
    el.bar.classList.toggle('hidden', !on);
    api.onModeChange(on);
    if (on) {
      setTool(null);
      refreshPrices();
      // Icons need the bar to be visible to measure themselves.
      requestAnimationFrame(() => el.icons.forEach(c => Furniture.drawIcon(c, c.dataset.tool)));
    }
  }

  function refreshPrices() {
    const cash = api.money();
    el.tools.forEach(btn => {
      const t = TOOLS.find(x => x.id === btn.dataset.tool);
      btn.classList.toggle('too-expensive', t.price !== null && t.price > cash);
    });
  }

  function buildUI() {
    el.bar = document.getElementById('build-bar');
    el.hint = document.getElementById('build-hint');
    el.rotate = document.getElementById('rotate-btn');
    const groupsEl = document.getElementById('build-tools');
    const groups = {};
    for (const t of TOOLS) {
      if (!groups[t.group]) {
        const g = document.createElement('div');
        g.className = 'tool-group';
        g.innerHTML = `<div class="tool-group-label">${t.group}</div><div class="tool-row"></div>`;
        groupsEl.appendChild(g);
        groups[t.group] = g.querySelector('.tool-row');
      }
      const btn = document.createElement('button');
      btn.className = 'tool' + (t.id === 'remove' ? ' tool-remove' : '');
      btn.dataset.tool = t.id;
      btn.innerHTML = `<canvas data-tool="${t.id}"></canvas><span class="tool-name">${t.name}</span>` +
        `<span class="tool-price">${t.price === null ? 'Sell 50%' : money.format(t.price)}</span>`;
      btn.addEventListener('click', () => setTool(B.tool === t.id ? null : t.id));
      groups[t.group].appendChild(btn);
    }
    el.tools = Array.from(groupsEl.querySelectorAll('.tool'));
    el.icons = Array.from(groupsEl.querySelectorAll('canvas'));
    el.rotate.addEventListener('click', rotate);
    document.getElementById('done-btn').addEventListener('click', () => setActive(false));
  }

  function init(gameApi) {
    api = gameApi;
    buildUI();
  }

  window.Build = {
    init, setActive, setTool, rotate, cancel, update, refreshPrices,
    onMove, onDown, onUp,
    get active() { return B.active; },
    get tool() { return B.tool; },
    get preview() { return B.preview; },
    get info() { return B.info; },
    get floaters() { return B.floaters; },
    formatMoney: (n) => money.format(n),
    addFloater: floater,
  };
})();
