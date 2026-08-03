/**
 * Оркестрация сохранения (спека §7.3): принтер → re-read файла (детект внешних изменений через
 * `lastModified`) → diff-preview → защищённая запись. Затирание чужих правок недопустимо: конфликт
 * помечается, решение — за пользователем в diff-модалке.
 *
 * @module reformer-builder/io/save
 */

import { print, type PrinterOptions } from '../model/printer';
import type { TabState } from '../store/types';
import { diffLines, diffStat, type DiffOp } from './diff';
import { readFile, writeFile } from './fs-access';

/** План сохранения для diff-модалки. */
export interface SavePlan {
  tabId: string;
  /** Текущее содержимое файла (baseline diff). */
  oldText: string;
  /** Текст после сохранения (round-trip принтер). */
  newText: string;
  diff: DiffOp[];
  added: number;
  removed: number;
  /** Файл изменился внешне после открытия (нельзя тихо затирать). */
  conflict: boolean;
  handle: FileSystemFileHandle | null;
}

/** Подготовить сохранение: напечатать схему, перечитать файл, посчитать diff и конфликт. */
export async function prepareSave(tab: TabState, options: PrinterOptions): Promise<SavePlan> {
  const newText = await print(tab.schema, options);
  let oldText = tab.source.rawText ?? '';
  let conflict = false;
  const handle = tab.source.handle ?? null;

  if (handle) {
    const { text, lastModified } = await readFile(handle);
    oldText = text;
    if (tab.source.lastModified != null && lastModified !== tab.source.lastModified)
      conflict = true;
  }

  const diff = diffLines(oldText, newText);
  const { added, removed } = diffStat(diff);
  return { tabId: tab.id, oldText, newText, diff, added, removed, conflict, handle };
}

/** Записать текст в файл и вернуть новую метку времени (обновить baseline вкладки). */
export async function commitSave(handle: FileSystemFileHandle, newText: string): Promise<number> {
  await writeFile(handle, newText);
  const { lastModified } = await readFile(handle);
  return lastModified;
}
