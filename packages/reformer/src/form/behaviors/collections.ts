/**
 * Операторы поведения над коллекциями и под-моделями.
 *
 * Все четыре начинаются одинаково: `getScope()` → `__path` цели → ранний выход, если пути нет.
 * Различаются владением cleanup'ами: `apply` кладёт отписку под-схемы в РОДИТЕЛЬСКИЙ ambient-сток,
 * а `applyEach` держит отписки строк в собственном `Map` и снимает их при удалении строки.
 *
 * @group Behaviors
 * @module form/behaviors/collections
 */

import type { Signal } from '@preact/signals-core';
import type { BehaviorCleanup, FormModel, FormProxy } from '../../index';
import { getScope, onDispose, effect, defer, defineFormBehavior } from './context';
import { type GroupSignals, isLeafSignal, asArray, getByPath } from './internals';
import { onChange } from './operators';
import type { FormBehavior } from './types';

/** Лёгкая модель-обёртка над вложенными сигналами (для `apply`): `.$` + value-чтение. */
function nestedModel<T>(groupSignals: GroupSignals): FormModel<T> {
  return new Proxy(
    {},
    {
      get: (_t, key) => {
        if (key === '$') return groupSignals;
        if (typeof key !== 'string') return undefined;
        const child = groupSignals[key];
        if (child == null) return undefined;
        return isLeafSignal(child) ? child.value : nestedModel(child as GroupSignals);
      },
    }
  ) as FormModel<T>;
}

/**
 * Заглушка формы строки для НЕматериализованного массива: бросает понятную ошибку при доступе к ноде.
 * Value-операции (row.$.*) её не трогают; ошибка возникает только при попытке node-операции (form.x).
 */
function unmaterializedRowForm<T>(path: string): FormProxy<T> {
  return new Proxy(
    {},
    {
      get(_t, key) {
        if (typeof key === 'symbol' || key === 'then') return undefined;
        throw new Error(
          `[@reformer/core/behaviors] applyEach: форма строки массива "${path}" недоступна (form.${String(
            key
          )}) — массив не материализован в схеме формы. Per-row node-операции ` +
            `(enableWhen/updateComponentProps/reset) требуют узла { array, item } в схеме; ` +
            `value-операции (row.$.*: compute/copyFrom/transformValue) работают и без материализации.`
        );
      },
    }
  ) as FormProxy<T>;
}

/**
 * Применить под-схему к КАЖДОМУ элементу динамического массива (per-item поведение).
 * Реагирует на добавление/удаление строк: новым строкам поведение применяется, удалённым — отписывается.
 *
 * Под-схема получает scope строки: `model` (под-модель строки — `row.$.field`) и `form` (нода строки).
 * - Value-операции (`compute`/`copyFrom`/`transformValue` на `row.$.*`) работают всегда.
 * - Node-операции (`enableWhen`/`updateComponentProps`/`reset` через `form.*`) требуют, чтобы массив был
 *   МАТЕРИАЛИЗОВАН в форме (узел `{ array, item }` в схеме) — тогда `form` строки = та же нода, что
 *   рендерится, а её сигналы зарегистрированы (`enableWhen` резолвит ноду). Без материализации доступ
 *   к `form.*` бросит понятную ошибку (см. {@link unmaterializedRowForm}).
 *
 * @example
 * applyEach(model.$.items, defineFormBehavior<Item>(({ model: row, form }) => {
 *   compute(row.$.lineTotal, () => row.qty * row.price);    // value-op — всегда
 *   enableWhen(row.$.discount, () => row.qty > 10);          // node-op — нужна материализация массива
 * }));
 */
export function applyEach<TItem>(array: object, itemSchema: FormBehavior<TItem>): void {
  const { model: rootModel, form: rootForm } = getScope();
  const path = (array as GroupSignals).__path;
  if (!path) return;
  const arrValue = getByPath(rootModel, path); // value-proxy массива (at/length/map)
  if (!arrValue) return;
  const arrNode = (rootForm as unknown as { getFieldByPath(p: string): unknown }).getFieldByPath(
    path
  ) as { at?: (i: number) => unknown; length?: { value: number } } | undefined;
  // Длину берём из НОДЫ массива (её сигнал обновляется ПОСЛЕ построения форм строк) — так rowForm готов
  // к запуску row-поведения независимо от порядка effect'ов. Фолбэк — длина value-proxy модели
  // (немат­ериализованный массив: форм строк нет, node-операции недоступны).
  const lengthSignal = arrNode?.length;

  // key = под-модель строки (стабильна по идентичности GroupNode через facadeCache)
  const activeByRow = new Map<unknown, BehaviorCleanup>();

  effect(() => {
    const len = lengthSignal ? lengthSignal.value : (arrValue.length as number);
    const seen = new Set<unknown>();
    for (let i = 0; i < len; i++) {
      const rowModel = arrValue.at(i);
      if (rowModel == null) continue;
      seen.add(rowModel);
      if (!activeByRow.has(rowModel)) {
        const rowForm =
          (arrNode?.at?.(i) as FormProxy<TItem> | undefined) ?? unmaterializedRowForm<TItem>(path);
        activeByRow.set(rowModel, itemSchema.__run(rowModel as FormModel<TItem>, rowForm));
      }
    }
    // отписать исчезнувшие строки
    for (const [rowModel, cleanup] of activeByRow) {
      if (!seen.has(rowModel)) {
        cleanup();
        activeByRow.delete(rowModel);
      }
    }
  });

  // финальная отписка всех строк при teardown схемы
  onDispose(() => {
    for (const cleanup of activeByRow.values()) cleanup();
    activeByRow.clear();
  });
}

