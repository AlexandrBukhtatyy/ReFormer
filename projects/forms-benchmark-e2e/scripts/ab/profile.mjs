#!/usr/bin/env node
/**
 * CPU-профиль монтирования или ввода на несжатой сборке страницы бенча: доли времени по пакетам и
 * по функциям, с именами из карт исходников.
 *
 *   npm run bench:ab:profile                                  # рабочее дерево, кредит, монтирование
 *   npm run bench:ab:profile -- --rev HEAD~1 --form registration
 *   npm run bench:ab:profile -- --subtree '^createForm '      # разложить поддерево функции
 *   npm run bench:ab:profile -- --total 'createForm |compileSchema|__run'
 *   npm run bench:ab:profile -- --scenario type --live --lib rhf
 *
 * Опции: `--rev <ревизия>|work`, `--form`, `--lib`, `--scenario mount|type`, `--n 150`, `--cpu 4`,
 * `--field`, `--live`, `--top 25`. Сырой профиль — `results/_ab/<участник>-<форма>-<сценарий>.cpuprofile`
 * (открывается в DevTools → Performance).
 *
 * Профилировщик замедляет страницу: абсолютные числа выше, чем у `bench:ab`; сравнивать — доли.
 */
/* global window -- функции, переданные в page.evaluate, исполняются на странице */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { SourceMap } from 'node:module';
import path from 'node:path';
import { AB_DIR, DEFAULT_FIELD, LIVE_BUTTON, buildVariant, openPage, parseArgs } from './lib.mjs';

const args = parseArgs();
const form = args.form ?? 'credit';
const lib = args.lib ?? 'reformer-core';
const scenario = args.scenario ?? 'mount';
const count = Number(args.n ?? 150);
const cpu = Number(args.cpu ?? 4);
const top = Number(args.top ?? 25);

const dist = await buildVariant({ rev: args.rev ?? 'work', libs: [lib], forms: [form] });
const browser = await chromium.launch();
const { page, cdp } = await openPage(browser, { dist, lib, form, cpu });

const field = page.locator(`[data-testid="input-${args.field ?? DEFAULT_FIELD[form]}"]`);
const type = async (chars) => {
  await field.click();
  for (let i = 0; i < chars; i++) await page.keyboard.type('абвгдежзик'[i % 10]);
};
const remount = (n) =>
  page.evaluate(async (times) => {
    for (let i = 0; i < times; i++) {
      await window.__bench.unmount();
      await window.__bench.mount();
    }
  }, n);

// Прогрев: JIT и ленивые модули — вне профиля.
if (scenario === 'mount') {
  await remount(30);
} else {
  if (args.live) {
    await page.locator(`[data-testid="${LIVE_BUTTON[form]}"]`).click();
    await page.evaluate(() => window.__bench.idle());
  }
  await type(20);
  await field.fill('');
}

await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 25 });
await cdp.send('Profiler.start');
if (scenario === 'mount') await remount(count);
else await type(count);
const { profile } = await cdp.send('Profiler.stop');
await browser.close();

const profileFile = path.join(AB_DIR, `${lib}-${form}-${scenario}.cpuprofile`);
fs.writeFileSync(profileFile, JSON.stringify(profile));

// ── Разбор: позиция в бандле → исходник по карте → пакет.
const maps = new Map();
function mapFor(url) {
  if (!url.startsWith('http://bench.local/')) return null;
  if (!maps.has(url)) {
    const file = `${path.join(dist, new URL(url).pathname)}.map`;
    maps.set(
      url,
      fs.existsSync(file) ? new SourceMap(JSON.parse(fs.readFileSync(file, 'utf8'))) : null
    );
  }
  return maps.get(url);
}

