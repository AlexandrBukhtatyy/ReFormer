/**
 * Операторы поведения над коллекциями и под-моделями.
 *
 * Цель оператора — РУЧКА дерева `model.$` (`model.$.items`, `model.$.address`). Под-модель и нода
 * формы находятся по идентичности ручки ({@link modelOf}, {@link getNodeForSignal}), а не по пути:
 * путь абсолютный, а область вложенной схемы (строка массива, группа) — нет. Поэтому операторы
 * работают одинаково в корневой схеме, в схеме строки и в схеме группы.
 *
 * Различаются владением cleanup'ами: `apply` кладёт отписку под-схемы в РОДИТЕЛЬСКИЙ ambient-сток,
 * а `applyEach` держит отписки строк в собственном `Map` и снимает их при удалении строки.
 *
 * @group Behaviors
 * @module form/behaviors/collections
 */

import type { Signal } from '@preact/signals-core';
import type { BehaviorCleanup } from '../../model/behaviors-value';
import type { FormModel, ModelArray } from '../../model/types';
import type { FormGroup } from '../types/index';
import { getNodeForSignal } from '../signal-node-registry';
import { arrayHandleOf, groupHandleOf, modelOf } from '../../model/model-value-proxy';
import {
  assertInsideSchema,
  getController,
  getFlow,
  onDispose,
  effect,
  defer,
  defineFormBehavior,
} from './context';
import { asArray } from './internals';
import { onChange } from './operators';
import type { FormBehavior } from './types';

/** Минимальный интерфейс value-фасада массива модели, нужный операторам коллекций. */
interface RowArray<TItem> {
  readonly length: number;
  at(index: number): FormModel<TItem> | undefined;
  toArray(): TItem[];
}

/** Нода массива под-форм: формы строк и реактивная длина. */
interface RowArrayNode {
  at?: (index: number) => unknown;
  /** Число строк; чтение внутри effect подписывает на их состав. */
  length?: number;
}

/**
 * Ручка массива под-форм `model.$.<массив>`. Тип строки выводится из её `peek()` — так же, как у
 * `applyEach` валидации. Раньше цель была `object`: тип строки не выводился (`unknown`), а чужая
 * схема строки и ручка не того вида проходили компиляцию.
 */
interface ArrayHandle<TItem> {
  peek(): readonly TItem[] | null | undefined;
}

/** Цель операторов массива: ручка `model.$.<массив>` либо его value-фасад `model.<массив>`. */
type ArrayTarget<TItem> = ArrayHandle<TItem> | ModelArray<TItem>;

/** Ручка группы `model.$.<группа>`: тип значения — из её `peek()`. */
interface GroupHandle<V> {
  peek(): V;
}

/** Цель `apply`: ручка `model.$.<группа>` либо её value-фасад `model.<группа>`. */
type GroupTarget<V> = GroupHandle<V> | FormModel<NonNullable<V>>;

/** Путь ручки — только для сообщений об ошибках. */
const pathOf = (handle: object): string => (handle as { __path?: string }).__path ?? '?';

/**
 * Заглушка формы строки для НЕматериализованного массива: бросает понятную ошибку при доступе к ноде.
 * Value-операции (row.$.*) её не трогают; ошибка возникает только при попытке node-операции (form.x).
 */
function unmaterializedRowForm<T>(path: string): FormGroup<T> {
  return new Proxy(
    {},
    {
      get(_t, key) {
        if (typeof key === 'symbol' || key === 'then') return undefined;
        throw new Error(
          `[@reformer/core/behaviors] applyEach: форма строки массива "${path}" недоступна (form.${String(
            key
          )}) — массив не материализован в схеме формы. Per-row node-операции ` +
            `(enableWhen/updateComponentProps/reset) требуют узла { model, item } в схеме; ` +
            `value-операции (row.$.*: compute/copyFrom/transformValue) работают и без материализации.`
        );
      },
    }
  ) as FormGroup<T>;
}

/**
 * Применить под-схему к КАЖДОМУ элементу динамического массива (per-item поведение).
 * Реагирует на добавление/удаление строк: новым строкам поведение применяется, удалённым — отписывается.
 *
 * Под-схема получает scope строки: `model` (под-модель строки — `row.$.field`) и `form` (нода строки).
 * - Value-операции (`compute`/`copyFrom`/`transformValue` на `row.$.*`) работают всегда.
 * - Node-операции (`enableWhen`/`updateComponentProps`/`reset` через `form.*`) требуют, чтобы массив был
 *   МАТЕРИАЛИЗОВАН в форме (узел `{ model: model.$.<массив>, item }` в схеме) — тогда `form` строки = та же нода, что
 *   рендерится, а её сигналы зарегистрированы (`enableWhen` резолвит ноду). Без материализации доступ
 *   к `form.*` бросит понятную ошибку (см. {@link unmaterializedRowForm}).
 *
 * Работает на любой глубине: массив в корне, в группе и в строке другого массива — в схеме строки
 * можно снова вызвать `applyEach`.
 *
 * @example
 * applyEach(model.$.items, defineFormBehavior<Item>(({ model: row, form }) => {
 *   compute(row.$.lineTotal, () => row.qty * row.price);    // value-op — всегда
 *   enableWhen(row.$.discount, () => row.qty > 10);          // node-op — нужна материализация массива
 *   applyEach(row.$.phones, phoneBehavior);                  // массив внутри строки
 * }));
 */
