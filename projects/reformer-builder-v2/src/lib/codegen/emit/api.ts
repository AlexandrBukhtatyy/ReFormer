/**
 * Эмиттер `api.ts` — заготовка бэкенда: `submitForm` с задержкой и записью в консоль.
 *
 * Авторский файл: реальные запросы пишет человек, регенерировать его не из чего.
 *
 * @module reformer-builder/lib/codegen/emit/api
 */

import type { EmitContext } from '../context';

export function emitApi(ctx: EmitContext): string {
  const { TypeName, dir } = ctx.names;
  return `// api.ts — заготовка бэкенда (submit). Реализуйте реальные запросы. Пишется один раз.

import type { ${TypeName} } from './types';

export type ApiResult<T> = { success: true; data: T } | { success: false; error: string };

const API_DELAY = 600;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** POST — отправка формы. TODO: заменить на реальный запрос. */
export async function submitForm(values: ${TypeName}): Promise<ApiResult<{ id: string }>> {
  await wait(API_DELAY);
  // eslint-disable-next-line no-console
  console.info('[${dir}] submit', values);
  return { success: true, data: { id: String(Date.now()) } };
}
`;
}
