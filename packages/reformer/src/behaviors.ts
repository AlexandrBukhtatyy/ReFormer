/**
 * Декларативный контракт схемы поведения формы — `@reformer/core/behaviors`.
 *
 * Свободные операторы (`compute`/`copyFrom`/`enableWhen`/`onChange`/…) вызываются внутри
 * `defineFormBehavior(({ model, form }) => { … })` и САМИ регистрируют свои отписки в ambient-стоке —
 * автор схемы не видит ни массива `cleanups`, ни `.push`, ни вызовов через точку. Жизненным циклом
 * владеет форма (`createForm({ behavior })`). Операторы — тонкие обёртки над примитивами слоя данных
 * ({@link module:core/model/behaviors}); пользовательские операторы пишутся так же и неотличимы от встроенных.
 *
 * Граница ответственности: контракт НЕ управляет валидацией — это отдельный слой (`validateFormModel`
 * + схема валидации), он остаётся владельцем `errors`. Это сделано намеренно. Для редких крайних случаев
 * behavior-driven валидации (cross-field, async-uniqueness) можно написать собственный оператор поверх
 * `effect`/`onChange` + `node.setErrors(...)` — он будет неотличим от встроенного; примеры см. в
 * tests/behaviors/web-scenarios (W1/W3). В общем случае правила валидности держите в слое валидации.
 *
 * Импортирует примитивы из `./index` (общий chunk → единый реестр сигнал→нода). Собственный ambient-сток
 * единственный в этом модуле; `createForm` запускает поведение через `FormBehavior.__run` (без runtime-связи).
 *
 * @module behaviors
 */

import { effect as preactEffect, type Signal, type ReadonlySignal } from '@preact/signals-core';
import {
  copyFrom as coreCopyFrom,
  watchField as coreWatchField,
  enableWhen as coreEnableWhen,
  transformValue as coreTransformValue,
  resetWhen as coreResetWhen,
  syncFields as coreSyncFields,
  revalidateWhen as coreRevalidateWhen,
  runOutsideEffect,
  markDerived,
  unmarkDerived,
  type BehaviorCleanup,
  type FormModel,
  type FormProxy,
} from './index';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ============================================================================
// Типы контракта
// ============================================================================

/** Контекст схемы поведения: модель (значения/сигналы) + форма (ноды). */
export type BehaviorScope<T> = { model: FormModel<T>; form: FormProxy<T> };

/** Результат {@link defineFormBehavior}; передаётся в `createForm({ behavior })`. */
export interface FormBehavior<T> {
  /** @internal Запускается `createForm` после построения нод и заполнения реестра сигнал→нода. */
  __run(model: FormModel<T>, form: FormProxy<T>): BehaviorCleanup;
}

export type { Signal, ReadonlySignal, BehaviorCleanup };

// ============================================================================
// Ambient-сток + текущий scope
// ============================================================================

interface RunContext {
  cleanups: BehaviorCleanup[];
  model: unknown;
  form: unknown;
}
let current: RunContext | null = null;

function requireCtx(op: string): RunContext {
  if (!current) {
    throw new Error(
      `[@reformer/core/behaviors] "${op}" вызван вне defineFormBehavior(...) — операторы поведения ` +
        `можно вызывать только внутри схемы.`
    );
  }
  return current;
}

/** Зарегистрировать произвольную отписку в активной схеме. */
export function onDispose(cleanup: BehaviorCleanup): void {
  requireCtx('onDispose').cleanups.push(cleanup);
}

/** Текущий scope ({ model, form }) активной схемы (escape hatch для кросс-операторов). */
export function getScope<T>(): BehaviorScope<T> {
  const ctx = requireCtx('getScope');
  return { model: ctx.model, form: ctx.form } as BehaviorScope<T>;
}

/**
 * Описать поведение формы декларативно. Возвращает {@link FormBehavior} для `createForm({ behavior })`.
 *
 * @example
 * ```ts
 * export const myBehavior = defineFormBehavior<MyForm>(({ model, form }) => {
 *   compute(model.$.total, () => model.price * model.qty);
 *   enableWhen([model.$.city], () => Boolean(model.country));
 *   onChange(model.$.country, async (c) => form.city.updateComponentProps({ options: await load(c) }));
 * });
 * ```
 */
export function defineFormBehavior<T>(setup: (scope: BehaviorScope<T>) => void): FormBehavior<T> {
  return {
    __run(model, form) {
      const ctx: RunContext = { cleanups: [], model, form };
      const prev = current;
      current = ctx;
      try {
        setup({ model, form });
      } finally {
        current = prev;
      }
      return () => {
        for (const c of ctx.cleanups) c();
      };
    },
  };
}

