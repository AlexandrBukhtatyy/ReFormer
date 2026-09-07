// @reformer-generated 5577f2528f27
// model.ts — начальные значения (из мока) и фабрика модели. Регенерируется.

import { createModel, type FormModel } from '@reformer/core';
import type { Test04BreakForm } from './types';

export function createInitialValues(): Test04BreakForm {
  return {
    lastName: '',
    firstName: '',
    fullName: '',
    city: 'msk',
    email: '',
  } as Test04BreakForm;
}

export function createTest04BreakFormModel(
  initial?: Partial<Test04BreakForm>
): FormModel<Test04BreakForm> {
  return createModel<Test04BreakForm>({ ...createInitialValues(), ...initial });
}
