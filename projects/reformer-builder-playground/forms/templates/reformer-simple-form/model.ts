// @reformer-generated 5577f2528f27
// model.ts — начальные значения (из мока) и фабрика модели. Регенерируется.

import { createModel, type FormModel } from '@reformer/core';
import type { ReformerSimpleFormForm } from './types';

export function createInitialValues(): ReformerSimpleFormForm {
  return {
    lastName: '',
    firstName: '',
    fullName: '',
    city: 'msk',
    email: '',
  } as ReformerSimpleFormForm;
}

export function createReformerSimpleFormFormModel(
  initial?: Partial<ReformerSimpleFormForm>
): FormModel<ReformerSimpleFormForm> {
  return createModel<ReformerSimpleFormForm>({ ...createInitialValues(), ...initial });
}
