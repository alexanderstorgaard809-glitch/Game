// Isometric projection + drawing helpers shared by every scene.
// Grid x runs toward the lower-right of the screen, grid y toward the lower-left.
// The viewer looks from the "front" (large x + y), so the +x and +y faces of a box are visible.
(function () {
  const TW = 64; // tile width in world pixels
  const TH = 32; // tile height in world pixels

  // Ambient light multiplier (r, g, b). The city sets this from the time of day.
  let ambient = [1, 1, 1];

  function toScreen(gx, gy, z) {
    return { x: (gx - gy) * (TW / 2), y: (gx + gy) * (TH / 2) - (z || 0) };
  }

  function toGrid(sx, sy) {
    const a = sx / (TW / 2);
    const b = sy / (TH / 2);
    return { x: (a + b) / 2, y: (b - a) / 2 };
  }

  function parseHex(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  const hexCache = new Map();
  function rgb(hex) {
    let c = hexCache.get(hex);
    if (!c) { c = parseHex(hex); hexCache.set(hex, c); }
    return c;
  }

  // Shade a colour by a factor and by the current ambient light.
  function shade(hex, f) {
    const c = rgb(hex);
    const k = f === undefined ? 1 : f;
    const r = Math.min(255, Math.round(c[0] * k * ambient[0]));
    const g = Math.min(255, Math.round(c[1] * k * ambient[1]));
    const b = Math.min(255, Math.round(c[2] * k * ambient[2]));
    return `rgb(${r},${g},${b})`;
  }

  // Shade a colour ignoring ambient light (for glowing things like lit windows).
  function glow(hex, f) {
    const c = rgb(hex);
    const k = f === undefined ? 1 : f;
    return `rgb(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0})`;
  }

  function poly(ctx, pts, fill, stroke, lineWidth) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth || 1; ctx.stroke(); }
  }

  // Flat diamond for one tile (or a w x d rectangle) at height z.
  function tile(ctx, x, y, w, d, z, fill, stroke) {
    poly(ctx, [
      toScreen(x, y, z), toScreen(x + w, y, z),
      toScreen(x + w, y + d, z), toScreen(x, y + d, z),
    ], fill, stroke);
  }

  // Solid box. colors: { top, front, side } or a single hex that gets shaded.
  function box(ctx, x, y, w, d, h, color, z0) {
    const z = z0 || 0;
    const top = typeof color === 'string' ? shade(color, 1.0) : color.top;
    const front = typeof color === 'string' ? shade(color, 0.82) : color.front;
    const side = typeof color === 'string' ? shade(color, 0.64) : color.side;
    // +y face (front-left)
    poly(ctx, [toScreen(x, y + d, z), toScreen(x + w, y + d, z), toScreen(x + w, y + d, z + h), toScreen(x, y + d, z + h)], front);
    // +x face (front-right)
    poly(ctx, [toScreen(x + w, y + d, z), toScreen(x + w, y, z), toScreen(x + w, y, z + h), toScreen(x + w, y + d, z + h)], side);
    // top
    poly(ctx, [toScreen(x, y, z + h), toScreen(x + w, y, z + h), toScreen(x + w, y + d, z + h), toScreen(x, y + d, z + h)], top);
  }

  // Screen outline of a box, useful for hit testing and hover glow.
  function boxSilhouette(x, y, w, d, h, z0) {
    const z = z0 || 0;
    return [
      toScreen(x, y, z + h), toScreen(x + w, y, z + h), toScreen(x + w, y, z),
      toScreen(x + w, y + d, z), toScreen(x, y + d, z), toScreen(x, y + d, z + h),
    ];
  }

  // A point on a vertical face that runs along the ground from A to B.
  function facePoint(ax, ay, bx, by, u, z) {
    return toScreen(ax + (bx - ax) * u, ay + (by - ay) * u, z);
  }

  // Quad on a vertical face: u in [0,1] along A->B, z in world pixels.
  function faceQuad(ctx, face, u0, u1, z0, z1, fill, stroke) {
    poly(ctx, [
      facePoint(face.ax, face.ay, face.bx, face.by, u0, z0),
      facePoint(face.ax, face.ay, face.bx, face.by, u1, z0),
      facePoint(face.ax, face.ay, face.bx, face.by, u1, z1),
      facePoint(face.ax, face.ay, face.bx, face.by, u0, z1),
    ], fill, stroke);
  }

  function pointInPoly(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // Small deterministic PRNG so the city looks the same every time.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash(a, b, c) {
    let h = (a * 374761393 + b * 668265263 + (c || 0) * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  window.Iso = {
    TW, TH, toScreen, toGrid, shade, glow, poly, tile, box, boxSilhouette,
    facePoint, faceQuad, pointInPoly, rng, hash,
    setAmbient(a) { ambient = a; },
    getAmbient() { return ambient; },
  };
})();
