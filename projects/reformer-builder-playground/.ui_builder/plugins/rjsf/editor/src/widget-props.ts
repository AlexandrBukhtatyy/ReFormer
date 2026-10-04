/**
 * Свойства виджета поля — те, что кит объявил записи каталога, а не список, зашитый в панель.
 *
 * Панель свойств ведёт поле в двух слоях. Что поле ЗНАЧИТ — имя, тип, варианты, обязательность —
 * принадлежит JSON Schema и одинаково для любого виджета. Чем поле НАРИСОВАНО — дело кита: у маски
 * ввода есть шаблон, у ползунка — ориентация, и знает об этом только каталог (`propsSchema`
 * записи). Этот модуль отвечает на второй вопрос: какая запись стоит за виджетом поля и какие её
 * пропсы правятся здесь.
 *
 * Обе половины ответа — у пакета темы (`@reformer/rjsf-kit-theme`): запись под виджетом выбирает
 * то же правило, что и тема, а список пропсов — ровно тот, что мост пробрасывает в контрол
 * из `ui:options`. Своего списка у редактора нет: свойство, показанное здесь, но не дошедшее
 * до контрола, правилось бы впустую. По той же причине здесь нет подписи, описания,
 * обязательности и вариантов — их ведёт схема, и второе место правки спорило бы с первым.
 *
 * Значения лежат в `uiSchema[поле]['ui:options']` — там, где RJSF ждёт подсказки отрисовки.
 *
 * @module plugins/rjsf/editor/widget-props
 */

import { kitWidgetTarget, registryWidgetName, widgetOptionProps } from '@reformer/rjsf-kit-theme';
import type { RjsfFieldSchema, RjsfFieldUi } from '../../core';
import type { CatalogJson } from '@reformer/builder-plugin-api';

const WIDGET_KEY = 'ui:widget';
const OPTIONS_KEY = 'ui:options';

/**
 * Чем правится свойство. Пропсов без редактора (колбэки, слоты, составные значения) в панели
 * нет: JSON'ом формы их либо не задать вовсе, либо задают руками в тексте документа.
 */
export type WidgetPropEditor = 'text' | 'checkbox' | 'number' | 'select';

/** Свойство контрола вместе с текущим значением поля. */
export interface WidgetPropField {
  /** Ключ пропа — он же ключ в `ui:options`. */
  readonly key: string;
  readonly label: string;
  readonly editor: WidgetPropEditor;
  /** Группа каталога (`x-doc.group`). */
  readonly group: string;
  readonly description?: string;
  /** Умолчание каталога. Показывается подсказкой, в документ не записывается. */
  readonly fallback?: unknown;
  readonly options?: readonly (string | number)[];
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  /** Значение из `ui:options`; `undefined` — свойство не задано. */
  readonly value: unknown;
}

export interface WidgetPropsModel {
  /** Запись каталога, которую рисует виджет поля. */
  readonly component: string;
  /** Правимые свойства записи — в порядке каталога. */
  readonly fields: readonly WidgetPropField[];
}

const DEFAULT_GROUP = 'Control';

/**
 * Группы панели в порядке показа — от важного к второстепенному: что это за поле и как оно
 * выглядит, что на нём написано, какие данные оно несёт, как себя ведёт, в каком состоянии.
 *
 * Имена — группы каталога китов ReFormer (`x-doc.group`), подписи к ним лежат в словаре. Свою
 * группу кита панель показывает после них и под её собственным именем: перевода взять неоткуда.
 */
export const FIELD_GROUPS: readonly string[] = Object.freeze([
  'Control',
  'Textfield',
  'Options',
  'Behavior',
  'State',
]);

/** Свойства поля, которые ведёт схема формы, а не каталог кита. */
export type FieldRowId = 'name' | 'widget' | 'label' | 'placeholder' | 'type' | 'enum' | 'required';

/** В какой группе стоит свойство схемы: рядом с родственными свойствами контрола. */
const SCHEMA_ROW_GROUPS: Readonly<Record<FieldRowId, string>> = {
  name: 'Control',
  widget: 'Control',
  label: 'Textfield',
  placeholder: 'Textfield',
  type: 'Options',
  enum: 'Options',
  required: 'State',
};

/**
 * Свойства контрола, которым панель назначает группу сама. Вариант и размер кит относит
 * к «Поведению» (так устроены его `cva`-пропсы), а по смыслу это внешний вид поля — и стоят они
 * сразу за выбором виджета.
 */
const PROP_GROUP_OVERRIDES: Readonly<Record<string, string>> = {
  variant: 'Control',
  size: 'Control',
};

/**
 * Порядок строк внутри группы — от важного к второстепенному. Свойства контрола, которых здесь
 * нет, идут в своей группе следом, в порядке каталога.
 *
 * Свойству схемы и свойству контрола нужен общий порядок, а ключи у них пересекаются (`name`
 * у поля — имя в данных, у ползунка — атрибут формы), поэтому адрес строки несёт слой.
 */
