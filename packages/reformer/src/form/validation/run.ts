/**
 * `defineValidationSchema` и раннер схемы валидации.
 *
 * Прогон делится на сбор и разнос. Сбор ({@link runValidation}) открывает ambient-окно на время
 * СИНХРОННОГО прогона схемы (`./context`), дожидается async-правил и возвращает
 * {@link ValidationResult} — нод формы он не трогает. Разнос ({@link applyValidationResult})
 * раскладывает собранные ошибки по нодам через реестр «ручка → нода» и гасит поля, ставшие
 * валидными. {@link validateModel} делает оба шага и отвечает одним `boolean`.
 *
 * @group Validation
 * @module form/validation/run
 */

import { batch } from '@preact/signals-core';
import type { FormModel, PathAwareSignal } from '../../model/types';
import { getNodeForSignal } from '../signal-node-registry';
import type { ValidationError } from '../types/contracts';
import { runWithContext, type VContext } from './context';
import { scopeOf } from './operators';
import type { ValidationFailure, ValidationResult, ValidationSchema } from './types';

/**
 * Тонкая identity-обёртка для типизации/discoverability (как `defineFormBehavior`). Возвращает схему как есть.
 *
 * @example
 * ```ts
 * export const step1 = defineValidationSchema<LoanForm>(({ model }) => {
 *   validate(model.$.loanAmount, [required(), min(50000)]);
 * });
 * ```
 */
export function defineValidationSchema<T>(schema: ValidationSchema<T>): ValidationSchema<T> {
  return schema;
}

/** Состояние гашения/отмены на пару (model, schema). */
interface RunState {
  /** Поля, чьи ошибки разнёс последний применённый прогон, — для очистки ставших валидными. */
  fields: Set<PathAwareSignal<unknown>>;
  /** Контроллер текущего прогона (отменяет предыдущий in-flight прогон той же (model, schema)). */
  ac: AbortController | null;
}
const stateRegistry = new WeakMap<object, WeakMap<object, RunState>>();

/** Состояние пары (model, schema), с которой собран результат: по нему разнос гасит поля диффом. */
const stateOfResult = new WeakMap<ValidationResult, RunState>();

function runStateFor(model: object, schema: object): RunState {
  let perModel = stateRegistry.get(model);
  if (!perModel) stateRegistry.set(model, (perModel = new WeakMap()));
  let state = perModel.get(schema);
  if (!state) perModel.set(schema, (state = { fields: new Set(), ac: null }));
  return state;
}

const hasBlocking = (errs: Map<unknown, ValidationError[]>): boolean => {
  for (const list of errs.values()) for (const e of list) if (e.severity !== 'warning') return true;
  return false;
};

/** Промис, резолвящийся при abort сигнала — размыкает ожидание устаревшего прогона (не висим на чужих медленных промисах). */
function whenAborted(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    signal.addEventListener('abort', () => resolve(), { once: true });
  });
}

/** Нода, которую раннер держит в `pending`, пока идут async-правила её поля. */
interface PendingTarget {
  setPending(pending: boolean): void;
}

/**
 * Сбор: прогон схемы и ожидание async-правил.
 *
 * @param markPending - держать ноды полей с async-правилами в `pending` до вызова `release`.
 * @returns Результат и `release` — снять `pending` (вызывается после разноса, чтобы поле не
 *   мигнуло прежним статусом между концом ожидания и новыми ошибками).
 */
async function collect<T>(
  model: FormModel<T>,
  schema: ValidationSchema<T>,
  markPending: boolean
): Promise<{ result: ValidationResult; release: () => void }> {
  const state = runStateFor(model as object, schema as object);
  state.ac?.abort(); // отменяем предыдущий in-flight прогон этой (model, schema)
  const ac = new AbortController();
  state.ac = ac;

  const failures: ValidationFailure[] = [];
  const ctx: VContext = {
    model: model as FormModel<unknown>,
    errors: new Map(),
    pending: [],
    asyncFields: new Set(),
    failures,
    whenStack: [],
    signal: ac.signal,
  };
  // Синхронная регистрация: validate/cross/apply/applyEach отрабатывают здесь. Ambient-окно
  // закрывается до любого await — этим владеет runWithContext.
  runWithContext(ctx, () => schema(scopeOf(model)));

  const busy: PendingTarget[] = [];
  if (markPending) {
    for (const sig of ctx.asyncFields) {
      const node = getNodeForSignal(sig) as PendingTarget | undefined;
      if (node) busy.push(node);
    }
    for (const node of busy) node.setPending(true);
  }

  // Дожидаемся async-правил, но размыкаем ожидание по отмене (устаревший прогон не висит на
  // медленных промисах). Промисы правил не отклоняются: сбой правила записан в `failures`.
  if (ctx.pending.length) await Promise.race([Promise.all(ctx.pending), whenAborted(ac.signal)]);

  // Приоритет статуса: отменённому прогону нельзя доверять вовсе (его async-часть оборвана);
  // сбой правила важнее обычной ошибки — результата проверки нет.
  const result: ValidationResult = {
    status: ac.signal.aborted
      ? 'cancelled'
      : failures.length > 0
        ? 'error'
        : hasBlocking(ctx.errors)
          ? 'invalid'
          : 'valid',
    errors: ctx.errors,
    failures,
  };
  stateOfResult.set(result, state);
  return {
    result,
    release: () => {
      for (const node of busy) node.setPending(false);
    },
  };
}

