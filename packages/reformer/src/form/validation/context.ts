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
  /** Поля с async-правилами: на время ожидания раннер держит их ноды в `pending`. */
  asyncFields: Set<PathAwareSignal<unknown>>;
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
}

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

/** Исполнить определение: его замечания помечаются им же. */
export function withOrigin(ctx: VContext, origin: object, fn: () => void): void {
  const previous = ctx.origin;
  ctx.origin = origin;
  ctx.executed.add(origin);
  try {
    fn();
  } finally {
    ctx.origin = previous;
  }
}

/** Активна ли текущая ветка (все `validateWhen`-условия истинны). */
export const gated = (ctx: VContext): boolean => ctx.whenStack.every((cond) => cond());

/**
 * Правила поля выполняются: ветка активна. Поле запоминается проверенным ({@link VContext.checked}).
 * Без активной ветки — `false`, и поле остаётся только в `issues` для гашения.
 */
export function checking(ctx: VContext, sig: PathAwareSignal<unknown>): boolean {
  if (!gated(ctx)) return false;
  ctx.checked.add(sig);
  return true;
}
