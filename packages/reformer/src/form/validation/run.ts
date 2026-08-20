/**
 * `defineValidationSchema` + внешний раннер `validateModel`.
 *
 * Раннер открывает ambient-окно на время СИНХРОННОГО прогона схемы (`./context`), дожидается
 * async-правил и разносит собранные ошибки по нодам формы через реестр сигнал→нода, гася поля,
 * ставшие валидными.
 *
 * ⚠️ Имя `validateModel` здесь — раннер функциональных схем; НЕ путать с legacy
 * `validateModel(model, treeSchema)` из корня `@reformer/core` (headless-движок дерева).
 *
 * @group Validation
 * @module form/validation/run
 */

import {
  getNodeForSignal,
  type FormModel,
  type PathAwareSignal,
  type ValidationError,
} from '../../index';
import { runWithContext, type VContext } from './context';
import type { ValidationSchema } from './types';

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
  /** Все сигналы, которых схема когда-либо касалась — для очистки полей, ставших валидными. */
  fields: Set<PathAwareSignal<unknown>>;
  /** Контроллер текущего прогона (отменяет предыдущий in-flight прогон той же (model, schema)). */
  ac: AbortController | null;
}
const stateRegistry = new WeakMap<object, WeakMap<object, RunState>>();

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

/**
 * Провалидировать модель ЛЮБОЙ схемой (шаг или вся форма). Открывает ambient-окно на время
 * синхронного прогона `schema`, дожидается async-правил, разносит ошибки по нодам формы и гасит
 * поля, ставшие валидными. Возвращает `true`, если нет блокирующих ошибок (`severity:'warning'` не блокирует).
 *
 * Гашение — на пару (model, schema): `validateModel(model, step2)` и `validateModel(model, form)` не мешают
 * друг другу. Устаревший прогон (быстрый повторный вызов той же (model, schema)) отменяется через `AbortSignal`
 * и возвращает `false` (**fail-closed** — отменённому результату нельзя доверять для submit).
 *
 * ⚠️ `schema` должна быть СТАБИЛЬНОЙ ссылкой: отмена устаревших прогонов ключится по идентичности `schema`.
 * Инлайн-стрелка (`validateModel(model, ({ model }) => …)`) каждый раз создаёт НОВЫЙ прогон без дедупликации —
 * держите схемы в `const` / `defineValidationSchema`.
 *
 * `options.touch` (§6): по завершении помечает `touched` ИМЕННО поля, которые схема проверяла
 * (не всё поддерево). Ошибки становятся видимыми (`shouldShowError = invalid && (touched||dirty)`)
 * без ручного `form.markAsTouched()`; при пошаговой валидации следующий шаг не показывается
 * «тронутым» до ввода. Валидные проверенные поля тоже метятся — это безвредно (ошибка не покажется).
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
  const state = runStateFor(model as object, schema as object);
  state.ac?.abort(); // отменяем предыдущий in-flight прогон этой (model, schema)
  const ac = new AbortController();
  state.ac = ac;

  const ctx: VContext = {
    model: model as FormModel<unknown>,
    errors: new Map(),
    pending: [],
    whenStack: [],
    signal: ac.signal,
  };
  // Синхронная регистрация: rule/cross/each/apply отрабатывают здесь. Ambient-окно
  // закрывается до любого await — этим владеет runWithContext.
  runWithContext(ctx, () => schema({ model }));

  // Дожидаемся async-правил, но размыкаем ожидание по отмене (устаревший прогон не висит на медленных промисах).
  if (ctx.pending.length) await Promise.race([Promise.all(ctx.pending), whenAborted(ac.signal)]);

  // Устаревший (отменённый) прогон НИКОГДА не рапортует «валидно» и не роутит: его async-часть оборвана,
  // поэтому `!hasBlocking` был бы ложно-положительным (async-констрейнты пропали).
  if (ac.signal.aborted) return false;

  // Гашение диффом (без неограниченного накопления `owned`): поля, которых НЕ коснулись в этом прогоне
  // (исчезнувший вызов — удалённый элемент массива), гасятся один раз и отпускаются на GC.
  const validated = new Set(ctx.errors.keys());
  for (const sig of state.fields) if (!validated.has(sig)) getNodeForSignal(sig)?.setErrors([]);
  for (const sig of validated) getNodeForSignal(sig)?.setErrors(ctx.errors.get(sig) ?? []);
  // §6: пометить провалидированные поля `touched`, чтобы ошибки стали видимыми без ручного
  // `form.markAsTouched()` на всё поддерево. `validated` — ровно поля, которых коснулась схема
  // (rule/cross/each заводят бакет в errors даже для валидного поля), поэтому scope точный.
  if (options?.touch) for (const sig of validated) getNodeForSignal(sig)?.markAsTouched();
  state.fields = validated;

  return !hasBlocking(ctx.errors);
}
