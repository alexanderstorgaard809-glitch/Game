// Walking around inside a room: which tiles are free, which steps are allowed, and shortest paths.
// People move between the centres of neighbouring tiles (no diagonals). A wall blocks the step
// between two tiles unless it has a door in it. Tiles with furniture can't be walked on.
(function () {
  const W = Layout.W, D = Layout.D;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  const key = (x, y) => x + ',' + y;

  // Snapshot of the layout that answers walkability questions quickly.
  function grid(layout) {
    const occ = Layout.occupancy(layout);
    const walls = new Set(layout.walls.map(w => Layout.edgeKey(w.o, w.x, w.y)));
    const doors = new Set(layout.doors.map(d => Layout.edgeKey(d.o, d.x, d.y)));
    function walkable(x, y) { return Layout.inRoom(x, y) && !occ.has(key(x, y)); }
    // The edge crossed when stepping from (x, y) to the neighbour (nx, ny).
    function edgeBetween(x, y, nx, ny) {
      if (nx !== x) return Layout.edgeKey('v', Math.max(x, nx), y);
      return Layout.edgeKey('h', x, Math.max(y, ny));
    }
    // A wall without a door on the edge between two neighbouring tiles.
    function wallEdge(x, y, nx, ny) {
      const e = edgeBetween(x, y, nx, ny);
      return walls.has(e) && !doors.has(e);
    }
    function canStep(x, y, nx, ny) {
      if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) return false;
      return walkable(nx, ny) && !wallEdge(x, y, nx, ny);
    }
    return { walkable, canStep, wallEdge, occ };
  }

  // Breadth-first search from a start tile. Returns distances and a way back for every reachable tile.
  function explore(g, sx, sy) {
    const dist = new Map([[key(sx, sy), 0]]);
    const prev = new Map();
    const queue = [[sx, sy]];
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      const d = dist.get(key(x, y));
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (dist.has(k) || !g.canStep(x, y, nx, ny)) continue;
        dist.set(k, d + 1);
        prev.set(k, [x, y]);
        queue.push([nx, ny]);
      }
    }
    return { dist, prev };
  }

  // Steps from start to the tile of the path that ends at target (start excluded).
  function route(exp, tx, ty) {
    const out = [];
    let k = key(tx, ty);
    if (!exp.dist.has(k)) return null;
    let cur = [tx, ty];
    while (exp.prev.has(k)) {
      out.push({ x: cur[0], y: cur[1] });
      cur = exp.prev.get(k);
      k = key(cur[0], cur[1]);
    }
    return out.reverse();
  }

  // Shortest path to the nearest of several target tiles. [] if already there, null if unreachable.
  function find(g, start, targets) {
    if (!targets.length) return null;
    const exp = explore(g, start.x, start.y);
    let best = null;
    for (const t of targets) {
      const d = exp.dist.get(key(t.x, t.y));
      if (d !== undefined && (!best || d < best.d)) best = { d, t };
    }
    return best ? route(exp, best.t.x, best.t.y) : null;
  }

  // Free tiles next to an item where someone can stand to use it.
  // side: 'front' prefers the side the item faces, 'back' the opposite side.
  function accessTiles(g, item, side) {
    const fp = Layout.footprint(item.type, item.x, item.y, item.rot);
    const f = Furniture.FACING[item.rot];
    const out = [];
    const seen = new Set();
    for (let j = 0; j < fp.d; j++) {
      for (let i = 0; i < fp.w; i++) {
        const tx = fp.x + i, ty = fp.y + j;
        for (const [dx, dy] of DIRS) {
          const nx = tx + dx, ny = ty + dy, k = key(nx, ny);
          if (seen.has(k) || nx >= fp.x && nx < fp.x + fp.w && ny >= fp.y && ny < fp.y + fp.d) continue;
          if (!g.walkable(nx, ny)) continue;
          // The person must be able to reach across: no solid wall between them and the item.
          if (g.wallEdge(nx, ny, tx, ty)) continue;
          seen.add(k);
          let rank = 1;
          if (side === 'front') rank = dx === f[0] && dy === f[1] ? 0 : dx === -f[0] && dy === -f[1] ? 2 : 1;
          if (side === 'back') rank = dx === -f[0] && dy === -f[1] ? 0 : dx === f[0] && dy === f[1] ? 2 : 1;
          out.push({ x: nx, y: ny, rank });
        }
      }
    }
    out.sort((a, b) => a.rank - b.rank);
    return out;
  }

  window.Path = { grid, explore, route, find, accessTiles, key, W, D };
})();
