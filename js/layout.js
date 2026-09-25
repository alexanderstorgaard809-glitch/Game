// The layout of a room: built walls, doors and placed items, plus the placement rules.
//
// Tiles are addressed by their top corner (x, y). Walls and doors sit on tile edges:
//   'h' edge (x, y): the line from (x, y) to (x + 1, y), between tiles (x, y - 1) and (x, y)
//   'v' edge (x, y): the line from (x, y) to (x, y + 1), between tiles (x - 1, y) and (x, y)
// The two back walls (y = 0 and x = 0) always exist. The front sides are left open so you can see in.
(function () {
  const W = 10;
  const D = 8;
  const ENTRANCE = { o: 'v', x: 0, y: 6 };

  function create() {
    return { walls: [], doors: [], items: [], nextId: 1 };
  }

  function edgeKey(o, x, y) { return o + ':' + x + ':' + y; }
  function sameEdge(a, b) { return a.o === b.o && a.x === b.x && a.y === b.y; }

  function isEntrance(o, x, y) { return o === ENTRANCE.o && x === ENTRANCE.x && y === ENTRANCE.y; }

  // The fixed walls at the back of the room.
  function isOuterWall(o, x, y) {
    return (o === 'h' && y === 0 && x >= 0 && x < W) || (o === 'v' && x === 0 && y >= 0 && y < D);
  }

  // Edges inside the room where a wall can be built.
  function isInnerEdge(o, x, y) {
    if (o === 'h') return y >= 1 && y <= D - 1 && x >= 0 && x < W;
    return x >= 1 && x <= W - 1 && y >= 0 && y < D;
  }

  function inRoom(x, y) { return x >= 0 && y >= 0 && x < W && y < D; }

  // Tiles on either side of an edge (some may be outside the room).
  function edgeTiles(o, x, y) {
    return o === 'h' ? [[x, y - 1], [x, y]] : [[x - 1, y], [x, y]];
  }

  function footprint(type, x, y, rot) {
    const def = Furniture.items[type];
    const turned = rot % 2 === 1;
    return { x, y, w: turned ? def.d : def.w, d: turned ? def.w : def.d };
  }

  function hasWall(layout, o, x, y) {
    return layout.walls.some(w => w.o === o && w.x === x && w.y === y);
  }

  function doorAt(layout, o, x, y) {
    return layout.doors.find(d => d.o === o && d.x === x && d.y === y) || null;
  }

  // Wall or door blocks the edge between two neighbouring tiles.
  function edgeBlocked(layout, o, x, y) {
    return hasWall(layout, o, x, y);
  }

  // Map of "x,y" -> item for every occupied tile.
  function occupancy(layout, ignoreId) {
    const map = new Map();
    for (const it of layout.items) {
      if (it.id === ignoreId) continue;
      const fp = footprint(it.type, it.x, it.y, it.rot);
      for (let j = 0; j < fp.d; j++) for (let i = 0; i < fp.w; i++) map.set((fp.x + i) + ',' + (fp.y + j), it);
    }
    return map;
  }

  // Tiles that must stay free so every door can be walked through.
  function doorwayTiles(layout) {
    const set = new Set();
    const all = layout.doors.concat([ENTRANCE]);
    for (const d of all) {
      for (const [tx, ty] of edgeTiles(d.o, d.x, d.y)) if (inRoom(tx, ty)) set.add(tx + ',' + ty);
    }
    return set;
  }

  function itemAt(layout, x, y) {
    return occupancy(layout).get(x + ',' + y) || null;
  }

  function fail(reason) { return { ok: false, reason }; }
  const OK = { ok: true };

  function canPlaceItem(layout, type, x, y, rot) {
    const def = Furniture.items[type];
    if (!def) return fail('Unknown item');
    const fp = footprint(type, x, y, rot);
    if (fp.x < 0 || fp.y < 0 || fp.x + fp.w > W || fp.y + fp.d > D) return fail('Must be inside the room');
    const occ = occupancy(layout);
    const doorway = doorwayTiles(layout);
    for (let j = 0; j < fp.d; j++) {
      for (let i = 0; i < fp.w; i++) {
        const k = (fp.x + i) + ',' + (fp.y + j);
        const other = occ.get(k);
        if (other) return fail('Something is already there (' + Furniture.items[other.type].name + ')');
        if (doorway.has(k)) return fail('Keep the doorway clear');
      }
    }
    // A wall may not run through the middle of an item.
    for (let j = 0; j < fp.d; j++) for (let i = 1; i < fp.w; i++) if (edgeBlocked(layout, 'v', fp.x + i, fp.y + j)) return fail('A wall is in the way');
    for (let j = 1; j < fp.d; j++) for (let i = 0; i < fp.w; i++) if (edgeBlocked(layout, 'h', fp.x + i, fp.y + j)) return fail('A wall is in the way');
    return OK;
  }

  function canPlaceWall(layout, o, x, y) {
    if (isOuterWall(o, x, y)) return fail('There is already an outer wall here');
    if (!isInnerEdge(o, x, y)) return fail('Walls must be inside the room');
    if (hasWall(layout, o, x, y)) return fail('There is already a wall here');
    const occ = occupancy(layout);
    const [a, b] = edgeTiles(o, x, y);
    const ia = occ.get(a[0] + ',' + a[1]), ib = occ.get(b[0] + ',' + b[1]);
    if (ia && ia === ib) return fail('Would cut through ' + Furniture.items[ia.type].name);
    return OK;
  }

  function canPlaceDoor(layout, o, x, y) {
    if (isEntrance(o, x, y)) return fail('This is the entrance');
    if (!isOuterWall(o, x, y) && !hasWall(layout, o, x, y)) return fail('Doors must go in a wall');
    if (doorAt(layout, o, x, y)) return fail('There is already a door here');
    const occ = occupancy(layout);
    for (const [tx, ty] of edgeTiles(o, x, y)) {
      const it = occ.get(tx + ',' + ty);
      if (it) return fail(Furniture.items[it.type].name + ' blocks the doorway');
    }
    return OK;
  }

  // ---------- Changes ----------

  function addItem(layout, type, x, y, rot) {
    const item = { id: layout.nextId++, type, x, y, rot };
    layout.items.push(item);
    return item;
  }
  function removeItem(layout, item) { layout.items = layout.items.filter(i => i !== item); }
  function addWall(layout, o, x, y) { layout.walls.push({ o, x, y }); }
  function removeWall(layout, o, x, y) {
    layout.walls = layout.walls.filter(w => !(w.o === o && w.x === x && w.y === y));
    layout.doors = layout.doors.filter(d => !(d.o === o && d.x === x && d.y === y));
  }
  function addDoor(layout, o, x, y) { layout.doors.push({ o, x, y }); }
  function removeDoor(layout, o, x, y) { layout.doors = layout.doors.filter(d => !(d.o === o && d.x === x && d.y === y)); }

  // ---------- Loading ----------

  function isInt(v) { return Number.isInteger(v); }

  // Rebuild a layout from saved data, dropping anything invalid.
  function sanitize(data) {
    const layout = create();
    if (!data || typeof data !== 'object') return layout;
    for (const w of Array.isArray(data.walls) ? data.walls : []) {
      if (w && (w.o === 'h' || w.o === 'v') && isInt(w.x) && isInt(w.y) && canPlaceWall(layout, w.o, w.x, w.y).ok) addWall(layout, w.o, w.x, w.y);
    }
    for (const it of Array.isArray(data.items) ? data.items : []) {
      if (!it || !Furniture.items[it.type] || !isInt(it.x) || !isInt(it.y)) continue;
      const rot = isInt(it.rot) ? ((it.rot % 4) + 4) % 4 : 0;
      if (canPlaceItem(layout, it.type, it.x, it.y, rot).ok) addItem(layout, it.type, it.x, it.y, rot);
    }
    for (const d of Array.isArray(data.doors) ? data.doors : []) {
      if (d && (d.o === 'h' || d.o === 'v') && isInt(d.x) && isInt(d.y) && canPlaceDoor(layout, d.o, d.x, d.y).ok) addDoor(layout, d.o, d.x, d.y);
    }
    return layout;
  }

  window.Layout = {
    W, D, ENTRANCE,
    create, sanitize, edgeKey, sameEdge, isEntrance, isOuterWall, isInnerEdge, inRoom, edgeTiles,
    footprint, hasWall, doorAt, itemAt, occupancy, doorwayTiles,
    canPlaceItem, canPlaceWall, canPlaceDoor,
    addItem, removeItem, addWall, removeWall, addDoor, removeDoor,
  };
})();
