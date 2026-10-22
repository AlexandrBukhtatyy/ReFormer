// @reformer-generated 3708c5d9c1b9
// model/initial-value.ts — начальные значения формы (из мока). Регенерируется.

import type { ContactHexaForm } from '../types/contact-hexa';

/** Начальные значения: задают форму данных и снимок, к которому возвращает сброс. */
export function createInitialValues(): ContactHexaForm {
  return {
    name: '',
    email: '',
    city: null,
    agree: false,
  } as ContactHexaForm;
}
