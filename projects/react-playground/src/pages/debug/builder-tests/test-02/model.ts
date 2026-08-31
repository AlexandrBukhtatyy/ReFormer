/**
 * Модель пошаговой формы «test-02» — поля всех шагов в одном объекте: визард шагает по одной
 * модели, а не по нескольким. Docs: @reformer/core (FormModel<T>), @reformer/cdk (FormWizard).
 */

export interface FormShape {
  // Шаг 1 — контакты.
  fullName: string;
  email: string;
  // Шаг 2 — адрес.
  city: string;
  address: string;
  agree: boolean;
}

/** Начальные значения — для createJsonForm/useFormControl. */
export const initialFormModel: FormShape = {
  fullName: '',
  email: '',
  city: '',
  address: '',
  agree: false,
};
