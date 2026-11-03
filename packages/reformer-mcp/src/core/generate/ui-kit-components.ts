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
  DatePickerMulti: 'DatePickerMulti',
  DatePickerRange: 'DatePickerRange',
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
  FieldArray: 'FieldArray',
};

/** Экспорты кита, которых нет в его корне: только подпуть. Импорт из корня не компилируется. */
const UI_KIT_SUBPATH_IMPORTS: Readonly<Record<string, string>> = {
  CalendarSingle: '@reformer/ui-kit/calendar',
  Combobox: '@reformer/ui-kit/combobox',
  ComboboxMulti: '@reformer/ui-kit/combobox',
  ComboboxTree: '@reformer/ui-kit/combobox',
  ComboboxTreeMulti: '@reformer/ui-kit/combobox',
  InputOTPDefault: '@reformer/ui-kit/input-otp',
  DatePicker: '@reformer/ui-kit/date-picker',
  DatePickerMulti: '@reformer/ui-kit/date-picker',
  DatePickerRange: '@reformer/ui-kit/date-picker',
};

/** Разложить экспорты кита по модулям: сначала корень пакета, затем подпути по алфавиту. */
export function groupUiKitImports(names: readonly string[]): Array<[string, string[]]> {
  const byModule = new Map<string, string[]>();
  for (const name of names) {
    const from = UI_KIT_SUBPATH_IMPORTS[name] ?? '@reformer/ui-kit';
    byModule.set(from, [...(byModule.get(from) ?? []), name]);
  }
  return [...byModule].sort(([first], [second]) => first.localeCompare(second));
}

/** Экспорт ui-kit → registry-имя (обратная таблица). */
const EXPORT_TO_REGISTRY: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(UI_KIT_FIELD_EXPORTS).map(([registry, exp]) => [exp, registry])
);

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
 * - имя экспорта (`CheckboxWithLabel`) → registry-имя;
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

  if (!UI_KIT_FIELD_EXPORTS[name] && EXPORT_TO_REGISTRY[name]) {
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
