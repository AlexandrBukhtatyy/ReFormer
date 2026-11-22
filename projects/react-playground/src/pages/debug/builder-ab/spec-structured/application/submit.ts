// application/submit.ts — отправка формы: запрос → исход → текст для человека.
// Ваш файл: пишется один раз и при регенерации не затирается.

import { onComponentEvent, type BehaviorScope } from '@reformer/core/behaviors';
import { submitForm } from '../api';
import type { CreditApplicationForm } from '../types/credit-application';

/** Что отправке нужно от места подключения. */
export interface SubmitOptions {
  /** Показать итог: баннер на странице, тост, переход. */
  onResult?: (message: string, ok: boolean) => void;
}

/**
 * Связать узел отправки схемы с отправкой формы.
 *
 * Пишется над областью поведения, а не над собранной формой: поведение — единственный канал,
 * общий для страницы и для записи реестра форм (`application/entry.ts`).
 */
export function wireSubmit(
  { schema }: BehaviorScope<CreditApplicationForm>,
  { onResult }: SubmitOptions = {}
): void {
  // Визард зовёт `onSubmit` сам — после успешной полной проверки: правила шагов и правила вне шагов.
  onComponentEvent(schema.node('wizard'), 'onSubmit', async (values: CreditApplicationForm) => {
    const result = await submitForm(values);
    onResult?.(result.success ? 'Форма отправлена' : result.error, result.success);
  });
}
