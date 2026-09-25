// Saving and loading the game state in the browser (localStorage).
(function () {
  const KEY = 'slice-tycoon.save.v1';
  const VERSION = 1;

  function defaultState() {
    return {
      version: VERSION,
      money: 15000,
      // Game time in minutes since the start. Day 1 starts at 08:00.
      time: 8 * 60,
      speed: 1,
      scene: 'city', // 'city' | 'interior'
      activeBusinessId: null,
      camera: null, // filled in by the city on first run
      businesses: [
        { id: 'pizzeria-1', type: 'pizzeria', name: 'My Pizzeria' },
      ],
    };
  }

  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
    if (!raw) return defaultState();
    try {
      const data = JSON.parse(raw);
      const base = defaultState();
      if (!data || data.version !== VERSION) return base;
      if (isNum(data.money)) base.money = data.money;
      if (isNum(data.time) && data.time >= 0) base.time = data.time;
      if ([0, 1, 2, 3].includes(data.speed)) base.speed = data.speed;
      if (Array.isArray(data.businesses) && data.businesses.length) base.businesses = data.businesses;
      if (data.scene === 'interior' && base.businesses.some(b => b.id === data.activeBusinessId)) {
        base.scene = 'interior';
        base.activeBusinessId = data.activeBusinessId;
      }
      const c = data.camera;
      if (c && isNum(c.x) && isNum(c.y) && isNum(c.zoom)) base.camera = { x: c.x, y: c.y, zoom: c.zoom };
      return base;
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(Object.assign({}, state, { version: VERSION, savedAt: Date.now() })));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }

  window.SaveSystem = { load, save, clear, defaultState, KEY };
})();
