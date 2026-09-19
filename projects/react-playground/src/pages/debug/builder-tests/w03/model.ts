// @reformer-generated 2286ac891438
// model.ts — начальные значения (из мока) и фабрика модели. Регенерируется.

import { createModel, type FormModel } from '@reformer/core';
import type { W03Form } from './types';

export function createInitialValues(): W03Form {
  return {
    lastName: '',
    firstName: '',
    fullName: '',
    city: '',
    email: '',
  } as W03Form;
}

export function createW03FormModel(initial?: Partial<W03Form>): FormModel<W03Form> {
  return createModel<W03Form>({ ...createInitialValues(), ...initial });
}
