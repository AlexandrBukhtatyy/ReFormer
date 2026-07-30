/**
 * Эмиттер `api.ts` (user-owned) — mock-бэкенд: `submitForm` с фейковой задержкой и `console.info`.
 * Реализуйте реальные запросы.
 *
 * @module reformer-builder/codegen/emit-api
 */

import type { Names } from './naming';

export function emitApi(n: Names): string {
  return `// api.ts — mock-бэкенд (submit + загрузка). Реализуйте реальные запросы. Пишется один раз.

import type { ${n.TypeName} } from './types';

export type ApiResult<T> = { success: true; data: T } | { success: false; error: string };

const API_DELAY = 600;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** POST — отправка формы. TODO: заменить на реальный запрос. */
export async function submitForm(values: ${n.TypeName}): Promise<ApiResult<{ id: string }>> {
  await wait(API_DELAY);
  // eslint-disable-next-line no-console
  console.info('[${n.dir}] submit', values);
  return { success: true, data: { id: String(Date.now()) } };
}
`;
}
