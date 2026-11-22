/**
 * Область жизни (scope) реакций модели и стор приложения поверх неё.
 *
 * Операторы модели (`computeFrom`, `copyFrom`, `watchField`, …) возвращают функцию отписки. В форме
 * их снимает сама форма, а в состоянии приложения отписок набирается много, и держать их вручную
 * неудобно. Область собирает их в одно место: всё, что создано внутри {@link Scope.run}, снимается
 * одним {@link Scope.dispose}.
 *
 * Захватывается только то, что создано синхронно внутри `run` (и в `setup` у {@link createStore}).
 * Реакции, созданные позже — в колбэке эффекта, после `await`, — в область не попадают: их снимает
 * тот, кто создал (например, очистка, которую возвращает колбэк эффекта).
 *
 * @module model/scope
 */

import { effect as preactEffect } from '@preact/signals-core';
import { isModelFacade } from './model-value-proxy';

/**
 * Область жизни реакций: собирает отписки и снимает их разом.
 *
 * @group Model
 */
export interface Scope {
  /**
   * Выполнить `fn` с этой областью как текущей: операторы модели, эффекты области и вложенные
   * области, созданные внутри, будут сняты её {@link Scope.dispose}.
   */
  run<R>(fn: () => R): R;
  /**
   * Добавить очистку. Если область уже снята, очистка выполняется сразу.
   *
   * @returns Функция, которая убирает очистку из области, не вызывая её.
   */
  add(cleanup: () => void): () => void;
  /**
   * Реактивный эффект, принадлежащий области. Колбэк может вернуть очистку — она вызывается перед
   * повторным запуском и при снятии.
   *
   * @returns Функция, которая снимает эффект досрочно.
   */
  effect(fn: () => void | (() => void)): () => void;
  /** Снята ли область. */
  readonly disposed: boolean;
  /**
   * Снять область: выполнить очистки в обратном порядке (последняя добавленная — первой). Повторный
   * вызов ничего не делает. Ошибки очисток не прерывают снятие: после всех очисток бросается первая
   * (или `AggregateError`, если их несколько).
   */
  dispose(): void;
}

/** Текущая область — та, внутри `run` которой идёт выполнение. */
let active: ScopeImpl | undefined;

class ScopeImpl implements Scope {
  disposed = false;
  /** Очистки в порядке добавления. Запись — объект, чтобы одну функцию можно было добавить дважды. */
  private readonly cleanups = new Set<{ fn: () => void }>();
  private detach: (() => void) | undefined;

  constructor(parent: ScopeImpl | undefined) {
    // Вложенная область снимается вместе с родителем, а снятая раньше — убирает себя из родителя,
    // чтобы долгоживущий родитель не копил ссылки на снятых детей.
    if (parent) this.detach = parent.add(() => this.dispose());
  }

  run<R>(fn: () => R): R {
    return withActive(this, fn);
  }

  add(cleanup: () => void): () => void {
    if (this.disposed) {
      cleanup();
      return noop;
    }
    const entry = { fn: cleanup };
    this.cleanups.add(entry);
    return () => {
      this.cleanups.delete(entry);
    };
  }

  effect(fn: () => void | (() => void)): () => void {
    // Колбэк эффекта — не часть `run`: реакции, созданные в нём, области не принадлежат (иначе
    // первый запуск захватывал бы их, а повторные — нет).
    const stop = preactEffect(() => runWithoutScope(fn));
    const remove = this.add(stop);
    return () => {
      remove();
      stop();
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.detach?.();
    this.detach = undefined;
    const entries = [...this.cleanups].reverse();
    this.cleanups.clear();
    const errors: unknown[] = [];
    for (const entry of entries) {
      try {
        entry.fn();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1)
      throw new AggregateError(errors, '[@reformer/core] ошибки при снятии области');
  }
}

const noop = (): void => {};

/**
 * Создать область жизни реакций. Созданная внутри другой области становится её дочерней и
 * снимается вместе с ней.
 *
 * @example
 * ```typescript
 * const scope = createScope();
 * scope.run(() => {
 *   computeFrom([model.$.price, model.$.qty], model.$.total, (p, q) => p * q);
 *   watchField(model.$.country, () => (model.city = ''));
 * });
 * scope.dispose(); // оба оператора сняты
 * ```
 *
 * @group Model
 */
export function createScope(): Scope {
  return new ScopeImpl(active);
}

/**
 * Текущая область — та, внутри `run` которой идёт выполнение; `undefined` вне области.
 *
 * @group Model
 */
export function getCurrentScope(): Scope | undefined {
  return active;
}

/**
 * Добавить очистку в текущую область. Вне области очистку некому вызвать — в режиме разработки
 * выводится предупреждение.
 *
 * @example
 * ```typescript
 * createStore(() => {
 *   const timer = setInterval(tick, 1000);
 *   onScopeDispose(() => clearInterval(timer));
 *   return {};
 * });
 * ```
 *
 * @group Model
 */
export function onScopeDispose(cleanup: () => void): void {
  if (active) {
    active.add(cleanup);
    return;
  }
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '[@reformer/core] onScopeDispose вызван вне области: очистку некому вызвать. ' +
        'Вызывайте его внутри scope.run(...) или setup у createStore.'
    );
  }
}

