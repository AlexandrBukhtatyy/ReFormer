/** Компоненты кита: справочник имён и приведение имени компонента поля к registry-имени. */

import { nameIgnoringCase } from './component-names.js';

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
  /**
   * Компоненты верхнего уровня по назначению ({@link COMPONENT_GROUPS}): группа → registry-имена.
   * Части составных — в {@link parts}, служебные обёртки кита (`kit.infra`) — нигде. Из этого
   * перечня грамматика печатает раздел `## components`: и для формы, и для страницы. Нет — хост
   * собрал справочники без групп; грамматика тогда называет одни поля.
   */
  readonly groups?: Readonly<Record<string, readonly string[]>>;
  /** Части составного компонента: корень → части (`Card` → `CardHeader`, `CardContent`, …). */
  readonly parts?: Readonly<Record<string, readonly string[]>>;
  /**
   * Пакет для импорта компонентов: `kit.codegen.importSpecifier`, иначе `kit.package` каталога.
   * Нет — `@reformer/ui-kit`.
   */
  readonly importSpecifier?: string;
  /**
   * Обёртка поля (`kit.infra.fieldWrapper`). `null` — у кита её нет: контрол сам рисует подпись и
   * ошибку, и реестр её не регистрирует. Нет поля — `FormField` по соглашению.
   */
  readonly fieldWrapper?: string | null;
  /**
   * Шаг визарда (`kit.adapters.step`). Нет или `null` — `Step` из `@reformer/cdk/form-wizard`
   * (React).
   */
  readonly step?: UiKitSymbol | null;
  /**
   * Что приложение ставит один раз, чтобы компоненты кита рисовались (`kit.adapters.provider`):
   * на React — обёртка поддерева, на Vue — фабрика плагина, на Angular — функция провайдеров.
   */
  readonly provider?: UiKitSymbol | null;
  /** Фреймворк кита (`kit.framework`); нет — `react`. */
  readonly framework?: 'react' | 'vue' | 'angular';
}

/** Символ кита и подпуть, откуда он импортируется, если его нет в главном входе. */
export interface UiKitSymbol {
  readonly symbol: string;
  readonly subpath?: string;
}

export const NO_UI_KIT: UiKitComponents = { found: false, fields: {}, exports: {}, subpaths: {} };

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
      notes.push(`\`${name}\` is the export name; the registry knows it as \`${registry}\`.`);
      name = registry;
    } else {
      // `input` вместо `Input`: имя однозначно, ход модели на ошибку не тратится (ReFormer-11oe.19).
      const inCase = nameIgnoringCase(name, Object.keys(kit.fields));
      if (inCase) {
        notes.push(`\`${name}\` is \`${inCase}\` — component names are case-sensitive.`);
        name = inCase;
      }
    }
  }

  if (name === 'Input') {
    if (componentProps.type === 'number' || fieldType === 'number') {
      notes.push("a number field is drawn by `InputNumber` (`Input` has no `type: 'number'`).");
      delete componentProps.type;
      name = 'InputNumber';
    } else if (componentProps.suggestions !== undefined) {
      notes.push(
        'a field with suggestions is drawn by `InputSuggest` (`Input` has no `suggestions`).'
      );
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
      notes.push(
        `the \`variant\` prop of \`${name}\` is dropped — the component itself is the variant.`
      );
    }
  }

  return { component: name, componentProps, notes };
}
