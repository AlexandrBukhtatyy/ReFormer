// @reformer-generated af3e847b027c
// model/initial-value.ts — начальные значения формы (из мока). Регенерируется.

import type { ReformerMultiStepForm } from '../types/reformer-multi-step-form';

/** Начальные значения: задают форму данных и снимок, к которому возвращает сброс. */
export function createInitialValues(): ReformerMultiStepForm {
  return {
    lastName: '',
    firstName: '',
    fullName: '',
    birthDate: null,
    gender: '',
    phone: '',
    email: '',
    city: '',
    position: '',
    skills: null,
    experience: 0,
    about: '',
    documents: null,
    hasReferences: false,
    references: [],
    agree: false,
  } as ReformerMultiStepForm;
}
