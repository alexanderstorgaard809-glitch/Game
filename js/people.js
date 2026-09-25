// Drawing people (staff and, later, customers) in the same isometric style as the room.
(function () {
  const OUTFITS = {
    cook: { shirt: '#f4f1ea', pants: '#3b3a44' },
    cashier: { shirt: '#2f8f83', pants: '#2e3440' },
    waiter: { shirt: '#26252c', pants: '#1f1e24' },
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // p: { x, y, look, role?, outfit?, walk, seated?, carrying?, problem?, alpha? }
  function draw(ctx, p, highlight) {
    const seated = !!p.seated;
    const base = Iso.toScreen(p.x, p.y, seated ? 13 : 0);
    const x = base.x, y = base.y;
    const outfit = p.outfit || OUTFITS[p.role] || { shirt: '#6c8ebf', pants: '#34384a' };
    const swing = seated ? 0 : Math.sin(p.walk * Math.PI * 2) * 2.2;
    ctx.save();
    ctx.globalAlpha = p.alpha === undefined ? 1 : Math.max(0, Math.min(1, p.alpha));

    if (!seated) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(x, y, 9, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      // Legs
      ctx.fillStyle = Iso.shade(outfit.pants);
      ctx.fillRect(x - 5, y - 14 + Math.max(0, swing), 4, 14 - Math.max(0, swing));
      ctx.fillRect(x + 1, y - 14 + Math.max(0, -swing), 4, 14 - Math.max(0, -swing));
    }

    if (highlight) {
      ctx.save();
      ctx.shadowColor = highlight;
      ctx.shadowBlur = 12;
      ctx.fillStyle = highlight;
      roundRect(ctx, x - 8, y - 45, 16, 34, 7);
      ctx.fill();
      ctx.restore();
    }

    // Body
    ctx.fillStyle = Iso.shade(outfit.shirt);
    roundRect(ctx, x - 7, y - 31, 14, 19, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    roundRect(ctx, x + 1, y - 31, 6, 19, 4);
    ctx.fill();

    if (p.role === 'waiter') {
      ctx.fillStyle = Iso.shade('#f4f1ea');
      ctx.fillRect(x - 2, y - 31, 4, 13);
      ctx.fillStyle = Iso.shade('#c8412f');
      ctx.fillRect(x - 3, y - 30, 6, 2.5);
    }
    if (p.role === 'cook') {
      ctx.fillStyle = Iso.shade('#dcd6ca');
      ctx.fillRect(x - 5, y - 24, 10, 11);
    }

    // Head
    const hy = y - 37;
    ctx.fillStyle = Iso.shade(p.look.skin);
    ctx.beginPath(); ctx.arc(x, hy, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = Iso.shade(p.look.hair);
    ctx.beginPath();
    ctx.arc(x, hy - 1, 6.8, Math.PI * 1.05, Math.PI * 1.95);
    if (!p.look.short) ctx.lineTo(x + 6.5, hy + 5);
    ctx.closePath();
    ctx.fill();

    if (p.role === 'cook') {
      ctx.fillStyle = Iso.shade('#ffffff');
      ctx.fillRect(x - 5, hy - 12, 10, 7);
      ctx.beginPath(); ctx.arc(x, hy - 13, 6, 0, Math.PI * 2); ctx.fill();
    } else if (p.role === 'cashier') {
      ctx.fillStyle = Iso.shade('#23706a');
      ctx.beginPath(); ctx.ellipse(x, hy - 4.5, 7.5, 3, 0, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillRect(x - 1, hy - 5, 10, 2.5);
    }

    if (p.carrying) drawPizza(ctx, x + 9, y - 25, 7);

    ctx.restore();

    if (p.kind === 'customer' && p.state === 'leaving' && p.mood && p.mood !== 'ok') {
      // How the visit went
      const by = hy - 20;
      const happy = p.mood === 'happy';
      ctx.fillStyle = happy ? '#4fa864' : '#c8412f';
      ctx.beginPath(); ctx.arc(x, by, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x, by + (happy ? -0.5 : 4.5), 3.2, happy ? 0.15 * Math.PI : 1.15 * Math.PI, happy ? 0.85 * Math.PI : 1.85 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 2.6, by - 2.6, 1.4, 1.6); ctx.fillRect(x + 1.2, by - 2.6, 1.4, 1.6);
    }

    if (p.problem) {
      const by = hy - (p.role === 'cook' ? 30 : 22);
      ctx.fillStyle = '#e8573f';
      ctx.beginPath(); ctx.arc(x, by, 8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 4, by + 6); ctx.lineTo(x, by + 12); ctx.lineTo(x + 4, by + 6); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '900 11px "Nunito", "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', x, by + 0.5);
    }
  }

  function drawPizza(ctx, x, y, r) {
    ctx.fillStyle = Iso.shade('#d9913a');
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = Iso.shade('#e8a33d');
    ctx.beginPath(); ctx.ellipse(x, y - 0.5, r * 0.78, r * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = Iso.shade('#c0392b');
    for (const [dx, dy] of [[-0.35, -0.05], [0.3, 0.08], [0, -0.15]]) {
      ctx.beginPath(); ctx.ellipse(x + dx * r, y + dy * r, r * 0.15, r * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Rough screen box of a standing person, for mouse hover.
  function hitTest(p, wx, wy) {
    const base = Iso.toScreen(p.x, p.y, p.seated ? 13 : 0);
    return wx > base.x - 9 && wx < base.x + 9 && wy > base.y - 46 && wy < base.y + 2;
  }

  // Small portrait for the staff window.
  function drawPortrait(canvas, person) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = canvas.clientWidth || 36, ch = canvas.clientHeight || 44;
    canvas.width = cw * dpr; canvas.height = ch * dpr;
    const ctx = canvas.getContext('2d');
    const prev = Iso.getAmbient();
    Iso.setAmbient([1, 1, 1]);
    const s = 0.72;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * cw / 2, dpr * (ch - 3));
    draw(ctx, Object.assign({ x: 0, y: 0, walk: 0 }, person));
    Iso.setAmbient(prev);
  }

  window.People = { draw, drawPizza, hitTest, drawPortrait, OUTFITS };
})();
