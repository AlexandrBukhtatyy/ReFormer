// @reformer-generated 28e762ea6228
// model/initial-value.ts — начальные значения формы (из мока). Регенерируется.

import type { ContactForm } from '../types/contact';

/** Начальные значения: задают форму данных и снимок, к которому возвращает сброс. */
export function createInitialValues(): ContactForm {
  return {
    name: '',
    email: '',
    city: null,
    agree: false,
  } as ContactForm;
}
