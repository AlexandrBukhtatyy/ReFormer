// @reformer-generated bf0821154294
/**
 * Поведение формы «Test03» — реактивные связи над моделью.
 */
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';
import type { Test03Form } from './types';

export const formBehavior = defineFormBehavior<Test03Form>(({ model }) => {
  computeFrom([model.$.lastName, model.$.firstName], model.$.fullName, (lastName, firstName) =>
    [lastName, firstName].filter(Boolean).join(' ')
  );
});
