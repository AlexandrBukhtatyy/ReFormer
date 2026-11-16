#!/usr/bin/env node
/**
 * Быстрый замер «до/после» для правок ядра: два и более вариантов сборки страницы бенча, раунды
 * чередуются, троттлинг CPU. Минуты вместо полного прогона `npm run bench`.
 *
 *   npm run bench:ab                              # HEAD против рабочего дерева, кредит, монтирование
 *   npm run bench:ab -- --base HEAD~3             # другая точка отсчёта
 *   npm run bench:ab -- --variants a=v1.2.0,b=HEAD,c=work
 *   npm run bench:ab -- --scenario type --live    # JS на клавишу в живой фазе проверки
 *   npm run bench:ab -- --with rhf,formik         # ориентиры: другие участники в тех же условиях
 *
 * Опции: `--form credit|registration`, `--lib reformer-core`, `--scenario mount|type`, `--rounds 6`,
 * `--n 80` (монтирований либо клавиш на раунд), `--cpu 4`, `--field <testid>`, `--live`, `--rebuild`.
 *
 * Что меряется. `mount` — `window.__bench.mount().sync`: рендер, commit и эффекты перемонтирования
 * (как фаза «Перемонтирование» отчёта). `type` — время JS на клавишу по CDP (`ScriptDuration`).
 * `performance.now()` в Chrome огрублён до 0.1 мс, поэтому сравнивать надо средние, а не медианы.
 * Разность считается по раундам: варианты в раунде идут подряд и делят дрейф машины.
 */
/* global window -- функции, переданные в page.evaluate, исполняются на странице */
import { chromium } from '@playwright/test';
import { describeSample, sampleFor } from '../../lib/background.ts';
import {
  DEFAULT_FIELD,
  LIVE_BUTTON,
  buildVariant,
  mean,
  median,
  openPage,
  parseArgs,
  standardError,
  trimmedMean,
} from './lib.mjs';

const args = parseArgs();
const form = args.form ?? 'credit';
const lib = args.lib ?? 'reformer-core';
const scenario = args.scenario ?? 'mount';
const rounds = Number(args.rounds ?? 6);
const count = Number(args.n ?? 80);
const cpu = Number(args.cpu ?? 4);
const others = typeof args.with === 'string' ? args.with.split(',').filter(Boolean) : [];
if (!['mount', 'type'].includes(scenario)) throw new Error(`bench:ab: сценарий «${scenario}»?`);

// Варианты ядра: имя → ревизия. По умолчанию точка отсчёта против рабочего дерева.
const revisions =
  typeof args.variants === 'string'
    ? args.variants.split(',').map((item) => item.split('='))
    : [
        ['base', args.base ?? 'HEAD'],
        ['work', 'work'],
      ];

const variants = [];
for (const [name, rev] of revisions) {
  const dist = await buildVariant({ rev, libs: [lib], forms: [form], rebuild: !!args.rebuild });
  variants.push({ name, dist, lib });
}
if (others.length > 0) {
  const dist = await buildVariant({ rev: 'work', libs: others, forms: [form] });
  for (const other of others) variants.push({ name: other, dist, lib: other });
}

const sample = await sampleFor(3000, process.pid);
if (sample?.dirty) {
  console.warn('⚠️  машина занята — разность вариантов устойчива к этому хуже обычного:');
  for (const line of describeSample(sample)) console.warn(`   ${line}`);
}

/** Замер монтирования: прогрев, затем `count` перемонтирований. */
async function measureMount(page) {
  return page.evaluate(async (n) => {
    for (let i = 0; i < 10; i++) {
      await window.__bench.unmount();
      await window.__bench.mount();
    }
    const samples = [];
    for (let i = 0; i < n; i++) {
      await window.__bench.unmount();
      samples.push((await window.__bench.mount()).sync);
    }
    return samples;
  }, count);
}

/** Замер ввода: JS на клавишу (мс) пачками по 20 клавиш. */
async function measureType(page, cdp) {
  const field = page.locator(`[data-testid="input-${args.field ?? DEFAULT_FIELD[form]}"]`);
  if (args.live) {
    await page.locator(`[data-testid="${LIVE_BUTTON[form]}"]`).click();
    await page.evaluate(() => window.__bench.idle());
  }
  await cdp.send('Performance.enable');
  const scriptMs = async () => {
    const { metrics } = await cdp.send('Performance.getMetrics');
    return 1000 * metrics.find((metric) => metric.name === 'ScriptDuration').value;
  };
  const type = async (chars) => {
    await field.click();
    for (let i = 0; i < chars; i++) await page.keyboard.type('абвгдежзик'[i % 10]);
  };
  await type(20);
  await field.fill('');
  const samples = [];
  const batch = 20;
  for (let done = 0; done < count; done += batch) {
    const before = await scriptMs();
    await type(batch);
    samples.push(((await scriptMs()) - before) / batch);
    await field.fill('');
  }
  return samples;
}

const browser = await chromium.launch();
const all = new Map(variants.map((variant) => [variant.name, []]));
const perRound = new Map(variants.map((variant) => [variant.name, []]));
for (let round = 0; round < rounds; round++) {
  // Порядок вариантов меняется через раунд: прогрев машины не достаётся одному и тому же.
  const order = round % 2 === 0 ? variants : [...variants].reverse();
  for (const variant of order) {
    const { context, page, cdp } = await openPage(browser, { ...variant, form, cpu });
    const samples = scenario === 'mount' ? await measureMount(page) : await measureType(page, cdp);
    all.get(variant.name).push(...samples);
    perRound.get(variant.name).push(mean(samples));
    await context.close();
  }
  if (process.stdout.isTTY) process.stdout.write(`раунд ${round + 1}/${rounds}\r`);
}
await browser.close();

const unit = scenario === 'mount' ? 'мс на монтирование' : 'мс JS на клавишу';
console.log(
  `\n${lib}/${form}, ${scenario}${args.live ? ' (живая фаза)' : ''}, CPU ${cpu}x, ${unit}`
);
const width = Math.max(...variants.map((variant) => variant.name.length));
for (const { name } of variants) {
  const values = all.get(name);
  console.log(
    `${name.padEnd(width)}  среднее ${mean(values).toFixed(3)}  усечённое ${trimmedMean(values).toFixed(3)}` +
      `  медиана ${median(values).toFixed(2)}  n=${values.length}`
  );
}

// Разность с первым вариантом — по раундам (парно), ± две стандартные ошибки.
const [first, ...rest] = variants;
const base = perRound.get(first.name);
for (const { name } of rest) {
  const diffs = perRound.get(name).map((value, index) => value - base[index]);
  const delta = mean(diffs);
  const spread = 2 * standardError(diffs);
  const share = (100 * delta) / mean(base);
  console.log(
    `${name} − ${first.name}: ${delta >= 0 ? '+' : ''}${delta.toFixed(3)} ± ${spread.toFixed(3)} мс` +
      ` (${share >= 0 ? '+' : ''}${share.toFixed(1)} %)`
  );
}
