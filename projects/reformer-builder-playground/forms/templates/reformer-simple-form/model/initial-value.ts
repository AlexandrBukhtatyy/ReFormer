// @reformer-generated 5b92c7a8ab2d
// model/initial-value.ts — начальные значения формы (из мока). Регенерируется.

import type { ReformerSimpleForm } from '../types/reformer-simple-form';

/** Начальные значения: задают форму данных и снимок, к которому возвращает сброс. */
export function createInitialValues(): ReformerSimpleForm {
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
  } as ReformerSimpleForm;
}
