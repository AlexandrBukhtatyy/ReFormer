/**
 * Поведение формы «test-02» — реактивные связи над МОДЕЛЬЮ. Работает одинаково на всех шагах:
 * визард переключает видимость, а модель и её связи общие. Docs: @reformer/core/behaviors.
 */
import { defineFormBehavior, enableWhen } from '@reformer/core/behaviors';
import type { FormShape } from './model';

export const formBehavior = defineFormBehavior<FormShape>(({ model }) => {
  // Адрес заполняется только после города — поле недоступно, пока город пуст.
  enableWhen(model.$.address, () => model.city.trim().length > 0);

  // ── Шпаргалка (скопируйте под свои поля) ──
  // computeFrom([model.$.fullName], model.$.greeting, (name) => name ? `Привет, ${name}!` : '');
  // copyFrom(model.$.email, model.$.login);
  // onChange(model.$.city, (value) => void loadStreets(value), { debounce: 300 });
});
