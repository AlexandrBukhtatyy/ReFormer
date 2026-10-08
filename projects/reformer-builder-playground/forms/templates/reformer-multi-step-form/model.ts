// @reformer-generated 5577f2528f27
// model.ts — начальные значения (из мока) и фабрика модели. Регенерируется.

import { createModel, type FormModel } from '@reformer/core';
import type { ReformerMultiStepFormForm } from './types';

export function createInitialValues(): ReformerMultiStepFormForm {
  return {
    lastName: '',
    firstName: '',
    fullName: '',
    city: 'msk',
    email: '',
  } as ReformerMultiStepFormForm;
}

export function createReformerMultiStepFormFormModel(
  initial?: Partial<ReformerMultiStepFormForm>
): FormModel<ReformerMultiStepFormForm> {
  return createModel<ReformerMultiStepFormForm>({ ...createInitialValues(), ...initial });
}
