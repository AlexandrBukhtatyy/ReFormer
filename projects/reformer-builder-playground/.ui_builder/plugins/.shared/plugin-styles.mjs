/**
 * Стили плагина-движка: утилиты Tailwind, которых нет в CSS билдера.
 *
 * Плагин проекта пользуется классами оболочки и токенами кита — свой CSS ему не нужен, пока
 * он не выходит за то, что оболочка уже собрала. Движки выходят: пока они жили внутри билдера,
 * его Tailwind сканировал их исходники и собирал правила и для `bg-amber-50/60`, и для
 * `text-[9px]`. Уехав в каталог плагинов проекта, они из-под сканера вышли — а класс без правила
 * молчит: вёрстка не падает, она просто теряет отступ, цвет или сетку.
 *
 * Поэтому недостающее плагин везёт сам — таблицей `styles` манифеста, которую оболочка ограничит
 * его поддеревом. Таблица ВЫЧИСЛЯЕТСЯ, а не пишется руками:
 *
 *   кандидаты плагина − кандидаты билдера → Tailwind → `src/styles.css`
 *
 * Только разность, а не все классы плагина — намеренно. Оболочка дописывает к каждому селектору
 * контейнер плагина, то есть правило из таблицы плагина сильнее такого же правила билдера. Пока
 * в таблице лишь то, чего у билдера нет, спорить ему не с кем; привези плагин копию
 * `bg-transparent`, она перебила бы `hover:bg-accent` кнопки кита, чьё правило осталось у билдера.
 *
 * Собирается тем же Tailwind и с той же темой, что CSS билдера: токены кита и вариант `dark`
 * берутся ссылкой (`@reference`) и в таблицу плагина не попадают — блок `:root` под скоупом
 * плагина заморозил бы светлую тему внутри его панелей.
 *
 * Запуск — из каталога пакета плагина, перед его сборкой (`prebuild:dev`, `prebuild:dist`,
 * `predev`); `src/styles.css` в git не едет.
 *
 *   node ../../.shared/plugin-styles.mjs [--with <каталог>]…
 *
 * `--with` добавляет к исходникам плагина каталог, чьи классы рисует этот плагин (ядро домена:
 * классы каталога тегов и шаблонов печати попадают в превью данными, а не разметкой).
 *
 * @module plugins/.shared/plugin-styles
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../../../..');
const BUILDER = resolve(REPO, 'projects/reformer-builder');
const BUILDER_CSS = resolve(BUILDER, 'src/index.css');
const KIT_THEME = resolve(REPO, 'packages/reformer-ui-kit/src/styles/theme.css');

/** Куда пишется таблица — относительно каталога пакета плагина. */
export const PLUGIN_STYLES_FILE = 'src/styles.css';

/** Имя npm-скрипта, которым пакет плагина собирает таблицу. */
export const PLUGIN_STYLES_SCRIPT = 'generate:styles';

/** Файлы, классы из которых плагин не рисует: проверки и их данные. */
const NOT_RENDERED = [
  '**/*.test.*',
  '**/__snapshots__/**',
  '**/__fixtures__/**',
  '**/__golden__/**',
  // Сама таблица: иначе второй прогон читал бы классы из результата первого.
  '**/styles.css',
];

/**
 * Tailwind берётся тот же, что у билдера: `@tailwindcss/node` и сканер — зависимости его
 * vite-плагина, в манифестах проекта их нет. Вторая копия собрала бы правила другой версией.
 */
async function loadTailwind() {
  const fromBuilder = createRequire(resolve(BUILDER, 'package.json'));
  const fromVitePlugin = createRequire(fromBuilder.resolve('@tailwindcss/vite'));
  const load = (name) => import(pathToFileURL(fromVitePlugin.resolve(name)).href);
  const [{ compile }, { Scanner }] = await Promise.all([
    load('@tailwindcss/node'),
    load('@tailwindcss/oxide'),
  ]);
  return { compile, Scanner };
}

const cssPath = (from, to) => relative(from, to).split('\\').join('/');

/** Аргументы запуска: каталоги `--with`, разрешённые от каталога пакета. */
export function parsePluginStylesArgs(argv, packageDir) {
  const extra = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== '--with' || argv[index + 1] === undefined) {
      throw new Error(`неизвестный аргумент «${argv[index]}». Ожидается: [--with <каталог>]…`);
    }
    extra.push(resolve(packageDir, argv[index + 1]));
    index += 1;
  }
  return extra;
}

const rendered = (base) => [
  { base, pattern: '**/*', negated: false },
  ...NOT_RENDERED.map((pattern) => ({ base, pattern, negated: true })),
];

/** Кандидаты билдера считаются один раз на процесс: это самая долгая часть работы. */
let providedByBuilder;

async function builderCandidates(tailwind) {
  providedByBuilder ??= (async () => {
    // Ровно те источники, что у vite-плагина билдера: корень его проекта и `@source` из CSS.
    const host = await tailwind.compile(readFileSync(BUILDER_CSS, 'utf8'), {
      base: dirname(BUILDER_CSS),
      onDependency() {},
    });
    const sources = [{ base: BUILDER, pattern: '**/*', negated: false }, ...host.sources];
    return new Set(new tailwind.Scanner({ sources }).scan());
  })();
  return providedByBuilder;
}

/**
 * Таблица недостающих утилит пакета плагина.
 *
 * `rules` — сколько правил-утилит получилось. Ноль значит, что плагину свой CSS не нужен:
 * кандидатов вне CSS билдера сканер находит всегда (любое слово из кода — кандидат), а правилом
 * становится только настоящий класс.
 */
export async function pluginStyles(packageDir, extraDirs = []) {
  const tailwind = await loadTailwind();
  const provided = await builderCandidates(tailwind);

  const own = [resolve(packageDir, 'src'), ...extraDirs].flatMap(rendered);
  const missing = new tailwind.Scanner({ sources: own })
    .scan()
    .filter((candidate) => !provided.has(candidate))
    .sort();

  // Тема по умолчанию эмитится: `--color-amber-700` билдер объявляет, только если сам им
  // пользуется. Тема кита — ссылкой: её токены живут в `:root` билдера и меняются с темой.
  const outputDir = dirname(resolve(packageDir, PLUGIN_STYLES_FILE));
  const input = [
    '@layer theme, utilities;',
    "@import 'tailwindcss/theme.css' layer(theme);",
    "@import 'tailwindcss/utilities.css' layer(utilities) source(none);",
    `@reference '${cssPath(outputDir, KIT_THEME)}';`,
  ].join('\n');
  const compiler = await tailwind.compile(input, { base: outputDir, onDependency() {} });
  const css = compiler.build(missing);
  const rules = (css.match(/^ {2}\.[^\n]*\{$/gm) ?? []).length;
  return { css, rules };
}

const HEADER = [
  '/*',
  ' * СГЕНЕРИРОВАНО `.shared/plugin-styles.mjs` — не править руками, в git не едет.',
  ' * Утилиты Tailwind, которыми пользуется плагин и которых нет в CSS билдера.',
  ' */',
  '',
].join('\n');

async function main() {
  const packageDir = process.cwd();
  const extra = parsePluginStylesArgs(process.argv.slice(2), packageDir);
  const { css, rules } = await pluginStyles(packageDir, extra);
  const output = resolve(packageDir, PLUGIN_STYLES_FILE);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, HEADER + css);
  console.log(`✓ ${PLUGIN_STYLES_FILE}: правил ${rules}, ${css.length} байт`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`✗ стили плагина не собраны: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}
