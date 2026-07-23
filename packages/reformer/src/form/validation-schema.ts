/**
 * Декларативный контракт СХЕМЫ ВАЛИДАЦИИ — `@reformer/core/validation`.
 *
 * Схема валидации — обычная функция `(ctx: { model }) => void`. Внутри вызываются свободные операторы
 * (`validate`/`validateAsync`/`validateWhen`/`cross`/`each`/`apply`), которые САМИ пишут ошибки в ambient-сток
 * текущего прогона — автор не видит ни коллектора, ни `getNodeForSignal`, ни `.push`. Внешний раннер
 * {@link validateModel} открывает ambient-окно на время СИНХРОННОГО прогона схемы, дожидается async-правил
 * и разносит ошибки по нодам формы (`getNodeForSignal(sig).setErrors(...)`), гася поля, ставшие валидными.
 *
 * Зеркалит контракт поведения (`@reformer/core/behaviors`): тот же ambient-стиль, но отдельный слой —
 * валидация НЕ реактивна (прогон по требованию: submit/шаг), поведение — реактивно (живые подписки).
 * Импортирует `getNodeForSignal` из `../index` → тот же реестр сигнал→нода, что и у форм/поведения.
 *
 * ⚠️ Имя `validateModel` в этом модуле — НОВЫЙ раннер функциональных схем; НЕ путать с legacy
 * `validateModel(model, treeSchema)` из корня `@reformer/core` (headless-движок дерева `{ value, validators }`),
 * который помечен `@deprecated` и удаляется после миграции. Новый экспортируется ТОЛЬКО из `@reformer/core/validation`.
 *
 * @module validation
 */

import {
  getNodeForSignal,
  type FormModel,
  type ModelArray,
  type PathAwareSignal,
  type ValidationError,
} from '../index';

/** Внутренний callable-вид правила: value-only фабрики игнорируют 2-й/3-й аргумент. */
type CallableRule = (value: unknown, model: unknown, root: unknown) => ValidationError | null;

// ============================================================================
// Типы контракта
// ============================================================================

/**
 * Синхронное правило поля типа `TField`. Проверяется ТОЛЬКО значение (`value`).
 *
 * Позиционные `scope`/`root` помечены `never` намеренно: так встроенные value-only фабрики
 * (`required()`/`min()`/… — они `(value, model, root) => …`) и inline-правила `(value) => …`
 * ОБА присваиваются в `Rule<TField>[]` без `any`, при этом сохраняется проверка типа поля
 * (`validate(model.$.age, [email()])` подсветится — `email` ждёт `string`, поле `number`).
 * На вызове раннер приводит правило к callable и передаёт `(value, model, model)`.
 */
export type Rule<TField> = (value: TField, scope: never, root: never) => ValidationError | null;

/**
 * Асинхронное правило поля. Получает `AbortSignal` для отмены устаревших ответов (быстрый повторный
 * прогон той же схемы отменяет предыдущий). Сетевой сбой не должен блокировать — ловите и возвращайте `null`.
 */
export type AsyncRule<TField> = (
  value: TField,
  ctx: { signal: AbortSignal }
) => Promise<ValidationError | null>;

/** Схема валидации — обычная функция над (под)моделью. First-class значение (можно `apply`/тестировать/переиспользовать). */
export type ValidationSchema<T> = (ctx: { model: FormModel<T> }) => void;

// ============================================================================
// Ambient-сток текущего прогона
// ============================================================================

interface VContext {
  /** Модель текущего scope — источник снапшота для {@link cross} и модель для {@link apply}. */
  model: FormModel<unknown>;
  /** Накопленные ошибки по сигналу (ключ — идентичность `PathAwareSignal`). */
  errors: Map<PathAwareSignal<unknown>, ValidationError[]>;
  /** Незавершённые async-правила (раннер их дожидается). */
  pending: Promise<void>[];
  /** Стек активных условий {@link validateWhen} (все должны быть истинны, чтобы правило сработало). */
  whenStack: Array<() => boolean>;
  /** Отмена устаревшего прогона: прокидывается в async-правила, гасит роутинг после await. */
  signal: AbortSignal;
}

let current: VContext | null = null;

function requireCtx(op: string): VContext {
  if (!current) {
    throw new Error(
      `[@reformer/core/validation] "${op}" вызван вне схемы валидации — операторы валидации ` +
        `можно вызывать только внутри прогона validateModel(...) (напрямую или через apply/each).`
    );
  }
  return current;
}

/** «Тронуть» сигнал: гарантирует его наличие в `errors` (даже пустым) → он попадёт в очистку. */
function touch(ctx: VContext, sig: PathAwareSignal<unknown>): ValidationError[] {
  let bucket = ctx.errors.get(sig);
  if (!bucket) ctx.errors.set(sig, (bucket = []));
  return bucket;
}

/** Активна ли текущая ветка (все `validateWhen`-условия истинны). */
const gated = (ctx: VContext): boolean => ctx.whenStack.every((cond) => cond());

// ============================================================================
// Операторы
// ============================================================================

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

// ============================================================================
// defineValidationSchema + внешний раннер
// ============================================================================

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
 * @example
 * ```ts
 * const ok = await validateModel(model, step2Validation);   // один шаг
 * const all = await validateModel(model, formValidation);   // вся форма
 * ```
 */
export async function validateModel<T>(
  model: FormModel<T>,
  schema: ValidationSchema<T>
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
  const prev = current;
  current = ctx;
  try {
    schema({ model }); // синхронная регистрация: rule/cross/each/apply отрабатывают здесь
  } finally {
    current = prev; // ambient-окно закрыто до любого await
  }

  // Дожидаемся async-правил, но размыкаем ожидание по отмене (устаревший прогон не висит на медленных промисах).
  if (ctx.pending.length) await Promise.race([Promise.all(ctx.pending), whenAborted(ac.signal)]);

  // Устаревший (отменённый) прогон НИКОГДА не рапортует «валидно» и не роутит: его async-часть оборвана,
  // поэтому `!hasBlocking` был бы ложно-положительным (async-констрейнты пропали).
  if (ac.signal.aborted) return false;

  // Гашение диффом (без неограниченного накопления `owned`): поля, которых НЕ коснулись в этом прогоне
  // (исчезнувший вызов — удалённый элемент массива), гасятся один раз и отпускаются на GC.
  const touched = new Set(ctx.errors.keys());
  for (const sig of state.fields) if (!touched.has(sig)) getNodeForSignal(sig)?.setErrors([]);
  for (const sig of touched) getNodeForSignal(sig)?.setErrors(ctx.errors.get(sig) ?? []);
  state.fields = touched;

  return !hasBlocking(ctx.errors);
}
