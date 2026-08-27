/**
 * Рабочая копия формы: материализация, синхронизация и уборка.
 *
 * **Правило, на котором всё держится.** При каждой синхронизации файл, помеченный маркером и
 * совпавший с ним по хэшу, перегенерируется; файл без маркера или с изменённым телом — остаётся
 * нетронутым. То есть сгенерированные файлы всегда догоняют схему и правила, а написанное руками
 * не затирается никогда. Это тот же co-ownership, что решал брейншторм (Q32), но разделение
 * проходит не по файлам, а по состоянию файла — и видно пользователю.
 *
 * **Откуда берётся копия.** Форма из проекта — копированием каталога с диска, чтобы рукописные
 * `validation.ts` и `form.behavior.ts` попали в копию как есть и опознались рукописными. Форма,
 * собранная в билдере, — кодогеном.
 *
 * @module reformer-builder/app/workdir-actions
 */

import { asRecord, isGenerated, regenerateModule } from '../codegen/regenerate';

import { formNameFromSchemaFile } from './save-actions';
import { listFilesDeep, readTextFile, splitPath } from '../io/fs-ops';
import { opfsSupported, readWorkdir, removeWorkdir, sweepWorkdirs, writeWorkdir } from '../io/opfs';
import { effectiveMock } from '../canvas/mock-data';
import { projectStore } from '../store/project-store';
import type { TabState } from '../store/types';

/** Файлы модуля, которые исполняет живое превью и правит пользователь. */
function isModuleFile(name: string): boolean {
  return /\.(ts|tsx|json|md)$/.test(name);
}

/**
 * Файлы каталога формы на диске (Mode B).
 *
 * Нужны ровно один раз — при первой материализации: дальше истина живёт в рабочей копии, а диск
 * становится местом сохранения. Читать его на каждой синхронизации значило бы затирать правки,
 * сделанные в билдере, содержимым, которое пользователь ещё не сохранял.
 */
async function seedFromDisk(tab: TabState): Promise<Record<string, string>> {
  const path = tab.source.path;
  const root = projectStore.getState().dirHandle;
  if (!path || !root) return {};
  const dir = splitPath(path).dirPath;
  const out: Record<string, string> = {};
  try {
    const names = (await listFilesDeep(root, dir)).filter(
      (rel) => !rel.includes('/') && isModuleFile(rel)
    );
    for (const name of names) {
      try {
        out[name] = await readTextFile(root, dir ? `${dir}/${name}` : name);
      } catch {
        // Файл исчез между листингом и чтением — не повод валить материализацию.
      }
    }
  } catch {
    // Каталог недоступен — форма откроется на одной генерации.
  }
  return out;
}

/**
 * Привести рабочую копию к текущему состоянию формы и вернуть её содержимое.
 *
 * Возвращает `null`, когда OPFS недоступен: вызывающий обязан деградировать (жить как раньше), а
 * не падать — приватный режим и старый браузер это законные состояния.
 */
export async function syncWorkdir(tab: TabState): Promise<Record<string, string> | null> {
  if (!opfsSupported()) return null;

  let current = await readWorkdir(tab.id);
  // Первая материализация формы из проекта: рукописные файлы обязаны попасть в копию как есть,
  // иначе они опознались бы сгенерированными и были бы затёрты первой же синхронизацией.
  if (Object.keys(current).length === 0 && tab.source.kind === 'file') {
    const seeded = await seedFromDisk(tab);
    if (Object.keys(seeded).length > 0) {
      await writeWorkdir(tab.id, seeded);
      current = seeded;
    }
  }

  const mock = effectiveMock(tab.schema, tab.mock);
  const fresh = asRecord(
    await regenerateModule(
      tab.schema,
      tab.rules,
      formNameFromSchemaFile(tab.source.name, tab.source.path),
      mock
    )
  );

  const changed: Record<string, string> = {};
  for (const [name, content] of Object.entries(fresh)) {
    const existing = current[name];
    // Нет файла — создаём. Есть и он наш — обновляем. Есть и его правили — не трогаем.
    if (existing === undefined || isGenerated(existing)) {
      if (existing !== content) changed[name] = content;
      current[name] = content;
    }
  }
  if (Object.keys(changed).length > 0) await writeWorkdir(tab.id, changed);

  return current;
}

/** Убрать рабочую копию закрытой вкладки. */
export async function dropWorkdir(tabId: string): Promise<void> {
  if (!opfsSupported()) return;
  await removeWorkdir(tabId);
}

/**
 * Подмести брошенные копии на старте.
 *
 * Каталоги OPFS живут, пока их не удалить. Без этой уборки за месяц работы там накопятся сотни
 * копий от закрытых вкладок и упавших сессий — молча, за счёт квоты пользователя.
 */
export async function sweepWorkdirsOnBoot(aliveTabIds: readonly string[]): Promise<number> {
  if (!opfsSupported()) return 0;
  try {
    return await sweepWorkdirs(aliveTabIds);
  } catch {
    return 0;
  }
}
