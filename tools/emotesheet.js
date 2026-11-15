// Emote sheet — not loaded by the game. In the browser console on the game page:
//   await new Promise((r) => { const s = document.createElement('script'); s.src = 'tools/emotesheet.js'; s.onload = r; document.head.appendChild(s); });
//   ES.page(0)        // emotes 0-14, big, over the page (ES.page(15), ES.page(30) ...)
//   ES.page(0, 1.3)   // the same, 1.3 seconds into their loops
//   ES.check()        // draws every emote at 40 moments of its loop; lists any that throw or
//                     // draw outside their box
//   ES.close()
window.ES = {
  canvas() {
    let c = document.getElementById('emsheet');
    if (!c) {
      c = document.createElement('canvas'); c.id = 'emsheet';
      c.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;background:#e9edf7;max-width:100vw';
      document.body.appendChild(c);
    }
    return c;
  },
  page(start, t = 0.6, n = 15, cols = 5) {
    const c = this.canvas(), cell = 200, rows = Math.ceil(n / cols);
    c.width = cols * cell; c.height = rows * cell; c.style.width = Math.min(innerWidth, cols * cell) + 'px';
    const g = c.getContext('2d');
    g.fillStyle = '#e9edf7'; g.fillRect(0, 0, c.width, c.height);
    EMOTES.slice(start, start + n).forEach((e, i) => {
      const x = (i % cols) * cell + cell / 2, y = Math.floor(i / cols) * cell + cell / 2;
      g.fillStyle = RARITIES[e.rarity].color + '30'; g.fillRect(x - cell / 2 + 3, y - cell / 2 + 3, cell - 6, cell - 6);
      Emotes.draw(g, e, x, y - 10, 160, t);
      g.fillStyle = '#161a33'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center';
      g.fillText(e.id + ' · ' + e.rarity, x, y + cell / 2 - 8);
    });
  },
  // Every emote, drawn alone in the middle of a big empty canvas at many moments: how far past
  // its own box (100 x 100 at size 100) any ink would land if it were not clipped. A ball kicked
  // across the box is meant to leave it; anything else this lists is being cut off.
  check(frames = 40) {
    const S = 100, pad = 100, W = S + pad * 2;
    const c = document.createElement('canvas'); c.width = W; c.height = W;
    const g = c.getContext('2d', { willReadFrequently: true });
    const out = [];
    for (const e of EMOTES) {
      let worst = 0;
      try {
        for (let f = 0; f < frames; f++) {
          g.clearRect(0, 0, W, W);
          Emotes.draw(g, e, W / 2, W / 2, S, f * 0.11, { clip: false });
          const d = g.getImageData(0, 0, W, W).data;
          for (let y = 0; y < W; y += 2) for (let x = 0; x < W; x += 2) {
            if (d[(y * W + x) * 4 + 3] < 40) continue;
            const over = Math.max(pad - x, x - (pad + S), pad - y, y - (pad + S));
            if (over > worst) worst = over;
          }
        }
      } catch (err) { out.push({ id: e.id, error: err.message }); continue; }
      if (worst > 4) out.push({ id: e.id, over: worst });
    }
    return out;
  },
  close() { const c = document.getElementById('emsheet'); if (c) c.remove(); },
};