const ROW_ORDER: readonly string[] = [
  'field:name',
  'field:widget',
  'prop:variant',
  'prop:size',
  'prop:className',
  'field:label',
  'prop:labelTooltip',
  'prop:tooltip',
  'field:placeholder',
  'field:type',
  'field:enum',
  'field:required',
];

/**
 * Группа свойства контрола в панели. «Основные» открывают панель, и стоит в них только
 * названное в {@link ROW_ORDER}: прочее, что кит отнёс к своей группе `Control` (атрибуты
 * HTML-формы `name` и `form`), — технические свойства, и рядом с «именем в данных» их приняли бы
 * за главное. Их место — «Поведение».
 */
function groupOf(prop: WidgetPropField, address: string): string {
  const assigned = PROP_GROUP_OVERRIDES[prop.key];
  if (assigned !== undefined) return assigned;
  return prop.group === 'Control' && !ROW_ORDER.includes(address) ? 'Behavior' : prop.group;
}

/** Строка панели свойств поля: свойство схемы либо свойство контрола. */
export type FieldRow =
  | { readonly kind: 'field'; readonly id: FieldRowId }
  | { readonly kind: 'prop'; readonly prop: WidgetPropField };

/** Группа панели со своими строками. */
export interface FieldSection {
  readonly group: string;
  readonly rows: readonly FieldRow[];
}

export interface FieldPanelModel {
  /** Запись каталога под виджетом поля; `null` — виджет рисует не кит. */
  readonly component: string | null;
  readonly sections: readonly FieldSection[];
}

type Json = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Запись под виджетом поля и пропсы, которые она берёт из `ui:options`. */
function targetOf(
  field: RjsfFieldSchema,
  ui: RjsfFieldUi | undefined,
  catalog: CatalogJson | null
) {
  if (catalog === null) return null;
  const named = ui?.[WIDGET_KEY];
  const widget = registryWidgetName(
    field,
    typeof named === 'string' && named !== '' ? named : undefined
  );
  if (widget === undefined) return null;
  const target = kitWidgetTarget(widget, {
    components: catalog.components,
    widgets: catalog.kit?.renderers?.rjsf?.widgets,
  });
  if (target === undefined) return null;
  return { record: target.record, keys: widgetOptionProps(target.record, target.props) };
}

/** `camelCase`/`snake` → «Title Case»: подписи пропсов в каталоге нет, есть только ключ. */
function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (first) => first.toUpperCase())
    .trim();
}

function choicesOf(prop: Json): (string | number)[] {
  return Array.isArray(prop.enum)
    ? prop.enum.filter((item) => typeof item === 'string' || typeof item === 'number')
    : [];
}

/** Вид свойства: пометка кита (`x-doc.kind`), иначе — по ключевым словам JSON Schema. */
function kindOf(key: string, prop: Json): string | undefined {
  // Класс кит помечает «только чтение» для своей документации; строкой он правится.
  if (key === 'className') return 'text';
  const doc = prop['x-doc'];
  if (isRecord(doc) && typeof doc.kind === 'string') return doc.kind;
  if (Array.isArray(prop.enum)) return 'enum';
  if (prop.type === 'boolean') return 'boolean';
  if (prop.type === 'number' || prop.type === 'integer') return 'number';
  return prop.type === 'string' ? 'text' : undefined;
}

function editorOf(key: string, prop: Json): WidgetPropEditor | null {
  switch (kindOf(key, prop)) {
    case 'text':
      return 'text';
    case 'boolean':
      return 'checkbox';
    case 'number':
      return 'number';
    case 'enum':
      return choicesOf(prop).length > 0 ? 'select' : null;
    default:
      return null;
  }
}

function optionsOf(ui: RjsfFieldUi | undefined | null): Json {
  const options = ui?.[OPTIONS_KEY];
  return isRecord(options) ? options : {};
}

/**
 * Свойства виджета поля; `null` — за виджетом нет записи кита (кита нет, каталог ещё едет или
 * виджет остался стандартным RJSF). Запись без правимых пропсов даёт модель без свойств.
 */
export function widgetPropsOf(
  field: RjsfFieldSchema,
  ui: RjsfFieldUi | undefined,
  catalog: CatalogJson | null
): WidgetPropsModel | null {
  const target = targetOf(field, ui, catalog);
  if (target === null) return null;
  const properties = target.record.propsSchema?.properties;
  const declared = isRecord(properties) ? properties : {};
  const values = optionsOf(ui);

  const fields: WidgetPropField[] = [];
  for (const key of target.keys) {
    const prop = declared[key];
    if (!isRecord(prop)) continue;
    const editor = editorOf(key, prop);
    if (editor === null) continue;
    const doc = prop['x-doc'];
    fields.push({
      key,
      label: humanize(key),
      editor,
      group: isRecord(doc) && typeof doc.group === 'string' ? doc.group : DEFAULT_GROUP,
      ...(typeof prop.description === 'string' ? { description: prop.description } : {}),
      ...(prop.default !== undefined ? { fallback: prop.default } : {}),
      ...(editor === 'select' ? { options: choicesOf(prop) } : {}),
      ...(typeof prop.minimum === 'number' ? { min: prop.minimum } : {}),
      ...(typeof prop.maximum === 'number' ? { max: prop.maximum } : {}),
      ...(typeof prop.multipleOf === 'number' ? { step: prop.multipleOf } : {}),
      value: values[key],
    });
  }
  return { component: target.record.name, fields };
}

