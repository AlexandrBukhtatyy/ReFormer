/**
 * Запись файла модуля — общий хвост `edit_file` и `write_file`.
 *
 * Гейт, запись через попытку хода (пометка, журнал) и ответ модели — одним путём для обоих
 * инструментов: два пути разошлись бы ровно в том, ради чего гейт стоит, — в том, попадает ли
 * в рабочую копию запись, которую гейт отверг.
 *
 * @module plugins/reformer/ai/tools/files/commit
 */

import { gateWrite } from '../../files/gate';
import { changedLines, linesOf, snippetOf } from '../../files/page';
import type { ModuleFile } from '../../files/scope';
import type { FileToolContext } from '../../files/turn';
import type { ToolOutcome } from '../../model/types';

/** Бюджет фрагмента вокруг правки в ответе. */
const SNIPPET_BUDGET = 1200;

/**
 * Проверить и записать.
 *
 * @param before - Текст файла сейчас; `null` — файла нет, запись его создаст.
 * @param showChange - Показать в ответе фрагмент вокруг правки — у `edit_file`; у замены файла
 *   целиком фрагментом был бы весь файл.
 */
export async function commitWrite(
  ctx: FileToolContext,
  file: ModuleFile,
  before: string | null,
  next: string,
  showChange: boolean
): Promise<ToolOutcome> {
  const verdict = await gateWrite(ctx, file, next, before);
  if (!verdict.ok) return verdict.outcome;

  await ctx.files.write(file, before, next);
  if (verdict.draft) ctx.files.setDraft(verdict.draft);

  const total = linesOf(next).length;
  const changed = changedLines(before ?? '', next);
  const head =
    before === null
      ? `Created ${file.rel} (${total} lines).`
      : `Written ${file.rel} (${total} lines).`;
  // Замечания — сразу за заголовком, до фрагмента: при обрезке по бюджету теряться должен
  // фрагмент, а не «этот файл кодоген перепишет».
  const notes = verdict.notes.length ? `\n${verdict.notes.join('\n')}` : '';
  const snippet =
    showChange && before !== null
      ? `\nLines ${changed.from}-${changed.to} now:\n${snippetOf(next, changed, SNIPPET_BUDGET)}`
      : '';
  return {
    ok: true,
    text: `${head}${notes}${snippet}`,
    ops: [
      {
        kind: before === null ? 'add' : 'update',
        ref: file.rel,
        summary: `${file.rel} (+${changed.added} −${changed.removed})`,
      },
    ],
  };
}
