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
 *   node ../../.shared/plugin-styles.mjs [--with <каталог>]… [--plugin <пакет>]… [--include <файл>]…
 *
 * `--with` добавляет к исходникам плагина каталог, чьи классы рисует этот плагин (ядро домена:
 * классы каталога тегов и шаблонов печати попадают в превью данными, а не разметкой).
 *
 * `--plugin` подключает плагин Tailwind (`@tailwindcss/typography`). Классы, которые существуют
 * только благодаря ему (`prose`), плагин везёт ВСЕГДА, что бы ни нашёл сканер в исходниках
 * билдера: билдер этого плагина Tailwind не подключает, и правила для такого класса у него нет,
 * даже если само слово встретилось в его тексте. «Существует только благодаря плагину»
 * вычисляется, а не перечисляется: каждый кандидат спрашивается у Tailwind дважды — с плагином
 * и без.
 *
 * Правила таких классов идут в слой `components`, а не `utilities`. В одной сборке Tailwind
 * типографика стоит раньше утилит, и на равной специфичности побеждает утилита: `max-w-none`
 * снимает ширину колонки, `p-3` — поля блока кода. В таблице плагина этот порядок теряется:
 * оболочка дописывает к селектору контейнер, правило типографики становится сильнее утилиты,
 * оставшейся у билдера, и колонка молча сужается до 65ch. Слой ниже утилит возвращает прежнее
 * «утилита сильнее типографики» — уже не порядком, а каскадом, и для утилит билдера тоже.
 * Постоянные блоки (`--include`), объявленные в том же слое, идут после и на равной
 * специфичности побеждают типографику.
 *
 * `--include` дописывает к таблице постоянный блок CSS из файла пакета — правила, которые
 * утилитами не выражаются: палитра подсветки кода живёт на классах чужой библиотеки. Блок идёт
 * как есть и считается в `rules` — плагин, у которого есть только он, тоже обязан объявить
 * таблицу.
 *
 * Блок обязан ссылаться на токены кита (`--chart-2`), а не на переменные темы Tailwind
 * (`--color-chart-2`): вторые в CSS билдера объявлены, только пока он сам ими пользуется,
 * и ссылка на необъявленную переменную молчит — правило есть, а цвет унаследован. Tailwind этот
 * блок не обрабатывает, подставить значение некому, поэтому такая ссылка — отказ сборки.
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
  // Любой CSS пакета: постоянные блоки (`--include`) — не разметка, классы в них не утилиты.
  '**/*.css',
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
  const [node, { Scanner }] = await Promise.all([
    load('@tailwindcss/node'),
    load('@tailwindcss/oxide'),
  ]);
  return {
    compile: node.compile,
    // Дизайн-система отвечает по ОДНОМУ кандидату: есть ли у него правило. Компилятор так
    // не умеет — он отдаёт таблицу на весь набор разом.
    loadDesignSystem: node.__unstable__loadDesignSystem,
    Scanner,
  };
}

const cssPath = (from, to) => relative(from, to).split('\\').join('/');

const USAGE = '[--with <каталог>]… [--plugin <пакет>]… [--include <файл>]…';

/**
 * Аргументы запуска: каталоги `--with` и файлы `--include` — разрешённые от каталога пакета,
 * плагины Tailwind `--plugin` — именами пакетов.
 */
export function parsePluginStylesArgs(argv, packageDir) {
  const options = { extraDirs: [], plugins: [], includes: [] };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (value === undefined || !['--with', '--plugin', '--include'].includes(flag)) {
      throw new Error(`неизвестный аргумент «${flag}». Ожидается: ${USAGE}`);
    }
    if (flag === '--with') options.extraDirs.push(resolve(packageDir, value));
    else if (flag === '--plugin') options.plugins.push(value);
    else options.includes.push(resolve(packageDir, value));
  }
  return options;
}

/**
 * Переменные темы Tailwind, которые объявляет кит (`@theme inline`): имя → на что оно ссылается.
 *
 * В документе их может не быть: Tailwind эмитит переменную темы, только когда на неё ссылается
 * CSS, который он собирает, — то есть CSS билдера. Токены же кита (`:root`) есть всегда.
 */
function kitThemeVariables() {
  const theme = readFileSync(KIT_THEME, 'utf8');
  const block = /@theme[^{]*\{([^}]*)\}/.exec(theme)?.[1] ?? '';
  return new Map(
    [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()])
  );
}

