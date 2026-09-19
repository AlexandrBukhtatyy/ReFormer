/**
 * Поля `@reformer/ui-kit`: registry-имя (JSON-DSL, `$component(...)`) ↔ экспорт пакета.
 *
 * Источник истины — `x-registryName` / `x-exportName` в props-схемах ui-kit (они же попадают в
 * `component-catalog.json`). Сервер публикуется отдельно от ui-kit и читать каталог в рантайме
 * не может (ui-kit — опциональный peer), поэтому таблица продублирована здесь, а расхождение с
 * каталогом ловит тест `tests/ui-kit-components.test.ts`: новый компонент в ките без строки здесь
 * — красный тест, а не молчаливый TODO в сгенерированном `registry.ts`.
 *
 * Модель полей (без `*Field`-обёрток): в `component` листа кладётся САМ компонент, свой диалект
 * (`checked`/`onCheckedChange`, `onValueChange`, …) он объявляет статикой `reformerAdapter`, а
 * связывает поле с моделью обёртка (`FormField` / лист рендерера). `InputField`, `CheckboxField`,
 * `withFormControl` и прочие удалены без алиасов.
 */

/** Registry-имя поля → экспорт `@reformer/ui-kit`, регистрируемый под этим именем. */
export const UI_KIT_FIELD_EXPORTS: Readonly<Record<string, string>> = {
  Calendar: 'CalendarSingle',
  Checkbox: 'CheckboxWithLabel',
  Combobox: 'Combobox',
  ComboboxMulti: 'ComboboxMulti',
  ComboboxTree: 'ComboboxTree',
  ComboboxTreeMulti: 'ComboboxTreeMulti',
  DatePicker: 'DatePicker',
  FileUpload: 'FileUploadBase',
  FileUploadAvatar: 'FileUploadAvatar',
  FileUploadDropzone: 'FileUploadDropzone',
  FileUploadInput: 'FileUploadInput',
  Input: 'Input',
  InputMask: 'InputMask',
  InputNumber: 'InputNumber',
  InputOTP: 'InputOTPDefault',
  InputPassword: 'InputPassword',
  InputSuggest: 'InputSuggest',
  NativeSelect: 'NativeSelectWithOptions',
  NativeSelectMulti: 'NativeSelectMulti',
  RadioGroup: 'RadioGroupOptions',
  Select: 'SelectAsync',
  SelectMulti: 'SelectMulti',
  Slider: 'Slider',
  Switch: 'SwitchWithLabel',
  Textarea: 'Textarea',
  Toggle: 'Toggle',
  ToggleGroup: 'ToggleGroupOptions',
  ToggleGroupMulti: 'ToggleGroupMulti',
};

/** Контейнеры ui-kit, которые генератор кладёт в разметку. */
export const UI_KIT_CONTAINER_EXPORTS: Readonly<Record<string, string>> = {
  Box: 'Box',
  Section: 'Section',
  FormArray: 'FormArray',
};

/**
 * Удалённые `*Field`-экспорты → registry-имя поля, которое их заменило.
 *
 * `InputField` был диспетчером (`type: 'number'` → число, `suggestions` → подсказки), поэтому он
 * ведёт в `Input`, а уточнение по пропсам делает {@link normalizeFieldComponent}. То же у
 * `FileUploadField` с его `variant`.
 */
export const REMOVED_FIELD_EXPORTS: Readonly<Record<string, string>> = {
  InputField: 'Input',
  InputBaseField: 'Input',
  InputNumberField: 'InputNumber',
  InputSuggestField: 'InputSuggest',
  TextareaField: 'Textarea',
  TextareaBaseField: 'Textarea',
  SelectField: 'Select',
  SelectAsyncField: 'Select',
  SelectMultiField: 'SelectMulti',
  CheckboxField: 'Checkbox',
  CheckboxBaseField: 'Checkbox',
  SwitchField: 'Switch',
  SwitchBaseField: 'Switch',
  ToggleField: 'Toggle',
  ToggleBaseField: 'Toggle',
  RadioGroupField: 'RadioGroup',
  RadioGroupBaseField: 'RadioGroup',
  ToggleGroupField: 'ToggleGroup',
  ToggleGroupBaseField: 'ToggleGroup',
  ToggleGroupMultiField: 'ToggleGroupMulti',
  NativeSelectField: 'NativeSelect',
  NativeSelectBaseField: 'NativeSelect',
  NativeSelectMultiField: 'NativeSelectMulti',
  SliderField: 'Slider',
  SliderBaseField: 'Slider',
  CalendarField: 'Calendar',
  CalendarBaseField: 'Calendar',
  DatePickerField: 'DatePicker',
  DatePickerBaseField: 'DatePicker',
  InputMaskField: 'InputMask',
  InputMaskBaseField: 'InputMask',
  InputPasswordField: 'InputPassword',
  InputPasswordBaseField: 'InputPassword',
  InputOTPField: 'InputOTP',
  InputOTPBaseField: 'InputOTP',
  ComboboxField: 'Combobox',
  ComboboxBaseField: 'Combobox',
  ComboboxMultiField: 'ComboboxMulti',
  ComboboxTreeField: 'ComboboxTree',
  ComboboxTreeMultiField: 'ComboboxTreeMulti',
  FileUploadField: 'FileUpload',
  FileUploadBaseField: 'FileUpload',
  FileUploadDropzoneField: 'FileUploadDropzone',
  FileUploadInputField: 'FileUploadInput',
  FileUploadAvatarField: 'FileUploadAvatar',
};

