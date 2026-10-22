// @reformer-generated 2129da659d99
// types/reformer-multi-step-form.ts — тип формы (выведен из схемы и начальных значений). Регенерируется.

export type SelectOption = { value: string; label: string };

export type ReformerMultiStepForm = {
  lastName: string;
  firstName: string;
  fullName: string;
  birthDate: Date | null;
  gender: '' | 'male' | 'female';
  phone: string;
  email: string;
  city: '' | 'msk' | 'spb' | 'nsk' | null;
  position: '' | 'developer' | 'analyst' | 'designer' | 'manager' | null;
  skills: Array<'typescript' | 'react' | 'sql' | 'figma' | 'english'> | null;
  experience: number | null;
  about: string;
  documents: File[] | null;
  hasReferences: boolean;
  references: Array<{
    name: string;
    phone: string;
  }>;
  agree: boolean;
};
