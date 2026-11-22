// @reformer-generated ccb53c957afd
// model/model.ts — фабрика модели формы. Регенерируется.

import { createModel, type FormModel } from '@reformer/core';
import type { ContactForm } from '../types/contact';
import { createInitialValues } from './initial-value';

/** Реактивная модель формы — источник истины значений. */
export function createContactFormModel(initial?: Partial<ContactForm>): FormModel<ContactForm> {
  return createModel<ContactForm>({ ...createInitialValues(), ...initial });
}
