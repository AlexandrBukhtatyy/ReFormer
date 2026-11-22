/**
 * Заглушки компонентов заявки на кредит.
 *
 * Ядро `component` узла не интерпретирует: схеме нужен лишь стабильный объект, по имени которого
 * узел узнаётся в снимках скомпилированной схемы и в сообщениях. Разметки здесь нет — фикстура
 * проверяет ядро без React, а сценарий React-сборки рисует узлы своим рендером.
 */

import { stub } from '../../../test-utils/stubs';

/** Визард шагов заявки. */
export const Wizard = stub('LoanWizard');
/** Шаг визарда. */
export const Step = stub('LoanStep');
/** Секция с заголовком. */
export const Section = stub('LoanSection');
/** Строка текста: подписи и сводки из литералов и сигналов модели. */
export const Summary = stub('LoanSummary');
export const TextInput = stub('LoanTextInput');
export const NumberInput = stub('LoanNumberInput');
export const DateInput = stub('LoanDateInput');
export const PhoneInput = stub('LoanPhoneInput');
export const Select = stub('LoanSelect');
/** Мультивыбор: значение поля — массив целиком. */
export const MultiSelect = stub('LoanMultiSelect');
export const Checkbox = stub('LoanCheckbox');
/** Загрузка файлов: значение поля — `File[]`. */
export const FileUpload = stub('LoanFileUpload');
/** Список строк массива с кнопкой «Добавить». */
export const FieldArray = stub('LoanFieldArray');
