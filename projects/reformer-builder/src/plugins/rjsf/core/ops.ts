/**
 * Правки документа RJSF — операциями, которые платформа кладёт в историю.
 *
 * Словарь операций принадлежит домену: платформа видит `{ type, params }` и знает о них одно —
 * у каждой есть обратная. Операции чистые: документ не мутируется, нетронутые части остаются теми
 * же объектами. Адрес поля — его ИМЯ, а не номер: номер сдвигается при каждой вставке.
 *
 * ## Инварианты, которые держат операции
 *
 * - `schema.required ⊆ schema.properties`: удаление и переименование поля правят и `required`;
 * - `uiSchema['ui:order']` полон или содержит `'*'`: новое поле встаёт в порядок, если `'*'` его
 *   не покрывает, — иначе RJSF откажется рисовать форму;
 * - подсказки поля (`uiSchema[имя]`) едут вместе с полем при переименовании и уходят при удалении.
 *
 * Пустой `required`, пустой `ui:order` и пустой `uiSchema` операции не оставляют — убирают целиком.
 * Поэтому закон `apply(apply(f, op).inverse) ≡ f` выполняется для форм без пустых контейнеров.
 *
 * @module plugins/rjsf/core/ops
 */

import type {
  RjsfFieldSchema,
  RjsfFieldUi,
  RjsfForm,
  RjsfObjectSchema,
  RjsfUiSchema,
} from './schema';

/** Где поле стоит: в `properties`, в `required` и в `ui:order`. Нужен, чтобы вернуть поле на место. */
export interface RjsfFieldPlace {
  readonly property?: number;
  readonly required?: number;
  readonly order?: number;
}

export type RjsfOp =
  | {
      readonly type: 'add-field';
      readonly params: {
        readonly name: string;
        readonly field: RjsfFieldSchema;
        readonly required?: boolean;
        readonly ui?: RjsfFieldUi;
        readonly at?: RjsfFieldPlace;
      };
    }
  | { readonly type: 'remove-field'; readonly params: { readonly name: string } }
  | {
      readonly type: 'rename-field';
      readonly params: { readonly name: string; readonly to: string };
    }
  | {
      readonly type: 'move-field';
      /** `index` — место в порядке показа: в `ui:order`, если он есть, иначе в `properties`. */
      readonly params: { readonly name: string; readonly index: number };
    }
  | {
      readonly type: 'set-field';
      readonly params: {
        readonly name: string;
        /** Новая схема поля целиком. */
        readonly field?: RjsfFieldSchema;
        readonly required?: boolean;
        /** Куда встать в `required`, если поле становится обязательным; по умолчанию — в конец. */
        readonly requiredIndex?: number;
        /** Подсказки поля; `null` — убрать. */
        readonly ui?: RjsfFieldUi | null;
      };
    }
  | { readonly type: 'set-title'; readonly params: { readonly title: string | null } };

export interface RjsfApplyResult {
  readonly model: RjsfForm;
  readonly inverse: RjsfOp;
}

const ORDER_KEY = 'ui:order';
const ANY = '*';

function fieldNames(form: RjsfForm): string[] {
  return Object.keys(form.schema.properties);
}

function requiredOf(form: RjsfForm): readonly string[] {
  return form.schema.required ?? [];
}

function orderOf(form: RjsfForm): readonly string[] | undefined {
  return form.uiSchema?.[ORDER_KEY];
}

function uiOf(form: RjsfForm, name: string): RjsfFieldUi | undefined {
  const ui = form.uiSchema?.[name];
  return ui !== null && typeof ui === 'object' ? (ui as RjsfFieldUi) : undefined;
}

function insertAt<T>(list: readonly T[], index: number | undefined, item: T): T[] {
  const at = Math.max(0, Math.min(index ?? list.length, list.length));
  return [...list.slice(0, at), item, ...list.slice(at)];
}

function withSchema(
  form: RjsfForm,
  patch: {
    readonly properties?: Readonly<Record<string, RjsfFieldSchema>>;
    readonly required?: readonly string[];
    readonly title?: string | null;
  }
): RjsfForm {
  const next: Record<string, unknown> = { ...form.schema };
  if (patch.properties !== undefined) next.properties = patch.properties;
  if (patch.required !== undefined) {
    if (patch.required.length === 0) delete next.required;
    else next.required = patch.required;
  }
  if (patch.title !== undefined) {
    if (patch.title === null) delete next.title;
    else next.title = patch.title;
  }
  return { ...form, schema: next as RjsfObjectSchema };
}

