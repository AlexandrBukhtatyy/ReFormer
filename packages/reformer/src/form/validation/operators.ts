/**
 * Операторы схемы валидации — то, что автор вызывает внутри `defineValidationSchema`.
 *
 * Каждый оператор берёт контекст текущего прогона (`./context`) и пишет в него ошибки; наружу
 * ничего не возвращает. Вне прогона любой из них бросает понятную ошибку — это дев-гард
 * `requireCtx`.
 *
 * @group Validation
 * @module form/validation/operators
 */

import type { FormModel, ModelArray, PathAwareSignal, ValidationError } from '../../index';
import { requireCtx, touch, gated } from './context';
import type { AsyncRule, CallableRule, Rule, ValidationSchema } from './types';

/**
 * Синхронные правила поля.
 *
 * @example
 * ```ts
 * validate(model.$.loanAmount, [required({ message: 'Сумма' }), min(50000)]);
 * ```
 */
export function validate<TField>(sig: PathAwareSignal<TField>, rules: Rule<TField>[]): void {
  const ctx = requireCtx('validate');
  const bucket = touch(ctx, sig as PathAwareSignal<unknown>); // touch до gate ⇒ поле очистится, если ветка выключена
  if (!gated(ctx)) return;
  const value = sig.peek();
  for (const rule of rules) {
    const err = (rule as unknown as CallableRule)(value, ctx.model, ctx.model);
    if (err) bucket.push(err as ValidationError);
  }
}

/**
 * Асинхронные правила поля (зеркалит движковое разделение `validators` / `asyncValidators`).
 * Раннер дожидается их и прокидывает `AbortSignal` для отмены устаревших ответов.
 *
 * @example
 * ```ts
 * validateAsync(model.$.username, [async (v, { signal }) => {
 *   const r = await fetch(`/api/free?u=${v}`, { signal });
 *   return (await r.json()).free ? null : { code: 'taken', message: 'Занято' };
 * }]);
 * ```
 */
export function validateAsync<TField>(
  sig: PathAwareSignal<TField>,
  rules: AsyncRule<TField>[]
): void {
  const ctx = requireCtx('validateAsync');
  const bucket = touch(ctx, sig as PathAwareSignal<unknown>);
  if (!gated(ctx)) return;
  const value = sig.peek();
  const signal = ctx.signal;
  for (const rule of rules) {
    ctx.pending.push(
      rule(value, { signal }).then(
        (err) => {
          if (err && !signal.aborted) bucket.push(err);
        },
        () => {
          /* сбой/отмена async-правила НЕ блокирует submit */
        }
      )
    );
  }
}

/**
 * Условная валидация: правила внутри `cb` активны, только пока `cond()` истинно; иначе их поля
 * ГАСЯТСЯ (пустой bucket → `setErrors([])`). Не трогает включение/сброс поля — это дело поведения (`enableWhen`).
 */
export function validateWhen(cond: () => boolean, cb: () => void): void {
  const ctx = requireCtx('validateWhen');
  ctx.whenStack.push(cond);
  try {
    cb();
  } finally {
    ctx.whenStack.pop();
  }
}

/**
 * Cross-field правило: `fn` получает СНАПШОТ модели текущего scope (`model.get()`) и вешает ошибку на `sig`.
 * Для элементов массива / под-моделей захватывайте нужный снапшот в замыкание (`const item = im.get()`),
 * т.к. `fn` всегда получает модель ТЕКУЩЕГО scope (корень прогона), а не под-модель.
 */
export function cross<TSnapshot>(
  sig: PathAwareSignal<unknown>,
  fn: (form: TSnapshot) => ValidationError | null
): void {
  const ctx = requireCtx('cross');
  const bucket = touch(ctx, sig);
  if (!gated(ctx)) return;
  const err = fn(ctx.model.get() as TSnapshot);
  if (err) bucket.push(err);
}

/**
 * Применить под-правила к КАЖДОМУ элементу текущего массива модели.
 * `U extends object` — элементы должны быть под-моделями (объектами); для массива примитивов валидируйте лист напрямую.
 */
export function each<U extends object>(
  arr: ModelArray<U>,
  itemFn: (item: FormModel<U>) => void
): void {
  requireCtx('each');
  const len = arr.length;
  for (let i = 0; i < len; i++) itemFn(arr.at(i) as unknown as FormModel<U>);
}

/** Композиция под-схем в текущую (над той же моделью scope). Заменяет пошаговую группировку. */
export function apply<T>(...schemas: ValidationSchema<T>[]): void {
  const ctx = requireCtx('apply');
  const model = ctx.model as FormModel<T>;
  for (const schema of schemas) schema({ model });
}