/** Прочие удалённые символы ui-kit и то, чем их заменить (для диагностики кода). */
export const REMOVED_UI_KIT_SYMBOLS: Readonly<Record<string, string>> = {
  withFormControl: '`defineFieldControl(Component, { adapter })` из `@reformer/ui-kit/fields`',
  stripWrapperProps: 'ничего — пропсы обёртки срезает `bindFieldProps` из `@reformer/core`',
  SwitchControlProps: '`SwitchWithLabelProps`',
};

/** Экспорт ui-kit → registry-имя (обратная таблица). */
const EXPORT_TO_REGISTRY: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(UI_KIT_FIELD_EXPORTS).map(([registry, exp]) => [exp, registry])
);

/** Экспорт ui-kit, регистрируемый под registry-именем; `undefined` — имя не из кита. */
export function uiKitExportFor(registryName: string): string | undefined {
  return UI_KIT_FIELD_EXPORTS[registryName] ?? UI_KIT_CONTAINER_EXPORTS[registryName];
}

/** Замена удалённого `*Field`-экспорта в TS-коде: экспорт нового компонента. */
export function replacementExportFor(removed: string): string | undefined {
  const registry = REMOVED_FIELD_EXPORTS[removed];
  return registry ? UI_KIT_FIELD_EXPORTS[registry] : undefined;
}

export interface NormalizedFieldComponent {
  /** Registry-имя компонента. */
  component: string;
  /** Пропсы без снятых ключей (`type: 'number'`, `variant`). */
  componentProps: Record<string, unknown>;
  /** Что было исправлено — для предупреждений генератора. */
  notes: string[];
}

/**
 * Привести компонент поля к актуальному registry-имени.
 *
 * - удалённый `*Field` (`CheckboxField`) или имя экспорта (`CheckboxWithLabel`) → registry-имя;
 * - `Input` для числового поля или с `type: 'number'` → `InputNumber` (у `Input` больше нет
 *   `type: 'number'`: схема `additionalProperties: false`, а значение ушло бы в модель строкой);
 * - `Input` с `suggestions` → `InputSuggest`;
 * - `FileUpload` с `variant: 'dropzone' | 'input'` → `FileUploadDropzone` / `FileUploadInput`
 *   (пропа `variant` у `FileUpload*` больше нет).
 */
export function normalizeFieldComponent(
  component: string,
  fieldType: string,
  props: Record<string, unknown> = {}
): NormalizedFieldComponent {
  const notes: string[] = [];
  const componentProps = { ...props };
  let name = component;

  const fromRemoved = REMOVED_FIELD_EXPORTS[name];
  if (fromRemoved) {
    notes.push(`\`${name}\` удалён из ui-kit — принят \`${fromRemoved}\`.`);
    name = fromRemoved;
  } else if (!UI_KIT_FIELD_EXPORTS[name] && EXPORT_TO_REGISTRY[name]) {
    // Имя экспорта вместо registry-имени: в JSON-DSL `$component(...)` ссылается на ключ реестра.
    notes.push(
      `\`${name}\` — имя экспорта; в реестре он зарегистрирован как \`${EXPORT_TO_REGISTRY[name]}\`.`
    );
    name = EXPORT_TO_REGISTRY[name];
  }

  if (name === 'Input') {
    if (componentProps.type === 'number' || fieldType === 'number') {
      notes.push("числовое поле рисует `InputNumber` (у `Input` нет `type: 'number'`).");
      delete componentProps.type;
      name = 'InputNumber';
    } else if (componentProps.suggestions !== undefined) {
      notes.push('поле с подсказками рисует `InputSuggest` (у `Input` нет `suggestions`).');
      name = 'InputSuggest';
    }
  } else if (name === 'InputNumber' && componentProps.type === 'number') {
    delete componentProps.type;
  }

  if (name === 'FileUpload' || name === 'FileUploadDropzone' || name === 'FileUploadInput') {
    const variant = componentProps.variant;
    if (variant !== undefined) delete componentProps.variant;
    if (name === 'FileUpload' && variant === 'dropzone') {
      notes.push("`FileUpload` + `variant: 'dropzone'` → `FileUploadDropzone`.");
      name = 'FileUploadDropzone';
    } else if (name === 'FileUpload' && variant === 'input') {
      notes.push("`FileUpload` + `variant: 'input'` → `FileUploadInput`.");
      name = 'FileUploadInput';
    } else if (variant !== undefined) {
      notes.push(`проп \`variant\` у \`${name}\` снят — вариант задаётся самим компонентом.`);
    }
  }

  return { component: name, componentProps, notes };
}
