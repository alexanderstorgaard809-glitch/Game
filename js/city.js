// The city map: roads, blocks, buildings, parks and the player's pizzeria.
(function () {
  const PERIOD = 7;          // a road every 7 tiles
  const BLOCKS = 4;          // 4 x 4 city blocks
  const N = PERIOD * BLOCKS + 1; // map size in tiles (29)
  const CURB = 4;            // sidewalk height in world pixels

  const C = {
    asphalt: '#4b4852',
    marking: '#ebe3cf',
    sidewalk: '#cfc6b5',
    curbSide: '#a79d8b',
    grass: '#86b35c',
    grassDark: '#6f9a4a',
    path: '#dccfb3',
    soil: '#6a5040',
    water: '#6fb8d6',
    trunk: '#7a5236',
    leaf: '#5f9a45',
    leafLight: '#78b554',
    glass: '#9fc6da',
    glassDark: '#3b4658',
    lit: '#ffd88a',
  };

  const BUILDING_COLORS = {
    apartment: ['#c9795b', '#b8674d', '#d69a6b', '#a95e4a', '#c4a27a', '#9f7b64'],
    office: ['#8aa3b5', '#7d93a8', '#a3b4bf', '#6f8799'],
    shop: ['#e7d3b0', '#d9c29a', '#efe1c6', '#cdb99a'],
  };
  const AWNINGS = ['#3f8f7a', '#2f6fa3', '#d3a13b', '#8a4f9c', '#4b8f45'];

  // Blocks with a fixed purpose. Everything else is generated.
  const PIZZERIA_BLOCK = '1,1';
  const PARKS = { '1,2': true, '3,0': true };
  const LOW_BLOCKS = { '2,2': true, '0,2': true }; // keep the view onto the pizzeria clear

  let buildings = [];
  let trees = [];
  let lamps = [];
  let parks = [];
  let benches = [];
  let fountains = [];
  let pizzeria = null;

  function isRoad(x, y) { return x % PERIOD === 0 || y % PERIOD === 0; }

  function addBuilding(lot, type, h, rand, id) {
    const inset = 0.3;
    const colors = BUILDING_COLORS[type];
    buildings.push({
      id,
      type,
      x: lot.x + inset, y: lot.y + inset,
      w: lot.w - inset * 2, d: lot.d - inset * 2,
      h,
      color: colors[Math.floor(rand() * colors.length)],
      awning: AWNINGS[Math.floor(rand() * AWNINGS.length)],
      roofProps: type === 'shop' ? 0 : 1 + Math.floor(rand() * 3),
      seed: Math.floor(rand() * 100000),
    });
  }

  function pickType(lot, rand, low) {
    const big = lot.w * lot.d >= 18;
    const r = rand();
    if (low) {
      return r < 0.6 ? ['shop', 32 + Math.floor(rand() * 8)] : ['apartment', 50 + Math.floor(rand() * 12)];
    }
    if (big && r < 0.45) return ['office', 120 + Math.floor(rand() * 90)];
    if (r < 0.3) return ['shop', 32 + Math.floor(rand() * 10)];
    if (r < 0.8) return ['apartment', 60 + Math.floor(rand() * 60)];
    return ['office', 90 + Math.floor(rand() * 70)];
  }

  function build() {
    buildings = []; trees = []; lamps = []; parks = []; benches = []; fountains = [];
    const rand = Iso.rng(20240917);
    let nextId = 0;

    for (let bj = 0; bj < BLOCKS; bj++) {
      for (let bi = 0; bi < BLOCKS; bi++) {
        const bx = bi * PERIOD + 1;
        const by = bj * PERIOD + 1;
        const key = bi + ',' + bj;
        const S = PERIOD - 1; // 6

        if (key === PIZZERIA_BLOCK) {
          // Pizzeria on the front-left lot, facing the road toward the viewer.
          pizzeria = {
            id: 'pizzeria-1',
            x: bx + 0.45, y: by + 3.35, w: 2.4, d: 2.3, h: 44,
          };
          addBuilding({ x: bx, y: by, w: 3, d: 3 }, 'apartment', 62, rand, 'b' + nextId++);
          addBuilding({ x: bx + 3, y: by, w: 3, d: 3 }, 'apartment', 54, rand, 'b' + nextId++);
          addBuilding({ x: bx + 3, y: by + 3, w: 3, d: 3 }, 'shop', 36, rand, 'b' + nextId++);
          continue;
        }

        if (PARKS[key]) {
          parks.push({ x: bx, y: by, w: S, d: S });
          fountains.push({ x: bx + 3, y: by + 3 });
          // Trees around the edges, but none in the front-top corner that faces the pizzeria.
          const spots = [
            [0.8, 0.8], [2.0, 0.6], [4.2, 0.7], [5.3, 1.2], [5.2, 4.4], [4.6, 5.3],
            [0.7, 2.2], [1.3, 5.2], [5.4, 2.6], [2.2, 4.8],
          ];
          for (const s of spots) {
            if (key === '1,2' && s[0] < 2.5 && s[1] < 2.5) continue;
            trees.push({ x: bx + s[0], y: by + s[1], size: 0.8 + rand() * 0.4 });
          }
          benches.push({ x: bx + 3, y: by + 1.6, dir: 'x' });
          benches.push({ x: bx + 1.6, y: by + 3, dir: 'y' });
          continue;
        }

        const low = !!LOW_BLOCKS[key];
        const pattern = Math.floor(rand() * 4);
        let lots;
        if (pattern === 0) {
          lots = [{ x: bx, y: by, w: 3, d: 3 }, { x: bx + 3, y: by, w: 3, d: 3 }, { x: bx, y: by + 3, w: 3, d: 3 }, { x: bx + 3, y: by + 3, w: 3, d: 3 }];
        } else if (pattern === 1) {
          lots = [{ x: bx, y: by, w: 6, d: 3 }, { x: bx, y: by + 3, w: 3, d: 3 }, { x: bx + 3, y: by + 3, w: 3, d: 3 }];
        } else if (pattern === 2) {
          lots = [{ x: bx, y: by, w: 3, d: 6 }, { x: bx + 3, y: by, w: 3, d: 3 }, { x: bx + 3, y: by + 3, w: 3, d: 3 }];
        } else {
          lots = low
            ? [{ x: bx, y: by, w: 6, d: 3 }, { x: bx, y: by + 3, w: 6, d: 3 }]
            : [{ x: bx + 1, y: by + 1, w: 4, d: 4 }];
          if (!low) {
            // Tower with a small plaza and trees around it.
            trees.push({ x: bx + 0.7, y: by + 5.3, size: 0.8 }, { x: bx + 5.3, y: by + 0.7, size: 0.8 }, { x: bx + 5.3, y: by + 5.3, size: 0.9 });
          }
        }
        for (const lot of lots) {
          let [type, h] = pickType(lot, rand, low);
          if (!low && lots.length === 1) { type = 'office'; h = 190 + Math.floor(rand() * 60); }
          addBuilding(lot, type, h, rand, 'b' + nextId++);
        }
      }
    }

    // Street lamps on every block corner.
    for (let bj = 0; bj < BLOCKS; bj++) {
      for (let bi = 0; bi < BLOCKS; bi++) {
        const bx = bi * PERIOD + 1, by = bj * PERIOD + 1, S = PERIOD - 1;
        lamps.push({ x: bx + 0.12, y: by + 0.12 }, { x: bx + S - 0.12, y: by + 0.12 }, { x: bx + 0.12, y: by + S - 0.12 }, { x: bx + S - 0.12, y: by + S - 0.12 });
      }
    }
  }

  // ---------- Time of day ----------

  function mix(a, b, t) { return a + (b - a) * t; }
  function mixHex(h1, h2, t) {
    const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
    const r = Math.round(mix((a >> 16) & 255, (b >> 16) & 255, t));
    const g = Math.round(mix((a >> 8) & 255, (b >> 8) & 255, t));
    const bl = Math.round(mix(a & 255, b & 255, t));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }

  // Returns darkness 0 (day) .. 1 (night) and a dusk amount for warm light.
  function lighting(minuteOfDay) {
    const h = minuteOfDay / 60;
    let night;
    if (h < 5) night = 1;
    else if (h < 7) night = 1 - (h - 5) / 2;
    else if (h < 18) night = 0;
    else if (h < 21) night = (h - 18) / 3;
    else night = 1;
    const dusk = Math.sin(Math.PI * night) * (h > 12 ? 1 : 0.6);
    const ambient = [
      mix(1, 0.4, night) + dusk * 0.12,
      mix(1, 0.45, night) - dusk * 0.02,
      mix(1, 0.72, night) - dusk * 0.12,
    ];
    const skyTop = mixHex(mixHex('#8fc6e3', '#0f1430', night), '#5a4f8f', dusk * 0.6);
    const skyBottom = mixHex(mixHex('#d8eef5', '#232a4d', night), '#f4a66a', dusk * 0.75);
    return { night, dusk, ambient, skyTop, skyBottom };
  }

  // ---------- Drawing ----------

  function drawGround(ctx, light) {
    // Diorama base
    Iso.box(ctx, 0, 0, N, N, 22, { top: Iso.shade(C.asphalt), front: Iso.shade(C.soil, 0.95), side: Iso.shade(C.soil, 0.75) }, -22);

    // Road markings
    ctx.lineCap = 'butt';
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (!isRoad(x, y)) continue;
        const xr = x % PERIOD === 0, yr = y % PERIOD === 0;
        if (xr && yr) continue; // intersection
        const edge = xr ? (y % PERIOD === 1 || y % PERIOD === PERIOD - 1) : (x % PERIOD === 1 || x % PERIOD === PERIOD - 1);
        if (edge) {
          // Zebra crossing
          for (let i = 0; i < 5; i++) {
            const o = 0.1 + i * 0.17;
            if (xr) Iso.tile(ctx, x + o, y + 0.2, 0.09, 0.6, 0, Iso.shade(C.marking, 0.95));
            else Iso.tile(ctx, x + 0.2, y + o, 0.6, 0.09, 0, Iso.shade(C.marking, 0.95));
          }
        } else if (xr) {
          Iso.tile(ctx, x + 0.47, y + 0.2, 0.06, 0.6, 0, Iso.shade(C.marking, 0.85));
        } else {
          Iso.tile(ctx, x + 0.2, y + 0.47, 0.6, 0.06, 0, Iso.shade(C.marking, 0.85));
        }
      }
    }

    // Blocks (raised sidewalks)
    for (let bj = 0; bj < BLOCKS; bj++) {
      for (let bi = 0; bi < BLOCKS; bi++) {
        const bx = bi * PERIOD + 1, by = bj * PERIOD + 1, S = PERIOD - 1;
        Iso.box(ctx, bx, by, S, S, CURB, { top: Iso.shade(C.sidewalk), front: Iso.shade(C.curbSide), side: Iso.shade(C.curbSide, 0.85) });
        // subtle paving grid
        ctx.strokeStyle = Iso.shade(C.sidewalk, 0.93);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 1; i < S; i++) {
          let a = Iso.toScreen(bx + i, by, CURB), b = Iso.toScreen(bx + i, by + S, CURB);
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          a = Iso.toScreen(bx, by + i, CURB); b = Iso.toScreen(bx + S, by + i, CURB);
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
      }
    }

    // Parks
    for (const p of parks) {
      Iso.box(ctx, p.x + 0.25, p.y + 0.25, p.w - 0.5, p.d - 0.5, 3, { top: Iso.shade(C.grass), front: Iso.shade(C.grassDark), side: Iso.shade(C.grassDark, 0.85) }, CURB);
      const z = CURB + 3;
      Iso.tile(ctx, p.x + 2.6, p.y + 0.25, 0.8, p.d - 0.5, z, Iso.shade(C.path));
      Iso.tile(ctx, p.x + 0.25, p.y + 2.6, p.w - 0.5, 0.8, z, Iso.shade(C.path));
    }

    // Pizzeria forecourt: a warm doormat of tiles in front of the shop
    const pz = pizzeria;
    Iso.tile(ctx, pz.x + 0.9, pz.y + pz.d, 0.6, 0.3, CURB, Iso.shade('#b5533c', 0.9));

    // Lamp light pools at night
    if (light.night > 0.3) {
      const a = (light.night - 0.3) / 0.7;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const l of lamps) {
        const p = Iso.toScreen(l.x, l.y, CURB);
        const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 46);
        g.addColorStop(0, `rgba(255,200,120,${0.35 * a})`);
        g.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 46, 23, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function faces(b) {
    return {
      front: { ax: b.x, ay: b.y + b.d, bx: b.x + b.w, by: b.y + b.d, len: b.w, shade: 0.82 },
      side: { ax: b.x + b.w, ay: b.y + b.d, bx: b.x + b.w, by: b.y, len: b.d, shade: 0.64 },
    };
  }

  function windowColor(lit, faceShade) {
    return lit ? Iso.glow(C.lit, faceShade > 0.7 ? 1 : 0.9) : Iso.shade(C.glass, faceShade * 1.05);
  }

  function drawBuilding(ctx, b, light) {
    const z0 = CURB;
    Iso.box(ctx, b.x, b.y, b.w, b.d, b.h, b.color, z0);
    const f = faces(b);
    const nightOn = light.night > 0.35;

    for (const name of ['front', 'side']) {
      const face = f[name];
      const cols = Math.max(1, Math.round(face.len * 1.6));
      if (b.type === 'shop') {
        // Storefront glass + awning
        Iso.faceQuad(ctx, face, 0.08, 0.92, z0 + 3, z0 + 22, windowColor(nightOn && name === 'front', face.shade), Iso.shade('#2b2830', 0.8), 1);
        drawAwning(ctx, face, b.awning, z0 + 24, 0.3, name === 'front' ? 1 : 0);
      } else {
        const floorH = b.type === 'office' ? 16 : 20;
        const floors = Math.floor((b.h - 8) / floorH);
        for (let fl = 0; fl < floors; fl++) {
          const zb = z0 + 6 + fl * floorH;
          for (let i = 0; i < cols; i++) {
            const lit = nightOn && Iso.hash(b.seed, fl * 31 + i, name === 'front' ? 1 : 2) < 0.55;
            const pad = b.type === 'office' ? 0.08 : 0.22;
            Iso.faceQuad(ctx, face, (i + pad) / cols, (i + 1 - pad) / cols, zb, zb + floorH * (b.type === 'office' ? 0.72 : 0.55), windowColor(lit, face.shade));
          }
        }
      }
    }

    // Roof parapet + props
    const top = z0 + b.h;
    Iso.tile(ctx, b.x + 0.12, b.y + 0.12, b.w - 0.24, b.d - 0.24, top, Iso.shade(b.color, 0.9));
    const r = Iso.rng(b.seed);
    for (let i = 0; i < b.roofProps; i++) {
      const px = b.x + 0.3 + r() * (b.w - 1.0);
      const py = b.y + 0.3 + r() * (b.d - 1.0);
      Iso.box(ctx, px, py, 0.45, 0.35, 7 + r() * 6, '#9a9aa0', top);
    }
  }

  function drawAwning(ctx, face, color, z, depth, stripes) {
    // Sloped awning sticking out from the face. Outward normal is +y for the front, +x for the side.
    const nx = face.ax === face.bx ? 1 : 0;
    const ny = face.ax === face.bx ? 0 : 1;
    const n = stripes ? 8 : 1;
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n;
      const gx0 = face.ax + (face.bx - face.ax) * u0, gy0 = face.ay + (face.by - face.ay) * u0;
      const gx1 = face.ax + (face.bx - face.ax) * u1, gy1 = face.ay + (face.by - face.ay) * u1;
      const col = stripes && i % 2 ? '#f6ecd9' : color;
      Iso.poly(ctx, [
        Iso.toScreen(gx0, gy0, z), Iso.toScreen(gx1, gy1, z),
        Iso.toScreen(gx1 + nx * depth, gy1 + ny * depth, z - 6), Iso.toScreen(gx0 + nx * depth, gy0 + ny * depth, z - 6),
      ], Iso.shade(col, face.shade + 0.1));
    }
    // valance
    Iso.poly(ctx, [
      Iso.toScreen(face.ax + nx * depth, face.ay + ny * depth, z - 6), Iso.toScreen(face.bx + nx * depth, face.by + ny * depth, z - 6),
      Iso.toScreen(face.bx + nx * depth, face.by + ny * depth, z - 10), Iso.toScreen(face.ax + nx * depth, face.ay + ny * depth, z - 10),
    ], Iso.shade(color, face.shade - 0.05));
  }

  function drawPizzeria(ctx, p, light, hover, t, alerts) {
    const z0 = CURB;
    const wall = '#f3e4c6';
    const brick = '#b4523b';

    Iso.box(ctx, p.x, p.y, p.w, p.d, p.h, wall, z0);
    const f = faces(p);

    // Brick base
    Iso.faceQuad(ctx, f.front, 0, 1, z0, z0 + 8, Iso.shade(brick, 0.85));
    Iso.faceQuad(ctx, f.side, 0, 1, z0, z0 + 8, Iso.shade(brick, 0.65));

    // Windows: warm light inside once it gets dark
    const warm = light.night > 0.25;
    const glass = (fs) => warm ? Iso.glow('#ffcf7a', 0.95) : Iso.shade(C.glass, fs);
    const frame = Iso.shade('#5a3526', 0.9);
    Iso.faceQuad(ctx, f.front, 0.06, 0.36, z0 + 9, z0 + 30, glass(0.9), frame, 2);
    Iso.faceQuad(ctx, f.front, 0.64, 0.94, z0 + 9, z0 + 30, glass(0.9), frame, 2);
    // Door
    Iso.faceQuad(ctx, f.front, 0.41, 0.59, z0, z0 + 30, Iso.shade('#6d3a28', 0.85), frame, 2);
    Iso.faceQuad(ctx, f.front, 0.44, 0.56, z0 + 16, z0 + 27, glass(0.8));
    // Side windows
    Iso.faceQuad(ctx, f.side, 0.12, 0.42, z0 + 12, z0 + 30, glass(0.65), frame, 2);
    Iso.faceQuad(ctx, f.side, 0.58, 0.88, z0 + 12, z0 + 30, glass(0.65), frame, 2);

    // Striped awnings
    drawAwning(ctx, f.front, '#d8412f', z0 + 36, 0.38, 1);
    drawAwning(ctx, f.side, '#d8412f', z0 + 36, 0.3, 1);

    // Roof trim
    const top = z0 + p.h;
    Iso.box(ctx, p.x - 0.04, p.y - 0.04, p.w + 0.08, p.d + 0.08, 3, '#7b3a2a', top);

    // Chimney for the pizza oven
    Iso.box(ctx, p.x + 0.4, p.y + 0.4, 0.35, 0.35, 16, '#9c4a35', top + 3);

    // Sign board on the roof, front edge
    const sx = p.x + 0.15, sw = p.w - 0.3, sy = p.y + p.d - 0.22, sd = 0.12;
    Iso.box(ctx, sx, sy, sw, sd, 22, { top: Iso.shade('#a82b21'), front: Iso.shade('#c9352a'), side: Iso.shade('#8f251c') }, top + 3);
    const c = Iso.facePoint(sx, sy + sd, sx + sw, sy + sd, 0.5, top + 3 + 11);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.transform(1, 0.5, 0, 1, 0, 0);
    ctx.fillStyle = warm ? Iso.glow('#fff4d6') : Iso.shade('#fff4d6');
    ctx.font = '900 14px "Nunito", "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PIZZA', 0, 1);
    ctx.restore();

    // Highlight outline when hovered
    if (hover) {
      ctx.save();
      ctx.shadowColor = 'rgba(255, 210, 90, 1)';
      ctx.shadowBlur = 16;
      ctx.lineJoin = 'round';
      Iso.poly(ctx, Iso.boxSilhouette(p.x, p.y, p.w, p.d, p.h, z0), 'rgba(255, 220, 120, 0.12)', 'rgba(255, 214, 96, 0.95)', 3);
      ctx.restore();
    }

    // Floating marker so the player can always find their business
    const bob = Math.sin(t * 2.4) * 4;
    const m = Iso.toScreen(p.x + p.w / 2, p.y + p.d / 2, top + 64 + bob);
    drawMarker(ctx, m.x, m.y, hover);
    if (alerts) {
      // Red badge: something at the pizzeria needs attention.
      ctx.fillStyle = '#e8573f';
      ctx.beginPath(); ctx.arc(m.x + 13, m.y - 12, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '900 11px "Nunito", "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', m.x + 13, m.y - 11.5);
    }
  }

  function drawMarker(ctx, x, y, hover) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = hover ? '#ffd35a' : '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 15, Math.PI * 0.8, Math.PI * 2.2);
    ctx.lineTo(x, y + 26);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // pizza icon
    ctx.fillStyle = '#d9913a';
    ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f6c453';
    ctx.beginPath(); ctx.arc(x, y, 8.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c0392b';
    for (const [dx, dy] of [[-3, -3], [3.5, -1], [-1, 4], [3, 4.5]]) {
      ctx.beginPath(); ctx.arc(x + dx, y + dy, 1.8, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawTree(ctx, tr) {
    const z = CURB + 3;
    Iso.box(ctx, tr.x - 0.05, tr.y - 0.05, 0.1, 0.1, 14 * tr.size, C.trunk, z);
    const p = Iso.toScreen(tr.x, tr.y, z + 14 * tr.size + 10 * tr.size);
    const r = 14 * tr.size;
    ctx.fillStyle = Iso.shade(C.leaf, 0.85);
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = Iso.shade(C.leafLight);
    ctx.beginPath(); ctx.arc(p.x - r * 0.3, p.y - r * 0.35, r * 0.62, 0, Math.PI * 2); ctx.fill();
  }

  function drawLamp(ctx, l, light) {
    Iso.box(ctx, l.x - 0.03, l.y - 0.03, 0.06, 0.06, 26, '#3c3a42', CURB);
    const p = Iso.toScreen(l.x, l.y, CURB + 28);
    ctx.fillStyle = light.night > 0.3 ? Iso.glow('#ffe2a8') : Iso.shade('#e8e2d0');
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
  }

  function drawBench(ctx, b) {
    const w = b.dir === 'x' ? 0.7 : 0.22, d = b.dir === 'x' ? 0.22 : 0.7;
    Iso.box(ctx, b.x - w / 2, b.y - d / 2, w, d, 5, '#8a5a3a', CURB + 3);
  }

  function drawFountain(ctx, f) {
    const z = CURB + 3;
    Iso.box(ctx, f.x - 0.7, f.y - 0.7, 1.4, 1.4, 6, '#b9b2a4', z);
    Iso.tile(ctx, f.x - 0.55, f.y - 0.55, 1.1, 1.1, z + 6, Iso.shade(C.water));
    Iso.box(ctx, f.x - 0.1, f.y - 0.1, 0.2, 0.2, 14, '#c9c2b4', z + 6);
  }

  // Everything that stands up gets depth-sorted so nearer things cover farther ones.
  function drawables() {
    const list = [];
    for (const b of buildings) list.push({ depth: b.x + b.w / 2 + b.y + b.d / 2, kind: 'building', o: b });
    for (const t of trees) list.push({ depth: t.x + t.y, kind: 'tree', o: t });
    for (const l of lamps) list.push({ depth: l.x + l.y, kind: 'lamp', o: l });
    for (const b of benches) list.push({ depth: b.x + b.y, kind: 'bench', o: b });
    for (const f of fountains) list.push({ depth: f.x + f.y, kind: 'fountain', o: f });
    list.push({ depth: pizzeria.x + pizzeria.w / 2 + pizzeria.y + pizzeria.d / 2, kind: 'pizzeria', o: pizzeria });
    list.sort((a, b) => a.depth - b.depth);
    return list;
  }

  let sorted = null;

  function render(ctx, opts) {
    const light = opts.light;
    drawGround(ctx, light);
    for (const d of sorted) {
      switch (d.kind) {
        case 'building': drawBuilding(ctx, d.o, light); break;
        case 'tree': drawTree(ctx, d.o); break;
        case 'lamp': drawLamp(ctx, d.o, light); break;
        case 'bench': drawBench(ctx, d.o); break;
        case 'fountain': drawFountain(ctx, d.o); break;
        case 'pizzeria': drawPizzeria(ctx, d.o, light, opts.hover === d.o.id, opts.t, opts.alerts); break;
      }
    }
  }

  // Returns the id of the business under a world point, if any (front-most wins).
  function pick(wx, wy) {
    for (let i = sorted.length - 1; i >= 0; i--) {
      const d = sorted[i];
      if (d.kind === 'pizzeria') {
        const p = d.o;
        const top = CURB + p.h + 28;
        const sil = Iso.boxSilhouette(p.x, p.y, p.w, p.d, top, 0);
        if (Iso.pointInPoly(wx, wy, sil)) return p.id;
        // Marker counts too
        const m = Iso.toScreen(p.x + p.w / 2, p.y + p.d / 2, CURB + p.h + 64);
        if (Math.hypot(wx - m.x, wy - m.y) < 20) return p.id;
      } else if (d.kind === 'building') {
        const b = d.o;
        if (Iso.pointInPoly(wx, wy, Iso.boxSilhouette(b.x, b.y, b.w, b.d, b.h + CURB, 0))) return null;
      }
    }
    return null;
  }

  function businessCenter(id) {
    if (pizzeria && pizzeria.id === id) {
      return Iso.toScreen(pizzeria.x + pizzeria.w / 2, pizzeria.y + pizzeria.d / 2, CURB + 30);
    }
    return Iso.toScreen(N / 2, N / 2, 0);
  }

  function bounds() {
    const l = Iso.toScreen(0, N), r = Iso.toScreen(N, 0), t = Iso.toScreen(0, 0), b = Iso.toScreen(N, N);
    return { minX: l.x, maxX: r.x, minY: t.y - 260, maxY: b.y + 22 };
  }

  build();
  sorted = drawables();

  window.City = { render, pick, lighting, businessCenter, bounds, N };
})();
