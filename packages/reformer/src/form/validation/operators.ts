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

import type { FormModel, ModelArray, PathAwareSignal } from '../../model/types';
import type { ValidationError } from '../types/contracts';
import { arrayHandleOf, groupHandleOf, modelOf } from '../../model/model-value-proxy';
import { requireCtx, runWithContext, touch, gated, type VContext } from './context';
import type { AsyncRule, Rule, ValidationSchema, ValidationScope } from './types';

/**
 * Синхронные правила поля.
 *
 * Поле — лист либо массив целиком: `model.$.<массив>` — такая же ручка значения, и правило
 * получает массив (мультивыбор, теги, список файлов).
 *
 * @example
 * ```ts
 * validate(model.$.loanAmount, [required({ message: 'Сумма' }), min(50000)]);
 * validate(model.$.tags, [required(), maxLength(3)]); // tags: string[] — массив как значение
 * ```
 */
export function validate<TField>(sig: PathAwareSignal<TField>, rules: Rule<TField>[]): void {
  const ctx = requireCtx('validate');
  const bucket = touch(ctx, sig as PathAwareSignal<unknown>); // touch до gate ⇒ поле очистится, если ветка выключена
  if (!gated(ctx)) return;
  const value = sig.peek();
  for (const rule of rules) {
    const err = rule(value);
    if (err) bucket.push(err);
  }
}

/** Код блокирующей ошибки поля, чьё async-правило не вернуло результат. */
const RULE_FAILED = 'ruleFailed';

/**
 * Асинхронные правила поля. Раннер дожидается их и прокидывает `AbortSignal` для отмены
 * устаревших ответов.
 *
 * Отклонённое правило (сеть, исключение) — сбой проверки: он попадает в `failures` результата
 * прогона, статус прогона становится `error`, а на поле ложится блокирующая ошибка `ruleFailed`
 * (текст — из словаря локали). Отмена устаревшего прогона сбоем не считается.
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
  const handle = sig as PathAwareSignal<unknown>;
  const bucket = touch(ctx, handle);
  if (!gated(ctx)) return;
  const value = sig.peek();
  const signal = ctx.signal;
  ctx.asyncFields.add(handle);
  for (const rule of rules) {
    ctx.pending.push(
      // Вызов внутри исполнителя промиса: синхронное исключение правила — такой же сбой.
      new Promise<ValidationError | null>((resolve) => resolve(rule(value, { signal }))).then(
        (err) => {
          if (err && !signal.aborted) bucket.push(err);
        },
        (error: unknown) => {
          if (signal.aborted) return;
          ctx.failures.push({ handle, error });
          if (!bucket.some((existing) => existing.code === RULE_FAILED)) {
            bucket.push({ code: RULE_FAILED });
          }
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

/** Правило над несколькими полями: снимок модели `model` → ошибка на поле `sig`. */
function crossOver(
  model: FormModel<unknown>,
  sig: PathAwareSignal<unknown>,
  check: (snapshot: never) => ValidationError | null
): void {
  const ctx = requireCtx('cross');
  const bucket = touch(ctx, sig);
  if (!gated(ctx)) return;
  const err = check(model.get() as never);
  if (err) bucket.push(err);
}

/**
 * Область схемы над моделью: сама модель и `cross`, снимок которого — эта модель.
 *
 * @internal
 */
export function scopeOf<T>(model: FormModel<T>): ValidationScope<T> {
  return {
    model,
    cross: (handle, check) => crossOver(model as FormModel<unknown>, handle, check),
  };
}

/** Привязка к группе: ручка `model.$.<группа>` (тип значения — из её `peek()`). */
interface GroupBinding<V> {
  peek(): V;
}

/** Привязка к массиву под-форм: ручка `model.$.<массив>`. */
interface ArrayBinding<U> {
  peek(): readonly U[] | null | undefined;
}

