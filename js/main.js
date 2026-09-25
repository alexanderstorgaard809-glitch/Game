// Game loop, input, camera, HUD and scene switching.
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const SPEEDS = [0, 2, 6, 20];       // game minutes per real second
  const AUTOSAVE_MS = 5000;
  const MIN_ZOOM = 0.45, MAX_ZOOM = 2.2;
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const el = {
    money: document.getElementById('money'),
    day: document.getElementById('day'),
    clock: document.getElementById('clock'),
    location: document.getElementById('location'),
    speedBtns: Array.from(document.querySelectorAll('.speed button')),
    cityActions: document.getElementById('city-actions'),
    interiorActions: document.getElementById('interior-actions'),
    roomTitle: document.getElementById('room-title'),
    helpCity: document.getElementById('help-city'),
    helpInterior: document.getElementById('help-interior'),
    saveStatus: document.getElementById('save-status'),
    tooltip: document.getElementById('tooltip'),
    fade: document.getElementById('fade'),
  };

  let state = SaveSystem.load();
  let lastSpeed = state.speed || 1;
  const view = { w: 0, h: 0, dpr: 1 };
  let cam = null;             // city camera { x, y, zoom } in world pixels
  let camTarget = null;       // smooth camera move target
  let hover = null;
  const mouse = { x: -1, y: -1, inside: false };
  let drag = null;
  const keys = new Set();
  let transitioning = false;
  let resetting = false;
  let lastSaveAt = -Infinity;
  let clockT = 0;             // real seconds, for animations

  // ---------- Setup ----------

  function initCamera() {
    if (state.camera) {
      cam = Object.assign({}, state.camera);
    } else {
      const c = City.businessCenter('pizzeria-1');
      const zoom = Math.max(0.7, Math.min(1.25, window.innerWidth / 1300));
      cam = { x: c.x, y: c.y, zoom };
    }
    clampCamera();
  }

  function resize() {
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);
    if (cam) clampCamera();
  }

  function clampCamera() {
    const b = City.bounds();
    cam.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom));
    cam.x = Math.max(b.minX, Math.min(b.maxX, cam.x));
    cam.y = Math.max(b.minY, Math.min(b.maxY, cam.y));
  }

  // Interior uses a fixed camera that fits the room on screen.
  function interiorCamera() {
    const b = Interior.bounds();
    const bw = b.maxX - b.minX, bh = b.maxY - b.minY;
    const zoom = Math.max(0.5, Math.min(2.0, Math.min((view.w - 60) / bw, (view.h - 190) / bh)));
    return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 - 8 / zoom, zoom };
  }

  function activeCamera() { return state.scene === 'interior' ? interiorCamera() : cam; }

  function screenToWorld(sx, sy) {
    const c = activeCamera();
    return { x: (sx - view.w / 2) / c.zoom + c.x, y: (sy - view.h / 2) / c.zoom + c.y };
  }

  // ---------- Scenes ----------

  function business(id) { return state.businesses.find(b => b.id === id); }

  function switchScene(fn) {
    if (transitioning) return;
    transitioning = true;
    el.fade.classList.add('on');
    setTimeout(() => {
      fn();
      hover = null;
      updateSceneUI();
      saveNow();
      el.fade.classList.remove('on');
      setTimeout(() => { transitioning = false; }, 220);
    }, 230);
  }

  function enterBusiness(id) {
    switchScene(() => {
      state.scene = 'interior';
      state.activeBusinessId = id;
    });
  }

  function exitToCity() {
    switchScene(() => {
      state.scene = 'city';
      state.activeBusinessId = null;
    });
  }

  function updateSceneUI() {
    const inside = state.scene === 'interior';
    el.cityActions.classList.toggle('hidden', inside);
    el.interiorActions.classList.toggle('hidden', !inside);
    el.helpCity.classList.toggle('hidden', inside);
    el.helpInterior.classList.toggle('hidden', !inside);
    const b = inside ? business(state.activeBusinessId) : null;
    el.location.textContent = inside ? `Inside ${b ? b.name : 'business'}` : 'City map · Downtown';
    if (b) el.roomTitle.textContent = b.name;
    el.tooltip.classList.add('hidden');
    canvas.classList.remove('pointer');
  }

  // ---------- Saving ----------

  function saveNow() {
    if (resetting) return;
    state.camera = { x: Math.round(cam.x * 10) / 10, y: Math.round(cam.y * 10) / 10, zoom: Math.round(cam.zoom * 1000) / 1000 };
    const ok = SaveSystem.save(state);
    lastSaveAt = performance.now();
    const t = new Date();
    el.saveStatus.textContent = ok
      ? `Auto-saved ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`
      : 'Saving is blocked by the browser';
    el.saveStatus.classList.add('flash');
    setTimeout(() => el.saveStatus.classList.remove('flash'), 700);
  }

  // ---------- HUD ----------

  const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const hudCache = {};
  function setText(node, key, text) {
    if (hudCache[key] !== text) { hudCache[key] = text; node.textContent = text; }
  }

  function updateHUD() {
    const total = Math.floor(state.time);
    const day = Math.floor(total / 1440) + 1;
    const minuteOfDay = total % 1440;
    const hh = Math.floor(minuteOfDay / 60);
    const mm = Math.floor((minuteOfDay % 60) / 5) * 5;
    setText(el.money, 'money', moneyFmt.format(state.money));
    setText(el.day, 'day', String(day));
    setText(el.clock, 'clock', `${DAYS[(day - 1) % 7]} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
    const speedKey = 'speed' + state.speed;
    if (hudCache.speed !== speedKey) {
      hudCache.speed = speedKey;
      el.speedBtns.forEach(b => {
        const s = Number(b.dataset.speed);
        b.classList.toggle('active', s === state.speed);
        b.classList.toggle('paused', s === 0 && state.speed === 0);
      });
    }
  }

  function setSpeed(s) {
    if (s > 0) lastSpeed = s;
    state.speed = s;
    updateHUD();
    saveNow();
  }

  // ---------- Hover / tooltip ----------

  function updateHover() {
    if (transitioning || !mouse.inside || (drag && drag.moved)) {
      hover = null;
    } else {
      const w = screenToWorld(mouse.x, mouse.y);
      if (state.scene === 'city') {
        hover = City.pick(w.x, w.y);
      } else {
        hover = Interior.pick(w.x, w.y);
      }
    }

    let html = null;
    let pointer = false;
    if (state.scene === 'city' && hover) {
      const b = business(hover);
      html = `<b>${b ? b.name : 'Business'}</b><small>Click to go inside</small>`;
      pointer = true;
    } else if (state.scene === 'interior' && hover && hover.type === 'door') {
      html = '<b>Exit</b><small>Back to the city map</small>';
      pointer = true;
    }
    canvas.classList.toggle('pointer', pointer);
    if (html) {
      el.tooltip.innerHTML = html;
      el.tooltip.style.left = mouse.x + 'px';
      el.tooltip.style.top = mouse.y + 'px';
      el.tooltip.classList.remove('hidden');
    } else {
      el.tooltip.classList.add('hidden');
    }
  }

  // ---------- Input ----------

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0 && e.button !== 2) return;
    drag = { sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, moved: false, button: e.button };
  });

  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.inside = e.target === canvas;
    if (drag && state.scene === 'city') {
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) > 4) {
        drag.moved = true;
        canvas.classList.add('dragging');
      }
      if (drag.moved) {
        camTarget = null;
        cam.x = drag.cx - dx / cam.zoom;
        cam.y = drag.cy - dy / cam.zoom;
        clampCamera();
      }
    }
  });

  window.addEventListener('mouseup', e => {
    if (!drag) return;
    const wasClick = !drag.moved && drag.button === 0 && e.target === canvas;
    drag = null;
    canvas.classList.remove('dragging');
    if (!wasClick || transitioning) return;
    const w = screenToWorld(e.clientX, e.clientY);
    if (state.scene === 'city') {
      const id = City.pick(w.x, w.y);
      if (id) enterBusiness(id);
    } else {
      const hit = Interior.pick(w.x, w.y);
      if (hit && hit.type === 'door') exitToCity();
    }
  });

  canvas.addEventListener('mouseleave', () => { mouse.inside = false; });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    if (state.scene !== 'city') return;
    camTarget = null;
    const before = screenToWorld(e.clientX, e.clientY);
    cam.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * Math.exp(-e.deltaY * 0.0015)));
    cam.x = before.x - (e.clientX - view.w / 2) / cam.zoom;
    cam.y = before.y - (e.clientY - view.h / 2) / cam.zoom;
    clampCamera();
  }, { passive: false });

  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); setSpeed(state.speed === 0 ? lastSpeed : 0); return; }
    if (k === '1' || k === '2' || k === '3') { setSpeed(Number(k)); return; }
    if (k === 'escape' && state.scene === 'interior') { exitToCity(); return; }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      e.preventDefault();
      keys.add(k);
    }
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  el.speedBtns.forEach(b => b.addEventListener('click', () => setSpeed(Number(b.dataset.speed))));
  document.getElementById('back-btn').addEventListener('click', exitToCity);
  document.getElementById('focus-btn').addEventListener('click', () => {
    const c = City.businessCenter('pizzeria-1');
    camTarget = { x: c.x, y: c.y };
  });
  // In-page confirmation (browser dialogs can be blocked when the game is embedded).
  const resetBtn = document.getElementById('reset-btn');
  const resetConfirm = document.getElementById('reset-confirm');
  function showResetConfirm(show) {
    resetBtn.classList.toggle('hidden', show);
    resetConfirm.classList.toggle('hidden', !show);
    el.saveStatus.classList.toggle('hidden', show);
  }
  resetBtn.addEventListener('click', () => showResetConfirm(true));
  document.getElementById('reset-no').addEventListener('click', () => showResetConfirm(false));
  document.getElementById('reset-yes').addEventListener('click', () => {
    resetting = true;
    SaveSystem.clear();
    location.reload();
  });

  window.addEventListener('resize', resize);
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

  // ---------- Loop ----------

  function update(dt) {
    clockT += dt;
    state.time += SPEEDS[state.speed] * dt;

    if (state.scene === 'city') {
      let dx = 0, dy = 0;
      if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
      if (keys.has('d') || keys.has('arrowright')) dx += 1;
      if (keys.has('w') || keys.has('arrowup')) dy -= 1;
      if (keys.has('s') || keys.has('arrowdown')) dy += 1;
      if (dx || dy) {
        camTarget = null;
        const speed = 700 / cam.zoom;
        cam.x += dx * speed * dt;
        cam.y += dy * speed * dt;
        clampCamera();
      }
      if (camTarget) {
        const k = 1 - Math.exp(-dt * 6);
        cam.x += (camTarget.x - cam.x) * k;
        cam.y += (camTarget.y - cam.y) * k;
        if (Math.hypot(camTarget.x - cam.x, camTarget.y - cam.y) < 0.5) camTarget = null;
        clampCamera();
      }
    }

    if (performance.now() - lastSaveAt > AUTOSAVE_MS) saveNow();
    updateHover();
    updateHUD();
  }

  function render() {
    const minuteOfDay = Math.floor(state.time) % 1440;
    const light = City.lighting(minuteOfDay);
    const inside = state.scene === 'interior';

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, view.h);
    if (inside) {
      bg.addColorStop(0, '#2a2230');
      bg.addColorStop(1, '#171219');
    } else {
      bg.addColorStop(0, light.skyTop);
      bg.addColorStop(1, light.skyBottom);
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, view.w, view.h);

    const c = activeCamera();
    ctx.setTransform(
      view.dpr * c.zoom, 0, 0, view.dpr * c.zoom,
      view.dpr * (view.w / 2 - c.x * c.zoom),
      view.dpr * (view.h / 2 - c.y * c.zoom)
    );

    if (inside) {
      Iso.setAmbient([1, 1, 1]);
      Interior.render(ctx, { light, hover });
    } else {
      Iso.setAmbient(light.ambient);
      City.render(ctx, { light, hover, t: clockT });
      Iso.setAmbient([1, 1, 1]);
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  resize();
  initCamera();
  updateSceneUI();
  updateHUD();
  requestAnimationFrame(frame);

  // Handy for debugging in the browser console.
  window.Game = { get state() { return state; }, saveNow };
})();
