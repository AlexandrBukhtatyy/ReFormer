/**
 * `write_file` — создать файл модуля или заменить его целиком.
 *
 * Существующий файл заменяется, только если модель его ЧИТАЛА в этой попытке хода и с тех пор
 * он не менялся. Замена целиком без чтения стирает то, о чём модель не знает: правку человека,
 * сделанную пока шёл ход, или содержимое, которого не было в затравке. Цена правила — один
 * `read_file`, и он нужен модели в любом случае, чтобы написать файл правильно.
 *
 * @module plugins/reformer/ai/tools/files/write-file
 */

import { isRefusal } from '../../files/scope';
import type { FileToolContext } from '../../files/turn';
import { fail, ok, type AgentTool } from '../../model/types';
import { commitWrite } from './commit';

/** Параметры вызова. */
interface Params {
  path: string;
  content: string;
}

export const writeFileTool: AgentTool<Params, FileToolContext> = {
  name: 'write_file',
  description:
    'Create a file in the form module, or replace a file you have read whole. Prefer edit_file ' +
    'for changes.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path from the module root' },
      content: { type: 'string', description: 'The whole new text' },
    },
    required: ['path', 'content'],
    additionalProperties: false,
  },
  readOnly: false,
  textBudget: 2000,
  async run(params, ctx) {
    const file = ctx.files.file(params.path);
    if (isRefusal(file)) return file;
    const before = await ctx.files.read(file);

    if (before !== null) {
      const seen = ctx.files.seen(file.rel);
      if (seen === undefined) {
        return fail(
          'STALE_FILE',
          `${file.rel} already exists. Read it before replacing it, or change it with edit_file.`
        );
      }
      if (seen !== before) {
        return fail('STALE_FILE', `${file.rel} changed since you read it. Read it again.`);
      }
    }

    // Переводы строк — как у существующего файла, чтобы замена не превращалась в diff на весь файл.
    const content =
      before !== null && before.includes('\r\n')
        ? params.content.replace(/\r?\n/g, '\r\n')
        : params.content;
    if (content === before) return ok(`No change: ${file.rel} already has this text.`);
    return commitWrite(ctx, file, before, content, false);
  },
};
