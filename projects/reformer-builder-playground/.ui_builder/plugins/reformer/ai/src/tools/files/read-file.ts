/**
 * `read_file` — страница файла модуля с номерами строк.
 *
 * Чтение запоминается попыткой хода: `write_file` заменяет только прочитанный файл, который с
 * тех пор не менялся (`files/turn`).
 *
 * @module plugins/reformer/ai/tools/files/read-file
 */

import { fileRoleOf } from '../../../../core/codegen/layout';
import { isRefusal } from '../../files/scope';
import { pageOf } from '../../files/page';
import { similarNames } from '../../loop/suggest';
import type { FileToolContext } from '../../files/turn';
import { fail, FILE_READ_BUDGET, ok, type AgentTool, type ToolOutcome } from '../../model/types';

/** Параметры вызова. */
interface Params {
  path: string;
  offset?: number;
  limit?: number;
}

/** Запас бюджета под заголовок и хвост страницы. */
const FRAME_RESERVE = 200;

/** Отказ «файла нет» с похожими путями модуля. */
export async function notFound(ctx: FileToolContext, rel: string): Promise<ToolOutcome> {
  return fail(
    'FILE_NOT_FOUND',
    `${rel} does not exist in the form module.`,
    similarNames(rel, await ctx.files.moduleFiles())
  );
}

export const readFileTool: AgentTool<Params, FileToolContext> = {
  name: 'read_file',
  description:
    'Read a file of the form module with line numbers. Long files come in pages — continue ' +
    'with offset.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path from the module root' },
      offset: { type: 'integer', minimum: 1, description: 'First line, 1-based' },
      limit: { type: 'integer', minimum: 1, description: 'Max lines' },
    },
    required: ['path'],
    additionalProperties: false,
  },
  readOnly: true,
  textBudget: FILE_READ_BUDGET,
  async run(params, ctx) {
    const file = ctx.files.file(params.path);
    if (isRefusal(file)) return file;
    const text = await ctx.files.read(file);
    if (text === null) return notFound(ctx, file.rel);
    ctx.files.see(file.rel, text);

    const page = pageOf(text, params.offset ?? 1, params.limit, FILE_READ_BUDGET - FRAME_RESERVE);
    const role = fileRoleOf(file.rel, ctx.files.scope.schemaPath);
    const head = `${file.rel} — ${page.total} lines${role === 'derived' ? ' (derived: codegen rewrites it)' : ''}`;
    if (page.total === 0 || text === '') return ok(`${head}\n(empty file)`);
    if (page.to < page.from) return ok(`${head}\n(no lines from ${page.from})`);
    const tail =
      page.to < page.total
        ? `\n… lines ${page.from}-${page.to} of ${page.total}. Continue: read_file offset=${page.to + 1}`
        : '';
    return ok(`${head}\n${page.body}${tail}`);
  },
};
