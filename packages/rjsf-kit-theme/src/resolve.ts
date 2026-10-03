/**
 * Какую запись каталога рисует виджет поля и какие её пропсы задаются через `ui:options`.
 *
 * Чистые функции над каталогом кита — без React и без пространства имён. Вопрос «что это за контрол
 * и что ему можно задать» задают двое: мост ({@link './widgets'.kitWidget}) пробрасывает пропсы
 * в контрол, а редактор формы показывает их полями. Ответ обязан быть один: редактор, показавший
 * свойство, которое мост не пробросит, предлагал бы править то, что ничего не меняет.
 *
 * @module @reformer/rjsf-kit-theme/resolve
 */

import type { KitThemeInput, KitThemeRecord } from './types';

/** Запись каталога, которой можно заменить виджет RJSF. */
export interface KitWidgetCandidate {
  /** Имя записи каталога. */
  readonly component: string;
  /** Пропсы, без которых запись в этой роли не годится (`Input` под паролем — `type: 'password'`). */
  readonly props?: Readonly<Record<string, unknown>>;
}

/**
 * Виджет RJSF → записи каталога, которые его заменяют, по убыванию предпочтения. Сопоставление
 * по имени записи, а не экспорта: имя записи — общее у китов (`Checkbox`), экспорт — нет.
 */
export const DEFAULT_WIDGET_CANDIDATES: Readonly<Record<string, readonly KitWidgetCandidate[]>> =
  Object.freeze({
    TextWidget: [{ component: 'Input' }],
    PasswordWidget: [
      { component: 'InputPassword' },
      { component: 'Input', props: { type: 'password' } },
    ],
    TextareaWidget: [{ component: 'Textarea' }],
    CheckboxWidget: [{ component: 'Checkbox' }, { component: 'Switch' }],
    SelectWidget: [{ component: 'Select' }, { component: 'NativeSelect' }],
    RadioWidget: [{ component: 'RadioGroup' }],
    RangeWidget: [{ component: 'Slider' }],
    UpDownWidget: [{ component: 'InputNumber' }],
    DateWidget: [{ component: 'DatePicker' }],
  });

/**
 * Короткое имя `ui:widget` → имя виджета в реестре RJSF. Та же таблица, что у `getWidget` из
 * `@rjsf/utils`, но без деления по типу поля: у одного короткого имени виджет один на все типы.
 */
const WIDGET_BY_ALIAS: Readonly<Record<string, string>> = Object.freeze({
  text: 'TextWidget',
  password: 'PasswordWidget',
  email: 'EmailWidget',
  hostname: 'TextWidget',
  ipv4: 'TextWidget',
  ipv6: 'TextWidget',
  uri: 'URLWidget',
  'data-url': 'FileWidget',
  radio: 'RadioWidget',
  select: 'SelectWidget',
  textarea: 'TextareaWidget',
  hidden: 'HiddenWidget',
  date: 'DateWidget',
  datetime: 'DateTimeWidget',
  'date-time': 'DateTimeWidget',
  'alt-date': 'AltDateWidget',
  'alt-datetime': 'AltDateTimeWidget',
  time: 'TimeWidget',
  color: 'ColorWidget',
  file: 'FileWidget',
  files: 'FileWidget',
  checkbox: 'CheckboxWidget',
  checkboxes: 'CheckboxesWidget',
  updown: 'UpDownWidget',
  range: 'RangeWidget',
});

/** Схема поля в объёме, от которого зависит виджет по умолчанию. */
export interface WidgetSchema {
  readonly type?: unknown;
  readonly enum?: unknown;
  readonly format?: unknown;
}

/**
 * Имя виджета поля в реестре RJSF: `ui:widget` (короткое имя развёрнуто) или виджет по умолчанию —
 * флажок у `boolean`, выбор у поля с вариантами, виджет формата (`format: date`), иначе текст.
 * `undefined` — у объекта и массива: их рисует не виджет.
 */
export function registryWidgetName(schema: WidgetSchema, widget?: unknown): string | undefined {
  if (typeof widget === 'string') return WIDGET_BY_ALIAS[widget] ?? widget;
  if (schema.type === 'boolean') return 'CheckboxWidget';
  if (schema.type !== 'string' && schema.type !== 'number' && schema.type !== 'integer') {
    return undefined;
  }
  if (Array.isArray(schema.enum)) return 'SelectWidget';
  const byFormat = typeof schema.format === 'string' ? WIDGET_BY_ALIAS[schema.format] : undefined;
  return byFormat ?? 'TextWidget';
}

/** Запись каталога, которую рисует виджет. */
export interface KitWidgetTarget {
  readonly record: KitThemeRecord;
  /** Постоянные пропсы роли (`type: 'password'`): через `ui:options` они не задаются. */
  readonly props?: Readonly<Record<string, unknown>>;
}

/**
 * Запись каталога под именем виджета реестра: роль RJSF (`TextWidget`) — по уточнению кита, иначе
 * первым подходящим кандидатом; имя записи (`Switch`) — сама запись, если она поле. `undefined` —
 * виджет остаётся стандартным RJSF.
 *
 * Смотрит только в каталог. Тема сверяется ещё и с пространством имён: запись без компонента она
 * пропускает, и тогда роль рисует следующий кандидат.
 */
export function kitWidgetTarget(
  widget: string,
  kit: Pick<KitThemeInput, 'components' | 'widgets'>
): KitWidgetTarget | undefined {
  const find = (name: string) => kit.components.find((record) => record.name === name);
  const named = kit.widgets?.[widget];
  const candidates = DEFAULT_WIDGET_CANDIDATES[widget];
  if (named === undefined && candidates === undefined) {
    const record = find(widget);
    return record?.role === 'field' ? { record } : undefined;
  }
  const refined = named === undefined ? undefined : find(named);
  if (refined !== undefined) return { record: refined };
  for (const candidate of candidates ?? []) {
    const record = find(candidate.component);
    if (record !== undefined && record.role !== 'container') {
      return candidate.props === undefined ? { record } : { record, props: candidate.props };
    }
  }
  return undefined;
}

/**
 * Пропсы контрола, которыми распоряжается форма, а не `ui:options`:
 *
 * - подпись, описание, обязательность и варианты — это `title`, `description`, `required` и `enum`
 *   схемы; подсказка в поле — `ui:placeholder`;
 * - значение и его начальное состояние — данные формы и `default` схемы;
 * - `id`, блокировку и автофокус ставит RJSF;
 * - `testId` и `labelTooltip` — мета-пропсы обёртки поля ReFormer, рамка поля RJSF их не рисует.
 */
export const FORM_OWNED_PROPS: readonly string[] = Object.freeze([
  'label',
  'description',
  'required',
  'placeholder',
  'options',
  'value',
  'defaultValue',
  'checked',
  'defaultChecked',
  'pressed',
  'defaultPressed',
  'id',
  'disabled',
  'autoFocus',
  'testId',
  'labelTooltip',
]);

/**
 * Пропсы записи, которые поле принимает из `ui:options`: объявленные в `propsSchema`, кроме тех,
 * что ведёт форма ({@link FORM_OWNED_PROPS}), и постоянных пропсов роли.
 */
export function widgetOptionProps(
  record: KitThemeRecord | undefined,
  fixed: Readonly<Record<string, unknown>> = {}
): readonly string[] {
  const properties = record?.propsSchema?.properties;
  if (typeof properties !== 'object' || properties === null) return [];
  return Object.keys(properties).filter(
    (key) => !FORM_OWNED_PROPS.includes(key) && !Object.hasOwn(fixed, key)
  );
}
