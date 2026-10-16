/**
 * `defineValidation` и раннер схемы валидации.
 *
 * Прогон делится на сбор и разнос. Сбор ({@link runValidation}) открывает ambient-окно на время
 * СИНХРОННОГО прогона схемы (`./context`), дожидается async-правил и возвращает
 * {@link ValidationResult} — нод формы он не трогает. Разнос ({@link applyValidationResult})
 * раскладывает собранные ошибки по нодам через реестр «ручка → нода» и гасит поля, ставшие
 * валидными. {@link validateModel} делает оба шага и отвечает одним `boolean`.
 *
 * Точки контакта валидации с нодами — только здесь и в стратегии (`./strategy`): разнос замечаний,
 * `pending` полей с async-правилами, касание проверенных полей или всей формы (`touch: 'all'`),
 * пропуск выключенных нод и триггер `blur`. Правила и схема о нодах не знают.
 *
 * @group Validation
 * @module form/validation/run
 */

import { batch } from '@preact/signals-core';
import { deferredWritesSettled } from '../../model/index';
import type { FormModel, PathAwareSignal } from '../../model/types';
import { getNodeForSignal } from '../signal-node-registry';
import type { ValidationIssue } from '../types/contracts';
import { runWithContext, type VContext } from './context';
import { scopeOf } from './operators';
import type { ValidationFailure, ValidationResult, ValidationDefinition } from './types';

/**
 * Тонкая identity-обёртка для типизации/discoverability (как `defineFormBehavior`). Возвращает схему как есть.
 *
 * @example
 * ```ts
 * export const step1 = defineValidation<LoanForm>(({ model }) => {
 *   validate(model.$.loanAmount, [required(), min(50000)]);
 * });
 * ```
 */
