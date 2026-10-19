/**
 * `edit_file` — точечная правка файла модуля заменой текста.
 *
 * Правки одного файла приходят пачкой и применяются ПО ОЧЕРЕДИ к уже изменённому тексту — всё
 * или ничего: пачка, применённая наполовину, оставила бы файл в состоянии, о котором модель не
 * знает. Проверяется и пишется результат пачки целиком, одной записью.
 *
 * `old_string` обязан найтись ровно один раз. Неоднозначная замена — самая тихая порча: правка
 * ложится в первый из одинаковых фрагментов, а в JSON формы одинаковых фрагментов много
 * (`"componentProps": {`). Поэтому неоднозначность — отказ с подсказкой, а не угадывание.
 *
 * @module plugins/reformer/ai/tools/files/edit-file
 */

import { isRefusal } from '../../files/scope';
import type { FileToolContext } from '../../files/turn';
import { fail, ok, type AgentTool } from '../../model/types';
import { commitWrite } from './commit';
import { notFound } from './read-file';

/** Одна замена. */
interface Edit {
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

/** Параметры вызова. */
interface Params {
  path: string;
  edits: Edit[];
}

/** Сколько раз фрагмент встречается в тексте. */
function occurrences(text: string, fragment: string): number {
  let count = 0;
  for (
    let at = text.indexOf(fragment);
    at !== -1;
    at = text.indexOf(fragment, at + fragment.length)
  ) {
    count += 1;
  }
  return count;
}

/** Переводы строк фрагмента — как в файле: модель пишет `\n` и в файле с `\r\n`. */
function asFileLines(fragment: string, crlf: boolean): string {
  return crlf ? fragment.replace(/\r?\n/g, '\r\n') : fragment;
}

export const editFileTool: AgentTool<Params, FileToolContext> = {
  name: 'edit_file',
  description:
    'Replace exact text in a file of the form module. old_string must match the file exactly ' +
    '(no line numbers) and be unique unless replace_all. Edits apply in order, all or none.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path from the module root' },
      edits: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          properties: {
            old_string: { type: 'string' },
            new_string: { type: 'string' },
            replace_all: { type: 'boolean' },
          },
          required: ['old_string', 'new_string'],
          additionalProperties: false,
        },
      },
    },
    required: ['path', 'edits'],
    additionalProperties: false,
  },
  readOnly: false,
  textBudget: 2000,
  async run(params, ctx) {
    const file = ctx.files.file(params.path);
    if (isRefusal(file)) return file;
    const before = await ctx.files.read(file);
    if (before === null) return notFound(ctx, file.rel);

    const crlf = before.includes('\r\n');
    let text = before;
    for (const [index, edit] of params.edits.entries()) {
      const which = params.edits.length > 1 ? `Edit ${index + 1}: ` : '';
      const from = asFileLines(edit.old_string, crlf);
      const to = asFileLines(edit.new_string, crlf);
      if (from === '') {
        return fail(
          'EDIT_MISMATCH',
          `${which}old_string is empty. To create a file use write_file.`
        );
      }
      const count = occurrences(text, from);
      if (count === 0) {
        return fail(
          'EDIT_MISMATCH',
          `${which}old_string is not in ${file.rel}. Read the file again and copy the text ` +
            'exactly, without the line-number prefix. Nothing was changed.'
        );
      }
      if (count > 1 && edit.replace_all !== true) {
        return fail(
          'EDIT_MISMATCH',
          `${which}old_string occurs ${count} times in ${file.rel}. Add surrounding lines to make ` +
            'it unique, or set replace_all. Nothing was changed.'
        );
      }
      // Без `String.replace`: в строке замены он трактует `$&`, `$'` и `$1` как шаблоны, а в коде
      // правил они встречаются как обычный текст.
      if (edit.replace_all === true) text = text.split(from).join(to);
      else {
        const at = text.indexOf(from);
        text = `${text.slice(0, at)}${to}${text.slice(at + from.length)}`;
      }
    }

    if (text === before) return ok(`No change: ${file.rel} already has this text.`);
    return commitWrite(ctx, file, before, text, true);
  },
};
