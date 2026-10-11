// @reformer-generated 950d52166187
// types/contact.ts — тип формы (выведен из схемы и начальных значений). Регенерируется.

export type SelectOption = { value: string; label: string };

export type ContactForm = {
  name: string;
  email: string;
  city: string | null;
  agree: boolean;
};