/**
 * Панель свойств поля: группы в порядке {@link FIELD_GROUPS}, внутри группы — {@link ROW_ORDER}.
 *
 * Свойства схемы и свойства контрола стоят в одних группах: человеку всё равно, где значение
 * хранится, — подпись и подсказка в контроле для него соседи, хотя первая лежит в схеме,
 * а вторая в `ui:options`. Отдельного блока «свойства компонента» поэтому нет.
 *
 * Свойства схемы есть у любого поля; подсказка в поле и варианты — у всех, кроме «да/нет»:
 * флажку вписывать нечего и выбирать не из чего.
 */
export function fieldPanelOf(
  field: RjsfFieldSchema,
  ui: RjsfFieldUi | undefined,
  catalog: CatalogJson | null
): FieldPanelModel {
  const props = widgetPropsOf(field, ui, catalog);
  const ids: FieldRowId[] = ['name', 'widget', 'label', 'type', 'required'];
  if (field.type !== 'boolean') ids.push('placeholder', 'enum');

  interface Placed {
    readonly address: string;
    readonly group: string;
    readonly row: FieldRow;
  }
  const placed: Placed[] = [
    ...ids.map(
      (id): Placed => ({
        address: `field:${id}`,
        group: SCHEMA_ROW_GROUPS[id],
        row: { kind: 'field', id },
      })
    ),
    ...(props?.fields ?? []).map((prop): Placed => {
      const address = `prop:${prop.key}`;
      return { address, group: groupOf(prop, address), row: { kind: 'prop', prop } };
    }),
  ];
  const rank = (address: string): number => {
    const at = ROW_ORDER.indexOf(address);
    return at < 0 ? ROW_ORDER.length : at;
  };
  // Сортировка устойчива: свойства контрола без своего места остаются в порядке каталога.
  placed.sort((a, b) => rank(a.address) - rank(b.address));

  const groups = [
    ...FIELD_GROUPS,
    ...new Set(placed.map((entry) => entry.group).filter((group) => !FIELD_GROUPS.includes(group))),
  ];
  return {
    component: props?.component ?? null,
    sections: groups
      .map((group) => ({
        group,
        rows: placed.filter((entry) => entry.group === group).map((entry) => entry.row),
      }))
      .filter((section) => section.rows.length > 0),
  };
}

/** Подсказки поля с новыми `ui:options`; пустые опции и пустые подсказки уходят целиком. */
function withOptions(ui: RjsfFieldUi | undefined | null, options: Json): RjsfFieldUi | null {
  const next: Record<string, unknown> = { ...ui };
  if (Object.keys(options).length === 0) delete next[OPTIONS_KEY];
  else next[OPTIONS_KEY] = options;
  return Object.keys(next).length === 0 ? null : next;
}

/**
 * Подсказки поля со свойством виджета; `undefined` и пустая строка свойство убирают.
 *
 * Убирают, а не пишут пустым: свойство, которого в `ui:options` нет, означает «умолчание кита»,
 * а пустая строка — «пусто». Стерев текст в поле, человек хочет первого.
 */
export function withWidgetOption(
  ui: RjsfFieldUi | undefined,
  key: string,
  value: unknown
): RjsfFieldUi | null {
  const options: Record<string, unknown> = { ...optionsOf(ui) };
  if (value === undefined || value === '') delete options[key];
  else options[key] = value;
  return withOptions(ui, options);
}

/**
 * Подсказки поля после смены его виджета: из `ui:options` уходят пропсы прежнего контрола,
 * которых новый не принимает, — иначе документ копил бы свойства, которых не видно ни в панели,
 * ни в форме.
 *
 * Уходят только они. Прочие ключи `ui:options` (`emptyValue`, `inline` — подсказки самого RJSF)
 * писал человек, редактор про них не знает и молча стирать не вправе.
 *
 * Виджет меняет не только его выбор: тип поля и появление вариантов меняют виджет по умолчанию.
 * Поэтому сравниваются поле и подсказки целиком — до и после.
 */
export function retargetUi(
  before: { readonly field: RjsfFieldSchema; readonly ui: RjsfFieldUi | undefined },
  after: { readonly field: RjsfFieldSchema; readonly ui: RjsfFieldUi | null },
  catalog: CatalogJson | null
): RjsfFieldUi | null {
  const was = targetOf(before.field, before.ui, catalog)?.keys ?? [];
  if (was.length === 0) return after.ui;
  const now = targetOf(after.field, after.ui ?? undefined, catalog)?.keys ?? [];
  const options: Record<string, unknown> = { ...optionsOf(after.ui) };
  let changed = false;
  for (const key of was) {
    if (now.includes(key) || !Object.hasOwn(options, key)) continue;
    delete options[key];
    changed = true;
  }
  return changed ? withOptions(after.ui, options) : after.ui;
}
