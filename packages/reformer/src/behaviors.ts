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
  computeFrom as coreComputeFrom,
  copyFrom as coreCopyFrom,
  watchField as coreWatchField,
  enableWhen as coreEnableWhen,
  transformValue as coreTransformValue,
  resetWhen as coreResetWhen,
  syncFields as coreSyncFields,
  revalidateWhen as coreRevalidateWhen,
  runOutsideEffect,
  markDerived,
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

/** Вычисляемое поле с auto-tracking: `target = read()` при изменении прочитанных сигналов. */
export function compute<R>(
  target: Signal<R>,
  read: () => R,
  options?: { when?: () => boolean }
): void {
  markDerived(target); // F9: bulk-load (set/patch/patchValue) не затирает вычисляемое поле
  effect(() => {
    if (options?.when && !options.when()) return;
    const next = read();
    if (target.peek() !== next) target.value = next;
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
  onDispose(coreComputeFrom(sources, target, fn, options));
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
function unmaterializedRowForm(path: string): FormProxy<unknown> {
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
  ) as FormProxy<unknown>;
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
          (arrNode?.at?.(i) as FormProxy<TItem> | undefined) ??
          (unmaterializedRowForm(path) as FormProxy<TItem>);
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
