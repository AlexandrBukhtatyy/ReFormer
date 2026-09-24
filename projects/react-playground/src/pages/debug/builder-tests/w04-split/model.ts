// @reformer-generated 3f436f3ae2be
// model.ts — начальные значения (из мока) и фабрика модели. Регенерируется.

import { createModel, type FormModel } from '@reformer/core';
import type { W04SplitForm } from './types';

export function createInitialValues(): W04SplitForm {
  return {
    lastName: '',
    firstName: '',
    fullName: '',
    city: '',
    email: '',
  } as W04SplitForm;
}

export function createW04SplitFormModel(initial?: Partial<W04SplitForm>): FormModel<W04SplitForm> {
  return createModel<W04SplitForm>({ ...createInitialValues(), ...initial });
}
