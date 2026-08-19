#!/usr/bin/env node
/**
 * Генератор safelist'а Tailwind по словарям классов всех китов реестра.
 *
 * Зачем: Tailwind v4 генерирует утилиту, только если увидел её ИМЯ при сканировании исходников.
 * `className` формы живёт в JSON-схеме пользователя (память браузера, открытый файл) — в
 * сканирование он не попадает никогда, поэтому в превью работают лишь те классы, что случайно
 * встретились в коде билдера или кита. Отсюда два разных бага с одним корнем:
 *   1. `md:grid-cols-2` в схеме не отрисовывается — правила в бандле нет;
 *   2. словарь подсказок предлагает мёртвые классы: строки, собранные шаблоном
 *      (`bg-${color}-${shade}` в `class-catalog.ts`), сканер не видит — в отличие от литералов.
 *
 * Решение: то, что билдер ПРЕДЛАГАЕТ, он обязан и уметь отрисовать. Словарь каждого кита
 * (`kit.styles.classNames`) разворачивается в `@source inline(...)` — Tailwind принимает такой
 * класс как найденный. Список генерируется, а не пишется руками: иначе он разъедется со словарём
 * при первой же правке кита (за этим следит `src/kits/safelist.test.ts`).
 *
 * Использование:
 *   node scripts/gen-kit-safelist.mjs [--check]
 * `--check` ничего не пишет, а падает при расхождении файла со словарями (для CI).
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

/** Файл, который читает `src/index.css`. Правится ТОЛЬКО этим скриптом. */
export const SAFELIST_PATH = join(root, 'src', 'kit-safelist.gen.css');

/** Каталоги китов, поставляемых пакетами (те же, что вшивает `src/kits/registry.ts`). */
const PACKAGE_CATALOGS = ['@reformer/ui-kit/catalog', '@reformer/kit-hexa-ui/catalog'];

/** Каталоги китов, сгенерированных для пакетов без `./catalog` (`gen-kit-catalog.mjs`). */
const GENERATED_DIR = join(root, 'src', 'kits', 'generated');

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

/** Каталоги всех китов реестра в стабильном порядке: сначала пакетные, затем сгенерированные. */
export async function loadCatalogs() {
  const out = [];
  for (const spec of PACKAGE_CATALOGS) {
    const path = fileURLToPath(await import.meta.resolve(spec));
    out.push({ source: spec, catalog: await readJson(path) });
  }
  const generated = (await readdir(GENERATED_DIR)).filter((f) => f.endsWith('.json')).sort();
  for (const file of generated) {
    out.push({ source: `generated/${file}`, catalog: await readJson(join(GENERATED_DIR, file)) });
  }
  return out;
}

/**
 * Классы словарей в порядке «кит → группа → класс», дубли схлопнуты (порядок курируемый: так
 * сгенерированный файл читается как словарь, а не как отсортированная свалка).
 */
export function collectSafelistClasses(catalogs) {
  const seen = new Set();
  const out = [];
  for (const { catalog } of catalogs) {
    for (const group of catalog?.kit?.styles?.classNames ?? []) {
      for (const cls of group.classes ?? []) {
        if (seen.has(cls)) continue;
        seen.add(cls);
        out.push(cls);
      }
    }
  }
  return out;
}

/** Содержимое `kit-safelist.gen.css` для набора классов. */
export function renderSafelistCss(classes) {
  const header = [
    '/* СГЕНЕРИРОВАНО `npm run generate:kit-safelist` — не редактировать руками.',
    ' *',
    ' * Словари классов китов (`kit.styles.classNames`) → safelist Tailwind. Без этого утилита,',
    ' * которую билдер предложил в подсказках, но которая нигде не встречается в исходниках,',
    ' * в бандл не попадает — и класс, проставленный в схеме формы, молча не действует.',
    ' *',
    ' * Ручной ввод в поле `className` шире словаря: класс вне этого списка отрисуется, только если',
    ' * встречается в коде билдера или кита. Инспектор помечает такие классы (см. `ClassNameField`).',
    ' */',
    '',
  ].join('\n');
  const body = classes.map((c) => `@source inline("${c}");`).join('\n');
  return `${header}${body}\n`;
}

/** CLI: перегенерировать файл (или, с `--check`, убедиться, что он актуален). */
async function main() {
  const classes = collectSafelistClasses(await loadCatalogs());
  const css = renderSafelistCss(classes);

  if (process.argv.includes('--check')) {
    const current = await readFile(SAFELIST_PATH, 'utf8').catch(() => '');
    if (current !== css) {
      console.error(
        `kit-safelist.gen.css разошёлся со словарями китов (${classes.length} классов). ` +
          'Запусти: npm run generate:kit-safelist'
      );
      process.exit(1);
    }
    console.log(`kit-safelist.gen.css актуален: ${classes.length} классов`);
    return;
  }

  await writeFile(SAFELIST_PATH, css);
  console.log(`kit-safelist.gen.css: ${classes.length} классов из словарей китов`);
}

// Импорт из теста не должен ничего писать на диск — работаем только при прямом запуске.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
