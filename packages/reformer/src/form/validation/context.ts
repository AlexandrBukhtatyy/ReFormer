/**
 * Ambient-сток текущего прогона схемы валидации.
 *
 * Операторы (`./operators`) пишут ошибки не в переданный им коллектор, а в контекст «текущего
 * прогона» — поэтому автор схемы не видит ни коллектора, ни `.push`. Окно прогона открывает
 * раннер (`./run`) через {@link runWithContext}.
 *
 * ⚠️ `current` — состояние модуля. Записать его извне нельзя (ESM запрещает присваивание
 * импортированной переменной), поэтому окно открывается ТОЛЬКО через {@link runWithContext}:
 * он же гарантирует восстановление предыдущего значения в `finally`.
 *
 * @group Validation
 * @module form/validation/context
 */

import type { FormModel, PathAwareSignal } from '../../model/types';
import type { ValidationIssue } from '../types/contracts';
import type { ValidationFailure } from './types';

/** Сток одного прогона: модель scope, накопленные ошибки, незавершённые async-правила, гейты. */
export interface VContext {
  /**
   * Модель текущей области — источник снапшота для `cross` и модель для `apply`. В корне прогона
   * это вся модель; внутри `apply(ручка, схема)` / `applyEach` — под-модель группы или строки.
   */
  model: FormModel<unknown>;
  /**
   * Накопленные ошибки по сигналу (ключ — идентичность `PathAwareSignal`). Здесь и поля выключенной
   * ветки `validateWhen` — с пустым списком: при разносе их прежние ошибки гасятся.
   */
  issues: Map<PathAwareSignal<unknown>, ValidationIssue[]>;
  /**
   * Поля, правила которых в этом прогоне действительно выполнялись — ветка активна. Только их разнос
   * с `touch` помечает тронутыми: поле выключенной ветки пользователь не видел.
   */
  checked: Set<PathAwareSignal<unknown>>;
  /** Незавершённые async-правила (раннер их дожидается). */
  pending: Promise<void>[];
  /**
   * Поля с async-правилами и промисы их правил: на время ожидания раннер держит ноды полей в
   * `pending`, а поле, чьи правила ответили, разносит, не дожидаясь остальных.
   */
  asyncFields: Map<PathAwareSignal<unknown>, Promise<void>[]>;
  /**
   * Правила, которые не вернули результат. Список — один на весь прогон: области `apply` /
   * `applyEach` получают поверхностную копию контекста и пишут в ту же ссылку.
   */
  failures: ValidationFailure[];
  /** Стек активных условий `validateWhen` (все должны быть истинны, чтобы правило сработало). */
  whenStack: Array<() => boolean>;
  /** Отмена устаревшего прогона: прокидывается в async-правила, гасит роутинг после await. */
  signal: AbortSignal;
  /**
   * Определение, правила которого исполняются сейчас: корень прогона либо схема, подключённая
   * `apply` / `applyEach`. Замечание помечается им: так разнос отличает замечания одного
   * определения, полученные разными прогонами (шаг и вся форма), от замечаний чужого.
   */
  origin: object;
  /** Замечания по полю и определению-источнику. Одна ссылка на весь прогон, как `failures`. */
  origins: Map<PathAwareSignal<unknown>, Map<object, ValidationIssue[]>>;
  /** Определения, исполненные в прогоне: за их замечания на проверенных полях прогон отвечает. */
  executed: Set<object>;
  /** Текущий вход в определение {@link VContext.origin} — с цепочкой входов от корня прогона. */
  entry: OriginEntry;
  /**
   * Поля, правила которых выполнялись прямо во входе (не во вложенных), по входу. Одна ссылка на
   * весь прогон, как `failures`: по ней прогон отвечает, какие поля проверило определение вместе с
   * подключёнными в нём.
   */
  checkedIn: Map<OriginEntry, Set<PathAwareSignal<unknown>>>;
  /**
   * Ответы async-правил пары (владелец, схема): прогон записывает каждый полученный ответ вместе со
   * значением, на которое он дан. Без памяти (прогон собран не раннером) ответы не запоминаются.
   */
  answers?: AsyncAnswers;
  /**
   * Живой прогон: правило, чьё поле не менялось с полученного ответа, не вызывается — ответ берётся
   * из {@link VContext.answers}, и поле не ждёт проверки. Сюда правило кладёт запись ответа в
   * замечания; раннер выполняет их после синхронной части, где ложились бы и ответы вызванных
   * правил: синхронные замечания поля остаются первыми.
   */
  recall?: Array<() => void>;
}

