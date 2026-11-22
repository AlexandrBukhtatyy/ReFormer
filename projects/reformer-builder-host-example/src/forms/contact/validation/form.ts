// validation/form.ts — валидация формы: поле `validation` сборки (application/create.ts).
// Ваш файл: правлен руками, при регенерации не затирается.

import type { FormValidation } from '@reformer/core';
import { defineValidation, validate } from '@reformer/core/validation';
import { email, required } from '@reformer/core/validators';
import type { ContactForm } from '../types/contact';

/** Правила формы: проверяются при отправке и живой проверкой. */
export const formRules = defineValidation<ContactForm>(({ model }) => {
  // Правило несёт только код замечания (`required`, `email`); текст по коду — в словаре формы,
  // `./messages.ts`.
  validate(model.$.name, [required()]);
  validate(model.$.email, [required(), email()]);
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
export const formValidation: FormValidation<ContactForm> = {
  rules: formRules,
  strategy: 'change',
};
