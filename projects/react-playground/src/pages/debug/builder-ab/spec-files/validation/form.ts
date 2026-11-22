// @reformer-generated ae20ddfb4258
// validation/form.ts — валидация формы: поле `validation` сборки (application/create.ts).
// Пока файл не правили руками, билдер перегенерирует его из правил формы; правленный не трогает.

import type { FormValidation } from '@reformer/core';
import { defineValidation } from '@reformer/core/validation';
import type { CreditApplicationForm } from '../types/credit-application';

/** Правила формы: проверяются при отправке и живой проверкой. */
export const formRules = defineValidation<CreditApplicationForm>(() => {
  // TODO: правила формы
});

/**
 * Валидация формы — поле `validation` сборки.
 *
 * `strategy` — когда поле проверяется само, не дожидаясь отправки:
 * - `'submit'` — никогда: замечание висит под исправленным полем до следующей отправки;
 * - `'blur'` — когда поле теряет фокус. Замечание под исправленным полем уходит в момент
 *   щелчка по кнопке (фокус покидает поле), кнопка сдвигается — и щелчок приходится мимо неё;
 * - `'change'` — на каждое изменение (`debounce` — пауза в мс): замечание уходит, как только
 *   значение исправили. Выбрана она;
 * - `'afterFirstSubmit'` — как `'change'`, но только после первой отправки. Включает её проверка
 *   через сборку (`form.validate()` / `form.submit()`), а здесь кнопка проверяет форму сама
 *   (application/submit.ts), мимо сборки.
 */
export const formValidation: FormValidation<CreditApplicationForm> = {
  rules: formRules,
  strategy: 'change',
};
