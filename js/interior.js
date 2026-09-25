// Inside a business: the room, everything built in it, and the build-mode previews.
(function () {
  const W = Layout.W;  // room width in tiles (x)
  const D = Layout.D;  // room depth in tiles (y)
  const H = 96;        // outer wall height in world pixels
  const T = 0.3;       // outer wall thickness in tiles
  const SLAB = 14;     // floor slab thickness

  const C = {
    floorA: '#e2cfa9',
    floorB: '#d5bf95',
    slab: '#8b6a4f',
    wall: '#f1e6d2',
    wainscot: '#b9573f',
    trim: '#7a3a2a',
    door: '#6d3a28',
    frame: '#4f2c20',
    ok: '120, 220, 140',
    bad: '255, 110, 90',
  };

  // Faces of the two back walls that point into the room.
  const backWall = { ax: 0, ay: 0, bx: W, by: 0, shade: 0.86 };  // runs along x, faces +y
  const leftWall = { ax: 0, ay: D, bx: 0, by: 0, shade: 0.7 };   // runs along y, faces +x
  const DOOR_H = 66;

  // Window positions along each back wall, in tiles.
  const WINDOWS = {
    back: [[1.8, 3.8], [6.2, 8.2]],
    left: [[1.8, 4.0]],
  };

  // Where an outer-wall edge sits on its face, as u0..u1.
  function edgeU(o, x, y) {
    return o === 'h' ? [x / W, (x + 1) / W] : [(D - y - 1) / D, (D - y) / D];
  }

  function outerDoorPoly(o, x, y) {
    const f = o === 'h' ? backWall : leftWall;
    const [u0, u1] = edgeU(o, x, y);
    const a = 0.12 / (o === 'h' ? W : D);
    return [
      Iso.facePoint(f.ax, f.ay, f.bx, f.by, u0 + a, 0),
      Iso.facePoint(f.ax, f.ay, f.bx, f.by, u1 - a, 0),
      Iso.facePoint(f.ax, f.ay, f.bx, f.by, u1 - a, DOOR_H),
      Iso.facePoint(f.ax, f.ay, f.bx, f.by, u0 + a, DOOR_H),
    ];
  }

  function entrancePoly() {
    const e = Layout.ENTRANCE;
    return outerDoorPoly(e.o, e.x, e.y);
  }

  // ---------- Room shell ----------

  function drawFloor(ctx) {
    const c = Iso.toScreen(W / 2, D / 2, -SLAB);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - 30, (W + D) * 15, (W + D) * 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    Iso.box(ctx, 0, 0, W, D, SLAB, { top: Iso.shade(C.floorA), front: Iso.shade(C.slab, 0.95), side: Iso.shade(C.slab, 0.75) }, -SLAB);
    for (let y = 0; y < D; y++) {
      for (let x = 0; x < W; x++) {
        Iso.tile(ctx, x, y, 1, 1, 0, Iso.shade((x + y) % 2 ? C.floorB : C.floorA));
      }
    }
    const lp = Iso.toScreen(W / 2, D / 2, 0);
    const g = ctx.createRadialGradient(lp.x, lp.y, 10, lp.x, lp.y, 260);
    g.addColorStop(0, 'rgba(255, 236, 190, 0.22)');
    g.addColorStop(1, 'rgba(255, 236, 190, 0)');
    Iso.tile(ctx, 0, 0, W, D, 0, g);
  }

  function drawGrid(ctx) {
    ctx.strokeStyle = 'rgba(80, 50, 30, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < W; x++) { const a = Iso.toScreen(x, 0), b = Iso.toScreen(x, D); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    for (let y = 1; y < D; y++) { const a = Iso.toScreen(0, y), b = Iso.toScreen(W, y); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    ctx.stroke();
  }

  function overlaps(a0, a1, b0, b1) { return a0 < b1 && b0 < a1; }

  function decorateWall(ctx, face, light, windows, doorRanges) {
    Iso.faceQuad(ctx, face, 0, 1, 0, 26, Iso.shade(C.wainscot, face.shade));
    Iso.faceQuad(ctx, face, 0, 1, 26, 29, Iso.shade(C.trim, face.shade));
    Iso.faceQuad(ctx, face, 0, 1, H - 5, H, Iso.shade(C.trim, face.shade + 0.1));

    // Windows show the sky outside. A door built in the same spot replaces the window.
    for (const [u0, u1] of windows) {
      if (doorRanges.some(r => overlaps(u0 - 0.02, u1 + 0.02, r[0], r[1]))) continue;
      Iso.faceQuad(ctx, face, u0 - 0.012, u1 + 0.012, 34, 82, Iso.shade(C.frame, face.shade + 0.1));
      const a = Iso.facePoint(face.ax, face.ay, face.bx, face.by, u0, 80);
      const b = Iso.facePoint(face.ax, face.ay, face.bx, face.by, u0, 38);
      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      grad.addColorStop(0, light.skyTop);
      grad.addColorStop(1, light.skyBottom);
      Iso.faceQuad(ctx, face, u0, u1, 38, 80, grad);
      const mid = (u0 + u1) / 2;
      Iso.faceQuad(ctx, face, mid - 0.004, mid + 0.004, 38, 80, Iso.shade(C.frame, face.shade + 0.1));
      Iso.faceQuad(ctx, face, u0, u1, 58, 60, Iso.shade(C.frame, face.shade + 0.1));
      Iso.faceQuad(ctx, face, u0 - 0.02, u1 + 0.02, 32, 35, Iso.shade('#f7efe0', face.shade + 0.1));
    }
  }

  // A door in one of the outer walls (the entrance, or a back door you built).
  function drawOuterDoor(ctx, o, x, y, opts) {
    const f = o === 'h' ? backWall : leftWall;
    const [u0, u1] = edgeU(o, x, y);
    const a = 0.12 / (o === 'h' ? W : D);
    const isEntrance = opts.entrance;
    if (opts.glow) {
      ctx.save();
      ctx.shadowColor = opts.glow;
      ctx.shadowBlur = 18;
      Iso.poly(ctx, outerDoorPoly(o, x, y), opts.glow);
      ctx.restore();
    }
    ctx.save();
    if (opts.alpha) ctx.globalAlpha = opts.alpha;
    Iso.faceQuad(ctx, f, u0 + a - 0.015, u1 - a + 0.015, 0, DOOR_H + 4, Iso.shade(C.frame, f.shade + 0.1));
    Iso.faceQuad(ctx, f, u0 + a, u1 - a, 0, DOOR_H, Iso.shade(isEntrance ? C.door : '#7d5a3c', opts.hovered ? 1.2 : f.shade + 0.15));
    Iso.faceQuad(ctx, f, u0 + a + 0.02, u1 - a - 0.02, 34, DOOR_H - 8, Iso.shade('#a9d2e4', f.shade + 0.1));
    const hp = Iso.facePoint(f.ax, f.ay, f.bx, f.by, u1 - a - 0.025, 30);
    ctx.fillStyle = Iso.shade('#e0b95a');
    ctx.beginPath(); ctx.arc(hp.x, hp.y, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    if (isEntrance) {
      const sc = Iso.facePoint(f.ax, f.ay, f.bx, f.by, (u0 + u1) / 2, DOOR_H + 13);
      Iso.faceQuad(ctx, f, u0 + a + 0.01, u1 - a - 0.01, DOOR_H + 7, DOOR_H + 19, '#2f8a57');
      ctx.save();
      ctx.translate(sc.x, sc.y);
      ctx.transform(1, o === 'h' ? 0.5 : -0.5, 0, 1, 0, 0);
      ctx.fillStyle = '#eafff1';
      ctx.font = '800 9px "Nunito", "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('EXIT', 0, 0.5);
      ctx.restore();
    }
  }

  function drawOuterWalls(ctx, light, layout, preview, hover) {
    const outerDoors = layout.doors.filter(d => Layout.isOuterWall(d.o, d.x, d.y));
    const ghost = preview && preview.outerDoor;
    const ranges = (o) => {
      const list = outerDoors.filter(d => d.o === o).map(d => edgeU(d.o, d.x, d.y));
      if (ghost && ghost.o === o && ghost.ok) list.push(edgeU(ghost.o, ghost.x, ghost.y));
      if (Layout.ENTRANCE.o === o) list.push(edgeU(Layout.ENTRANCE.o, Layout.ENTRANCE.x, Layout.ENTRANCE.y));
      return list;
    };
    const toU = (o, list) => list.map(([a, b]) => o === 'h' ? [a / W, b / W] : [(D - b) / D, (D - a) / D]);

    const removing = preview && preview.removeEdge;
    const doorOpts = (d) => {
      const target = removing && Layout.sameEdge(removing, d);
      return { alpha: target ? 0.5 : 0, glow: target ? `rgba(${C.bad}, 0.9)` : null };
    };

    // Back wall (upper-right), then left wall (upper-left) which sits in front of it.
    Iso.box(ctx, -T, -T, W + T, T, H, { top: Iso.shade(C.trim, 1.1), front: Iso.shade(C.wall, backWall.shade), side: Iso.shade(C.wall, 0.6) });
    decorateWall(ctx, backWall, light, toU('h', WINDOWS.back), ranges('h'));
    for (const d of outerDoors) if (d.o === 'h') drawOuterDoor(ctx, d.o, d.x, d.y, doorOpts(d));
    if (ghost && ghost.o === 'h') drawOuterDoor(ctx, ghost.o, ghost.x, ghost.y, { alpha: 0.6, glow: `rgba(${ghost.ok ? C.ok : C.bad}, 0.8)` });

    Iso.box(ctx, -T, 0, T, D, H, { top: Iso.shade(C.trim, 1.1), front: Iso.shade(C.wall, 0.8), side: Iso.shade(C.wall, leftWall.shade) });
    decorateWall(ctx, leftWall, light, toU('v', WINDOWS.left), ranges('v'));
    for (const d of outerDoors) if (d.o === 'v') drawOuterDoor(ctx, d.o, d.x, d.y, doorOpts(d));
    if (ghost && ghost.o === 'v') drawOuterDoor(ctx, ghost.o, ghost.x, ghost.y, { alpha: 0.6, glow: `rgba(${ghost.ok ? C.ok : C.bad}, 0.8)` });

    const e = Layout.ENTRANCE;
    const entranceHover = hover && hover.type === 'door';
    const entranceRemove = removing && Layout.sameEdge(removing, e);
    drawOuterDoor(ctx, e.o, e.x, e.y, {
      entrance: true, hovered: entranceHover,
      glow: entranceHover ? 'rgba(255, 210, 90, 0.95)' : entranceRemove ? `rgba(${C.bad}, 0.9)` : null,
    });
    // Door mat in front of the entrance
    Iso.tile(ctx, 0.05, e.y + 0.08, 0.7, 0.84, 0.5, Iso.shade('#7b4a36'));
  }

  // ---------- Depth sorting ----------

  // a is drawn before b when it lies entirely behind b along x or y.
  function behind(a, b) { return a.x1 <= b.x0 + 1e-6 || a.y1 <= b.y0 + 1e-6; }

  function sortObjects(objs) {
    const n = objs.length;
    const indeg = new Array(n).fill(0);
    const adj = objs.map(() => []);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ab = behind(objs[i], objs[j]), ba = behind(objs[j], objs[i]);
        if (ab && !ba) { adj[i].push(j); indeg[j]++; }
        else if (ba && !ab) { adj[j].push(i); indeg[i]++; }
      }
    }
    const depth = o => o.x0 + o.x1 + o.y0 + o.y1;
    const done = new Array(n).fill(false);
    const out = [];
    for (let k = 0; k < n; k++) {
      let best = -1;
      for (let i = 0; i < n; i++) if (!done[i] && indeg[i] === 0 && (best < 0 || depth(objs[i]) < depth(objs[best]))) best = i;
      if (best < 0) { // cycle (should not happen): fall back to depth order
        for (let i = 0; i < n; i++) if (!done[i] && (best < 0 || depth(objs[i]) < depth(objs[best]))) best = i;
      }
      done[best] = true;
      out.push(objs[best]);
      for (const j of adj[best]) indeg[j]--;
    }
    return out;
  }

  function edgeBounds(e) {
    return e.o === 'h' ? { x0: e.x, x1: e.x + 1, y0: e.y, y1: e.y } : { x0: e.x, x1: e.x, y0: e.y, y1: e.y + 1 };
  }

  function collectObjects(layout, preview, agents, hoverAgent) {
    const objs = [];
    for (const a of agents || []) {
      const r = 0.12;
      objs.push({ x0: a.x - r, x1: a.x + r, y0: a.y - r, y1: a.y + r, kind: 'person', a, alpha: 1, hover: a === hoverAgent });
    }
    const removeItem = preview && preview.removeItem;
    const removeEdge = preview && preview.removeEdge;
    const ghostDoorEdges = (preview && preview.ghostWalls || []).filter(g => g.door && g.ok);

    for (const w of layout.walls) {
      const door = Layout.doorAt(layout, w.o, w.x, w.y) || ghostDoorEdges.some(g => Layout.sameEdge(g, w));
      const target = removeEdge && Layout.sameEdge(removeEdge, w);
      objs.push(Object.assign(edgeBounds(w), { kind: door ? 'doorway' : 'wall', e: w, alpha: target ? 0.45 : 1 }));
    }
    for (const it of layout.items) {
      const fp = Layout.footprint(it.type, it.x, it.y, it.rot);
      objs.push({ x0: fp.x, x1: fp.x + fp.w, y0: fp.y, y1: fp.y + fp.d, kind: 'item', item: it, fp, alpha: removeItem === it ? 0.45 : 1 });
    }
    if (preview) {
      for (const g of preview.ghostItems || []) {
        const fp = Layout.footprint(g.type, g.x, g.y, g.rot);
        objs.push({ x0: fp.x, x1: fp.x + fp.w, y0: fp.y, y1: fp.y + fp.d, kind: 'item', item: g, fp, alpha: g.ok ? 0.7 : 0.4 });
      }
      for (const g of preview.ghostWalls || []) {
        if (g.door || !g.ok) continue;
        objs.push(Object.assign(edgeBounds(g), { kind: 'wall', e: g, alpha: 0.6 }));
      }
    }
    return sortObjects(objs);
  }

  function drawObject(ctx, o) {
    ctx.save();
    ctx.globalAlpha = o.alpha;
    if (o.kind === 'person') People.draw(ctx, o.a, o.hover ? 'rgba(255, 214, 96, 0.9)' : null);
    else if (o.kind === 'item') Furniture.items[o.item.type].draw(ctx, o.fp, o.item.rot);
    else if (o.kind === 'wall') Furniture.drawWall(ctx, o.e);
    else Furniture.drawDoorway(ctx, o.e);
    ctx.restore();
  }

  // ---------- Build previews on the floor ----------

  function edgeStrip(ctx, e, fill) {
    const t = 0.12;
    if (e.o === 'h') Iso.tile(ctx, e.x, e.y - t, 1, t * 2, 0.5, fill);
    else Iso.tile(ctx, e.x - t, e.y, t * 2, 1, 0.5, fill);
  }

  function drawPreviewFloor(ctx, preview) {
    for (const f of preview.footprints || []) {
      const col = f.ok ? C.ok : C.bad;
      Iso.tile(ctx, f.x, f.y, f.w, f.d, 0.5, `rgba(${col}, 0.35)`, `rgba(${col}, 0.95)`);
    }
    for (const g of preview.ghostWalls || []) {
      edgeStrip(ctx, g, `rgba(${g.ok ? C.ok : C.bad}, 0.75)`);
    }
    if (preview.removeEdge) edgeStrip(ctx, preview.removeEdge, `rgba(${C.bad}, 0.85)`);
  }

  function drawFloaters(ctx, floaters) {
    ctx.save();
    ctx.font = '800 15px "Nunito", "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of floaters) {
      const k = f.age / f.life;
      const p = Iso.toScreen(f.x, f.y, 50 + k * 40);
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(20, 14, 18, 0.8)';
      ctx.strokeText(f.text, p.x, p.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, p.x, p.y);
    }
    ctx.restore();
  }

  // ---------- Public ----------

  function render(ctx, opts) {
    const layout = opts.layout;
    const preview = opts.preview;
    drawFloor(ctx);
    if (preview) drawGrid(ctx);
    if (preview) drawPreviewFloor(ctx, preview);
    drawOuterWalls(ctx, opts.light, layout, preview, opts.hover);
    const hoverAgent = opts.hover && opts.hover.type === 'person' ? opts.hover.agent : null;
    for (const o of collectObjects(layout, preview, opts.agents, hoverAgent)) drawObject(ctx, o);
    if (opts.floaters && opts.floaters.length) drawFloaters(ctx, opts.floaters);
  }

  function gridAt(wx, wy) { return Iso.toGrid(wx, wy); }

  function pick(wx, wy, agents) {
    // People first, front-most wins.
    const hit = (agents || []).filter(a => People.hitTest(a, wx, wy)).sort((a, b) => (b.x + b.y) - (a.x + a.y))[0];
    if (hit) return { type: 'person', agent: hit };
    if (Iso.pointInPoly(wx, wy, entrancePoly())) return { type: 'door' };
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

  window.Interior = { render, pick, gridAt, bounds, W, D, WALL_PICK_H: H };
})();
