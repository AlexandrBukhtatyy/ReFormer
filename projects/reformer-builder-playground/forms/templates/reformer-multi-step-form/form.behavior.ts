// @reformer-generated bf0821154294
/**
 * Поведение формы «ReformerMultiStepForm» — реактивные связи над моделью.
 */
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';
import type { ReformerMultiStepFormForm } from './types';

export const formBehavior = defineFormBehavior<ReformerMultiStepFormForm>(({ model }) => {
  computeFrom([model.$.lastName, model.$.firstName], model.$.fullName, (lastName, firstName) =>
    [lastName, firstName].filter(Boolean).join(' ')
  );
});