// ============================================================================
// Низкоуровневый набор авторинга
// ============================================================================

/** Реактивный эффект (авто-dispose). Колбэк может вернуть собственный cleanup. */
export function effect(fn: () => void | (() => void)): void {
  onDispose(preactEffect(fn));
}

/** Отложенная запись вне effect-контекста (микротаск) — защита от «Cycle detected». */
export function defer(fn: () => void): void {
  runOutsideEffect(fn);
}

// ============================================================================
// Утилиты
// ============================================================================

type GroupSignals = Record<string, unknown> & { __path?: string };

const isSignal = (v: unknown): v is Signal<unknown> =>
  typeof v === 'object' && v !== null && typeof (v as { peek?: unknown }).peek === 'function';

const asArray = <X>(v: X | X[]): X[] => (Array.isArray(v) ? v : [v]);

function readGroup(g: GroupSignals): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(g)) {
    const child = g[k];
    out[k] = isSignal(child) ? child.value : readGroup(child as GroupSignals);
  }
  return out;
}
function writeGroup(g: GroupSignals, val: Record<string, unknown>): void {
  for (const k of Object.keys(g)) {
    const child = g[k];
    if (isSignal(child)) child.value = val?.[k];
    else writeGroup(child as GroupSignals, (val?.[k] as Record<string, unknown>) ?? {});
  }
}

interface NodeOps {
  enable(): void;
  disable(): void;
  reset(): void;
}
function nodeByPath(path: string | undefined): NodeOps | undefined {
  if (!path) return undefined;
  const { form } = getScope();
  const node = (form as unknown as { getFieldByPath(p: string): unknown }).getFieldByPath(path);
  return node as NodeOps | undefined;
}

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
        return isSignal(child) ? child.value : nestedModel(child as GroupSignals);
      },
    }
  ) as FormModel<T>;
}

// ============================================================================
// Операторы
// ============================================================================

/**
 * Guard от расходящихся циклов пересчёта (F7). Расходящийся взаимный compute/computeFrom (без
 * стабилизации) preact обрывает невнятным «Cycle detected» — перехватываем и заменяем понятной
 * ошибкой с именем поля и подсказкой. Сходящиеся compute (упираются в peek-guard) и массовые
 * синхронные мутации цикла не порождают → не затрагиваются.
 */
function makeCycleGuard(target: Signal<unknown>): (write: () => void) => void {
  return (write) => {
    try {
      write();
    } catch (err) {
      if (err instanceof Error && /cycle detected/i.test(err.message)) {
        const path = (target as { __path?: string }).__path ?? '?';
        throw new Error(
          `[@reformer/core/behaviors] compute("${path}"): расходящийся цикл пересчёта — взаимные ` +
            `compute/computeFrom без стабилизации. Проверьте зависимости или добавьте стабилизирующее ` +
            `условие (when) / разорвите цикл через peek.`
        );
      }
      throw err;
    }
  };
}

/** Вычисляемое поле с auto-tracking: `target = read()` при изменении прочитанных сигналов. */
export function compute<R>(
  target: Signal<R>,
  read: () => R,
  options?: { when?: () => boolean }
): void {
  markDerived(target); // F9: bulk-load (set/patch/patchValue) не затирает вычисляемое поле
  onDispose(() => unmarkDerived(target)); // при снятии behavior снова разрешаем bulk-set (refcount)
  const guard = makeCycleGuard(target as Signal<unknown>); // F7: детект расходящегося цикла
  effect(() => {
    if (options?.when && !options.when()) return;
    const next = read();
    if (target.peek() === next) return;
    guard(() => {
      target.value = next;
    });
  });
}

/** Вычисляемое поле с явным списком зависимостей (escape hatch). */
export function computeFrom<R>(
  sources: ReadonlySignal<unknown>[],
  target: Signal<R>,
  fn: (...values: any[]) => R,
  options?: { when?: (...values: any[]) => boolean }
): void {
  markDerived(target); // F9: см. compute
  onDispose(() => unmarkDerived(target)); // refcount: см. compute
  const guard = makeCycleGuard(target as Signal<unknown>); // F7
  effect(() => {
    const values = sources.map((s) => s.value); // подписка на источники
    if (options?.when && !options.when(...values)) return;
    const next = fn(...values);
    if (target.peek() === next) return;
    guard(() => {
      target.value = next;
    });
  });
}

