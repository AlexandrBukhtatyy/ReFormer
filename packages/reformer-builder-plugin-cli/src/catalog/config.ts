/**
 * Конфиг генератора каталога кита (`catalog.config.mjs`) и его пресеты.
 *
 * Модуль — отдельный подпуть пакета (`@reformer/builder-plugin-cli/catalog-config`) БЕЗ
 * зависимостей в рантайме: конфиг кита импортирует отсюда `defineKitCatalog` и пресеты, и ему
 * не нужны ни TypeScript, ни сам генератор. Из SDK — только типы.
 *
 * ## Как конфиг описывает кит
 *
 * Генератор интроспектирует ВХОД пакета кита (`entry`): каждая запись описывает тот символ,
 * который импортирует кодоген и рисует превью. Набор пропсов — из типов; конфиг лишь решает то,
 * чего типы не знают:
 *
 * - **поля** (`fields`) — экспорты со статикой `reformerAdapter`, тип значения модели и подписи;
 *   биекция «статика ↔ `fields`» обязательна;
 * - **роли записей** — палитра (`categories`, `palette`), ограниченное превью (`limited`),
 *   служебные (`service`, `palette: false`), вне каталога (`exclude`), листья (`leaves`),
 *   части составных компонентов (`parts`, только явно);
 * - **статики** (`Textbox.Masked`) — каждая найденная требует решения в `statics`;
 * - **владение пропсами** (`ownership.packages`) — чьи пропсы перечисляются в `properties`,
 *   а чьи уходят в `x-inherits`; правки набора — `props.pick/omit/override`.
 *
 * Имя из конфига, не нашедшее записи или экспорта, — отказ генерации, а не тихий пропуск:
 * переименованный компонент иначе молча терял бы раздел палитры или превью.
 *
 * @module @reformer/builder-plugin-cli/catalog-config
 */

import type {
  CatalogPropDoc,
  CatalogPropGroup,
  CatalogRuntimePropDoc,
  KitDescriptorJson,
} from '@reformer/builder-plugin-api';

/**
 * Узел JSON Schema пропа, как его пишет каталог: стандартные ключи плюс `x-doc`. Открыт для
 * остальных ключей JSON Schema (`items`, `minimum`, `properties`…).
 */
export interface CatalogPropSchema {
  readonly type?: string | readonly string[];
  readonly enum?: readonly (string | number | boolean | null)[];
  readonly default?: unknown;
  readonly description?: string;
  readonly 'x-doc'?: Partial<CatalogPropDoc>;
  readonly [keyword: string]: unknown;
}

/** Блок `kit` каталога; `id` обязателен — без него реестр китов кит не примет. */
export type KitCatalogDescriptor = Omit<KitDescriptorJson, 'id' | 'palette'> & {
  readonly id: string;
  /**
   * Палитра кита. Разделы (`categoryByName`, `order`) генератор выводит из `categories`
   * конфига — здесь задаются только глифы.
   */
  readonly palette?: { readonly glyphs?: Readonly<Record<string, string>> };
};

/** Поле формы — экспорт кита со статикой `reformerAdapter`. Ключ в `fields` — имя записи. */
export interface KitFieldConfig {
  /** Экспорт входа, если он называется иначе, чем запись (`Checkbox` → `CheckboxWithLabel`). */
  readonly exportName?: string;
  /** Взять пропсы у другого экспорта входа — запасной путь, как у {@link KitRecordConfig.propsFrom}. */
  readonly propsFrom?: string;
  /**
   * Тип значения модели — самодостаточный TS-тип: только встроенные типы (`string | null`,
   * `Date | null`, `[Date, Date] | null`, `File[] | null`, `Record<string, number[]> | null`).
   * Пишется в `x-runtimeProps.value.type`; по нему стеки узнают вид значения поля.
   */
  readonly value: string;
  /** Описание значения (`x-runtimeProps.value.description`). */
  readonly description?: string;
  /** Описание изменения (`x-runtimeProps.onChange.description`). */
  readonly onChangeDescription?: string;
  /**
   * Пропсы обёртки, которые подставляет форма сверх общего шва (`value`/`onChange`/`onBlur`/
   * `disabled`): в `properties` их нет.
   */
  readonly seam?: readonly string[];
  /** Дополнительные пропсы `x-runtimeProps` (подставляемые формой, а не схемой). */
  readonly runtimeProps?: Readonly<Record<string, CatalogRuntimePropDoc>>;
  readonly variantGroup?: string;
  readonly variant?: string;
  readonly classGroups?: readonly string[];
}

