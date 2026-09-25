// Inside a business: an empty room seen from the same isometric angle as the city.
(function () {
  const W = 10;       // room width in tiles (x)
  const D = 8;        // room depth in tiles (y)
  const H = 96;       // wall height in world pixels
  const T = 0.3;      // wall thickness in tiles
  const SLAB = 14;    // floor slab thickness

  const C = {
    floorA: '#e2cfa9',
    floorB: '#d5bf95',
    slab: '#8b6a4f',
    wall: '#f1e6d2',
    wainscot: '#b9573f',
    trim: '#7a3a2a',
    door: '#6d3a28',
    frame: '#4f2c20',
  };

  // Faces of the two back walls that point into the room.
  const backWall = { ax: 0, ay: 0, bx: W, by: 0, shade: 0.86 };  // runs along x, faces +y
  const leftWall = { ax: 0, ay: D, bx: 0, by: 0, shade: 0.7 };   // runs along y, faces +x
  const DOOR = { u0: 0.14, u1: 0.3, h: 66 };

  function doorPoly() {
    const f = leftWall;
    return [
      Iso.facePoint(f.ax, f.ay, f.bx, f.by, DOOR.u0, 0),
      Iso.facePoint(f.ax, f.ay, f.bx, f.by, DOOR.u1, 0),
      Iso.facePoint(f.ax, f.ay, f.bx, f.by, DOOR.u1, DOOR.h),
      Iso.facePoint(f.ax, f.ay, f.bx, f.by, DOOR.u0, DOOR.h),
    ];
  }

  function render(ctx, opts) {
    const light = opts.light;
    const hover = opts.hover;

    // Soft shadow under the diorama
    const c = Iso.toScreen(W / 2, D / 2, -SLAB);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - 30, (W + D) * 15, (W + D) * 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Floor slab
    Iso.box(ctx, 0, 0, W, D, SLAB, { top: Iso.shade(C.floorA), front: Iso.shade(C.slab, 0.95), side: Iso.shade(C.slab, 0.75) }, -SLAB);

    // Checkered floor tiles
    for (let y = 0; y < D; y++) {
      for (let x = 0; x < W; x++) {
        Iso.tile(ctx, x, y, 1, 1, 0, Iso.shade((x + y) % 2 ? C.floorB : C.floorA));
      }
    }

    // Warm light pool in the middle of the room
    const lp = Iso.toScreen(W / 2, D / 2, 0);
    const g = ctx.createRadialGradient(lp.x, lp.y, 10, lp.x, lp.y, 260);
    g.addColorStop(0, 'rgba(255, 236, 190, 0.22)');
    g.addColorStop(1, 'rgba(255, 236, 190, 0)');
    ctx.fillStyle = g;
    Iso.tile(ctx, 0, 0, W, D, 0, null);
    ctx.fill();

    // Hovered floor tile
    if (hover && hover.type === 'tile') {
      Iso.tile(ctx, hover.x, hover.y, 1, 1, 0, 'rgba(255,255,255,0.28)', 'rgba(255,255,255,0.9)');
    }

    // Back wall (upper-right), then left wall (upper-left) which sits in front of it.
    Iso.box(ctx, -T, -T, W + T, T, H, { top: Iso.shade(C.trim, 1.1), front: Iso.shade(C.wall, backWall.shade), side: Iso.shade(C.wall, 0.6) });
    decorateWall(ctx, backWall, light, [[0.18, 0.38], [0.62, 0.82]]);

    Iso.box(ctx, -T, 0, T, D, H, { top: Iso.shade(C.trim, 1.1), front: Iso.shade(C.wall, 0.8), side: Iso.shade(C.wall, leftWall.shade) });
    decorateWall(ctx, leftWall, light, [[0.5, 0.78]]);
    drawDoor(ctx, hover && hover.type === 'door');
  }

  function decorateWall(ctx, face, light, windows) {
    // Wainscot + chair rail
    Iso.faceQuad(ctx, face, 0, 1, 0, 26, Iso.shade(C.wainscot, face.shade));
    Iso.faceQuad(ctx, face, 0, 1, 26, 29, Iso.shade(C.trim, face.shade));
    // Crown moulding
    Iso.faceQuad(ctx, face, 0, 1, H - 5, H, Iso.shade(C.trim, face.shade + 0.1));

    // Windows show the sky outside, so you can see day turn into night.
    for (const [u0, u1] of windows) {
      Iso.faceQuad(ctx, face, u0 - 0.012, u1 + 0.012, 34, 82, Iso.shade(C.frame, face.shade + 0.1));
      const a = Iso.facePoint(face.ax, face.ay, face.bx, face.by, u0, 80);
      const b = Iso.facePoint(face.ax, face.ay, face.bx, face.by, u0, 38);
      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      grad.addColorStop(0, light.skyTop);
      grad.addColorStop(1, light.skyBottom);
      Iso.faceQuad(ctx, face, u0, u1, 38, 80, grad);
      // Mullions
      const mid = (u0 + u1) / 2;
      Iso.faceQuad(ctx, face, mid - 0.004, mid + 0.004, 38, 80, Iso.shade(C.frame, face.shade + 0.1));
      Iso.faceQuad(ctx, face, u0, u1, 58, 60, Iso.shade(C.frame, face.shade + 0.1));
      // Sill
      Iso.faceQuad(ctx, face, u0 - 0.02, u1 + 0.02, 32, 35, Iso.shade('#f7efe0', face.shade + 0.1));
    }
  }

  function drawDoor(ctx, hovered) {
    const f = leftWall;
    if (hovered) {
      ctx.save();
      ctx.shadowColor = 'rgba(255, 210, 90, 0.95)';
      ctx.shadowBlur = 18;
      Iso.poly(ctx, doorPoly(), 'rgba(255, 210, 90, 0.9)');
      ctx.restore();
    }
    Iso.faceQuad(ctx, f, DOOR.u0 - 0.015, DOOR.u1 + 0.015, 0, DOOR.h + 4, Iso.shade(C.frame, 0.8));
    Iso.faceQuad(ctx, f, DOOR.u0, DOOR.u1, 0, DOOR.h, Iso.shade(C.door, hovered ? 1.05 : 0.85));
    Iso.faceQuad(ctx, f, DOOR.u0 + 0.025, DOOR.u1 - 0.025, 34, DOOR.h - 8, Iso.shade('#a9d2e4', 0.8));
    // Handle
    const hp = Iso.facePoint(f.ax, f.ay, f.bx, f.by, DOOR.u1 - 0.03, 30);
    ctx.fillStyle = Iso.shade('#e0b95a');
    ctx.beginPath(); ctx.arc(hp.x, hp.y, 2.2, 0, Math.PI * 2); ctx.fill();

    // EXIT sign above the door
    const sc = Iso.facePoint(f.ax, f.ay, f.bx, f.by, (DOOR.u0 + DOOR.u1) / 2, DOOR.h + 13);
    Iso.faceQuad(ctx, f, DOOR.u0 + 0.01, DOOR.u1 - 0.01, DOOR.h + 7, DOOR.h + 19, '#2f8a57');
    ctx.save();
    ctx.translate(sc.x, sc.y);
    // Along this wall, moving toward the back (−y) goes up-right on screen.
    ctx.transform(1, -0.5, 0, 1, 0, 0);
    ctx.fillStyle = '#eafff1';
    ctx.font = '800 9px "Nunito", "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', 0, 0.5);
    ctx.restore();

    // Door mat
    Iso.tile(ctx, 0.05, D * (1 - DOOR.u1) + 0.05, 0.7, D * (DOOR.u1 - DOOR.u0) - 0.1, 0.5, Iso.shade('#7b4a36'));
  }

  function pick(wx, wy) {
    if (Iso.pointInPoly(wx, wy, doorPoly())) return { type: 'door' };
    const g = Iso.toGrid(wx, wy);
    if (g.x >= 0 && g.y >= 0 && g.x < W && g.y < D) return { type: 'tile', x: Math.floor(g.x), y: Math.floor(g.y) };
    return null;
  }

  function bounds() {
    return {
      minX: Iso.toScreen(-T, D).x,
      maxX: Iso.toScreen(W, -T).x,
      minY: Iso.toScreen(-T, -T, H).y,
      maxY: Iso.toScreen(W, D, -SLAB).y + 30,
    };
  }

  window.Interior = { render, pick, bounds, W, D };
})();
