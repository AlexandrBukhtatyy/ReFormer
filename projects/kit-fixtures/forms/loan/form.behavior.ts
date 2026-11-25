/**
 * Поведение формы «Заявка на кредит (сокращённая)» — реактивные связи над моделью.
 */
import { defineFormBehavior, enableWhen } from '@reformer/core/behaviors';
import type { FormShape } from './model';

export const formBehavior = defineFormBehavior<FormShape>(({ model }) => {
  enableWhen(model.$.propertyValue, () => model.loanType === 'mortgage');
  enableWhen(model.$.carBrand, () => model.loanType === 'car');
});
