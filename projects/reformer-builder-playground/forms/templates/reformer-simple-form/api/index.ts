// api/index.ts — запросы к серверу: отправка формы. Заготовка: реализуйте реальные
// запросы. Ваш файл: пишется один раз и при регенерации не затирается.

import type { ReformerSimpleForm } from '../types/reformer-simple-form';

export type ApiResult<T> = { success: true; data: T } | { success: false; error: string };

const API_DELAY = 600;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** POST — отправка формы. TODO: заменить на реальный запрос. */
export async function submitForm(values: ReformerSimpleForm): Promise<ApiResult<{ id: string }>> {
  await wait(API_DELAY);

  console.info('[reformer-simple-form] submit', values);
  return { success: true, data: { id: String(Date.now()) } };
}
