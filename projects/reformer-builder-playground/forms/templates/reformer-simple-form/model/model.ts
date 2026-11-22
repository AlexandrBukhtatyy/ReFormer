// @reformer-generated 77fe4369406c
// model/model.ts — фабрика модели формы. Регенерируется.

import { createModel, type FormModel } from '@reformer/core';
import type { ReformerSimpleForm } from '../types/reformer-simple-form';
import { createInitialValues } from './initial-value';

/** Реактивная модель формы — источник истины значений. */
export function createReformerSimpleFormModel(
  initial?: Partial<ReformerSimpleForm>
): FormModel<ReformerSimpleForm> {
  return createModel<ReformerSimpleForm>({ ...createInitialValues(), ...initial });
}
