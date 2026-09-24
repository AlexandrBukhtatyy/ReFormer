// @reformer-generated 034b34afa72e
// steps/dannye/form.validation.ts — валидация шага «Данные». «Далее» проверяет только эти
// правила, отправка — все шаги сразу. МОК: required выведены из схемы, допишите правила.
// Пишется один раз и при регенерации не затирается.

import { validate, defineValidationSchema } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import type { W03Form } from '../../types';

export const stepValidation = defineValidationSchema<W03Form>(({ model }) => {
  validate(model.$.lastName, [required({ message: 'Обязательное поле' })]);
  validate(model.$.firstName, [required({ message: 'Обязательное поле' })]);
});