/**
 * Вход прогона в определение: корень прогона либо подключение схемы через `apply` / `applyEach`
 * (у каждой строки массива — свой вход). Цепочка `parent` ведёт к корню прогона.
 *
 * Принадлежность поля считается по входам, а не по самим определениям: схема, подключённая в двух
 * местах (адрес регистрации в одном шаге и адрес созаёмщика в другом), относит поле к тому
 * определению, через которое прогон дошёл до него, а не к первому, где её подключили.
 */
export interface OriginEntry {
  readonly origin: object;
  /** Вход, из которого подключено определение; у корня прогона — нет. */
  readonly parent: OriginEntry | undefined;
}

/** Ответ async-правила и значение поля, на которое он дан. */
export interface AsyncAnswer {
  readonly value: unknown;
  readonly issue: ValidationIssue | null;
}

/** Память ответов async-правил: ручка поля → правило → последний ответ. */
export type AsyncAnswers = WeakMap<object, Map<unknown, AsyncAnswer>>;

let current: VContext | null = null;

/**
 * Открыть ambient-окно на время `fn` и закрыть его в `finally`.
 *
 * Единственный способ установить контекст: прямое присваивание `current` из другого модуля
 * невозможно. Сохранение/восстановление `prev` делает вложенный прогон безопасным.
 */
export function runWithContext<R>(ctx: VContext, fn: () => R): R {
  const prev = current;
  current = ctx;
  try {
    return fn();
  } finally {
    current = prev;
  }
}

/** Контекст активного прогона либо понятная ошибка, если оператор вызван вне схемы. */
export function requireCtx(op: string): VContext {
  if (!current) {
    throw new Error(
      `[@reformer/core/validation] "${op}" вызван вне схемы валидации — операторы валидации ` +
        `можно вызывать только внутри прогона validateModel(...) (напрямую или через apply/each).`
    );
  }
  return current;
}

/**
 * «Тронуть» сигнал: гарантирует его наличие в замечаниях прогона (даже пустым) → он попадёт в
 * очистку. Возвращает список текущего определения ({@link VContext.origin}): в него и пишут правила.
 */
export function touch(ctx: VContext, sig: PathAwareSignal<unknown>): ValidationIssue[] {
  let byOrigin = ctx.origins.get(sig);
  if (!byOrigin) ctx.origins.set(sig, (byOrigin = new Map()));
  let bucket = byOrigin.get(ctx.origin);
  if (!bucket) byOrigin.set(ctx.origin, (bucket = []));
  return bucket;
}

/**
 * Исполнить определение: его замечания помечаются им же, а проверенные поля записываются в новый
 * вход, подключённый к текущему.
 */
export function withOrigin(ctx: VContext, origin: object, fn: () => void): void {
  const previous = ctx.origin;
  const outer = ctx.entry;
  ctx.origin = origin;
  ctx.entry = { origin, parent: outer };
  ctx.executed.add(origin);
  try {
    fn();
  } finally {
    ctx.origin = previous;
    ctx.entry = outer;
  }
}

/** Активна ли текущая ветка (все `validateWhen`-условия истинны). */
export const gated = (ctx: VContext): boolean => ctx.whenStack.every((cond) => cond());

/**
 * Правила поля выполняются: ветка активна. Поле запоминается проверенным ({@link VContext.checked})
 * и проверенным в текущем входе ({@link VContext.checkedIn}). Без активной ветки — `false`, и поле
 * остаётся только в `issues` для гашения.
 */
export function checking(ctx: VContext, sig: PathAwareSignal<unknown>): boolean {
  if (!gated(ctx)) return false;
  ctx.checked.add(sig);
  let direct = ctx.checkedIn.get(ctx.entry);
  if (!direct) ctx.checkedIn.set(ctx.entry, (direct = new Set()));
  direct.add(sig);
  return true;
}