export function defineValidation<T>(schema: ValidationDefinition<T>): ValidationDefinition<T> {
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

/**
 * Поля, правила которых прогон действительно выполнил (ветка `validateWhen` активна, поле не
 * выключено в проверке формы). Разнос с `touch` метит тронутыми только их. Результат, собранный не
 * раннером, здесь не записан — для него проверенными считаются все поля `issues`.
 */
const checkedOfResult = new WeakMap<ValidationResult, ReadonlySet<PathAwareSignal<unknown>>>();

/** Замечания результата по определениям-источникам и определения, исполненные прогоном. */
interface TaggedIssues {
  readonly origins: ReadonlyMap<PathAwareSignal<unknown>, ReadonlyMap<object, ValidationIssue[]>>;
  readonly executed: ReadonlySet<object>;
}
const taggedOfResult = new WeakMap<ValidationResult, TaggedIssues>();

/**
 * Замечания поля, разнесённые на его ноду, — по определениям-источникам, и сам записанный список.
 *
 * Прогоны разных схем (шаг и вся форма, отправка) пишут в одну ноду. Список ноды — объединение
 * списков определений; прогон заменяет списки только тех определений, которые сам исполнял: шаг
 * не стирает замечание `extras` полной проверки, а устаревшее замечание правил шага — стирает.
 * Если ноду с тех пор правили мимо разноса (`reset`, `clearIssues`, `setIssues`), хранилище
 * забывается: решение того, кто правил, главнее.
 */
const shownIssues = new WeakMap<
  object,
  { byOrigin: Map<object, readonly ValidationIssue[]>; written: readonly ValidationIssue[] }
>();

/** Результат, собранный не раннером: меток нет, и он отвечает за весь список поля. */
const UNTAGGED = {};

/** Замечания корня, поставленные мимо разноса (ошибка сервера на форме), — их прогон не стирает. */
const FOREIGN = {};

/** Модель, по которой собран результат: от неё разнос находит корень формы. */
const modelOfResult = new WeakMap<ValidationResult, FormModel<unknown>>();

/** Нода, на которую ложится итог: `setIssues` и собственный список для сверки. */
interface IssueTarget {
  setIssues(issues: readonly ValidationIssue[]): void;
  ownIssues?: { peek(): readonly ValidationIssue[] };
}

/** Одно замечание из двух определений с одними правилами (шаг внутри формы) — один раз. */
function mergeIssues(lists: Iterable<readonly ValidationIssue[]>): readonly ValidationIssue[] {
  const seen = new Set<string>();
  const out: ValidationIssue[] = [];
  for (const list of lists) {
    for (const issue of list) {
      const key = JSON.stringify([issue.code, issue.severity ?? null, issue.params ?? null]);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(issue);
    }
  }
  return out;
}

/**
 * Записать ноде итог прогона с учётом замечаний других определений — см. {@link shownIssues}.
 *
 * @param key - Ключ хранилища: сигнал поля либо корень формы.
 * @param lists - Списки прогона по определениям; `undefined` — поле в прогоне не проверялось.
 * @param keepForeign - Список, поставленный мимо разноса, сохранить, а не забыть (корень формы).
 */
function settleOn(
  key: object,
  node: IssueTarget,
  tagged: TaggedIssues | undefined,
  lists: ReadonlyMap<object, readonly ValidationIssue[]> | undefined,
  flat: readonly ValidationIssue[] | undefined,
  keepForeign = false
): void {
  const previous = shownIssues.get(key);
  const current = node.ownIssues?.peek() ?? [];
  const untouched = previous !== undefined && current === previous.written;
  const byOrigin = untouched ? previous.byOrigin : new Map<object, readonly ValidationIssue[]>();
  if (!untouched && keepForeign && current.length > 0) byOrigin.set(FOREIGN, current);
  byOrigin.delete(UNTAGGED);
  if (tagged === undefined) {
    for (const origin of [...byOrigin.keys()]) if (origin !== FOREIGN) byOrigin.delete(origin);
    if (flat !== undefined && flat.length > 0) byOrigin.set(UNTAGGED, flat);
  } else {
    for (const origin of tagged.executed) byOrigin.delete(origin);
    lists?.forEach((list, origin) => {
      if (list.length > 0) byOrigin.set(origin, list);
    });
  }
  const written = byOrigin.size === 0 ? [] : mergeIssues(byOrigin.values());
  node.setIssues(written);
  shownIssues.set(key, { byOrigin, written: node.ownIssues?.peek() ?? written });
}

/** Записать полю итог прогона; поле без ноды — в сборщик замечаний корня. */
function settleIssues(
  sig: PathAwareSignal<unknown>,
  tagged: TaggedIssues | undefined,
  issues: readonly ValidationIssue[] | undefined,
  orphans: Map<object, ValidationIssue[]>
): void {
  const node = getNodeForSignal(sig) as IssueTarget | undefined;
  const lists = issues === undefined ? undefined : tagged?.origins.get(sig);
  if (node === undefined) {
    // Правило на поле без ноды (массив примитивов без узла в схеме): замечанию негде показаться
    // у поля, и оно ложится на корень формы — так статус прогона совпадает с `form.valid`.
    lists?.forEach((list, origin) => {
      const bucket = orphans.get(origin) ?? [];
      bucket.push(...list);
      orphans.set(origin, bucket);
    });
    if (tagged === undefined && issues !== undefined) {
      const bucket = orphans.get(UNTAGGED) ?? [];
      bucket.push(...issues);
      orphans.set(UNTAGGED, bucket);
    }
    return;
  }
  settleOn(sig, node, tagged, lists, issues);
}

/**
 * Разнести на корень формы замечания полей без нод. Корень трогается, только если такие замечания
 * есть сейчас или были разнесены раньше: его собственные замечания (ошибка сервера) — не дело прогона.
 */
function settleOrphans(
  model: FormModel<unknown> | undefined,
  tagged: TaggedIssues | undefined,
  orphans: Map<object, ValidationIssue[]>
): void {
  if (model === undefined) return;
  const root = getNodeForSignal(model.$ as object) as IssueTarget | undefined;
  if (root === undefined) return;
  if (orphans.size === 0 && !shownIssues.has(root)) return;
  if (tagged === undefined) {
    settleOn(root, root, undefined, undefined, orphans.get(UNTAGGED) ?? [], true);
    return;
  }
  settleOn(root, root, tagged, orphans, undefined, true);
}

function runStateFor(model: object, schema: object): RunState {
  let perModel = stateRegistry.get(model);
  if (!perModel) stateRegistry.set(model, (perModel = new WeakMap()));
  let state = perModel.get(schema);
  if (!state) perModel.set(schema, (state = { fields: new Set(), ac: null }));
  return state;
}

const hasBlocking = (errs: Map<unknown, ValidationIssue[]>): boolean => {
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

/** Нода ручки выключена (`enableWhen` / `disable()`, в том числе каскадом от группы). */
const isDisabledNode = (sig: unknown): boolean =>
  sig !== null &&
  typeof sig === 'object' &&
  (getNodeForSignal(sig) as { disabled?: { peek(): boolean } } | undefined)?.disabled?.peek() ===
    true;

/**
 * Поле в проверке формы не участвует. Причин две. Выключена его нода или нода контейнера на пути к
 * нему: агрегат `valid` выключенную группу пропускает целиком, даже если поведение включило поле
 * внутри неё. Либо ручки уже нет в модели: строку массива могли удалить, пока прогон ждал
 * async-правил, — тогда по её пути пусто или другая строка.
 */
function isInactive(model: FormModel<unknown>, handle: PathAwareSignal<unknown>): boolean {
  if (handle.__path === '') return isDisabledNode(handle);
  let current: unknown = model.$;
  for (const segment of handle.__path.split('.')) {
    if (current === null || typeof current !== 'object') return true;
    current = (current as Record<string, unknown>)[segment];
    if (isDisabledNode(current)) return true;
  }
  return current !== handle;
}

/**
 * Выключенное поле, поле выключенной группы и поле удалённой строки в проверке формы не участвуют:
 * их замечания гасятся (пустой список — нода очищается при разносе), сбои их async-правил
 * отбрасываются. Так статус прогона совпадает с агрегатом `valid` формы, который такие поля тоже не
 * считает.
 */
function dropInactive(
  model: FormModel<unknown>,
  issues: Map<PathAwareSignal<unknown>, ValidationIssue[]>,
  failures: ValidationFailure[],
  checked: Set<PathAwareSignal<unknown>>,
  origins: Map<PathAwareSignal<unknown>, Map<object, ValidationIssue[]>>
): void {
  for (const sig of issues.keys()) {
    if (!isInactive(model, sig)) continue;
    issues.set(sig, []);
    origins.get(sig)?.forEach((_, origin, byOrigin) => byOrigin.set(origin, []));
    checked.delete(sig);
  }
  for (let i = failures.length - 1; i >= 0; i--) {
    if (isInactive(model, failures[i].handle)) failures.splice(i, 1);
  }
}

/**
 * Отменить идущий прогон пары (model, schema): его `AbortSignal` срабатывает, ожидание async-правил
 * размыкается, результат получает статус `cancelled` и по нодам не разносится. Контроллер живой
 * проверки зовёт это при снятии — иначе ответ правила лёг бы на ноды уже снятой формы.
 *
 * @internal
 */
export function cancelRun(model: object, schema: object): void {
  stateRegistry.get(model)?.get(schema)?.ac?.abort();
}

/**
 * Какие поля пометить тронутыми при разносе: `false` — никакие, `true` — проверенные правилами,
 * `'all'` — проверенные, а при отказе (`invalid`, `error`) ещё и всю форму.
 *
 * @internal
 */
export type ValidationTouch = boolean | 'all';

/** Сколько разносов результата прямо сейчас метят поля `touched` от имени проверки. */
let touchesByValidation = 0;

/**
 * Пометить поля `touched` от имени проверки, а не пользователя. Стратегия `blur` такую метку за
 * уход из поля не принимает: иначе прогон с касанием будил бы лишний живой прогон, а тот отменял
 * бы его самого. Эффекты отрабатывают в конце `batch` — ещё внутри окна.
 *
 * Окно открывает только раннер: касание всей формы при отказе отправки — опция `touch: 'all'`.
 */
function touchByValidation(action: () => void): void {
  touchesByValidation++;
  try {
    batch(action);
  } finally {
    touchesByValidation--;
  }
}

/** Идёт ли сейчас касание полей от имени проверки ({@link touchByValidation}). @internal */
export const isTouchByValidation = (): boolean => touchesByValidation > 0;

/**
 * Сбор: прогон схемы и ожидание async-правил.
 *
 * @param markPending - держать ноды полей с async-правилами в `pending` до вызова `release`.
 * @param skipDisabled - не учитывать поля выключенных нод (проверка уровня формы).
 * @returns Результат и `release` — снять `pending` (вызывается после разноса, чтобы поле не
 *   мигнуло прежним статусом между концом ожидания и новыми ошибками).
 */
async function collect<T>(
  model: FormModel<T>,
  schema: ValidationDefinition<T>,
  markPending: boolean,
  skipDisabled = false
): Promise<{ result: ValidationResult; release: () => void }> {
  const state = runStateFor(model as object, schema as object);
  state.ac?.abort(); // отменяем предыдущий in-flight прогон этой (model, schema)
  const ac = new AbortController();
  state.ac = ac;

  const failures: ValidationFailure[] = [];
  const ctx: VContext = {
    model: model as FormModel<unknown>,
    issues: new Map(),
    checked: new Set(),
    pending: [],
    asyncFields: new Set(),
    failures,
    whenStack: [],
    signal: ac.signal,
    origin: schema as object,
    origins: new Map(),
    executed: new Set([schema as object]),
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
  // Без async-правил проверка формы всё равно ждёт отложенных записей рантайма: доступность полей
  // `enableWhen` пишется на микротаске, и живой прогон сразу после правки условия иначе засчитал бы
  // правила поля, которое вот-вот выключится. Записей нет — это один микротаск, как раньше.
  else if (skipDisabled) await deferredWritesSettled();
  // Список поля в результате — объединение списков определений (async-правила дописали свои).
  for (const [sig, byOrigin] of ctx.origins) ctx.issues.set(sig, [...byOrigin.values()].flat());
  if (skipDisabled) {
    dropInactive(model as FormModel<unknown>, ctx.issues, failures, ctx.checked, ctx.origins);
  }

  // Приоритет статуса: отменённому прогону нельзя доверять вовсе (его async-часть оборвана);
  // сбой правила важнее обычной ошибки — результата проверки нет.
  const result: ValidationResult = {
    status: ac.signal.aborted
      ? 'cancelled'
      : failures.length > 0
        ? 'error'
        : hasBlocking(ctx.issues)
          ? 'invalid'
          : 'valid',
    issues: ctx.issues,
    failures,
  };
  stateOfResult.set(result, state);
  checkedOfResult.set(result, ctx.checked);
  taggedOfResult.set(result, { origins: ctx.origins, executed: ctx.executed });
  modelOfResult.set(result, model as FormModel<unknown>);
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
 * `schema`. Держите схемы в `const` / `defineValidation`.
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
  schema: ValidationDefinition<T>
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
 * `options.touch`: пометить `touched` ИМЕННО поля, которые схема проверяла (не всё поддерево):
 * поля выключенной ветки `validateWhen` и, в проверке уровня формы, выключенные поля не метятся —
 * пользователь их не видел, и после включения их ошибка не должна быть видна с первой проверки.
 * Замечания становятся видимыми (`shouldShowIssues`: есть замечания и `touched || dirty`) без
 * ручного `form.markAsTouched()`; при пошаговой валидации следующий шаг не показывается
 * «тронутым».
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
  const validated = new Set(result.issues.keys());
  const checked = checkedOfResult.get(result) ?? validated;
  const tagged = taggedOfResult.get(result);
  const write = (): void => {
    const orphans = new Map<object, ValidationIssue[]>();
    // Гашение диффом (без неограниченного накопления): поля, которых НЕ коснулись в этом прогоне,
    // гасятся один раз и отпускаются на GC — от замечаний определений этого прогона.
    if (state) {
      for (const sig of state.fields) {
        if (!validated.has(sig)) settleIssues(sig, tagged, undefined, orphans);
      }
    }
    for (const [sig, issues] of result.issues) settleIssues(sig, tagged, issues, orphans);
    settleOrphans(modelOfResult.get(result), tagged, orphans);
    if (options?.touch) for (const sig of checked) getNodeForSignal(sig)?.markAsTouched();
  };
  if (options?.touch) touchByValidation(write);
  else batch(write);
  if (state) state.fields = validated;
}

/**
 * Прогон с разносом и полным результатом — общий движок {@link validateModel}, контроллера
 * стратегии и прогонов шага. На время async-правил держит ноды их полей в `pending`.
 * `skipDisabled` — проверка уровня формы: поля выключенных нод не учитываются.
 *
 * `touch`: `true` — пометить тронутыми проверенные поля; `'all'` — то же, а при отказе (`invalid`,
 * `error`) ещё и всю форму: так попытка отправки раскрывает замечания полей, которых правила не
 * касались. Отменённый результат не разносится и ничего не трогает.
 *
 * @internal
 */
export async function runAndApply<T>(
  model: FormModel<T>,
  schema: ValidationDefinition<T>,
  options?: { touch?: ValidationTouch; skipDisabled?: boolean }
): Promise<ValidationResult> {
  const { result, release } = await collect(model, schema, true, options?.skipDisabled);
  const touch = options?.touch ?? false;
  const write = (): void => {
    applyValidationResult(result, { touch: touch !== false });
    if (touch === 'all' && (result.status === 'invalid' || result.status === 'error')) {
      // Корень формы метит тронутыми все поля, в том числе непроверенные правилами.
      getNodeForSignal(model.$ as object)?.markAsTouched();
    }
    release();
  };
  // Окно касания — вокруг внешнего batch: эффекты отрабатывают в его конце.
  if (touch !== false) touchByValidation(write);
  else batch(write);
  return result;
}

/**
 * Провалидировать модель ЛЮБОЙ схемой (шаг или вся форма): собрать результат и разнести ошибки по
 * нодам формы. Возвращает `true` только для статуса `valid`: ошибки, сбой правила и отмена дают
 * `false` (**fail-closed**). Чтобы различить их, берите {@link runValidation} либо
 * `bundle.validate()` / `bundle.validateStep(id)` сборки формы.
 *
 * Гашение — на пару (model, schema): `validateModel(model, step2)` и `validateModel(model, form)`
 * не мешают друг другу. Устаревший прогон (быстрый повторный вызов той же (model, schema))
 * отменяется через `AbortSignal`.
 *
 * ⚠️ `schema` должна быть СТАБИЛЬНОЙ ссылкой: отмена устаревших прогонов ключится по идентичности
 * `schema`. Инлайн-стрелка (`validateModel(model, ({ model }) => …)`) каждый раз создаёт НОВЫЙ
 * прогон без дедупликации — держите схемы в `const` / `defineValidation`.
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
  schema: ValidationDefinition<T>,
  options?: { touch?: boolean }
): Promise<boolean> {
  return (await runAndApply(model, schema, options)).status === 'valid';
}
