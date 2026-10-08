// @reformer-generated bf0821154294
/**
 * Поведение формы «ReformerSimpleForm» — реактивные связи над моделью.
 */
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';
import type { ReformerSimpleFormForm } from './types';

export const formBehavior = defineFormBehavior<ReformerSimpleFormForm>(({ model }) => {
  computeFrom([model.$.lastName, model.$.firstName], model.$.fullName, (lastName, firstName) =>
    [lastName, firstName].filter(Boolean).join(' ')
  );
});
