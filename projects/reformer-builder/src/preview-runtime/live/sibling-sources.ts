/**
 * Исходники каталога формы — то, что будет исполнено рядом с `form.json`.
 *
 * **Приоритет: открытая в Monaco `code`-вкладка, потом диск.** Иначе правка `validation.ts` во
 * вкладке не влияла бы на превью до сохранения, а именно этот цикл («правлю правило — вижу, как оно
 * отрабатывает») и есть смысл живого рендера.
 *
 * Берём прямых детей каталога с расширением `.ts`/`.tsx`, кроме `index.tsx` (страница-обёртка со
 * своим JSX и submit — превью её не исполняет) и тестов.
 *
 * @module reformer-builder/preview-runtime/live/sibling-sources
 */

import { listFilesDeep, readTextFile, splitPath } from '../../io/fs-ops';
import { editorStore } from '../../store';
import { projectStore } from '../../store/project-store';

/** Исходники каталога формы: имя файла → текст. */
export interface FormSources {
  /** Каталог формы относительно корня проекта. */
  dir: string;
  /** Прямые дети каталога: имя файла (с расширением) → исходник. */
  files: Record<string, string>;
  /** Файлы, взятые из несохранённых вкладок Monaco, — показываем это в панели «Сборка». */
  fromEditor: string[];
}

/** Исполняем только TS/TSX и не трогаем страницу-обёртку и тесты. */
function isExecutable(name: string): boolean {
  if (!/\.tsx?$/.test(name)) return false;
  if (name === 'index.ts' || name === 'index.tsx') return false;
  return !/\.(test|spec)\.tsx?$/.test(name);
}

/** Тексты открытых `code`-вкладок, лежащих прямо в каталоге формы. */
function editorOverrides(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const tab of Object.values(editorStore.getState().tabs)) {
    const path = tab.source.path;
    if (tab.kind !== 'code' || typeof tab.text !== 'string' || !path) continue;
    const { dirPath, base } = splitPath(path);
    if (dirPath !== dir || !isExecutable(base)) continue;
    out[base] = tab.text;
  }
  return out;
}

/**
 * Прочитать исходники каталога, в котором лежит `formPath` (путь к `form.json` относительно корня
 * проекта). Без открытого проекта или при недоступном каталоге — пустой набор: вызывающий покажет
 * это как «схемы не подключены», а не как ошибку.
 */
export async function readFormSources(formPath: string): Promise<FormSources> {
  const dir = splitPath(formPath).dirPath;
  const root = projectStore.getState().dirHandle;
  const files: Record<string, string> = {};

  if (root) {
    // listFilesDeep обходит вложенные каталоги — берём только прямых детей.
    const names = (await listFilesDeep(root, dir)).filter(
      (rel) => !rel.includes('/') && isExecutable(rel)
    );
    for (const name of names) {
      try {
        files[name] = await readTextFile(root, dir ? `${dir}/${name}` : name);
      } catch {
        // Файл исчез между листингом и чтением — не повод валить всю сборку.
      }
    }
  }

  const overrides = editorOverrides(dir);
  Object.assign(files, overrides);
  return { dir, files, fromEditor: Object.keys(overrides) };
}
