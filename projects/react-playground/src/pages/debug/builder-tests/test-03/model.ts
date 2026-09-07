// @reformer-generated 5577f2528f27
// model.ts — начальные значения (из мока) и фабрика модели. Регенерируется.

import { createModel, type FormModel } from '@reformer/core';
import type { Test03Form } from './types';

export function createInitialValues(): Test03Form {
  return {
    lastName: '',
    firstName: '',
    fullName: '',
    city: 'msk',
    email: '',
  } as Test03Form;
}

export function createTest03FormModel(initial?: Partial<Test03Form>): FormModel<Test03Form> {
  return createModel<Test03Form>({ ...createInitialValues(), ...initial });
}
