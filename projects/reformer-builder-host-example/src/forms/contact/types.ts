// types.ts — тип формы (выведен из схемы и мока). Регенерируется.

export type SelectOption = { value: string; label: string };

export type ContactForm = {
  name: string;
  email: string;
  city: string | null;
  agree: boolean;
};
