/** Проверка читаемости линий диаграммы кода. */
import fs from 'node:fs';
import { resolveOut } from './paths.mjs';

const SRC = resolveOut(process.argv[2]);
const d = JSON.parse(fs.readFileSync(SRC, 'utf8').match(/## Drawing\n```json\n([\s\S]*?)\n```/)[1]);
const Y0 = 2500;

const boxes = d.elements
  .filter(
    (e) =>
      e.type === 'rectangle' &&
      e.y > Y0 &&
      (e.backgroundColor === '#ffffff' || e.backgroundColor === '#f8f9fa') &&
      e.width < 700
  )
  .map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height }));

const arrows = d.elements.filter((e) => e.type === 'arrow' && e.y > Y0);
const segs = [];
const endpoints = [];
for (const a of arrows) {
  const pts = a.points.map(([x, y]) => [a.x + x, a.y + y]);
  endpoints.push(pts[0].map(Math.round).join(','), pts[pts.length - 1].map(Math.round).join(','));
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1];
    const [x2, y2] = pts[i];
    segs.push({ x1, y1, x2, y2, horiz: y1 === y2, id: a.id });
  }
}

// 1) совпадающие точки прикрепления
const epCount = {};
for (const e of endpoints) epCount[e] = (epCount[e] || 0) + 1;
const dupEP = Object.entries(epCount).filter(([, n]) => n > 1);

// 2) наложение параллельных линий (одна прямая + пересекающиеся диапазоны)
let overlap = 0;
const OVL = [];
for (let i = 0; i < segs.length; i++) {
  for (let j = i + 1; j < segs.length; j++) {
    const s = segs[i];
    const t = segs[j];
    if (s.horiz !== t.horiz) continue;
    if (s.horiz) {
      if (Math.abs(s.y1 - t.y1) > 2) continue;
      const lo = Math.max(Math.min(s.x1, s.x2), Math.min(t.x1, t.x2));
      const hi = Math.min(Math.max(s.x1, s.x2), Math.max(t.x1, t.x2));
      if (hi - lo > 6) {
        overlap++;
        if (OVL.length < 5)
          OVL.push(`гор. y=${Math.round(s.y1)} перекрытие ${Math.round(hi - lo)}px`);
      }
    } else {
      if (Math.abs(s.x1 - t.x1) > 2) continue;
      const lo = Math.max(Math.min(s.y1, s.y2), Math.min(t.y1, t.y2));
      const hi = Math.min(Math.max(s.y1, s.y2), Math.max(t.y1, t.y2));
      if (hi - lo > 6) {
        overlap++;
        if (OVL.length < 5)
          OVL.push(`верт. x=${Math.round(s.x1)} перекрытие ${Math.round(hi - lo)}px`);
      }
    }
  }
}

// 3) пересечения линий с блоками
let cross = 0;
for (const s of segs) {
  if (s.horiz) {
    const lo = Math.min(s.x1, s.x2);
    const hi = Math.max(s.x1, s.x2);
    if (boxes.some((b) => b.y < s.y1 && s.y1 < b.y + b.h && b.x < hi && lo < b.x + b.w)) cross++;
  } else {
    const lo = Math.min(s.y1, s.y2) + 2;
    const hi = Math.max(s.y1, s.y2) - 2;
    if (boxes.some((b) => b.x < s.x1 && s.x1 < b.x + b.w && b.y < hi && lo < b.y + b.h)) cross++;
  }
}

// 4) взаимные пересечения линий (крестом)
let xcross = 0;
for (const s of segs.filter((z) => z.horiz)) {
  for (const t of segs.filter((z) => !z.horiz)) {
    if (s.id === t.id) continue;
    const sl = Math.min(s.x1, s.x2),
      sh = Math.max(s.x1, s.x2);
    const tl = Math.min(t.y1, t.y2),
      th = Math.max(t.y1, t.y2);
    if (sl < t.x1 && t.x1 < sh && tl < s.y1 && s.y1 < th) xcross++;
  }
}

console.log(`стрелок: ${arrows.length}, сегментов: ${segs.length}, блоков: ${boxes.length}`);
console.log(`1. точек прикрепления с дублями: ${dupEP.length} ${dupEP.length ? '✗' : '✓'}`);
dupEP.slice(0, 5).forEach(([p, n]) => console.log(`     ${p} — ${n} линии`));
console.log(`2. наложений параллельных линий: ${overlap} ${overlap ? '✗' : '✓'}`);
OVL.forEach((o) => console.log('     ' + o));
console.log(`3. пересечений линий с блоками: ${cross} ${cross ? '✗' : '✓'}`);
console.log(`4. взаимных пересечений линий (крестом): ${xcross}`);

// 7) крюки: длина пути против прямого манхэттенского расстояния
let detour = 0;
const worst = [];
for (const a of arrows) {
  const p = a.points.map(([x, y]) => [a.x + x, a.y + y]);
  let len = 0;
  for (let i = 1; i < p.length; i++)
    len += Math.abs(p[i][0] - p[i - 1][0]) + Math.abs(p[i][1] - p[i - 1][1]);
  const direct = Math.abs(p[p.length - 1][0] - p[0][0]) + Math.abs(p[p.length - 1][1] - p[0][1]);
  const ratio = direct > 0 ? len / direct : 1;
  if (ratio > 1.6) {
    detour++;
    worst.push({ ratio: ratio.toFixed(2), len: Math.round(len), direct: Math.round(direct) });
  }
}
worst.sort((x, y) => y.ratio - x.ratio);
console.log(`7. маршрутов с крюком (путь > 1.6× прямого): ${detour} ${detour ? '✗' : '✓'}`);
worst.slice(0, 5).forEach((w) => console.log(`     ×${w.ratio}  путь ${w.len} против ${w.direct}`));