/** Минимальный интерфейс value-proxy массива модели (length/at), нужный кросс-строчным операторам. */
interface RowArray<TItem> {
  readonly length: number;
  at(index: number): FormModel<TItem> | undefined;
}

/** Реактивно «потрогать» весь массив (длина + все поля строк), чтобы подписать на любые изменения. */
function touchValue(v: unknown): void {
  if (v == null || typeof v !== 'object') return;
  const arr = v as { length?: unknown; at?: unknown };
  if (typeof arr.at === 'function' && typeof arr.length === 'number') {
    const len = arr.length; // чтение length подписывает на структуру массива
    for (let i = 0; i < len; i++) touchValue((arr.at as (i: number) => unknown)(i));
    return;
  }
  for (const k of Object.keys(v as object)) touchValue((v as Record<string, unknown>)[k]);
}

/**
 * Взаимное исключение булева флага среди строк массива (single-selection — «единственный primary»).
 * Когда флаг строки становится true, у остальных строк он сбрасывается в false. Не хрупок к push:
 * новые строки с флагом false исключения не запускают.
 *
 * @example
 * exclusiveFlag(model.$.contacts, (row) => row.$.primary);
 */
export function exclusiveFlag<TItem>(
  array: object,
  getFlag: (row: FormModel<TItem>) => Signal<boolean>
): void {
  const { model } = getScope();
  const path = (array as GroupSignals).__path;
  if (!path) return;
  const arrValue = getByPath(model, path) as RowArray<TItem> | undefined;
  if (!arrValue) return;
  applyEach(
    array,
    defineFormBehavior<TItem>(({ model: row }) => {
      onChange(getFlag(row), (on) => {
        if (!on) return;
        for (let i = 0; i < arrValue.length; i++) {
          const other = arrValue.at(i);
          if (other && other !== row) {
            const flag = getFlag(other);
            if (flag.peek()) flag.value = false;
          }
        }
      });
    })
  );
}

/**
 * Агрегатная запись в строки массива. `derive(snapshot)` получает СНИМОК строк и возвращает список
 * `{ index, patch }`, который применяется к строкам. Записи КОАЛЕСИРУЮТСЯ в один отложенный проход на
 * финальном состоянии — поэтому массовые синхронные мутации (push в цикле) не вызывают каскад на
 * промежуточных состояниях. `derive` должна сходиться (на фикспоинте возвращать те же значения).
 *
 * @example
 * // последняя строка = 100 − Σ(остальные)
 * aggregateInto(model.$.rows, (rows) => {
 *   const n = rows.length; if (n === 0) return [];
 *   const others = rows.slice(0, n - 1).reduce((s, r) => s + r.percent, 0);
 *   return [{ index: n - 1, patch: { percent: 100 - others } }];
 * });
 */
export function aggregateInto<TItem>(
  array: object,
  derive: (rows: TItem[]) => Array<{ index: number; patch: Partial<TItem> }>
): void {
  const { model } = getScope();
  const path = (array as GroupSignals).__path;
  if (!path) return;
  const arrValue = getByPath(model, path) as (RowArray<TItem> & { toArray(): TItem[] }) | undefined;
  if (!arrValue) return;
  let scheduled = false;
  let runs = 0;
  effect(() => {
    touchValue(arrValue); // подписка на длину + все поля строк
    if (scheduled) return;
    scheduled = true;
    defer(() => {
      scheduled = false;
      const writes = derive(arrValue.toArray()); // derive по ФИНАЛЬНОМУ состоянию
      let changed = false;
      for (const { index, patch } of writes) {
        const r = arrValue.at(index) as Record<string, unknown> | undefined;
        if (!r) continue;
        for (const [k, val] of Object.entries(patch as Record<string, unknown>)) {
          if (r[k] !== val) {
            r[k] = val; // запись в строку через value-proxy
            changed = true;
          }
        }
      }
      runs = changed ? runs + 1 : 0;
      if (runs > 50) {
        runs = 0;
        throw new Error(
          `[@reformer/core/behaviors] aggregateInto("${path}"): запись не сходится (>50 проходов) — ` +
            `derive должна быть идемпотентной на фикспоинте.`
        );
      }
    });
  });
}

/** Применить под-схему к одному или нескольким полям-группам (переиспользование). */
export function apply<TField>(targets: object | object[], subSchema: FormBehavior<TField>): void {
  const { form: rootForm } = getScope();
  for (const t of asArray(targets)) {
    const groupSignals = t as GroupSignals;
    const path = groupSignals.__path;
    if (!path) continue;
    // Форма может отсутствовать (массив не материализован / form === null) — тогда под-схема
    // работает только с моделью (value-операции), без доступа к ноде группы.
    const node = rootForm
      ? (rootForm as unknown as { getFieldByPath(p: string): unknown }).getFieldByPath(path)
      : undefined;
    const nestedForm = (
      node ? ((node as { getProxy?: () => unknown }).getProxy?.() ?? node) : undefined
    ) as FormProxy<TField>;
    onDispose(subSchema.__run(nestedModel<TField>(groupSignals), nestedForm));
  }
}
