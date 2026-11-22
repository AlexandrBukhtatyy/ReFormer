// @reformer-generated 21d3d4ce8909
// validation/form.ts — валидация формы: поле `validation` сборки (application/create.ts).
// Пока файл не правили руками, билдер перегенерирует его из правил формы; правленный не трогает.

import type { FormValidation } from '@reformer/core';
import { validate, defineValidation, applyEach } from '@reformer/core/validation';
import {
  email,
  max,
  maxFileSize,
  maxFiles,
  maxLength,
  min,
  pastDate,
  phone,
  required,
} from '@reformer/core/validators';
import type { ReformerSimpleForm } from '../types/reformer-simple-form';

/** Правила формы: проверяются при отправке и живой проверкой. */
export const formRules = defineValidation<ReformerSimpleForm>(({ model }) => {
  validate(model.$.lastName, [required()]);
  validate(model.$.firstName, [required()]);
  validate(model.$.birthDate, [pastDate()]);
  validate(model.$.phone, [phone()]);
  validate(model.$.email, [required(), email()]);
  validate(model.$.skills, [maxLength(3)]);
  validate(model.$.experience, [min(0), max(50)]);
  validate(model.$.about, [maxLength(500)]);
  validate(model.$.documents, [maxFiles(3), maxFileSize(5242880)]);
  applyEach(model.$.references, ({ model: item }) => {
    validate(item.$.name, [required()]);
  });
  validate(model.$.agree, [required()]);
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
export const formValidation: FormValidation<ReformerSimpleForm> = {
  rules: formRules,
  strategy: 'change',
};
