#!/usr/bin/env node
/**
 * Утечка или прогрев: серия перемонтирований формы бенча со сборкой мусора и снимками кучи. Минута
 * вместо полного прогона, ответ — растёт ли число живых объектов, а не только `JSHeapUsedSize`.
 *
 *   npm run bench:leak                                        # reformer-core, кредит, prod dist
 *   npm run bench:leak -- --lib reformer-json --form registration
 *   npm run bench:leak -- --jit-off                           # без JIT: рост — только объекты
 *   npm run bench:leak -- --retainers --dist results/_ab/dist-work   # кто держит новые объекты
 *   npm run bench:leak -- --events                            # DOM-события на цикл
 *
 * Опции: `--warm 40` (циклов прогрева), `--cycles 200`, `--step 20` (циклов между точками), `--cpu 1`,
 * `--dist <каталог>` (сборки страниц; путь от forms-benchmark-e2e или абсолютный; по умолчанию
 * `projects/forms-benchmark/dist`, несжатые сборки с именами классов — `results/_ab/dist-*` от
 * bench:ab), `--watch <Класс,Класс>`, `--js-flags '<флаги V8>'`, `--top 16`.
 *
 * Как читать. Прогрев — первые десятки циклов: кучу растит код движка (байт-код, векторы обратной
 * связи, оптимизированный код), у всех участников и даже у пустой страницы. После прогрева:
 * - «объекты без JIT» — прирост живых объектов страницы между снимками; утечка — когда он растёт с
 *   числом циклов; ноль — утечки нет, даже если `JSHeapUsedSize` ещё растёт;
 * - «по типам» — где рост: `code`/`hidden` — JIT, `object`/`closure`/`array`/`native` — удержание;
 * - `--jit-off` (`--no-opt --no-maglev --no-sparkplug --no-lazy-feedback-allocation`) убирает рост
 *   кода совсем: остаток наклона — удержанные объекты;
 * - «новые и живые» (`--retainers`) включают подмену: если жива одна последняя форма, её объекты —
 *   новые, хотя счётчики классов не растут. Утечку выдаёт рост счётчиков, а не сам список.
 */
/* global window, document, HTMLElement, Document, Window -- функции, переданные в page.evaluate, исполняются на странице */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { APP, E2E, openPage, parseArgs } from '../ab/lib.mjs';
import {
  classCounts,
  freshGroups,
  netGrowth,
  objectBytes,
  retainerPath,
  takeHeapSnapshot,
  totalsByType,
} from '../../lib/heap.ts';

const JIT_OFF = '--no-opt --no-maglev --no-sparkplug --no-lazy-feedback-allocation';
const WATCH = [
  'FormControlNode',
  'FormGroupNode',
  'FormArrayNode',
  'ModelGroupNode',
  'ModelLeafNode',
  'LazyLeaf',
  'OwnedSignal',
  'HTMLSelectElement',
  'HTMLInputElement',
];

const args = parseArgs();
const lib = args.lib ?? 'reformer-core';
const form = args.form ?? 'credit';
const warm = Number(args.warm ?? 40);
const cycles = Number(args.cycles ?? 200);
const step = Number(args.step ?? 20);
const cpu = Number(args.cpu ?? 1);
const top = Number(args.top ?? 16);
const dist = typeof args.dist === 'string' ? path.resolve(E2E, args.dist) : path.join(APP, 'dist');
const watch = typeof args.watch === 'string' ? args.watch.split(',').filter(Boolean) : WATCH;
const jsFlags = [
  args['jit-off'] ? JIT_OFF : '',
  typeof args['js-flags'] === 'string' ? args['js-flags'] : '',
]
  .filter(Boolean)
  .join(' ');
if (cycles % step !== 0) throw new Error('bench:leak: --cycles должно делиться на --step');
// Без сборки страница не станет готовой и упадёт по таймауту — сказать причину сразу.
if (!fs.existsSync(path.join(dist, lib, form, 'index.html')))
  throw new Error(
    `bench:leak: нет сборки ${path.join(dist, lib, form)} — npm run bench:build или другой --dist`
  );

const kb = (bytes) => (bytes / 1024).toFixed(1);
const perCycle = (bytes, n) => kb(bytes / n);