export function applyEach<TItem extends object>(
  array: ArrayTarget<TItem>,
  itemSchema: FormBehavior<NoInfer<TItem>>
): void {
  const controller = getController('applyEach'); // вне схемы поведения — понятная ошибка
  const flow = getFlow('applyEach');
  const handle = arrayHandleOf(array);
  if (!handle) return;
  const rows = modelOf(handle as { peek(): unknown[] }) as unknown as RowArray<TItem>;
  const arrNode = getNodeForSignal(handle) as RowArrayNode | undefined;
  // Длину берём из НОДЫ массива (её строки обновляются ПОСЛЕ построения форм строк) — так rowForm готов
  // к запуску row-поведения независимо от порядка effect'ов. Фолбэк — длина value-фасада модели
  // (нематериализованный массив: форм строк нет, node-операции недоступны). Поле над массивом
  // целиком (мультивыбор) форм строк тоже не имеет — у его ноды нет `at`.
  const rowForms = typeof arrNode?.at === 'function' ? arrNode : undefined;

  // key = под-модель строки (стабильна по идентичности узла модели через facadeCache)
  const activeByRow = new Map<unknown, BehaviorCleanup>();

  effect(() => {
    const len = rowForms ? (rowForms.length ?? 0) : rows.length;
    const seen = new Set<unknown>();
    for (let i = 0; i < len; i++) {
      const rowModel = rows.at(i);
      if (rowModel == null) continue;
      seen.add(rowModel);
      if (!activeByRow.has(rowModel)) {
        const rowForm =
          (rowForms?.at?.(i) as FormGroup<TItem> | undefined) ??
          unmaterializedRowForm<TItem>(pathOf(handle));
        activeByRow.set(rowModel, itemSchema.__run(rowModel, rowForm, controller, flow));
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
export function exclusiveFlag<TItem extends object>(
  array: ArrayTarget<TItem>,
  getFlag: (row: FormModel<NoInfer<TItem>>) => Signal<boolean>
): void {
  assertInsideSchema('exclusiveFlag');
  const handle = arrayHandleOf(array);
  if (!handle) return;
  const rows = modelOf(handle as { peek(): unknown[] }) as unknown as RowArray<TItem>;
  applyEach(
    handle as ArrayHandle<TItem>,
    defineFormBehavior<TItem>(({ model: row }) => {
      onChange(getFlag(row), (on) => {
        // Флаг — текущий, а не на момент изменения: строку выбрали и тут же сняли — прежний выбор
        // другой строки не сбрасывается; две строки выбраны в одном тике — остаётся первая.
        if (!on || !getFlag(row).peek()) return;
        for (let i = 0; i < rows.length; i++) {
          const other = rows.at(i);
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
export function aggregateInto<TItem extends object>(
  array: ArrayTarget<TItem>,
  derive: (rows: NoInfer<TItem>[]) => Array<{ index: number; patch: Partial<NoInfer<TItem>> }>
): void {
  assertInsideSchema('aggregateInto');
  const handle = arrayHandleOf(array);
  if (!handle) return;
  const rows = modelOf(handle as { peek(): unknown[] }) as unknown as RowArray<TItem>;
  let scheduled = false;
  let runs = 0;
  // Расходящаяся derive останавливает оператор насовсем: ошибку отложенного прохода глотает
  // dev-логгер, и без флага следующий проход, уже запланированный записью, крутил бы цикл без конца.
  let stopped = false;
  effect(() => {
    touchValue(rows); // подписка на длину + все поля строк
    if (scheduled || stopped) return;
    scheduled = true;
    defer(() => {
      scheduled = false;
      if (stopped) return;
      const writes = derive(rows.toArray()); // derive по ФИНАЛЬНОМУ состоянию
      let changed = false;
      for (const { index, patch } of writes) {
        const r = rows.at(index) as Record<string, unknown> | undefined;
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
        stopped = true;
        throw new Error(
          `[@reformer/core/behaviors] aggregateInto("${pathOf(handle)}"): запись не сходится (>50 проходов) — ` +
            `derive должна быть идемпотентной на фикспоинте.`
        );
      }
    });
  });
}

/**
 * Применить под-схему к одному или нескольким полям-группам (переиспользование).
 *
 * Под-схема получает scope группы: `model` — настоящая под-модель (`model.$.field`, чтение и
 * запись значений, `get`/`set`/`patch`), `form` — нода группы. Цель — ручка группы
 * (`model.$.address`); работает и в корневой схеме, и в схеме строки массива.
 *
 * @example
 * apply([model.$.registrationAddress, model.$.residenceAddress], addressBehavior);
 */
export function apply<V extends object | null | undefined>(
  targets: GroupTarget<V> | GroupTarget<V>[],
  subSchema: FormBehavior<NoInfer<NonNullable<V>>>
): void {
  const controller = getController('apply'); // вне схемы поведения — понятная ошибка
  const flow = getFlow('apply');
  for (const target of asArray(targets)) {
    // Цель — группа. Массив и лист под-модели не имеют: массив подключают через `applyEach`.
    const handle = groupHandleOf(target);
    if (!handle) continue;
    const subModel = modelOf(handle as { peek(): object }) as unknown as FormModel<NonNullable<V>>;
    // Форма может отсутствовать (модель без формы, под-схема работает только со значениями) —
    // тогда node-операции через `form.*` недоступны.
    // У группы в реестре лежит её лицо — FormGroup с нодами полей.
    const nestedForm = getNodeForSignal(handle) as FormGroup<NonNullable<V>> | undefined;
    onDispose(subSchema.__run(subModel, nestedForm as FormGroup<NonNullable<V>>, controller, flow));
  }
}
