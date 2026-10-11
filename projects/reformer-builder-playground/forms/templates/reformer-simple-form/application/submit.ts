// application/submit.ts — отправка формы: запрос → исход → текст для человека.
// Ваш файл: пишется один раз и при регенерации не затирается.

import { onComponentEvent, type BehaviorScope } from '@reformer/core/behaviors';
import { validateModel } from '@reformer/core/validation';
import { submitForm } from '../api';
import type { ReformerSimpleForm } from '../types/reformer-simple-form';
import { formRules } from '../validation/form';

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
  { model, schema }: BehaviorScope<ReformerSimpleForm>,
  { onResult }: SubmitOptions = {}
): void {
  onComponentEvent(schema.node('submit'), 'onClick', async () => {
    // `touch: true` обязателен: киты показывают ошибку только у тронутого поля. Без него
    // неудачная отправка выглядела бы так, будто кнопка не работает.
    if (!(await validateModel(model, formRules, { touch: true }))) {
      onResult?.('Проверьте заполнение формы', false);
      return;
    }
    const result = await submitForm(model.get());
    onResult?.(result.success ? 'Форма отправлена' : result.error, result.success);
  });
}
