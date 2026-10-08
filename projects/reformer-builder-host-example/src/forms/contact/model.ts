// model.ts — начальные значения (из мока) и фабрика модели. Регенерируется.

import { createModel, type FormModel } from '@reformer/core';
import type { ContactForm } from './types';

export function createInitialValues(): ContactForm {
  return {
    name: '',
    email: '',
    city: null,
    agree: false,
  } as ContactForm;
}

export function createContactFormModel(initial?: Partial<ContactForm>): FormModel<ContactForm> {
  return createModel<ContactForm>({ ...createInitialValues(), ...initial });
}