/** Запись, не являющаяся полем: переименование, подпуть, вариант, запасной тип пропсов. */
export interface KitRecordConfig {
  /** Экспорт входа, если запись называется иначе (`Separator` → `Divider`). */
  readonly exportName?: string;
  /**
   * Взять пропсы у другого экспорта входа — запасной путь, когда тип символа неточен.
   * Обёртки кита обязаны иметь точные типы; это — исключение, а не способ.
   */
  readonly propsFrom?: string;
  /** Подпуть кита, откуда импортируется символ (`<спецификатор>/<subpath>`). */
  readonly subpath?: string;
  readonly variantGroup?: string;
  readonly variant?: string;
  readonly classGroups?: readonly string[];
}

/**
 * Селектор записей в `props`: имя записи, `'*'` — все записи, `'@field'` — поля,
 * `'@container'` — остальные.
 */
export type KitPropsSelector = string;

/** Правило секции инспектора пропа: функция или таблица «имя пропа → секция». */
export type KitPropGroupRule =
  | ((prop: string) => CatalogPropGroup | undefined)
  | Readonly<Record<string, CatalogPropGroup>>;

/** Правки набора пропсов поверх выведенного из типов. */
export interface KitPropsConfig {
  /**
   * Вернуть в `properties` пропсы, которые политика уводит в `x-inherits` (чужой пакет,
   * HTML-атрибут): `{ Textbox: ['placeholder'] }`.
   */
  readonly pick?: Readonly<Record<KitPropsSelector, readonly string[]>>;
  /** Убрать пропсы из `properties`: `{ '@field': ['validationStatus', 'invalid'] }`. */
  readonly omit?: Readonly<Record<KitPropsSelector, readonly string[]>>;
  /**
   * Уточнить схему пропа (описание, секция, сужение enum, `items`). Проп обязан быть в
   * `properties` — добавить отсутствующий в типе проп нельзя.
   */
  readonly override?: Readonly<
    Record<KitPropsSelector, Readonly<Record<string, CatalogPropSchema>>>
  >;
  /** Секция инспектора (`x-doc.group`); по умолчанию — {@link groupByName}. */
  readonly groups?: KitPropGroupRule;
}

/** Конфиг генератора каталога кита (`catalog.config.mjs` с `// @ts-check` или `.json`). */
export interface KitCatalogConfig {
  /** Вход пакета кита относительно файла конфига (`./src/index.ts`). */
  readonly entry: string;
  /** tsconfig кита; по умолчанию `tsconfig.json` рядом с конфигом, если он есть. */
  readonly tsconfig?: string;
  /** Куда писать каталог; по умолчанию `catalog.json` рядом с конфигом. */
  readonly out?: string;
  /** `$schema` каталога — ссылка на контракт для подсказок в IDE. */
  readonly schemaRef?: string;
  /** Версия контракта каталога; по умолчанию текущая (`3.0`). */
  readonly version?: string;
  /** Блок `kit` каталога — что кит рассказывает о себе. */
  readonly kit: KitCatalogDescriptor;
  /**
   * Владение пропсами. Свои — исходники кита и `packages` (`@kaspersky/hexa-ui`): их пропсы
   * идут в `properties`. `@types/react` — в `x-inherits.react`, прочие пакеты — в
   * `x-inherits.packages` (нужные возвращает `props.pick`).
   */
  readonly ownership?: { readonly packages?: readonly string[] };
  /** Поля формы: имя записи → тип значения и подписи. */
  readonly fields?: Readonly<Record<string, KitFieldConfig>>;
  /**
   * Пропсы обёртки поля, которые получает каждое поле (`label`, `required`…): пресет
   * `'reformer'` (по умолчанию), свои схемы либо `false` — без них.
   */
  readonly fieldWrapper?: 'reformer' | false | Readonly<Record<string, CatalogPropSchema>>;
  /**
   * Шов поля — `x-runtimeProps` каждого поля; `value`/`onChange` уточняет `fields[*].value`.
   * По умолчанию {@link SEAM_RUNTIME_PROPS}.
   */
  readonly fieldSeam?: Readonly<Record<string, CatalogRuntimePropDoc>>;
  /** Записи, не являющиеся полями: имя записи → настройки. */
  readonly records?: Readonly<Record<string, KitRecordConfig>>;
  /**
   * Решения по статикам экспортов (`'Textbox.Masked'`): `'ignore'` либо имя плоского экспорта
   * кита, которым статика доступна (`'Tabs.TabPane': 'TabPane'`).
   */
  readonly statics?: Readonly<Record<string, string>>;
  /** Части составных компонентов: имя записи-части → корень (`TabPane: 'Tabs'`). */
  readonly parts?: Readonly<Record<string, string>>;
  /** Разделы палитры: раздел → записи. Порядок ключей — порядок разделов. */
  readonly categories?: Readonly<Record<string, readonly string[]>>;
  /** Палитровые записи без раздела (лягут в раздел по умолчанию билдера). */
  readonly palette?: readonly string[];
  /** Ограниченное превью: запись → причина. Запись остаётся в палитре, рисуется заглушкой. */
  readonly limited?: Readonly<Record<string, string>>;
  /** Служебные записи: в каталоге ради пропсов, но не узлы палитры (`palette: false`). */
  readonly service?: readonly string[];
  /** Экспорты вне каталога. */
  readonly exclude?: readonly string[];
  /** Листья: самодостаточный визуал без детей. */
  readonly leaves?: readonly string[];
  /**
   * Что делать с экспортом-компонентом, которому конфиг не назначил роли: `'service'` (по
   * умолчанию) — запись `palette: false` и заметка; `'refuse'` — отказ генерации.
   */
  readonly unclassified?: 'service' | 'refuse';
  readonly props?: KitPropsConfig;
}

