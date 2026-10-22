// @reformer-generated a810358440e2
// model/model.ts — фабрика модели формы. Регенерируется.

import { createModel, type FormModel } from '@reformer/core';
import type { CreditApplicationForm } from '../types/credit-application';
import { createInitialValues } from './initial-value';

/** Реактивная модель формы — источник истины значений. */
export function createCreditApplicationFormModel(
  initial?: Partial<CreditApplicationForm>
): FormModel<CreditApplicationForm> {
  return createModel<CreditApplicationForm>({ ...createInitialValues(), ...initial });
}
