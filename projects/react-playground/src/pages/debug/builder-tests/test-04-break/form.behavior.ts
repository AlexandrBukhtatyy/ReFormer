// @reformer-generated bf0821154294
/**
 * Поведение формы «Test04Break» — реактивные связи над моделью.
 */
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';
import type { Test04BreakForm } from './types';

export const formBehavior = defineFormBehavior<Test04BreakForm>(({ model }) => {
  computeFrom([model.$.lastName, model.$.firstName], model.$.fullName, (lastName, firstName) =>
    [lastName, firstName].filter(Boolean).join(' ')
  );
});
