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
import type { RjsfFieldSchema, RjsfFieldUi } from '@/plugins/rjsf/core';
import type { CatalogJson } from '@reformer/builder-plugin-api';

const WIDGET_KEY = 'ui:widget';
const OPTIONS_KEY = 'ui:options';

/**
 * Чем правится свойство. Пропсов без редактора (колбэки, слоты, составные значения) в панели
 * нет: JSON'ом формы их либо не задать вовсе, либо задают руками в тексте документа.
 */
export type WidgetPropEditor = 'text' | 'checkbox' | 'number' | 'select';

/** Свойство виджета вместе с текущим значением поля. */
export interface WidgetPropField {
  /** Ключ пропа — он же ключ в `ui:options`. */
  readonly key: string;
  readonly label: string;
  readonly editor: WidgetPropEditor;
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

/** Секция свойств — группа каталога (`x-doc.group`). */
export interface WidgetPropSection {
  readonly group: string;
  readonly fields: readonly WidgetPropField[];
}

export interface WidgetPropsModel {
  /** Запись каталога, которую рисует виджет поля. */
  readonly component: string;
  readonly sections: readonly WidgetPropSection[];
}

/** Порядок секций — тот же, что у инспектора схемы ReFormer; группы сверх него идут следом. */
export const WIDGET_PROP_GROUPS: readonly string[] = Object.freeze([
  'Control',
  'Options',
  'Textfield',
  'Behavior',
  'State',
]);

const DEFAULT_GROUP = 'Control';

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
 * виджет остался стандартным RJSF). Запись без правимых пропсов даёт модель без секций.
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

  const byGroup = new Map<string, WidgetPropField[]>();
  for (const key of target.keys) {
    const prop = declared[key];
    if (!isRecord(prop)) continue;
    const editor = editorOf(key, prop);
    if (editor === null) continue;
    const doc = prop['x-doc'];
    const group = isRecord(doc) && typeof doc.group === 'string' ? doc.group : DEFAULT_GROUP;
    const choices = choicesOf(prop);
    const fields = byGroup.get(group) ?? [];
    fields.push({
      key,
      label: humanize(key),
      editor,
      ...(typeof prop.description === 'string' ? { description: prop.description } : {}),
      ...(prop.default !== undefined ? { fallback: prop.default } : {}),
      ...(editor === 'select' ? { options: choices } : {}),
      ...(typeof prop.minimum === 'number' ? { min: prop.minimum } : {}),
      ...(typeof prop.maximum === 'number' ? { max: prop.maximum } : {}),
      ...(typeof prop.multipleOf === 'number' ? { step: prop.multipleOf } : {}),
      value: values[key],
    });
    byGroup.set(group, fields);
  }

  const order = [
    ...WIDGET_PROP_GROUPS.filter((group) => byGroup.has(group)),
    ...[...byGroup.keys()].filter((group) => !WIDGET_PROP_GROUPS.includes(group)),
  ];
  return {
    component: target.record.name,
    sections: order.map((group) => ({ group, fields: byGroup.get(group)! })),
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
