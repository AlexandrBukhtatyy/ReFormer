// @reformer-generated a3b03f5c8079
// model/model.ts — фабрика модели формы. Регенерируется.

import { createModel, type FormModel } from '@reformer/core';
import type { ContactHexaForm } from '../types/contact-hexa';
import { createInitialValues } from './initial-value';

/** Реактивная модель формы — источник истины значений. */
export function createContactHexaFormModel(
  initial?: Partial<ContactHexaForm>
): FormModel<ContactHexaForm> {
  return createModel<ContactHexaForm>({ ...createInitialValues(), ...initial });
}
