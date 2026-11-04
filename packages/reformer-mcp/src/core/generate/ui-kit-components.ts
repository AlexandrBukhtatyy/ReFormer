/**
 * Компоненты `@reformer/ui-kit`: registry-имя (JSON-DSL, `$component(...)`) ↔ экспорт пакета ↔
 * модуль, из которого его импортировать.
 *
 * Источник — `component-catalog.json` кита (`@reformer/ui-kit/catalog`), который кит генерирует
 * из контрактов своих компонентов. Своей таблицы у сервера нет: каталог читает платформа (CLI —
 * из проекта или рядом с сервером, браузер — у хоста) и передаёт сюда разобранным. Поэтому новый
 * компонент кита попадает в грамматику и импорты без правки MCP, а версия данных всегда та, что
 * установлена у потребителя.
 *
 * Без каталога (кит не установлен) сверять не с чем: {@link NO_UI_KIT}. Имена компонентов тогда
 * уходят в код как есть, из корня пакета, — такой код без кита не собрался бы в любом случае.
 *
 * Модель полей (без `*Field`-обёрток): в `component` листа кладётся САМ компонент, свой диалект
 * (`checked`/`onCheckedChange`, `onValueChange`, …) он объявляет статикой `reformerAdapter`, а
 * связывает поле с моделью обёртка (`FormField` / лист рендерера).
 */

/** Пакет кита: корень импортов и префикс подпутей. */
export const UI_KIT_PACKAGE = '@reformer/ui-kit';

/** Компоненты кита, прочитанные из его каталога. */
export interface UiKitComponents {
  /** Каталог найден. `false` — сверять не с чем: имена идут в код как есть. */
  readonly found: boolean;
  /** Registry-имя поля (`role: 'field'`) → экспорт, регистрируемый под этим именем. */
  readonly fields: Readonly<Record<string, string>>;
  /** Registry-имя любой записи каталога (поле, контейнер, `FormWizard`, …) → экспорт. */
  readonly exports: Readonly<Record<string, string>>;
  /** Экспорт → подпуть (`calendar`), если в корне пакета его нет: импорт из корня не компилируется. */
  readonly subpaths: Readonly<Record<string, string>>;
}

export const NO_UI_KIT: UiKitComponents = { found: false, fields: {}, exports: {}, subpaths: {} };

/** Запись каталога — ровно те поля, что нужны генератору. */
interface CatalogRecord {
  name: string;
  role?: unknown;
  exportName?: unknown;
  subpath?: unknown;
}

const isRecord = (value: unknown): value is CatalogRecord =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { name?: unknown }).name === 'string';

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

/**
 * Разобрать каталог кита: `component-catalog.json` или любой объект с `components` из записей
 * `{ name, role, exportName?, subpath? }` (каталог конструктора несёт и свои записи — лишнее не
 * мешает). Не каталог — {@link NO_UI_KIT}.
 */
export function uiKitFromCatalog(json: unknown): UiKitComponents {
  const components = (json as { components?: unknown } | null)?.components;
  if (!Array.isArray(components)) return NO_UI_KIT;
  const fields: Record<string, string> = {};
  const exports: Record<string, string> = {};
  const subpaths: Record<string, string> = {};
  for (const record of components.filter(isRecord)) {
    const exported = text(record.exportName) ?? record.name;
    exports[record.name] = exported;
    if (record.role === 'field') fields[record.name] = exported;
    const subpath = text(record.subpath);
    if (subpath) subpaths[exported] = subpath;
  }
  if (Object.keys(exports).length === 0) return NO_UI_KIT;
  return { found: true, fields, exports, subpaths };
}

/**
 * Экспорт кита под registry-именем. Без каталога — само имя; `undefined` — каталог есть, а такого
 * компонента в нём нет.
 */
export function uiKitExportOf(kit: UiKitComponents, name: string): string | undefined {
  return kit.found ? kit.exports[name] : name;
}

/** Предупреждение генератора, когда каталога нет. */
export const NO_UI_KIT_WARNING =
  'Каталог @reformer/ui-kit не найден: импорты компонентов не сверены — имена взяты как есть из корня пакета.';

/** Разложить экспорты кита по модулям: сначала корень пакета, затем подпути по алфавиту. */
export function groupUiKitImports(
  names: readonly string[],
  kit: UiKitComponents
): Array<[string, string[]]> {
  const byModule = new Map<string, string[]>();
  for (const name of names) {
    const subpath = kit.subpaths[name];
    const from = subpath ? `${UI_KIT_PACKAGE}/${subpath}` : UI_KIT_PACKAGE;
    byModule.set(from, [...(byModule.get(from) ?? []), name]);
  }
  return [...byModule].sort(([first], [second]) => first.localeCompare(second));
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
 * - имя экспорта (`CheckboxWithLabel`) → registry-имя (по каталогу кита);
 * - `Input` для числового поля или с `type: 'number'` → `InputNumber` (у `Input` больше нет
 *   `type: 'number'`: схема `additionalProperties: false`, а значение ушло бы в модель строкой);
 * - `Input` с `suggestions` → `InputSuggest`;
 * - `FileUpload` с `variant: 'dropzone' | 'input'` → `FileUploadDropzone` / `FileUploadInput`
 *   (пропа `variant` у `FileUpload*` больше нет).
 */
export function normalizeFieldComponent(
  component: string,
  fieldType: string,
  props: Record<string, unknown> = {},
  kit: UiKitComponents = NO_UI_KIT
): NormalizedFieldComponent {
  const notes: string[] = [];
  const componentProps = { ...props };
  let name = component;

  if (!kit.fields[name]) {
    // Имя экспорта вместо registry-имени: в JSON-DSL `$component(...)` ссылается на ключ реестра.
    const registry = Object.keys(kit.fields).find((key) => kit.fields[key] === name);
    if (registry) {
      notes.push(`\`${name}\` — имя экспорта; в реестре он зарегистрирован как \`${registry}\`.`);
      name = registry;
    }
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
