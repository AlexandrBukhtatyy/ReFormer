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
 * @module scripts/collect-application-plugins
 */

import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPluginsIndex, PLUGINS_INDEX_FILE } from '../bin/plugins-index.mjs';

const builderDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const listPath = join(builderDir, 'application-plugins.json');
const outDir = join(builderDir, 'dist', 'plugins');

const fail = (message) => {
  console.error(`collect-application-plugins: ${message}`);
  process.exit(1);
};

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
if (!(await isDirectory(join(builderDir, 'dist')))) {
  fail('нет dist/ билдера — сначала соберите его (npm run build)');
}

const root = resolve(builderDir, list.root);
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