/** Запустить схему в собственной области: общий сток ошибок, своя модель. */
function runScoped(ctx: VContext, model: unknown, schema: ValidationSchema<never>): void {
  const scoped = model as FormModel<unknown>;
  runWithContext({ ...ctx, model: scoped }, () =>
    (schema as ValidationSchema<unknown>)(scopeOf(scoped))
  );
}

/** Value-фасад массива по аргументу оператора — ручке `model.$.<массив>` либо самому фасаду. */
function rowsOf(op: string, array: unknown): { length: number; at(index: number): unknown } {
  const handle = arrayHandleOf(array);
  if (!handle) {
    throw new TypeError(
      `[@reformer/core/validation] ${op}: ожидался массив под-форм модели — ` +
        '`model.$.<массив>`. Массив примитивов — одно значение поля, его проверяют целиком: ' +
        '`validate(model.$.<массив>, [...])`.'
    );
  }
  return modelOf(handle as { peek(): unknown[] }) as never;
}

/**
 * Применить схему к КАЖДОМУ элементу массива под-форм. Схема элемента — обычная
 * `ValidationSchema` над типом элемента: тот же набор правил подключается и к группе через
 * {@link apply}.
 *
 * У каждого элемента своя область: `cross` внутри схемы получает снапшот элемента.
 *
 * @example
 * ```ts
 * const propertyRules = defineValidationSchema<Property>(({ model, cross }) => {
 *   validate(model.$.type, [required()]);
 *   cross(model.$.estimatedValue, (property) =>
 *     property.hasEncumbrance && property.estimatedValue < 100_000 ? tooCheap : null
 *   );
 * });
 *
 * applyEach(model.$.properties, propertyRules);
 * ```
 */
export function applyEach<U extends object>(
  array: ArrayBinding<U> | ModelArray<U>,
  schema: ValidationSchema<U>
): void {
  const ctx = requireCtx('applyEach');
  const rows = rowsOf('applyEach', array);
  const len = rows.length;
  for (let i = 0; i < len; i++) runScoped(ctx, rows.at(i), schema);
}

/**
 * Подключить схему подформы к группе модели — одной или нескольким.
 *
 * Схема запускается в области группы: `model` в ней — под-модель, `cross` получает снапшот
 * группы. Привязка — ручка `model.$.<группа>`, как у узла-подформы схемы и у `apply` поведения.
 *
 * @example
 * ```ts
 * const addressRules = defineValidationSchema<Address>(({ model }) => {
 *   validate(model.$.city, [required()]);
 * });
 *
 * apply(model.$.registrationAddress, addressRules);
 * validateWhen(
 *   () => !model.sameAsRegistration,
 *   () => apply(model.$.residenceAddress, addressRules)
 * );
 * ```
 */
export function apply<V extends object | null | undefined>(
  group: GroupBinding<V> | GroupBinding<V>[],
  schema: ValidationSchema<NonNullable<V>>
): void;

/**
 * Композиция схем над ТОЙ ЖЕ моделью области — так форма собирается из схем шагов.
 *
 * @example
 * ```ts
 * const formRules = defineValidationSchema<Form>(() => apply(loanRules, contactsRules));
 * ```
 */
export function apply<T>(...schemas: ValidationSchema<T>[]): void;

export function apply(...args: unknown[]): void {
  const ctx = requireCtx('apply');
  if (typeof args[0] === 'function') {
    for (const schema of args as ValidationSchema<unknown>[]) schema(scopeOf(ctx.model));
    return;
  }
  const [groups, schema] = args as [unknown, ValidationSchema<never>];
  for (const group of Array.isArray(groups) ? groups : [groups]) {
    const handle = groupHandleOf(group);
    if (!handle) {
      throw new TypeError(
        '[@reformer/core/validation] apply: ожидалась группа модели — `model.$.<группа>`. ' +
          'Массив под-форм подключают через `applyEach`.'
      );
    }
    runScoped(ctx, modelOf(handle as { peek(): object }), schema);
  }
}
