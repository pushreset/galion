// Old-map compass rose radar. Directions are screen-relative (iso camera at 45°),
// so a blip at the top of the rose is an enemy toward the top of the screen.
const S = 112, C = S / 2, R = 44, RANGE = 90;

function drawRose() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const disc = (r, col) => { g.fillStyle = col; g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.fill(); };
  disc(53, '#1b110b');
  disc(51, '#8d5c35');
  disc(49, '#e6cc8e');
  disc(41, '#f6e6b4');
  // ticks every 22.5°
  g.strokeStyle = '#704629';
  g.lineWidth = 1.5;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, r0 = i % 2 ? 44 : 41;
    g.beginPath();
    g.moveTo(C + Math.cos(a) * r0, C + Math.sin(a) * r0);
    g.lineTo(C + Math.cos(a) * 48, C + Math.sin(a) * 48);
    g.stroke();
  }
  // star points: each split into a light and a dark half, like engraved roses
  const point = (a, len, w, light, dark) => {
    const tip = [C + Math.cos(a) * len, C + Math.sin(a) * len];
    const l = [C + Math.cos(a - Math.PI / 2) * w, C + Math.sin(a - Math.PI / 2) * w];
    const r = [C + Math.cos(a + Math.PI / 2) * w, C + Math.sin(a + Math.PI / 2) * w];
    for (const [side, col] of [[l, light], [r, dark]]) {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(C, C); g.lineTo(...side); g.lineTo(...tip);
      g.fill();
    }
  };
  for (let i = 0; i < 4; i++) point(Math.PI / 4 + (i * Math.PI) / 2, 30, 6, '#d84a38', '#6e1619');
  for (let i = 0; i < 4; i++) point(-Math.PI / 2 + (i * Math.PI) / 2, 44, 8, '#f5ecd2', '#3f2616');
  disc(5, '#1b110b');
  disc(3.5, '#ffd24a');
  // hard-edge everything: no anti-aliased fringe after the 2× CSS upscale
  const img = g.getImageData(0, 0, S, S), d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
  g.putImageData(img, 0, 0);
  // pixel "N" at the top
  g.fillStyle = '#e6cc8e';
  g.fillRect(C - 4, 6, 9, 8);
  g.fillStyle = '#1b110b';
  const N = ['1...1', '11..1', '1.1.1', '1..11', '1...1'];
  N.forEach((row, y) => [...row].forEach((ch, x) => ch === '1' && g.fillRect(C - 2 + x, 7 + y, 1, 1)));
  return cv;
}

export function createRadar(canvas) {
  canvas.width = canvas.height = S;
  const g = canvas.getContext('2d');
  const rose = drawRose();
  // world (dx, dz) → radar (x, y): screen right = (1,0,-1)/√2, screen up = (-1,0,-1)/√2
  const toRadar = (dx, dz) => [(dx - dz) / Math.SQRT2, (dx + dz) / Math.SQRT2];
  const px = (x, y, w, col) => { g.fillStyle = col; g.fillRect(Math.round(x - w / 2), Math.round(y - w / 2), w, w); };

  return function draw(player, ships, loot, fort) {
    g.clearRect(0, 0, S, S);
    g.drawImage(rose, 0, 0);
    const place = (x, z) => {
      const [rx, ry] = toRadar(x - player.x, z - player.z);
      const d = Math.hypot(rx, ry);
      const k = Math.min(R, (d / RANGE) * R) / (d || 1);
      return { x: C + rx * k, y: C + ry * k, out: d > RANGE, a: Math.atan2(ry, rx) };
    };
    for (const o of loot) { const p = place(o.x, o.z); if (!p.out) px(p.x, p.y, 2, '#c9952a'); }
    if (fort) {
      const p = place(fort.x, fort.z);
      px(p.x, p.y, 6, '#1b110b');
      px(p.x, p.y, 4, fort.active ? '#a52623' : '#6f6f7c');
    }
    for (const s of ships) {
      if (s === player || (s.team === 0 && !s.isPlayer) || !s.alive || s.escaped) continue;
      const ally = s.isPlayer && s.team === player.team;
      const col = ally ? '#94c54c' : s.team === 2 ? '#ffd24a' : s.isPlayer ? '#ff7a2a' : '#d84a38'; // crewmates green, merchants gold, rival pirates orange, navy red
      const p = place(s.x, s.z);
      if (p.out) {
        // arrowhead on the ring, pointing outward
        g.fillStyle = ally ? '#5f8f2e' : s.team === 2 ? '#c9952a' : '#a52623';
        g.beginPath();
        g.moveTo(C + Math.cos(p.a) * (R + 4), C + Math.sin(p.a) * (R + 4));
        g.lineTo(C + Math.cos(p.a + 0.13) * (R - 3), C + Math.sin(p.a + 0.13) * (R - 3));
        g.lineTo(C + Math.cos(p.a - 0.13) * (R - 3), C + Math.sin(p.a - 0.13) * (R - 3));
        g.fill();
      } else {
        const big = s.type === 'galleon' ? 6 : s.type === 'brig' ? 5 : 4;
        px(p.x, p.y, big + 2, '#1b110b');
        px(p.x, p.y, big, col);
      }
    }
  };
}