/**
 * Типизирует конфиг в `catalog.config.mjs` (`// @ts-check`). Ничего не делает со значением.
 *
 * @example
 * ```js
 * // @ts-check
 * import { defineKitCatalog } from '@reformer/builder-plugin-cli/catalog-config';
 *
 * export default defineKitCatalog({
 *   entry: './src/index.ts',
 *   kit: { id: 'acme', label: 'Acme DS', package: '@acme/ds' },
 *   ownership: { packages: ['@acme/ds'] },
 *   fields: { Input: { value: 'string | null' } },
 *   categories: { 'Поля ввода': ['Input'] },
 * });
 * ```
 */
export function defineKitCatalog(config: KitCatalogConfig): KitCatalogConfig {
  return config;
}

// ── Пресеты ─────────────────────────────────────────────────────────────────────

/**
 * Пропсы обёртки поля ReFormer — их вынимает обёртка (`FormField`), а не контрол. Тексты — как
 * у `@reformer/ui-kit` (`fieldWrapperPropsSchema` + `fieldCommonPropsSchema`), чтобы одна схема
 * формы читалась одинаково на любом ките.
 */
export const REFORMER_FIELD_WRAPPER: Readonly<Record<string, CatalogPropSchema>> = {
  label: {
    type: 'string',
    description: 'Подпись поля (рендерит FormField.Label).',
    'x-doc': { group: 'Textfield', type: 'string' },
  },
  required: {
    type: 'boolean',
    default: false,
    description: 'Маркер «*» у метки + aria-required.',
    'x-doc': { group: 'State', type: 'boolean' },
  },
  description: {
    type: 'string',
    description: 'Пояснение под полем (shadcn FieldDescription).',
    'x-doc': { group: 'Textfield', type: 'string' },
  },
  labelTooltip: {
    type: 'string',
    description:
      'Подсказка-тултип у иконки (i) после подписи поля (рисует FormField). У inline-контролов (Checkbox/Switch) иконка встаёт справа от контрола.',
    'x-doc': { group: 'Textfield', type: 'string' },
  },
  testId: {
    type: 'string',
    description: 'data-testid для e2e (meta-проп; в DOM примитива не течёт).',
    'x-doc': { group: 'Behavior', type: 'string', kind: 'readonly' },
  },
  tooltip: {
    type: 'string',
    description:
      'Подсказка-тултип у иконки (i) в самом контроле: у полей ввода и селектов — внутри справа (правее крестика очистки, левее шеврона/глаза), у Checkbox/Switch — после текста, у остальных — справа от контрола.',
    'x-doc': { group: 'Textfield', type: 'string' },
  },
};

/** Пресеты обёртки поля по имени (`fieldWrapper: 'reformer'`). */
export const FIELD_WRAPPER_PRESETS: Readonly<
  Record<'reformer', Readonly<Record<string, CatalogPropSchema>>>
> = { reformer: REFORMER_FIELD_WRAPPER };

/**
 * Шов поля: пропсы, которые резолвит форма, а не автор `componentProps`. Тексты — как у
 * `@reformer/ui-kit` (`seamRuntimeProps`); `value`/`onChange` генератор уточняет типом значения
 * поля из `fields[*].value`.
 */
