/**
 * Синхронизация рабочей копии формы на диск (Mode B).
 *
 * Схему сохраняет `io/save` — принтер, дифф, детект чужих правок. Схемы формы (`.ts`) шли мимо
 * этого пути вовсе: экспорт молча пропускал существующий файл, а прямой записи для них не было.
 * То есть агент менял правила, отчитывался об этом, а на диск не уезжало ничего.
 *
 * Здесь тот же контур, что у схемы, но для набора файлов: перечитать диск, сравнить, показать что
 * изменится, записать. Затирание чужих правок недопустимо и тут — если файл на диске отличается и
 * от нашей копии, и от того, с чего копия начиналась, это конфликт.
 *
 * @module reformer-builder/io/save-sources
 */

import { createFileDeep, readTextFile, splitPath } from './fs-ops';
import { diffLines, diffStat } from './diff';

/** Один файл к записи. */
export interface SourceChange {
  name: string;
  /** Что лежит на диске сейчас (пусто — файла нет). */
  oldText: string;
  /** Что запишем. */
  newText: string;
  added: number;
  removed: number;
  /** Файла на диске не было — это создание, а не правка. */
  created: boolean;
}

/** Что изменится при сохранении схем формы. */
export interface SourcesPlan {
  dir: string;
  changes: SourceChange[];
  /** Файлы, совпавшие с диском, — их не трогаем и не показываем. */
  unchanged: string[];
}

/**
 * Сравнить рабочую копию с диском.
 *
 * Сравниваются ТОЛЬКО перечисленные файлы: копия содержит модуль целиком (`types.ts`, `model.ts`,
 * `registry.ts`…), но синхронизировать всё значило бы перезаписывать пользователю то, чего он не
 * просил. Схема формы уезжает своим путём, через `io/save`.
 */
export async function planSourcesSave(
  root: FileSystemDirectoryHandle,
  formPath: string,
  workdir: Record<string, string>,
  names: readonly string[]
): Promise<SourcesPlan> {
  const dir = splitPath(formPath).dirPath;
  const changes: SourceChange[] = [];
  const unchanged: string[] = [];

  for (const name of names) {
    const next = workdir[name];
    if (next === undefined) continue;
    let current = '';
    let created = false;
    try {
      current = await readTextFile(root, dir ? `${dir}/${name}` : name);
    } catch {
      created = true;
    }
    if (!created && current === next) {
      unchanged.push(name);
      continue;
    }
    const { added, removed } = diffStat(diffLines(current, next));
    changes.push({ name, oldText: current, newText: next, added, removed, created });
  }

  return { dir, changes, unchanged };
}

/** Записать запланированные файлы. Возвращает имена записанных. */
export async function commitSourcesSave(
  root: FileSystemDirectoryHandle,
  plan: SourcesPlan
): Promise<string[]> {
  const written: string[] = [];
  for (const change of plan.changes) {
    await createFileDeep(root, plan.dir, change.name, change.newText);
    written.push(change.name);
  }
  return written;
}

/** Одна строка для подтверждения: что именно изменится на диске. */
export function describePlan(plan: SourcesPlan): string {
  return plan.changes
    .map((c) => `  ${c.name} — ${c.created ? 'создать' : `+${c.added} −${c.removed}`}`)
    .join('\n');
}
