/**
 * Собирает плагины ПРИЛОЖЕНИЯ рядом со сборкой билдера: `dist/plugins/`.
 *
 * Плагины приложения — пакеты, которые едут вместе с билдером и работают для любого проекта
 * (`src/shell/platform/plugin/application`). Их исходники живут вне билдера, в каталоге
 * плагинов проекта-образца; какие из них образуют приложение — список `application-plugins.json`.
 * Скрипт берёт у каждого сборку для поставки (`<пакет>/dist`, её делает `build:dist` пакета),
 * кладёт её в `dist/plugins/<тот же путь>` и пишет индекс, по которому оболочка их находит.
 *
 * Раскладка каталога сохраняется как есть (`reformer/editor`, `rjsf/render`): загрузчик оболочки
 * узнаёт каталог домена по тому же правилу, что и в проекте, и второй раскладки не появляется.
 *
 * Ничего не собирает сам и не угадывает: несобранный пакет — отказ с именем команды. Тихо
 * пропущенный плагин означал бы билдер, опубликованный без движка формы.
 *
 * Запуск: `node scripts/collect-application-plugins.mjs` из каталога билдера, ПОСЛЕ `vite build`
 * (он очищает `dist`) и после `build:dist` пакетов плагинов.
 *
 * ## Один каталог на два набора
 *
 * Наборов плагинов приложения два: у билдера в своей вкладке и у билдера, встроенного
 * в приложение (`application-plugins.embedded.json`). Второму не нужны рендереры — плагины,
 * которыми форму рисует сам билдер, — зато нужен плагин «Превью приложением»: форму там рисует
 * приложение. Превью-хост есть в обоих: он не рисует, а выбирает, чем. Различаются наборы
 * парой плагинов, поэтому каталог один — их объединение, — а набор выбирает тот, кто каталог
 * отдаёт:
 *
 * - лаунчер отдаёт `index.json`, записанный здесь, — в нём набор своей вкладки;
 * - плагин dev-сервера приложения (`vite/plugin.mjs`) строит индекс сам, по второму списку.
 *
 * ## Свой список и свой каталог
 *
 * ```
 * node scripts/collect-application-plugins.mjs --list my-plugins.json --out ../somewhere/plugins
 * ```
 *
 * Так собирают каталог под флаг `--plugins` лаунчера. С названным `--list` в каталог идёт ровно
 * он, без второго набора. `--list` — путь от текущего каталога; `root` внутри списка считается
 * от каталога самого списка. `--out` — путь от текущего каталога; с ним собранный билдер
 * не нужен: плагины кладутся не в его `dist`.
 *
 * @module scripts/collect-application-plugins
 */

import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPluginsIndex, PLUGINS_INDEX_FILE } from '../bin/plugins-index.mjs';

const fail = (message) => {
  console.error(`collect-application-plugins: ${message}`);
  process.exit(1);
};

/** Значение именованного аргумента либо `undefined`. Аргумент без значения — отказ. */
const argument = (name) => {
  const at = process.argv.indexOf(name);
  if (at === -1) return undefined;
  const value = process.argv[at + 1];
  if (value === undefined || value.startsWith('--')) fail(`у «${name}» нет значения`);
  return value;
};

const builderDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const listArgument = argument('--list');
const outArgument = argument('--out');
/** Каталог по умолчанию — рядом со сборкой билдера; названный — где угодно. */
const besideBuilder = outArgument === undefined;
const outDir = besideBuilder
  ? join(builderDir, 'dist', 'plugins')
  : resolve(process.cwd(), outArgument);

const isDirectory = async (path) => {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
};

/**
 * Читает список: каталоги плагинов и корень, от которого они считаются.
 *
 * `root` — от каталога списка, а не билдера: список может лежать где угодно, и «где плагины»
 * он называет относительно себя.
 */
const readList = async (listPath) => {
  const list = JSON.parse(await readFile(listPath, 'utf8'));
  if (typeof list.root !== 'string' || !Array.isArray(list.plugins)) {
    fail(`«${listPath}» должен называть «root» и список «plugins»`);
  }
  return { root: resolve(dirname(listPath), list.root), plugins: list.plugins };
};

/** Набор, который попадает в индекс. */
const indexed = await readList(
  listArgument === undefined
    ? join(builderDir, 'application-plugins.json')
    : resolve(process.cwd(), listArgument)
);
/** Набор билдера, встроенного в приложение: едет в том же каталоге, но мимо индекса. */
const embedded =
  listArgument === undefined
    ? await readList(join(builderDir, 'application-plugins.embedded.json'))
    : { root: indexed.root, plugins: [] };

if (besideBuilder && !(await isDirectory(join(builderDir, 'dist')))) {
  fail('нет dist/ билдера — сначала соберите его (npm run build)');
}

/** Каталог плагина → его сборка для поставки. Плагин, названный обоими списками, — один. */
const builds = new Map();
for (const { root, plugins } of [indexed, embedded]) {
  for (const plugin of plugins) builds.set(plugin, join(root, plugin, 'dist'));
}

// Каталог пересобирается целиком: плагин, убранный из списка, не должен остаться в поставке.
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const [plugin, built] of builds) {
  if (!(await isDirectory(built))) {
    fail(
      `плагин «${plugin}» не собран для поставки: нет «${built}».\n` +
        `  Соберите: npm run build:dist -w ${dirname(built)}`
    );
  }
  await cp(built, join(outDir, plugin), { recursive: true });
}

const index = await buildPluginsIndex(outDir, { include: indexed.plugins });
await writeFile(join(outDir, PLUGINS_INDEX_FILE), `${JSON.stringify(index, null, 2)}\n`);
const beside = builds.size - indexed.plugins.length;
console.log(
  `✓ плагины приложения: ${indexed.plugins.length} шт., файлов ${index.files.length} → ${outDir}` +
    (beside > 0 ? `\n  и ещё ${beside} — только для билдера, встроенного в приложение` : '')
);
