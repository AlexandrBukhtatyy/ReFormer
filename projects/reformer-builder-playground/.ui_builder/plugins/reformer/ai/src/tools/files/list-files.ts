/**
 * `list_files` — файлы модуля формы с ролями.
 *
 * @module plugins/reformer/ai/tools/files/list-files
 */

import { renderTree } from '../../files/tree';
import type { FileToolContext } from '../../files/turn';
import { ok, type AgentTool } from '../../model/types';

/** Бюджет листинга: модуль формы — пара десятков файлов, строка на файл. */
const LIST_BUDGET = 2500;

export const listFilesTool: AgentTool<Record<string, never>, FileToolContext> = {
  name: 'list_files',
  description: 'Files of the form module, each with its role.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  readOnly: true,
  textBudget: LIST_BUDGET,
  async run(_params, ctx) {
    const paths = await ctx.files.moduleFiles();
    return ok(paths.length ? renderTree(paths, ctx.files.scope) : '(the module has no files)');
  },
};
