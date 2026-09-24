// api.ts — заготовка бэкенда (submit). Реализуйте реальные запросы. Пишется один раз.

import type { W04SplitForm } from './types';

export type ApiResult<T> = { success: true; data: T } | { success: false; error: string };

const API_DELAY = 600;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** POST — отправка формы. TODO: заменить на реальный запрос. */
export async function submitForm(values: W04SplitForm): Promise<ApiResult<{ id: string }>> {
  await wait(API_DELAY);

  console.info('[w04-split] submit', values);
  return { success: true, data: { id: String(Date.now()) } };
}
