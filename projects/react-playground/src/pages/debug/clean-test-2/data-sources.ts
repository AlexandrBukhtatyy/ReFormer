// @reformer-form-build 50e62062f7f05419 собран из form.intent.json; правка руками отсоединит файл от сборки
/**
 * Справочники формы «Заявка на кредит» — варианты полей выбора. TS-схема кладёт их в
 * `componentProps.options`, реестр renderer-json регистрирует под теми же именами
 * (`$dataSource(NAME)` в схеме).
 */

export const LOAN_TYPES = [
  {
    value: 'consumer',
    label: 'Потребительский',
  },
  {
    value: 'mortgage',
    label: 'Ипотека',
  },
  {
    value: 'car',
    label: 'Автокредит',
  },
  {
    value: 'business',
    label: 'Бизнес',
  },
  {
    value: 'refinancing',
    label: 'Рефинансирование',
  },
];
