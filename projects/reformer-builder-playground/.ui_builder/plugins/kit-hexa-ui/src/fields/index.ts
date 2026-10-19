/**
 * Поля HexaUI для формы ReFormer — тем же способом, что в `@reformer/ui-kit`: без per-control
 * «field-обёрток». Контрол объявляет свой диалект статикой `reformerAdapter` ({@link FieldAdapter}
 * из `@reformer/core`), а связывает его с формой обёртка поля — `FormField.Control` из
 * `@reformer/cdk` (путь `<FormField control>`) или рендерер `@reformer/renderer-react`.
 *
 * Имена экспортов — имена записей ui-kit либо их `exportName` (`CheckboxWithLabel`,
 * `SwitchWithLabel`, `ToggleButton`): каталог кита связывает имя записи с экспортом, и одна схема
 * формы рендерится на обоих китах. Адаптеры — чистые данные (`./adapters`), преобразования
 * значений — чистые функции (`./convert`).
 *
 * Здесь только сами поля: модуль целиком раскладывается в пространство имён кита.
 *
 * @module reformer/kit-hexa-ui/fields
 */

export {
  Input,
  Textarea,
  InputPassword,
  InputNumber,
  InputMask,
  InputSearch,
  type InputProps,
  type TextareaProps,
  type InputPasswordProps,
  type InputNumberProps,
  type InputMaskProps,
  type InputSearchProps,
} from './text';
export {
  Select,
  SelectMulti,
  Combobox,
  ComboboxMulti,
  ComboboxTree,
  ComboboxTreeMulti,
  RadioGroup,
  CheckboxGroup,
  ToggleGroup,
  ToggleGroupMulti,
  ToggleButtonGroup,
  type SelectProps,
  type SelectMultiProps,
  type ComboboxProps,
  type ComboboxMultiProps,
  type ComboboxTreeProps,
  type ComboboxTreeMultiProps,
  type RadioGroupProps,
  type CheckboxGroupProps,
  type ToggleGroupOption,
  type ToggleGroupProps,
  type ToggleGroupMultiProps,
  type ToggleButtonGroupProps,
} from './choice';
export {
  CheckboxWithLabel,
  SwitchWithLabel,
  ToggleButton,
  type CheckboxWithLabelProps,
  type SwitchWithLabelProps,
  type ToggleButtonProps,
} from './boolean';
export {
  DatePicker,
  DatePickerRange,
  TimeInput,
  TimeRange,
  type DatePickerProps,
  type DatePickerRangeProps,
  type TimeInputProps,
  type TimeRangeProps,
} from './date';
export {
  FileUpload,
  FileUploadDropzone,
  type FileUploadProps,
  type FileUploadDropzoneProps,
} from './file-upload';
export {
  WeeklySchedule,
  type WeeklyScheduleProps,
  type WeeklyScheduleDays,
  type WeeklyScheduleLegend,
} from './weekly-schedule';
export {
  RichTextEditor,
  CodeEditor,
  type RichTextEditorProps,
  type CodeEditorProps,
  type CodeEditorLanguage,
} from './editors';
export type { FieldControl, FieldControlLayout, FieldControlStatics } from './control';
export type { HexaTreeNode, TreeSelectable, WeeklyScheduleValue } from './convert';