/**
 * Привязать отписку оператора к текущей области. Ручной вызов возвращённой функции снимает
 * оператор и убирает его из области.
 *
 * @internal
 */
export function ownedByScope(stop: () => void): () => void {
  if (!active) return stop;
  const remove = active.add(stop);
  return () => {
    remove();
    stop();
  };
}

/**
 * Выполнить `fn` без текущей области: созданное внутри области не принадлежит. Так подключается
 * поведение формы — его снимает форма, а не область, в которой форму собрали.
 *
 * @internal
 */
export function runWithoutScope<R>(fn: () => R): R {
  return withActive(undefined, fn);
}

/** Выполнить `fn` с `scope` как текущей областью и вернуть прежнюю. */
function withActive<R>(scope: ScopeImpl | undefined, fn: () => R): R {
  const prev = active;
  active = scope;
  try {
    return fn();
  } finally {
    active = prev;
  }
}

/**
 * Стор — объект API, который вернул `setup`, плюс `dispose()`, снимающий всё, что `setup` создал.
 *
 * @group Model
 */
export type Store<T> = T & { dispose(): void };

/**
 * Собрать стор: `setup` выполняется в новой области, и всё, что в нём создано (операторы модели,
 * `scope.effect`, вложенные области, `onScopeDispose`), снимается `store.dispose()`.
 *
 * `setup` возвращает обычный объект — API стора: модель, вычисляемые значения, команды. Если у него
 * уже есть свой `dispose`, он вызывается первым, затем снимается область.
 *
 * @example
 * ```typescript
 * const cart = createStore((scope) => {
 *   const model = createModel({ items: arrayOf(blankItem), coupon: '' });
 *   const total = computed(() => model.$.items.value.reduce((s, i) => s + i.price * i.qty, 0));
 *   watchField(model.$.coupon, (code) => checkCoupon(code));
 *   scope.effect(() => {
 *     document.title = `Корзина: ${model.$.items.value.length}`;
 *   });
 *   return { model, total, add: (item: Item) => model.items.push(item) };
 * });
 *
 * cart.add(item);
 * cart.dispose(); // watchField и эффект сняты
 * ```
 *
 * @group Model
 */
export function createStore<T extends object>(setup: (scope: Scope) => T): Store<T> {
  const scope = createScope();
  let api: T;
  try {
    api = scope.run(() => setup(scope));
  } catch (error) {
    scope.dispose();
    throw error;
  }
  if (!isExtensibleObject(api)) {
    scope.dispose();
    throw new TypeError(
      '[@reformer/core] createStore: setup должен вернуть обычный объект — API стора ' +
        '(например { model, total, add }). Модель или замороженный объект оберните: return { model }.'
    );
  }
  const own = (api as { dispose?: unknown }).dispose;
  Object.defineProperty(api, 'dispose', {
    configurable: true,
    enumerable: false,
    writable: true,
    value: (): void => {
      try {
        if (typeof own === 'function') own.call(api);
      } finally {
        scope.dispose();
      }
    },
  });
  return api as Store<T>;
}

/**
 * Обычный изменяемый объект: не модель и не её массив (их фасады не принимают новых полей) и не
 * заморожен.
 */
function isExtensibleObject(value: unknown): value is object {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.isExtensible(value) &&
    !isModelFacade(value)
  );
}

/**
 * Поверхностное равенство: значения по `Object.is`; массивы — поэлементно, объекты — по тем же
 * собственным ключам. Для селекторов, которые каждый раз собирают новый объект или массив.
 *
 * @example
 * ```typescript
 * shallowEqual({ a: 1, b: 'x' }, { a: 1, b: 'x' }); // true
 * shallowEqual([1, 2], [1, 2]); // true
 * shallowEqual({ a: {} }, { a: {} }); // false — вложенные сравниваются по ссылке
 * ```
 *
 * @group Model
 */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
    return true;
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every(
    (key) => Object.prototype.hasOwnProperty.call(right, key) && Object.is(left[key], right[key])
  );
}
