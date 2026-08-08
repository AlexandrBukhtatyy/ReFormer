/**
 * Схема валидации формы «test-02» — правила над МОДЕЛЬЮ, сгруппированные по шагам визарда.
 * Запуск: validateModel(model, formValidation). Docs: @reformer/core/validation.
 */
import { validate, defineValidationSchema } from '@reformer/core/validation';
import { email, minLength, required } from '@reformer/core/validators';
import type { FormShape } from './model';

export const formValidation = defineValidationSchema<FormShape>(({ model }) => {
  // Шаг 1 — контакты.
  validate(model.$.fullName, [required({ message: 'Укажите ФИО' }), minLength(3)]);
  validate(model.$.email, [required(), email()]);

  // Шаг 2 — адрес.
  validate(model.$.city, [required({ message: 'Укажите город' })]);
  validate(model.$.address, [required({ message: 'Укажите адрес' })]);
  validate(model.$.agree, [
    (value) => (value === true ? null : { code: 'agree', message: 'Подтвердите данные' }),
  ]);
});
