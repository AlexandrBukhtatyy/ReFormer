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
import type { ValidationError } from '../types/contracts';
import type { ValidationFailure } from './types';

/** Сток одного прогона: модель scope, накопленные ошибки, незавершённые async-правила, гейты. */
export interface VContext {
  /**
   * Модель текущей области — источник снапшота для `cross` и модель для `apply`. В корне прогона
   * это вся модель; внутри `apply(ручка, схема)` / `applyEach` — под-модель группы или строки.
   */
  model: FormModel<unknown>;
  /** Накопленные ошибки по сигналу (ключ — идентичность `PathAwareSignal`). */
  errors: Map<PathAwareSignal<unknown>, ValidationError[]>;
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

/** «Тронуть» сигнал: гарантирует его наличие в `errors` (даже пустым) → он попадёт в очистку. */
export function touch(ctx: VContext, sig: PathAwareSignal<unknown>): ValidationError[] {
  let bucket = ctx.errors.get(sig);
  if (!bucket) ctx.errors.set(sig, (bucket = []));
  return bucket;
}

/** Активна ли текущая ветка (все `validateWhen`-условия истинны). */
export const gated = (ctx: VContext): boolean => ctx.whenStack.every((cond) => cond());
