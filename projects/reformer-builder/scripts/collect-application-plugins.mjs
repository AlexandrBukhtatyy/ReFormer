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
 * ## Не только рядом со сборкой билдера
 *
 * Билдер, встроенный в приложение, запускает не лаунчер, а само приложение: каталог плагинов
 * оно раздаёт своей статикой, и состав у него свой — без плагинов, которыми форму рисует
 * билдер (её там рисует приложение). Поэтому и список, и каталог назначения можно назвать:
 *
 * ```
 * node scripts/collect-application-plugins.mjs --list application-plugins.embedded.json \
 *   --out ../my-app/public/builder-plugins
 * ```
 *
 * `--list` — путь от текущего каталога; `root` внутри списка считается от каталога самого
 * списка. `--out` — путь от текущего каталога. С названным `--out` собранный билдер не нужен:
 * плагины кладутся не в его `dist`.
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
const listPath =
  listArgument === undefined
    ? join(builderDir, 'application-plugins.json')
    : resolve(process.cwd(), listArgument);
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

const list = JSON.parse(await readFile(listPath, 'utf8'));
if (typeof list.root !== 'string' || !Array.isArray(list.plugins)) {
  fail(`«${listPath}» должен называть «root» и список «plugins»`);
}
if (besideBuilder && !(await isDirectory(join(builderDir, 'dist')))) {
  fail('нет dist/ билдера — сначала соберите его (npm run build)');
}

// От каталога списка, а не билдера: список встроенного состава может лежать где угодно,
// и «где плагины» он называет относительно себя.
const root = resolve(dirname(listPath), list.root);
// Каталог пересобирается целиком: плагин, убранный из списка, не должен остаться в поставке.
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const plugin of list.plugins) {
  const built = join(root, plugin, 'dist');
  if (!(await isDirectory(built))) {
    fail(
      `плагин «${plugin}» не собран для поставки: нет «${built}».\n` +
        `  Соберите: npm run build:dist -w ${join(root, plugin)}`
    );
  }
  await cp(built, join(outDir, plugin), { recursive: true });
}

const index = await buildPluginsIndex(outDir);
await writeFile(join(outDir, PLUGINS_INDEX_FILE), `${JSON.stringify(index, null, 2)}\n`);
console.log(
  `✓ плагины приложения: ${list.plugins.length} шт., файлов ${index.files.length} → ${outDir}`
);