/** Копирование `source → target` — скаляр или группа (объект целиком). */
export function copyFrom<T>(
  source: ReadonlySignal<T> | object,
  target: Signal<T> | object,
  options?: { when?: () => boolean; transform?: (value: T) => T }
): void {
  if (isSignal(source) && isSignal(target)) {
    onDispose(coreCopyFrom(source as ReadonlySignal<T>, target as Signal<T>, options));
    return;
  }
  const src = source as GroupSignals;
  const dst = target as GroupSignals;
  effect(() => {
    const snapshot = readGroup(src); // подписка на все листья источника
    if (options?.when && !options.when()) return;
    defer(() => writeGroup(dst, snapshot));
  });
}

/** Контекст async-реакции: `signal` аннулируется, когда поле меняется снова до завершения колбэка. */
export interface ChangeContext {
  signal: AbortSignal;
}

/**
 * Реакция на изменение поля; `{ debounce, immediate }`.
 *
 * Колбэк выполняется ВНЕ effect-контекста (микротаск/таймер) — можно безопасно писать сигналы и ноды
 * (`updateComponentProps`/`reset`/`clear`) без ручного `defer` и без «Cycle detected».
 *
 * Для async-колбэков 2-м аргументом приходит `{ signal }` (AbortSignal): при следующей смене значения
 * предыдущий `signal` аннулируется. Передавай его в `fetch` (сетевая отмена) или проверяй
 * `signal.aborted` перед применением результата — это убирает гонки устаревших ответов (F2).
 */
export function onChange<T>(
  source: ReadonlySignal<T>,
  cb: (value: T, ctx: ChangeContext) => void,
  options?: { immediate?: boolean; debounce?: number }
): void {
  let controller: AbortController | undefined;
  const fire = (v: T): void => {
    controller?.abort(); // аннулируем предыдущий in-flight вызов
    controller = new AbortController();
    const { signal } = controller;
    runOutsideEffect(() => cb(v, { signal }));
  };

  if (!options?.debounce) {
    onDispose(coreWatchField(source, fire, { immediate: options?.immediate }));
  } else {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = coreWatchField(
      source,
      (v) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fire(v), options.debounce);
      },
      { immediate: options?.immediate }
    );
    onDispose(() => {
      if (timer) clearTimeout(timer);
      stop();
    });
  }
  onDispose(() => controller?.abort());
}

type EnableTarget = ReadonlySignal<unknown> | object;

/** Условное включение поля(ей) — скаляр, массив целей или группа. `resetOnDisable=false` по умолчанию. */
export function enableWhen(
  target: EnableTarget | EnableTarget[],
  condition: () => boolean,
  options?: { resetOnDisable?: boolean }
): void {
  for (const t of asArray(target)) {
    if (isSignal(t)) {
      onDispose(coreEnableWhen(t as ReadonlySignal<unknown>, condition, options));
    } else {
      enableGroup(t as GroupSignals, condition, options);
    }
  }
}

/** Условное выключение поля(ей) (инверсия {@link enableWhen}). */
export function disableWhen(
  target: EnableTarget | EnableTarget[],
  condition: () => boolean,
  options?: { resetOnDisable?: boolean }
): void {
  enableWhen(target, () => !condition(), options);
}

function enableGroup(
  g: GroupSignals,
  condition: () => boolean,
  options?: { resetOnDisable?: boolean }
): void {
  const node = nodeByPath(g.__path);
  if (!node) return;
  effect(() => {
    const enabled = condition();
    defer(() => {
      if (enabled) node.enable();
      else {
        node.disable();
        if (options?.resetOnDisable) node.reset();
      }
    });
  });
}

/** Трансформация значения поля (идемпотентная). */
export function transformValue<T>(target: Signal<T>, transformer: (value: T) => T): void {
  onDispose(coreTransformValue(target, transformer));
}

/** Сброс значения по условию. */
export function resetWhen<T>(
  target: Signal<T>,
  condition: () => boolean,
  options?: { resetValue?: T }
): void {
  onDispose(coreResetWhen(target, condition, options));
}

/** Двусторонняя синхронизация двух полей. */
export function syncFields<T>(
  a: Signal<T>,
  b: Signal<T>,
  options?: { transform?: (value: T) => T }
): void {
  onDispose(coreSyncFields(a, b, options));
}

/** Ревалидация при изменении зависимостей. */
export function revalidateWhen(deps: ReadonlySignal<unknown>[], revalidate: () => void): void {
  onDispose(coreRevalidateWhen(deps, revalidate));
}

function getByPath(root: unknown, path: string): any {
  return path.split('.').reduce<any>((o, k) => (o == null ? undefined : o[k]), root);
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

/* eslint-enable @typescript-eslint/no-explicit-any */
