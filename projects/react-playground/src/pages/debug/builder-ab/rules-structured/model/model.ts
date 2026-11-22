// @reformer-generated 831880ee6456
// model/model.ts — фабрика модели формы. Регенерируется.

import { createModel, type FormModel } from '@reformer/core';
import type { ReformerMultiStepForm } from '../types/reformer-multi-step-form';
import { createInitialValues } from './initial-value';

/** Реактивная модель формы — источник истины значений. */
export function createReformerMultiStepFormModel(
  initial?: Partial<ReformerMultiStepForm>
): FormModel<ReformerMultiStepForm> {
  return createModel<ReformerMultiStepForm>({ ...createInitialValues(), ...initial });
}