export const SEAM_RUNTIME_PROPS: Readonly<Record<string, CatalogRuntimePropDoc>> = {
  value: {
    group: 'Control',
    type: 'unknown',
    kind: 'readonly',
    description:
      'Текущее значение поля. Резолвится формой (сигнал модели), не задаётся в componentProps.',
  },
  onChange: {
    group: 'Control',
    type: '(value: unknown) => void',
    kind: 'readonly',
    description: 'Value-based колбэк изменения. Форма подставляет control.setValue.',
  },
  onBlur: {
    group: 'Control',
    type: '() => void',
    kind: 'readonly',
    description: 'Отметка touched. Форма подставляет control.markAsTouched.',
  },
  disabled: {
    group: 'State',
    type: 'boolean',
    kind: 'boolean',
    default: false,
    description:
      'Блокировка поля. Задаётся через control.disable()/enable(), НЕ через componentProps: ' +
      'FormFieldControl.tsx:104-115 ставит disabled ПОСЛЕ спреда componentProps, поэтому ' +
      'componentProps.disabled мёртв.',
  },
};

/** Секции пропсов по точному имени — по мотивам решений каталога `@reformer/ui-kit`. */
const GROUP_BY_NAME: Readonly<Record<string, CatalogPropGroup>> = {
  className: 'Control',
  value: 'Control',
  title: 'Control',
  content: 'Control',
  src: 'Control',
  alt: 'Control',
  href: 'Control',
  color: 'Control',
  shape: 'Control',
  size: 'Control',
  mode: 'Control',
  variant: 'Control',
  rows: 'Control',
  header: 'Control',
  heading: 'Control',
  icon: 'Control',
  iconName: 'Control',
  label: 'Textfield',
  description: 'Textfield',
  placeholder: 'Textfield',
  tooltip: 'Textfield',
  labelTooltip: 'Textfield',
  hint: 'Textfield',
  text: 'Textfield',
  mask: 'Textfield',
  search: 'Textfield',
  options: 'Options',
  items: 'Options',
  nodes: 'Options',
  treeData: 'Options',
  suggestions: 'Options',
  dataSource: 'Options',
  config: 'Options',
  settings: 'Options',
  disabled: 'State',
  readOnly: 'State',
  required: 'State',
  invalid: 'State',
  loading: 'State',
  checked: 'State',
  selected: 'State',
  open: 'State',
  active: 'State',
  pressed: 'State',
  expanded: 'State',
  collapsed: 'State',
  visible: 'State',
};

/**
 * Секция инспектора по имени пропа: точная таблица (по мотивам каталога ui-kit), затем форма имени —
 * `is*`/`default*` → `State`, `*Placeholder`/`*Text` → `Textfield`, `*Options`/`*Key` → `Options`,
 * `*ClassName`/`*Style` → `Control`. Не узнанное — `undefined` (генератор кладёт в `Behavior`).
 */
export function groupByName(prop: string): CatalogPropGroup | undefined {
  const exact = GROUP_BY_NAME[prop];
  if (exact !== undefined) return exact;
  if (/^(is|has)[A-Z]/.test(prop) || /^default[A-Z]/.test(prop)) return 'State';
  if (/(Placeholder|Text)$/.test(prop)) return 'Textfield';
  if (/(Options|Key)$/.test(prop)) return 'Options';
  if (/(ClassName|Style)$/.test(prop)) return 'Control';
  return undefined;
}

/** Параметры {@link optionsProp}. */
export interface OptionsPropOptions {
  readonly description?: string;
  /** Поля варианта; по умолчанию `value` и `label`. */
  readonly fields?: readonly string[];
}

/**
 * Схема пропа вариантов выбора (`options`/`items`): массив `{ value, label }`, секция `Options`.
 * Для `props.override` — тип таких пропсов в ките обычно не выражается в JSON (React-узел в
 * подписи), и без уточнения инспектор показал бы их только для чтения.
 */
export function optionsProp(options: OptionsPropOptions = {}): CatalogPropSchema {
  const fields = options.fields ?? ['value', 'label'];
  return {
    type: 'array',
    items: {
      type: 'object',
      required: ['value', 'label'].filter((field) => fields.includes(field)),
      additionalProperties: false,
      properties: Object.fromEntries(
        fields.map((field) => [
          field,
          field === 'value' ? { type: ['string', 'number'] } : { type: 'string' },
        ])
      ),
    },
    ...(options.description === undefined ? {} : { description: options.description }),
    'x-doc': {
      group: 'Options',
      type: `Array<{ ${fields.join('; ')} }>`,
      kind: 'readonly',
    },
  };
}