function bucketOf(source) {
  if (!source) return 'прочее';
  if (/react-dom/.test(source)) return 'react-dom';
  if (/node_modules\/scheduler\//.test(source)) return 'scheduler';
  if (/node_modules\/react\//.test(source)) return 'react';
  if (/signals-core/.test(source)) return 'preact-signals';
  if (/packages\/reformer-cdk\//.test(source)) return '@reformer/cdk';
  if (/packages\/reformer-renderer-/.test(source)) return '@reformer/renderer';
  if (/packages\/reformer\//.test(source)) return '@reformer/core';
  if (/src\/shared\/harness/.test(source)) return 'стенд бенча';
  if (/src\/shared/.test(source)) return 'приложение: общее';
  if (/src\/libs/.test(source)) return 'приложение: участник';
  const pkg = source.split('node_modules/').pop().split('/');
  return pkg[0].startsWith('@') ? `${pkg[0]}/${pkg[1]}` : pkg[0];
}

const SPECIAL = new Set(['(garbage collector)', '(program)', '(idle)', '(root)']);
const shorten = (source) =>
  source.replace(/^.*node_modules\//, '').replace(/^.*\/(packages|projects)\//, '');

const byId = new Map(profile.nodes.map((node) => [node.id, node]));
const parentOf = new Map();
for (const node of profile.nodes)
  for (const child of node.children ?? []) parentOf.set(child, node.id);

const infoCache = new Map();
function infoOf(node) {
  let info = infoCache.get(node.id);
  if (info) return info;
  const frame = node.callFrame;
  let name = frame.functionName || '(anon)';
  let source = null;
  const map = mapFor(frame.url);
  if (map) {
    const entry = map.findEntry(frame.lineNumber, frame.columnNumber);
    source = entry?.originalSource ?? null;
    if (name === '(anon)' && entry?.name) name = entry.name;
  }
  const bucket = SPECIAL.has(frame.functionName)
    ? frame.functionName
    : map
      ? bucketOf(source)
      : 'браузер';
  info = { bucket, key: `${name} ${source ? shorten(source) : frame.url}:${frame.lineNumber + 1}` };
  infoCache.set(node.id, info);
  return info;
}

const selfTime = new Map();
profile.samples.forEach((id, index) => {
  selfTime.set(id, (selfTime.get(id) ?? 0) + (profile.timeDeltas[index] ?? 0));
});

const IDLE = new Set(['(idle)', '(program)', '(root)']);
const byBucket = new Map();
const bySelf = new Map();
const byTotal = new Map();
let busy = 0;
for (const [id, time] of selfTime) {
  const info = infoOf(byId.get(id));
  if (IDLE.has(info.bucket)) continue;
  busy += time;
  byBucket.set(info.bucket, (byBucket.get(info.bucket) ?? 0) + time);
  bySelf.set(info.key, (bySelf.get(info.key) ?? 0) + time);
  const seen = new Set();
  for (let cur = id; cur !== undefined; cur = parentOf.get(cur)) {
    const key = infoOf(byId.get(cur)).key;
    if (seen.has(key)) continue;
    seen.add(key);
    byTotal.set(key, (byTotal.get(key) ?? 0) + time);
  }
}

const perUnit = (time) => `${(time / 1000 / count).toFixed(3)} мс`;
const share = (time, whole) => `${((100 * time) / whole).toFixed(1).padStart(5)}%`;
const sorted = (map) => [...map].sort((a, b) => b[1] - a[1]);
const unit = scenario === 'mount' ? 'монтирование' : 'клавишу';

console.log(
  `\n${lib}/${form}, ${scenario}, CPU ${cpu}x: ${perUnit(busy)} на ${unit} (под профилем)`
);
console.log('\nПО ПАКЕТАМ (собственное время)');
for (const [key, time] of sorted(byBucket)) {
  console.log(`${share(time, busy)}  ${perUnit(time).padStart(10)}  ${key}`);
}
console.log('\nФУНКЦИИ (собственное время)');
for (const [key, time] of sorted(bySelf).slice(0, top)) console.log(`${share(time, busy)}  ${key}`);

if (typeof args.total === 'string') {
  const pattern = new RegExp(args.total);
  console.log(`\nВКЛЮЧАЯ ВЫЗВАННОЕ: ${args.total}`);
  for (const [key, time] of sorted(byTotal)
    .filter(([key]) => pattern.test(key))
    .slice(0, top)) {
    console.log(`${share(time, busy)}  ${perUnit(time).padStart(10)}  ${key}`);
  }
}

if (typeof args.subtree === 'string') {
  const pattern = new RegExp(args.subtree);
  const inside = new Map();
  let whole = 0;
  for (const [id, time] of selfTime) {
    let found = false;
    for (let cur = id; cur !== undefined && !found; cur = parentOf.get(cur)) {
      found = pattern.test(infoOf(byId.get(cur)).key);
    }
    if (!found) continue;
    whole += time;
    const key = infoOf(byId.get(id)).key;
    inside.set(key, (inside.get(key) ?? 0) + time);
  }
  console.log(`\nПОДДЕРЕВО ${args.subtree}: ${perUnit(whole)} на ${unit}`);
  for (const [key, time] of sorted(inside).slice(0, top)) {
    console.log(`${share(time, whole)}  ${perUnit(time).padStart(10)}  ${key}`);
  }
}
console.log(`\nпрофиль → ${path.relative(process.cwd(), profileFile)}`);
