/**
 * `read_resource` — страница ресурса, который дал плагин (точка `reformer.assistant.resource`).
 *
 * Встроенный, но в набор хода попадает только вместе с провайдером ресурсов: без провайдеров
 * читать нечего, а поверхность платится каждым шагом. Поэтому и меряется он не храповиком
 * встроенных, а потолком вкладов — появляется он из-за них.
 *
 * Провайдер отдаёт ресурс целиком, страницы режет инструмент — тем же `pageOf`, что `read_file`:
 * модель уже знает этот формат и продолжает чтение с `offset`.
 *
 * @module plugins/reformer/ai/tools/read-resource
 */

import { pageOf } from '@reformer/builder-toolkit';
import { fail, ok, RESOURCE_READ_BUDGET, type AgentTool } from '../model/types';

/** Параметры вызова. */
interface Params {
  uri: string;
  offset?: number;
}

/** Запас бюджета под заголовок и хвост страницы. */
const FRAME_RESERVE = 200;

export const readResourceTool: AgentTool<Params> = {
  name: 'read_resource',
  description:
    'Read a resource listed under Resources in the turn data, by its URI. Long ones come in ' +
    'pages — continue with offset.',
  inputSchema: {
    type: 'object',
    properties: {
      uri: { type: 'string', description: 'scheme:rest, e.g. source:src/app.ts' },
      offset: { type: 'integer', minimum: 1, description: 'First line, 1-based' },
    },
    required: ['uri'],
    additionalProperties: false,
  },
  readOnly: true,
  textBudget: RESOURCE_READ_BUDGET,
  async run(params, ctx) {
    if (ctx.turn === undefined) return fail('UNAVAILABLE', 'Resources are not available here.');
    const read = await ctx.turn.readResource(params.uri);
    if (!read.ok) return fail(read.error.code, read.error.message, read.error.suggestions);

    const page = pageOf(
      read.text,
      params.offset ?? 1,
      undefined,
      RESOURCE_READ_BUDGET - FRAME_RESERVE
    );
    const head = `${params.uri} — ${page.total} lines (${read.mediaType})`;
    if (read.text === '') return ok(`${head}\n(empty)`);
    if (page.to < page.from) return ok(`${head}\n(no lines from ${page.from})`);
    const tail =
      page.to < page.total
        ? `\n… lines ${page.from}-${page.to} of ${page.total}. Continue: read_resource offset=${page.to + 1}`
        : '';
    return ok(`${head}\n${page.body}${tail}`);
  },
};