/** Новый uiSchema: `fields` — подсказки по имени (`null` — убрать), `order` — порядок (`null` — убрать). */
function withUi(
  form: RjsfForm,
  patch: {
    readonly fields?: Readonly<Record<string, RjsfFieldUi | null>>;
    readonly order?: readonly string[] | null;
  }
): RjsfForm {
  const next: Record<string, unknown> = { ...(form.uiSchema ?? {}) };
  for (const [name, ui] of Object.entries(patch.fields ?? {})) {
    if (ui === null || Object.keys(ui).length === 0) delete next[name];
    else next[name] = ui;
  }
  if (patch.order !== undefined) {
    if (patch.order === null || patch.order.length === 0) delete next[ORDER_KEY];
    else next[ORDER_KEY] = patch.order;
  }
  // Копия, а не сборка заново: неизвестные ключи верхнего уровня документа не теряются.
  const copy: Record<string, unknown> = { ...form };
  if (Object.keys(next).length === 0) delete copy.uiSchema;
  else copy.uiSchema = next as RjsfUiSchema;
  return copy as unknown as RjsfForm;
}

function requireField(form: RjsfForm, name: string): RjsfFieldSchema {
  const field = form.schema.properties[name];
  if (field === undefined) throw new Error(`поля «${name}» нет`);
  return field;
}

function assertFreeName(form: RjsfForm, name: string): void {
  if (name.trim() === '') throw new Error('имя поля пустое');
  if (Object.hasOwn(form.schema.properties, name)) throw new Error(`поле «${name}» уже есть`);
}

/** Порядок показа полей: `ui:order` с развёрнутым `'*'`, иначе порядок `properties`. */
export function displayOrder(form: RjsfForm): readonly string[] {
  const names = fieldNames(form);
  const order = orderOf(form);
  if (order === undefined) return names;
  const known = new Set(names);
  const listed = order.filter((name) => name === ANY || known.has(name));
  const rest = names.filter((name) => !listed.includes(name));
  const star = listed.indexOf(ANY);
  // Без `'*'` RJSF неполный порядок не рисует; показ всё равно не теряет поле — оно в конце.
  if (star < 0) return [...listed, ...rest];
  return [...listed.slice(0, star), ...rest, ...listed.slice(star + 1)];
}

