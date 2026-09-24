// @reformer-generated 3ab236efef70
// steps/kontakty/form.validation.ts — валидация шага «Контакты». «Далее» проверяет только эти
// правила, отправка — все шаги сразу. МОК: required выведены из схемы, допишите правила.
// Пишется один раз и при регенерации не затирается.

import { validate, defineValidationSchema } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import type { W03Form } from '../../types';

export const stepValidation = defineValidationSchema<W03Form>(({ model }) => {
  validate(model.$.email, [required({ message: 'Обязательное поле' })]);
});