/**
 * Собрать результат проверки модели схемой — без формы и без побочных эффектов на нодах.
 *
 * Открывает ambient-окно на время синхронного прогона `schema`, дожидается async-правил и
 * возвращает {@link ValidationResult}. Нод формы не трогает: ошибки по ним разносит
 * {@link applyValidationResult}. Подходит для проверки данных без UI (сервер, тест, предпросмотр).
 *
 * Статус результата:
 *  - `cancelled` — прогон устарел: пока он шёл, для той же пары (model, schema) запущен следующий;
 *  - `error` — хотя бы одно async-правило не вернуло результат (сеть, исключение) — см. `failures`;
 *  - `invalid` — есть блокирующие ошибки (`severity: 'warning'` не блокирует);
 *  - `valid` — блокирующих ошибок нет.
 *
 * ⚠️ `schema` должна быть СТАБИЛЬНОЙ ссылкой: отмена устаревших прогонов ключится по идентичности
 * `schema`. Держите схемы в `const` / `defineValidationSchema`.
 *
 * @param model - Модель данных формы.
 * @param schema - Схема валидации (стабильная ссылка).
 *
 * @example
 * ```ts
 * const result = await runValidation(model, formRules);
 * if (result.status === 'error') showToast('Не удалось проверить форму, повторите попытку');
 * else if (result.status !== 'cancelled') applyValidationResult(result, { touch: true });
 * ```
 */
export async function runValidation<T>(
  model: FormModel<T>,
  schema: ValidationSchema<T>
): Promise<ValidationResult> {
  return (await collect(model, schema, false)).result;
}

/**
 * Разнести собранный результат по нодам формы: поставить ошибки проверенным полям и погасить поля,
 * которые были с ошибкой в прошлом разнесённом прогоне той же пары (model, schema), а теперь не
 * проверялись (удалённая строка массива, выключенная ветка).
 *
 * Отменённый результат (`status: 'cancelled'`) не разносится: его async-часть оборвана.
 *
 * `options.touch`: пометить `touched` ИМЕННО поля, которые схема проверяла (не всё поддерево).
 * Ошибки становятся видимыми (`shouldShowError = invalid && (touched || dirty)`) без ручного
 * `form.markAsTouched()`; при пошаговой валидации следующий шаг не показывается «тронутым».
 *
 * @param result - Результат {@link runValidation}.
 * @param options - `{ touch }` — пометить проверенные поля `touched` для показа ошибок.
 */
export function applyValidationResult(
  result: ValidationResult,
  options?: { touch?: boolean }
): void {
  if (result.status === 'cancelled') return;
  const state = stateOfResult.get(result);
  const validated = new Set(result.errors.keys());
  batch(() => {
    // Гашение диффом (без неограниченного накопления): поля, которых НЕ коснулись в этом прогоне,
    // гасятся один раз и отпускаются на GC.
    if (state) {
      for (const sig of state.fields) if (!validated.has(sig)) getNodeForSignal(sig)?.setErrors([]);
    }
    for (const [sig, errors] of result.errors) {
      getNodeForSignal(sig)?.setErrors(errors as ValidationError[]);
    }
    if (options?.touch) for (const sig of validated) getNodeForSignal(sig)?.markAsTouched();
  });
  if (state) state.fields = validated;
}

/**
 * Прогон с разносом и полным результатом — общий движок {@link validateModel}, контроллера
 * стратегии и прогонов шага. На время async-правил держит ноды их полей в `pending`.
 *
 * @internal
 */
export async function runAndApply<T>(
  model: FormModel<T>,
  schema: ValidationSchema<T>,
  options?: { touch?: boolean }
): Promise<ValidationResult> {
  const { result, release } = await collect(model, schema, true);
  batch(() => {
    applyValidationResult(result, options);
    release();
  });
  return result;
}

/**
 * Провалидировать модель ЛЮБОЙ схемой (шаг или вся форма): собрать результат и разнести ошибки по
 * нодам формы. Возвращает `true` только для статуса `valid`: ошибки, сбой правила и отмена дают
 * `false` (**fail-closed**). Чтобы различить их, берите {@link runValidation} либо
 * `validation.runAll()` / `validation.runStep()` сборки формы.
 *
 * Гашение — на пару (model, schema): `validateModel(model, step2)` и `validateModel(model, form)`
 * не мешают друг другу. Устаревший прогон (быстрый повторный вызов той же (model, schema))
 * отменяется через `AbortSignal`.
 *
 * ⚠️ `schema` должна быть СТАБИЛЬНОЙ ссылкой: отмена устаревших прогонов ключится по идентичности
 * `schema`. Инлайн-стрелка (`validateModel(model, ({ model }) => …)`) каждый раз создаёт НОВЫЙ
 * прогон без дедупликации — держите схемы в `const` / `defineValidationSchema`.
 *
 * @param model - Модель данных формы.
 * @param schema - Схема валидации (стабильная ссылка).
 * @param options - `{ touch }` — пометить провалидированные поля `touched` для показа ошибок.
 *
 * @example
 * ```ts
 * const ok = await validateModel(model, step2Validation);              // один шаг
 * const all = await validateModel(model, formValidation);              // вся форма
 * const stepOk = await validateModel(model, step2Validation, { touch: true }); // + показать ошибки шага
 * ```
 */
export async function validateModel<T>(
  model: FormModel<T>,
  schema: ValidationSchema<T>,
  options?: { touch?: boolean }
): Promise<boolean> {
  return (await runAndApply(model, schema, options)).status === 'valid';
}
