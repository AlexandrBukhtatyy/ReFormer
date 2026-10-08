/**
 * Форма для тестов из компактного описания «значение и компонент рядом».
 *
 * Тесты нод описывают поля одной записью: `{ email: { value: '', component } }`; вложенный объект —
 * группа; массив `[описание строки, ...значения строк]` — массив под-форм, где первая запись даёт и
 * шаблон строки, и первую строку. Помощник строит из описания модель и дерево схемы и собирает форму
 * обычным путём — `createModel` и `createFormFromModel`.
 *
 * Описание читается по форме записи — это удобство тестов, а не контракт ядра: поле, чьё значение
 * само объект вида `{ value }`, помощник примет за группу. Такую форму собирайте из модели напрямую.
 */

import { signal } from '@preact/signals-core';
import { arrayOf, createModel } from '../../src/model/index';
import { createFormFromModel } from '../../src/form/create-form';
import { FieldNode } from '../../src/form/nodes/field-node';
import type { ModelArrayNode } from '../../src/form/nodes/model-array-node';
import type { FieldConfig, FormProxy } from '../../src/form/types/index';
import type { FormSchemaNode } from '../../src/form/types/schema-node';

/** Описание поля: начальное значение и то, что нода берёт из узла схемы. */
interface TestField<V> {
  value: V | null;
  component?: unknown;
  componentProps?: Record<string, unknown>;
  disabled?: boolean;
}

/** Описание полей формы данных `T`: поле, вложенная группа или массив под-форм. */
export type TestFields<T> = {
  [K in keyof T]: NonNullable<T[K]> extends ReadonlyArray<infer U>
    ? TestField<T[K]> | [TestFields<U>, ...Partial<U>[]]
    : NonNullable<T[K]> extends object
      ? TestField<T[K]> | TestFields<NonNullable<T[K]>>
      : TestField<T[K]>;
};

type Fields = Record<string, unknown>;

const FIELD_KEYS = new Set(['value', 'component', 'componentProps', 'disabled']);

const looksLikeField = (entry: unknown): entry is TestField<unknown> =>
  entry !== null &&
  typeof entry === 'object' &&
  !Array.isArray(entry) &&
  'value' in entry &&
  Object.keys(entry).every((key) => FIELD_KEYS.has(key));

/**
 * Описание поля — запись с `value`. Группа с полем данных по имени `value` выглядит так же, и её
 * выдаёт вложенность: `{ value: { value: '' } }` — группа, внутри которой описание поля `value`.
 */
const isField = (entry: unknown): entry is TestField<unknown> =>
  looksLikeField(entry) && !looksLikeField(entry.value);

const isFields = (entry: unknown): entry is Fields =>
  entry !== null && typeof entry === 'object' && !Array.isArray(entry) && !isField(entry);

/** Начальные значения по описанию полей. */
function valuesOf(fields: Fields): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(fields)) {
    if (isField(entry)) {
      values[key] = entry.value;
    } else if (Array.isArray(entry)) {
      const [rowFields, ...rows] = entry as [Fields, ...unknown[]];
      const blank = () => valuesOf(rowFields);
      values[key] = arrayOf(blank, [
        blank(),
        ...rows.map((row) => (isFields(row) ? rowValues(rowFields, row) : row)),
      ]);
    } else {
      values[key] = valuesOf(entry as Fields);
    }
  }
  return values;
}

/** Строка, заданная описанием полей либо обычными значениями: недостающее — из шаблона. */
function rowValues(rowFields: Fields, row: Fields): Record<string, unknown> {
  const described = Object.values(row).some((entry) => isField(entry));
  return described ? valuesOf(row) : { ...valuesOf(rowFields), ...row };
}

/** Узлы схемы по описанию полей; `model` — под-модель той же формы данных. */
function nodesOf(fields: Fields, model: { $: Record<string, unknown> }): FormSchemaNode[] {
  const nodes: FormSchemaNode[] = [];
  for (const [key, entry] of Object.entries(fields)) {
    const handle = model.$[key];
    if (isField(entry)) {
      nodes.push({
        model: handle,
        component: entry.component as FormSchemaNode['component'],
        componentProps: entry.componentProps,
        disabled: entry.disabled,
      });
    } else if (Array.isArray(entry)) {
      const rowFields = entry[0] as Fields;
      nodes.push({
        model: handle,
        item: (rowModel: { $: Record<string, unknown> }) => ({
          children: nodesOf(rowFields, rowModel),
        }),
      });
    } else {
      nodes.push({ children: nodesOf(entry as Fields, { $: handle as Record<string, unknown> }) });
    }
  }
  return nodes;
}

/**
 * Собрать форму из описания полей.
 *
 * @example
 * ```ts
 * const form = formFromFields<{ email: string; address: { city: string } }>({
 *   email: { value: '', component: Input },
 *   address: { city: { value: '' } },
 * });
 * form.email.setValue('user@mail.com');
 * ```
 */
export function formFromFields<T>(fields: TestFields<T>): FormProxy<T> {
  const model = createModel(valuesOf(fields as Fields) as T & object);
  const schema: FormSchemaNode = {
    children: nodesOf(fields as Fields, model as unknown as { $: Record<string, unknown> }),
  };
  return createFormFromModel<T>({ model: model as never, schema });
}

/**
 * Массив под-форм из описания строки. Без начальных строк массив пуст.
 *
 * @example
 * ```ts
 * const phones = arrayFromFields<{ number: string }>({ number: { value: '' } });
 * phones.push({ number: '+7' });
 * ```
 */
export function arrayFromFields<T extends object>(
  rowFields: TestFields<T>,
  rows: Partial<T>[] = []
): ModelArrayNode<T> {
  const blank = () => valuesOf(rowFields as Fields);
  const model = createModel({
    rows: arrayOf(
      blank,
      rows.map((row) => ({ ...blank(), ...row }))
    ),
  });
  const form = createFormFromModel({
    model,
    schema: {
      children: [
        {
          model: model.$.rows,
          item: (rowModel: { $: Record<string, unknown> }) => ({
            children: nodesOf(rowFields as Fields, rowModel),
          }),
        },
      ],
    },
  });
  return form.rows as unknown as ModelArrayNode<T>;
}

/**
 * Поле-нода над собственным сигналом — для тестов самой ноды, без модели и формы.
 *
 * @example
 * ```ts
 * const field = fieldOf('initial', { disabled: true });
 * ```
 */
export function fieldOf<T>(
  value: T,
  config: Omit<FieldConfig<T>, 'valueSignal'> = {}
): FieldNode<T> {
  return new FieldNode<T>({ ...config, valueSignal: signal(value) });
}