/** Постоянный блок не вправе ссылаться на переменные темы Tailwind — см. шапку модуля. */
function assertKitTokensOnly(file, css, packageDir) {
  const theme = kitThemeVariables();
  const fragile = [
    ...new Set(
      [...css.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]).filter((n) => theme.has(n))
    ),
  ].sort();
  if (fragile.length === 0) return;
  const hints = fragile.map((name) => `${name} → ${theme.get(name)}`).join(', ');
  throw new Error(
    `«${cssPath(packageDir, file)}» ссылается на переменные темы Tailwind — билдер объявляет их, ` +
      `только пока сам ими пользуется. Нужны токены кита: ${hints}`
  );
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
 * `rules` — сколько правил получилось: утилит и правил постоянных блоков. Ноль значит, что
 * плагину свой CSS не нужен: кандидатов вне CSS билдера сканер находит всегда (любое слово
 * из кода — кандидат), а правилом становится только настоящий класс.
 *
 * @param options `extraDirs`, `plugins`, `includes` — см. шапку модуля; всё необязательно.
 */
export async function pluginStyles(packageDir, options = {}) {
  const { extraDirs = [], plugins = [], includes = [] } = options;
  const tailwind = await loadTailwind();
  const provided = await builderCandidates(tailwind);

  const own = new tailwind.Scanner({
    sources: [resolve(packageDir, 'src'), ...extraDirs].flatMap(rendered),
  }).scan();

  // Тема по умолчанию эмитится: `--color-amber-700` билдер объявляет, только если сам им
  // пользуется. Тема кита — ссылкой: её токены живут в `:root` билдера и меняются с темой.
  const outputDir = dirname(resolve(packageDir, PLUGIN_STYLES_FILE));
  const inputFor = (withPlugins, layer = 'utilities') =>
    [
      '@layer theme, components, utilities;',
      "@import 'tailwindcss/theme.css' layer(theme);",
      `@import 'tailwindcss/utilities.css' layer(${layer}) source(none);`,
      `@reference '${cssPath(outputDir, KIT_THEME)}';`,
      ...(withPlugins ? plugins.map((name) => `@plugin '${name}';`) : []),
    ].join('\n');

  // Классы плагина Tailwind — мимо разности: правила для них у билдера нет, даже если слово
  // встретилось в его тексте (см. шапку модуля).
  const pluginOnly = new Set();
  if (plugins.length > 0) {
    const [extended, plain] = await Promise.all([
      tailwind.loadDesignSystem(inputFor(true), { base: outputDir }),
      tailwind.loadDesignSystem(inputFor(false), { base: outputDir }),
    ]);
    const withPlugins = extended.candidatesToCss(own);
    const without = plain.candidatesToCss(own);
    own.forEach((candidate, index) => {
      if (withPlugins[index] !== null && without[index] === null) pluginOnly.add(candidate);
    });
  }

  const needed = own
    .filter((candidate) => pluginOnly.has(candidate) || !provided.has(candidate))
    .sort();

  // Две сборки: классы плагина Tailwind — в слой `components`, остальное — в `utilities`
  // (см. шапку модуля). Порядок внутри каждой — тот, что дал бы Tailwind в одной сборке.
  const build = async (candidates, layer) => {
    if (candidates.length === 0) return '';
    const compiler = await tailwind.compile(inputFor(true, layer), {
      base: outputDir,
      onDependency() {},
    });
    return compiler.build(candidates);
  };
  const [components, utilities] = await Promise.all([
    build(
      needed.filter((candidate) => pluginOnly.has(candidate)),
      'components'
    ),
    build(
      needed.filter((candidate) => !pluginOnly.has(candidate)),
      'utilities'
    ),
  ]);
  const blocks = includes.map((file) => {
    const block = readFileSync(file, 'utf8').trim();
    assertKitTokensOnly(file, block, packageDir);
    return `/* ${cssPath(packageDir, file)} */\n${block}\n`;
  });
  const css = [components, utilities, ...blocks].filter((part) => part !== '').join('\n');
  // Правило-утилита стоит внутри `@layer` — с отступом в два пробела; правило постоянного
  // блока — у края либо так же внутри слоя. Считается и то и другое: оба требуют таблицы.
  const rules = (css.match(/^(?: {2})?\.[^\n{}]*\{$/gm) ?? []).length;
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
  const options = parsePluginStylesArgs(process.argv.slice(2), packageDir);
  const { css, rules } = await pluginStyles(packageDir, options);
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