/** @throws если цель операции исчезла, имя занято или тип операции незнаком. */
export function applyRjsfOp(form: RjsfForm, op: RjsfOp): RjsfApplyResult {
  switch (op.type) {
    case 'add-field': {
      const { name, field, required, ui, at } = op.params;
      assertFreeName(form, name);
      const entries = insertAt(Object.entries(form.schema.properties), at?.property, [
        name,
        field,
      ] as const);
      let model = withSchema(form, {
        properties: Object.fromEntries(entries),
        ...(required === true ? { required: insertAt(requiredOf(form), at?.required, name) } : {}),
      });
      const order = orderOf(form);
      // В порядок поле встаёт, если место названо или порядок без `'*'` иначе стал бы неполным.
      const joinsOrder = at?.order !== undefined || (order !== undefined && !order.includes(ANY));
      model = withUi(model, {
        ...(ui !== undefined ? { fields: { [name]: ui } } : {}),
        ...(joinsOrder ? { order: insertAt(order ?? [], at?.order, name) } : {}),
      });
      return { model, inverse: { type: 'remove-field', params: { name } } };
    }

    case 'remove-field': {
      const { name } = op.params;
      const field = requireField(form, name);
      const place: RjsfFieldPlace = {
        property: fieldNames(form).indexOf(name),
        ...(requiredOf(form).includes(name) ? { required: requiredOf(form).indexOf(name) } : {}),
        ...(orderOf(form)?.includes(name) ? { order: orderOf(form)!.indexOf(name) } : {}),
      };
      const ui = uiOf(form, name);
      const properties = Object.fromEntries(
        Object.entries(form.schema.properties).filter(([key]) => key !== name)
      );
      let model = withSchema(form, {
        properties,
        required: requiredOf(form).filter((key) => key !== name),
      });
      const order = orderOf(form);
      model = withUi(model, {
        fields: { [name]: null },
        ...(order !== undefined ? { order: order.filter((key) => key !== name) } : {}),
      });
      return {
        model,
        inverse: {
          type: 'add-field',
          params: {
            name,
            field,
            required: place.required !== undefined,
            ...(ui !== undefined ? { ui } : {}),
            at: place,
          },
        },
      };
    }

    case 'rename-field': {
      const { name, to } = op.params;
      requireField(form, name);
      if (name === to) return { model: form, inverse: { type: 'rename-field', params: op.params } };
      assertFreeName(form, to);
      const properties = Object.fromEntries(
        Object.entries(form.schema.properties).map(([key, value]) => [
          key === name ? to : key,
          value,
        ])
      );
      let model = withSchema(form, {
        properties,
        required: requiredOf(form).map((key) => (key === name ? to : key)),
      });
      const ui = uiOf(form, name);
      const order = orderOf(form);
      model = withUi(model, {
        ...(ui !== undefined ? { fields: { [name]: null, [to]: ui } } : {}),
        ...(order !== undefined ? { order: order.map((key) => (key === name ? to : key)) } : {}),
      });
      return { model, inverse: { type: 'rename-field', params: { name: to, to: name } } };
    }

    case 'move-field': {
      const { name, index } = op.params;
      requireField(form, name);
      const order = orderOf(form);
      if (order !== undefined && order.includes(name)) {
        const from = order.indexOf(name);
        const rest = order.filter((key) => key !== name);
        return {
          model: withUi(form, { order: insertAt(rest, index, name) }),
          inverse: { type: 'move-field', params: { name, index: from } },
        };
      }
      const entries = Object.entries(form.schema.properties);
      const from = entries.findIndex(([key]) => key === name);
      const moved = entries[from]!;
      const rest = entries.filter(([key]) => key !== name);
      return {
        model: withSchema(form, { properties: Object.fromEntries(insertAt(rest, index, moved)) }),
        inverse: { type: 'move-field', params: { name, index: from } },
      };
    }

    case 'set-field': {
      const { name, field, required, requiredIndex, ui } = op.params;
      const previous = requireField(form, name);
      const wasRequired = requiredOf(form).includes(name);
      const previousUi = uiOf(form, name);
      let model = form;
      if (field !== undefined) {
        model = withSchema(model, {
          properties: Object.fromEntries(
            Object.entries(model.schema.properties).map(([key, value]) => [
              key,
              key === name ? field : value,
            ])
          ),
        });
      }
      if (required !== undefined && required !== wasRequired) {
        model = withSchema(model, {
          required: required
            ? insertAt(requiredOf(model), requiredIndex, name)
            : requiredOf(model).filter((key) => key !== name),
        });
      }
      if (ui !== undefined) model = withUi(model, { fields: { [name]: ui } });
      return {
        model,
        inverse: {
          type: 'set-field',
          params: {
            name,
            ...(field !== undefined ? { field: previous } : {}),
            ...(required !== undefined && required !== wasRequired
              ? {
                  required: wasRequired,
                  ...(wasRequired ? { requiredIndex: requiredOf(form).indexOf(name) } : {}),
                }
              : {}),
            ...(ui !== undefined ? { ui: previousUi ?? null } : {}),
          },
        },
      };
    }

    case 'set-title': {
      const previous = form.schema.title ?? null;
      const title = op.params.title === '' ? null : op.params.title;
      return {
        model: withSchema(form, { title }),
        inverse: { type: 'set-title', params: { title: previous } },
      };
    }

    default: {
      const unknown: { readonly type: string } = op;
      throw new Error(`операция «${unknown.type}» домену rjsf неизвестна`);
    }
  }
}

/** Свободное имя для нового поля: `field1`, `field2`, … */
export function nextFieldName(form: RjsfForm, base = 'field'): string {
  const taken = new Set(fieldNames(form));
  for (let n = 1; ; n += 1) {
    const candidate = `${base}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