const browser = await chromium.launch({ args: jsFlags ? [`--js-flags=${jsFlags}`] : [] });
try {
  const { context, page, cdp } = await openPage(browser, { dist, lib, form, cpu });
  await cdp.send('Performance.enable');
  const settle = async () => {
    await page.evaluate(() => window.__bench.idle());
    await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('HeapProfiler.collectGarbage');
  };
  const point = async () => {
    await settle();
    const { metrics } = await cdp.send('Performance.getMetrics');
    const dom = await cdp.send('Memory.getDOMCounters');
    const heap = metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0;
    return { heap, nodes: dom.nodes, listeners: dom.jsEventListeners };
  };
  const run = (n) =>
    page.evaluate(async (count) => {
      for (let i = 0; i < count; i++) {
        await window.__bench.mount();
        await window.__bench.unmount();
      }
    }, n);

  await page.evaluate(() => window.__bench.unmount());
  const loaded = await point();
  await run(warm);
  const warmed = await point();
  const before = await takeHeapSnapshot(cdp);
  if (args.events) await page.evaluate(installEventLog);
  const points = [warmed];
  for (let done = 0; done < cycles; done += step) {
    await run(step);
    points.push(await point());
  }
  const events = args.events ? await page.evaluate(readEventLog) : null;
  const after = await takeHeapSnapshot(cdp);
  await context.close();

  const totalsBefore = totalsByType(before);
  const totalsAfter = totalsByType(after);
  const last = points.at(-1);
  // Середина серии по окнам; при одном окне «вторая половина» — вся серия.
  const middle = Math.floor((points.length - 1) / 2);
  const half = points[middle];
  const halfCycles = (points.length - 1 - middle) * step;
  console.log(
    `bench:leak — ${lib}/${form}, ${path.relative(process.cwd(), dist) || dist}` +
      (jsFlags ? `, V8: ${jsFlags}` : '') +
      (cpu > 1 ? `, CPU ${cpu}x` : '')
  );
  console.log(
    `  прогрев ${warm}: +${kb(warmed.heap - loaded.heap)} КБ (${perCycle(warmed.heap - loaded.heap, warm)} КБ на цикл)`
  );
  console.log(
    `  после прогрева, КБ на цикл по окнам ${step}: ${points
      .slice(1)
      .map((p, i) => perCycle(p.heap - points[i].heap, step))
      .join(' ')}`
  );
  console.log(
    `  ${cycles} циклов: +${kb(last.heap - warmed.heap)} КБ — ${perCycle(last.heap - warmed.heap, cycles)} КБ на цикл, вторая половина ${perCycle(last.heap - half.heap, halfCycles)}`
  );
  console.log(
    `  объекты без JIT: ${perCycle(objectBytes(totalsAfter) - objectBytes(totalsBefore), cycles)} КБ на цикл (${kb(objectBytes(totalsAfter) - objectBytes(totalsBefore))} КБ за ${cycles})`
  );
  console.log(
    `  по типам (число/КБ): ${
      netGrowth(totalsBefore, totalsAfter)
        .map((r) => `${r.type} ${r.count >= 0 ? '+' : ''}${r.count}/${kb(r.size)}`)
        .join(', ') || 'без изменений'
    }`
  );
  console.log(
    `  DOM-узлов ${warmed.nodes} → ${last.nodes}, слушателей ${warmed.listeners} → ${last.listeners}`
  );
  const countsBefore = classCounts(before, watch);
  const countsAfter = classCounts(after, watch);
  const names = [...new Set([...Object.keys(countsBefore), ...Object.keys(countsAfter)])].sort();
  console.log(
    `  живых по классам (после прогрева → в конце): ${names.map((n) => `${n} ${countsBefore[n] ?? 0}→${countsAfter[n] ?? 0}`).join(', ') || 'классов из --watch нет (сжатая сборка?)'}`
  );

  if (args.retainers) {
    const groups = freshGroups(before, after);
    console.log(`\n  новые и живые (созданы после прогрева и пережили сборку), топ ${top}:`);
    for (const g of groups.slice(0, top))
      console.log(`    ${kb(g.size).padStart(8)} КБ ${String(g.count).padStart(6)}  ${g.key}`);
    const held = groups
      .filter((g) => ['object', 'closure', 'array', 'native'].includes(g.type))
      .slice(0, 4);
    for (const g of held) {
      console.log(`\n  кто держит ${g.key}:`);
      for (const line of retainerPath(after, g.samples[0])) console.log(`    ${line}`);
    }
  }

  if (events) {
    console.log(`\n  DOM-события за ${cycles} циклов (на цикл, цели):`);
    for (const [type, { count, targets }] of Object.entries(events).sort(
      (a, b) => b[1].count - a[1].count
    ))
      console.log(
        `    ${(count / cycles).toFixed(2).padStart(7)}  ${type}  ${Object.entries(targets)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([t, n]) => `${t}×${n}`)
          .join(', ')}`
      );
  }
} finally {
  await browser.close();
}

/**
 * Слушатель захвата на `window` для всех типов событий элементов, документа и окна: захват с `window`
 * видит и события с целью `document`, и не всплывающие.
 */
function installEventLog() {
  const log = {};
  const describe = (target) => {
    if (target === document) return 'document';
    if (target === window) return 'window';
    if (!(target instanceof HTMLElement)) return String(target?.nodeName ?? target);
    const id = target.getAttribute('data-testid') ?? target.getAttribute('name') ?? target.id;
    return `${target.tagName.toLowerCase()}${id ? `[${id}]` : ''}`;
  };
  const types = new Set(['selectionchange', 'focusin', 'focusout', 'DOMContentLoaded']);
  for (const proto of [HTMLElement.prototype, Document.prototype, Window.prototype])
    for (const key of Object.getOwnPropertyNames(proto))
      if (key.startsWith('on')) types.add(key.slice(2));
  const record = (event) => {
    const entry = (log[event.type] ??= { count: 0, targets: {} });
    entry.count++;
    const target = describe(event.target);
    entry.targets[target] = (entry.targets[target] ?? 0) + 1;
  };
  for (const type of types) window.addEventListener(type, record, true);
  window.__leakEvents = log;
}

function readEventLog() {
  return window.__leakEvents;
}
