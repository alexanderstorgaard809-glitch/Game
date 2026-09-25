// Catalog of things you can build inside a business, and how each one is drawn.
(function () {
  const WALL_H = 50;   // height of walls you build yourself (low enough to see people behind them)
  const WALL_T = 0.14; // thickness in tiles

  const PRICES = { wall: 120, door: 350 };
  const REFUND = 0.5;  // share of the price you get back when removing something

  // Facing direction for each rotation: 0 = toward +y (lower left), 1 = +x (lower right), 2 = -y, 3 = -x.
  const FACING = [[0, 1], [1, 0], [0, -1], [-1, 0]];

  const C = {
    steel: '#b3bcc4',
    steelDark: '#8a949d',
    butcher: '#d8ac72',
    wood: '#94603f',
    woodLight: '#b57a50',
    brick: '#9e4a34',
    dome: '#c26a45',
    cloth: '#c8412f',
    linen: '#f4e8d3',
    wall: '#efe4d0',
    wainscot: '#b9573f',
    trim: '#7a3a2a',
  };

  // Shortcut: box inside a footprint with an inset on every side.
  function inset(fp, i) { return { x: fp.x + i, y: fp.y + i, w: fp.w - i * 2, d: fp.d - i * 2 }; }
  function faceY(b) { return { ax: b.x, ay: b.y + b.d, bx: b.x + b.w, by: b.y + b.d, shade: 0.82 }; }
  function faceX(b) { return { ax: b.x + b.w, ay: b.y + b.d, bx: b.x + b.w, by: b.y, shade: 0.64 }; }

  // ---------- Items ----------

  function drawCounter(ctx, fp) {
    const b = inset(fp, 0.06);
    Iso.box(ctx, b.x, b.y, b.w, b.d, 26, C.steel);
    // Cupboard doors on the visible sides
    const fy = faceY(b), fx = faceX(b);
    const nY = Math.round(b.w * 2), nX = Math.round(b.d * 2);
    for (let i = 0; i < nY; i++) Iso.faceQuad(ctx, fy, (i + 0.1) / nY, (i + 0.9) / nY, 4, 22, null, Iso.shade(C.steelDark, 0.8), 1);
    for (let i = 0; i < nX; i++) Iso.faceQuad(ctx, fx, (i + 0.1) / nX, (i + 0.9) / nX, 4, 22, null, Iso.shade(C.steelDark, 0.6), 1);
    // Butcher-block worktop
    Iso.box(ctx, b.x - 0.03, b.y - 0.03, b.w + 0.06, b.d + 0.06, 4, C.butcher, 26);
    // A ball of dough and a tomato tin on top
    const c = Iso.toScreen(b.x + b.w * 0.3, b.y + b.d * 0.5, 33);
    ctx.fillStyle = Iso.shade('#f3e6c8');
    ctx.beginPath(); ctx.ellipse(c.x, c.y, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
    Iso.box(ctx, b.x + b.w * 0.7 - 0.08, b.y + b.d * 0.5 - 0.08, 0.16, 0.16, 7, '#c9422f', 30);
  }

  function drawOven(ctx, fp, rot) {
    const b = inset(fp, 0.06);
    Iso.box(ctx, b.x, b.y, b.w, b.d, 20, C.brick);
    // Brick courses
    for (const z of [7, 14]) {
      Iso.faceQuad(ctx, faceY(b), 0, 1, z, z + 1, Iso.shade('#6e3222', 0.8));
      Iso.faceQuad(ctx, faceX(b), 0, 1, z, z + 1, Iso.shade('#6e3222', 0.6));
    }
    const cx = fp.x + fp.w / 2, cy = fp.y + fp.d / 2;
    const f = FACING[rot];
    const c = Iso.toScreen(cx, cy, 20);
    const rx = 24 * Math.min(fp.w, fp.d), ry = rx / 2, rh = 26;
    const grad = ctx.createLinearGradient(c.x - rx, c.y - rh, c.x + rx, c.y);
    grad.addColorStop(0, Iso.shade('#d98a5c'));
    grad.addColorStop(1, Iso.shade('#8e4127'));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI);
    ctx.ellipse(c.x, c.y, rx, rh, 0, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    // Chimney at the back
    Iso.box(ctx, cx - f[0] * 0.2 - 0.07, cy - f[1] * 0.2 - 0.07, 0.14, 0.14, 18, '#6f6a6a', 36);
    // Mouth of the oven, only when it faces the viewer
    if (rot === 0 || rot === 1) {
      const m = Iso.toScreen(cx + f[0] * 0.36, cy + f[1] * 0.36, 21);
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.transform(1, rot === 0 ? 0.5 : -0.5, 0, 1, 0, 0);
      ctx.fillStyle = '#2a1510';
      ctx.beginPath(); ctx.ellipse(0, 0, 8, 9, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = Iso.glow('#ff9a3c');
      ctx.beginPath(); ctx.ellipse(0, 0, 5, 5, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function drawRegister(ctx, fp, rot) {
    const b = inset(fp, 0.08);
    Iso.box(ctx, b.x, b.y, b.w, b.d, 26, C.wood);
    Iso.faceQuad(ctx, faceY(b), 0.12, 0.88, 6, 20, null, Iso.shade('#5e3a26', 0.8), 1);
    Iso.faceQuad(ctx, faceX(b), 0.12, 0.88, 6, 20, null, Iso.shade('#5e3a26', 0.6), 1);
    Iso.box(ctx, b.x - 0.03, b.y - 0.03, b.w + 0.06, b.d + 0.06, 4, C.linen, 26);
    // Till: drawer + screen facing the customer side
    const cx = fp.x + fp.w / 2, cy = fp.y + fp.d / 2;
    Iso.box(ctx, cx - 0.2, cy - 0.2, 0.4, 0.4, 7, '#3b3a44', 30);
    const f = FACING[rot];
    const sx = cx - f[0] * 0.12, sy = cy - f[1] * 0.12;
    const sw = f[0] === 0 ? 0.34 : 0.08, sd = f[0] === 0 ? 0.08 : 0.34;
    Iso.box(ctx, sx - sw / 2, sy - sd / 2, sw, sd, 9, { top: Iso.shade('#2b2a33'), front: Iso.glow('#6fe0a0', 0.9), side: Iso.glow('#6fe0a0', 0.75) }, 37);
  }

  function drawTable(ctx, fp) {
    const cx = fp.x + fp.w / 2, cy = fp.y + fp.d / 2;
    Iso.box(ctx, cx - 0.2, cy - 0.2, 0.4, 0.4, 2, '#3b3530');
    Iso.box(ctx, cx - 0.05, cy - 0.05, 0.1, 0.1, 22, '#3b3530', 2);
    const t = inset(fp, 0.1);
    Iso.box(ctx, t.x, t.y, t.w, t.d, 5, C.cloth, 22);
    Iso.tile(ctx, t.x + 0.12, t.y + 0.12, t.w - 0.24, t.d - 0.24, 27, Iso.shade(C.linen));
    // Little oil bottle
    Iso.box(ctx, cx - 0.04, cy - 0.04, 0.08, 0.08, 7, '#9fb04a', 27);
  }

  function drawChair(ctx, fp, rot) {
    const cx = fp.x + fp.w / 2, cy = fp.y + fp.d / 2;
    const f = FACING[rot];
    const s = 0.22;
    const back = () => {
      const bx = cx - f[0] * s, by = cy - f[1] * s;
      if (f[0] === 0) Iso.box(ctx, cx - s, by - 0.035, s * 2, 0.07, 18, C.wood, 16);
      else Iso.box(ctx, bx - 0.035, cy - s, 0.07, s * 2, 18, C.wood, 16);
    };
    const backIsBehind = f[0] > 0 || f[1] > 0; // backrest on the -x or -y side
    if (backIsBehind) back();
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      Iso.box(ctx, cx + dx * (s - 0.03) - 0.025, cy + dy * (s - 0.03) - 0.025, 0.05, 0.05, 13, '#5c3a26');
    }
    Iso.box(ctx, cx - s, cy - s, s * 2, s * 2, 3, C.woodLight, 13);
    if (!backIsBehind) back();
  }

  const items = {
    counter: { name: 'Kitchen counter', price: 450, w: 2, d: 1, draw: drawCounter, group: 'Kitchen' },
    oven: { name: 'Pizza oven', price: 2400, w: 1, d: 1, draw: drawOven, group: 'Kitchen' },
    register: { name: 'Cash register', price: 650, w: 1, d: 1, draw: drawRegister, group: 'Kitchen' },
    table: { name: 'Dining table', price: 220, w: 1, d: 1, draw: drawTable, group: 'Dining' },
    chair: { name: 'Chair', price: 75, w: 1, d: 1, draw: drawChair, group: 'Dining' },
  };

  // ---------- Walls and doorways you build ----------

  const wallColors = () => ({ top: Iso.shade(C.trim, 1.1), front: Iso.shade(C.wall, 0.86), side: Iso.shade(C.wall, 0.7) });

  function wallBox(e, from, to, z0, h, colors) {
    const t = WALL_T / 2;
    return e.o === 'h'
      ? [e.x + from - (from === 0 ? t : 0), e.y - t, to - from + (from === 0 ? t : 0) + (to === 1 ? t : 0), WALL_T, h, colors, z0]
      : [e.x - t, e.y + from - (from === 0 ? t : 0), WALL_T, to - from + (from === 0 ? t : 0) + (to === 1 ? t : 0), h, colors, z0];
  }

  function drawWall(ctx, e) {
    const b = wallBox(e, 0, 1, 0, WALL_H, wallColors());
    Iso.box(ctx, ...b);
    // Wainscot band on the side facing the viewer
    const face = e.o === 'h'
      ? { ax: b[0], ay: b[1] + b[3], bx: b[0] + b[2], by: b[1] + b[3], shade: 0.86 }
      : { ax: b[0] + b[2], ay: b[1] + b[3], bx: b[0] + b[2], by: b[1], shade: 0.7 };
    Iso.faceQuad(ctx, face, 0, 1, 0, 20, Iso.shade(C.wainscot, face.shade));
    Iso.faceQuad(ctx, face, 0, 1, 20, 22, Iso.shade(C.trim, face.shade));
  }

  // An open doorway in a wall you built: two posts and a lintel.
  function drawDoorway(ctx, e) {
    const post = 0.12;
    Iso.tile(ctx, e.o === 'h' ? e.x + post : e.x - WALL_T / 2, e.o === 'h' ? e.y - WALL_T / 2 : e.y + post,
      e.o === 'h' ? 1 - post * 2 : WALL_T, e.o === 'h' ? WALL_T : 1 - post * 2, 0.5, Iso.shade('#7b4a36'));
    Iso.box(ctx, ...wallBox(e, 0, post, 0, WALL_H, wallColors()));
    Iso.box(ctx, ...wallBox(e, post, 1 - post, WALL_H - 9, 9, wallColors()));
    Iso.box(ctx, ...wallBox(e, 1 - post, 1, 0, WALL_H, wallColors()));
  }

  // ---------- Toolbar icons ----------

  function drawIcon(canvas, tool) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = canvas.clientWidth || 56, ch = canvas.clientHeight || 44;
    canvas.width = cw * dpr; canvas.height = ch * dpr;
    const ctx = canvas.getContext('2d');
    const def = items[tool];
    const fp = def ? { x: 0, y: 0, w: def.w, d: def.d } : { x: 0, y: 0, w: 1, d: 1 };
    const center = Iso.toScreen(fp.w / 2, fp.d / 2, 16);
    const scale = def && def.w > 1 ? 0.55 : 0.72;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (cw / 2 - center.x * scale), dpr * (ch / 2 - center.y * scale + 4));
    const prev = Iso.getAmbient();
    Iso.setAmbient([1, 1, 1]);
    Iso.tile(ctx, fp.x, fp.y, fp.w, fp.d, 0, 'rgba(255,255,255,0.08)');
    if (def) def.draw(ctx, fp, 0);
    else if (tool === 'wall') drawWall(ctx, { o: 'h', x: 0, y: 0.5 });
    else if (tool === 'door') drawDoorway(ctx, { o: 'h', x: 0, y: 0.5 });
    else if (tool === 'remove') {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = '#ff8a73';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cw / 2 - 9, ch / 2 - 9); ctx.lineTo(cw / 2 + 9, ch / 2 + 9);
      ctx.moveTo(cw / 2 + 9, ch / 2 - 9); ctx.lineTo(cw / 2 - 9, ch / 2 + 9);
      ctx.stroke();
    }
    Iso.setAmbient(prev);
  }

  window.Furniture = {
    items, PRICES, REFUND, FACING, WALL_H, WALL_T,
    drawWall, drawDoorway, drawIcon,
  };
})();
