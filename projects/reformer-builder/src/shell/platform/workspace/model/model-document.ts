/**
 * Два вида документа и переключение между ними.
 *
 * ```text
 *              TextDocument                     ModelDocument
 * истина       буфер                            модель, буфер — её сериализация
 * когда        провайдера модели нет            провайдер взялся и разбор удался
 * редакторы    текстовый                        текстовый и структурный, оба на одну модель
 * правка       текстом                          операциями над моделью
 * отмена       патчи                            снимки
 * ```
 *
 * **Почему не хватает одного вида.** Структурная правка против текстового буфера означала бы
 * разбор на каждое перетаскивание, а разбор каждый раз даёт НОВЫЙ объект целиком — и рушится
 * structural sharing, на котором держится и дешёвая отмена, и сравнение, и точечная
 * перерисовка. Обратно: заводить модель для произвольного `.ts` не на чем.
 *
 * **Разведены типами, а не флагом.** {@link ModelDocument} — отдельный тип с `getModel()`,
 * а не документ с полем `model?: unknown`. С флагом каждый потребитель писал бы проверку
 * на `undefined`, компилятор не отличал бы «модели нет» от «модель ещё не разобралась»,
 * а структурный редактор мог бы открыться на текстовом документе и упасть в рантайме.
 * Дискриминант `DocumentKind` живёт на базовом `Document`, поэтому документ без провайдера —
 * уже `TextDocument`, без единой обёртки.
 *
 * ## Расхождение
 *
 * ```text
 * буфер разбирается     → модель обновилась, всё согласовано
 * буфер не разбирается  → документ «разошёлся»
 *                         · буфер держит то, что напечатал пользователь
 *                         · модель держит последнюю валидную
 *                         · структурная правка отвергается (редакторы на чтение)
 *                         · диагностика показывает ошибку разбора
 * ```
 *
 * **Сохранение в расхождении пишет буфер, а не модель.** Держится это не проверкой в `save`,
 * а тем, что в расхождении сюда не приходит ни одной записи: `writeText` вызывается только
 * из перерисовки буфера по модели, а она в расхождении не запускается. Workspace сохраняет
 * рабочую копию, то есть ровно то, что видит пользователь. Молча записать устаревшую модель
 * означало бы потерять его работу — а незавершённый код является законным содержимым файла.
 *
 * ## Обратное направление: перерисовка буфера
 *
 * Когда модель меняется извне (структурная правка, ход ассистента), буфер перерисовывается
 * из `print(model)` — **но только если текстовый редактор не в фокусе**, иначе мы затрём то,
 * что человек печатает прямо сейчас. Отложенная перерисовка не теряется: она выполняется
 * по {@link ModelDocumentHandle.flush} (уход фокуса) — и ОТМЕНЯЕТСЯ, если тем временем
 * буфер изменил сам пользователь. Приоритет у того, кто печатает: его текст — истина,
 * которую он видит.
 *
 * @module shell/platform/workspace/model/model-document
 */

import type { Disposable } from '@/shell/platform/primitives/disposable';
import { toDisposable } from '@/shell/platform/primitives/disposable';
import type { ExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import type { Diagnostic } from '@/shell/platform/services/diagnostics/types';
import type { Document } from '../document';
import type { DiagnosticsSink } from '../workspace';
import { createModelHistory, type ModelHistory, type ModelSnapshot } from './history';
import {
  createEditorProbe,
  resolveModelProvider,
  type ApplyResult,
  type DocumentModelProvider,
  type EditOp,
  type NodeId,
} from './provider';

/** Источник диагностик разбора: по нему `publish` замещает прошлый результат. */
export const PARSE_DIAGNOSTIC_SOURCE = 'document.model';

/** Документ без провайдера модели: истина — буфер. Это ровно то, что отдаёт Workspace. */
export interface TextDocument extends Document {
  readonly kind: 'text';
}

/** Согласован ли буфер с моделью. */
export type DocumentSyncState = 'synced' | 'diverged';

/** Почему буфер не разобрался. Текста для человека тут нет — он собирается по коду i18n. */
export interface ParseFailure {
  readonly providerId: string;
  /** Сообщение провайдера: годится для диагностики и для лога, не для интерфейса. */
  readonly message: string;
  /** Исходная ошибка: у разбора с позициями в ней лежит смещение. */
  readonly error?: unknown;
}

/** Что вызвало смену состояния документа. */
export type ModelChangeReason = 'apply' | 'parse' | 'undo' | 'redo' | 'selection';

export interface ModelChange<M> {
  readonly model: M;
  readonly selection: readonly NodeId[];
  readonly syncState: DocumentSyncState;
  readonly reason: ModelChangeReason;
}

/**
 * Документ с моделью: истина — модель, буфер — её сериализация.
 *
 * Наследует `Document` целиком: для текстового редактора модельный документ ничем не отличается
 * от обычного, и это осознанно — иначе Monaco пришлось бы знать про два вида документов.
 */
export interface ModelDocument<M = unknown> extends Document {
  readonly kind: 'model';
  /** Чей разбор. Попадает в диагностику и в отчёт об отказе операции. */
  readonly providerId: string;
  /** Последняя валидная модель. В расхождении — та, что была до поломки буфера. */
  getModel(): M;
  getSyncState(): DocumentSyncState;
  /** `undefined`, когда согласовано. */
  getParseFailure(): ParseFailure | undefined;
  /**
   * Выделение — часть модели правки, а не состояния вида: операция переносит его на `focus`,
   * оно входит в снимок отмены и читается командами. В `viewState` редактора уходит другое.
   */
  getSelection(): readonly NodeId[];
  /** Ложь в расхождении: структурные редакторы там только на чтение. */
  isStructurallyEditable(): boolean;
  onDidChangeModel(cb: (change: ModelChange<M>) => void): Disposable;
}

/** Отказ применить операцию. Не исключение: оба случая — нормальные состояния, а не аварии. */
export type ApplyRejection =
  /** Буфер не разбирается: правка модели затёрла бы работу пользователя при перерисовке. */
  | { readonly status: 'rejected'; readonly reason: 'diverged'; readonly failure: ParseFailure }
  /** Провайдер не смог применить операцию: неизвестный тип, исчезнувшая цель, битые параметры. */
  | { readonly status: 'rejected'; readonly reason: 'provider-error'; readonly error: unknown };

export type ApplyOutcome<M> = ({ readonly status: 'applied' } & ApplyResult<M>) | ApplyRejection;

export interface ApplyOptions {
  /** Ключ схлопывания в истории, обычно `свойство@узел` (см. `mergeKeyOf`). */
  readonly mergeKey?: string;
}

/**
 * Ручки управления модельным документом.
 *
 * Разведено так же, как `Document`/`DocumentHandle`: наружу уходит документ, который читают,
 * а править его может только тот, кто им владеет. Иначе любая панель, получившая ссылку,
 * могла бы применить операцию мимо истории и мимо перерисовки буфера.
 */
export interface ModelDocumentHandle<M> {
  readonly document: ModelDocument<M>;
  /** Применяет операцию: история, перенос выделения на `focus`, перерисовка буфера. */
  apply(op: EditOp, options?: ApplyOptions): ApplyOutcome<M>;
  setSelection(selection: readonly NodeId[]): void;
  /** `false`, если отменять нечего или документ в расхождении. */
  undo(): boolean;
  redo(): boolean;
  /**
   * Ответит ли {@link undo} согласием. Расхождение учитывается здесь же, а не отдельным
   * вопросом: иначе команда «Отменить» была бы доступна там, где отмена откажет, —
   * а пункт меню, который обещает то, чего не сделает, хуже отсутствующего.
   */
  canUndo(): boolean;
  canRedo(): boolean;
  /** Явная граница схлопывания: конец хода ассистента, уход фокуса с поля. */
  breakUndoMerge(): void;
  /**
   * Выполняет отложенную перерисовку буфера и дожидается записи.
   *
   * Вызывается при уходе фокуса из текстового редактора и в конце операции, которой важно,
   * что буфер уже согласован (сохранение, компиляция, снимок для превью).
   */
  flush(): Promise<void>;
  /** Ждёт ли документ перерисовки буфера, отложенной из-за фокуса. */
  hasPendingSync(): boolean;
  dispose(): void;
}

export interface ModelDocumentOptions<M> {
  /** Документ из Workspace: буфер, за которым надстраивается модель. */
  readonly document: Document;
  readonly provider: DocumentModelProvider<M>;
  /**
   * Единственный путь записи буфера — `workspace.writeText`.
   *
   * Внедряется, а не берётся из Workspace: документ не знает ни про рабочую область,
   * ни про хранилище, и это знание не должно протечь в модель.
   */
  readonly writeText: (text: string) => void | Promise<void>;
  /**
   * В фокусе ли текстовый редактор ЭТОГО документа.
   *
   * Функция, а не флаг: фокус меняется чаще, чем документ, и опрашивать его надо в момент
   * решения. Про Monaco здесь не знает никто — ответ даёт тот, кто редактор нарисовал.
   * По умолчанию «не в фокусе»: документ без редактора перерисовывается всегда.
   */
  readonly isTextEditorFocused?: () => boolean;
  /** Куда уходит ошибка разбора. Форма совпадает с `DiagnosticsService.publish`. */
  readonly diagnostics?: DiagnosticsSink;
  readonly selection?: readonly NodeId[];
  readonly historyLimit?: number;
}

/** Документ этого вида. Предикат, а не сравнение поля: сужает союз на месте вызова. */
export function isTextDocument(document: Document): document is TextDocument {
  return document.kind === 'text';
}

export function isModelDocument<M = unknown>(document: Document): document is ModelDocument<M> {
  return document.kind === 'model';
}

/** Отказ разбора при создании модельного документа. */
export class ModelParseError extends Error {
  readonly failure: ParseFailure;

  constructor(failure: ParseFailure) {
    super(`провайдер «${failure.providerId}» не разобрал содержимое: ${failure.message}`);
    this.name = 'ModelParseError';
    this.failure = failure;
  }
}

function toFailure(providerId: string, error: unknown): ParseFailure {
  return {
    providerId,
    message: error instanceof Error ? error.message : String(error),
    error,
  };
}

function parseDiagnostic(failure: ParseFailure): Diagnostic {
  return {
    source: PARSE_DIAGNOSTIC_SOURCE,
    severity: 'error',
    code: 'document.parse-failed',
    params: { provider: failure.providerId, message: failure.message },
    // Цель — ресурс целиком: смещение ошибки знает разбор, а не ядро, и додумывать диапазон
    // здесь означало бы показывать волнистую линию не там, где сломано.
    target: { kind: 'resource' },
  };
}

/**
 * Надстраивает модель над буфером документа.
 *
 * @throws {@link ModelParseError} если начальный буфер не разбирается. Документ с моделью
 *   обязан иметь «последнюю валидную модель» с первой секунды: без неё структурный редактор
 *   открылся бы на пустоте, а расхождение стало бы состоянием, из которого нет выхода назад.
 *   Открытие такого файла — {@link attachDocumentModel}, и он остаётся текстовым.
 */
export function createModelDocument<M>(options: ModelDocumentOptions<M>): ModelDocumentHandle<M> {
  const { document: buffer, provider, writeText } = options;
  const focused = options.isTextEditorFocused ?? ((): boolean => false);
  const diagnostics = options.diagnostics;
  const history: ModelHistory<M> = createModelHistory<M>({ limit: options.historyLimit });

  const initialText = buffer.getText();
  let model: M;
  try {
    model = provider.parse(initialText);
  } catch (err) {
    throw new ModelParseError(toFailure(provider.id, err));
  }

  let selection: readonly NodeId[] = options.selection ?? [];
  /**
   * Отказ разбора — ЕДИНСТВЕННЫЙ носитель расхождения: `syncState` из него выводится.
   * Два поля рядом допускали бы состояние «разошлись, но причина неизвестна», которого нет.
   */
  let failure: ParseFailure | undefined;
  /**
   * Текст, которому соответствует текущая модель.
   *
   * Это и есть защита от кольца «печать → запись → событие буфера → разбор → новая модель».
   * Разбор своего же вывода вернул бы РАВНУЮ, но другую модель — и structural sharing,
   * ради которого всё это затевалось, пропал бы на первой же правке.
   */
  let modelText = initialText;
  /**
   * Тексты, отправленные в буфер, чьё эхо ещё не вернулось.
   *
   * Одного `modelText` мало: `writeText` асинхронен, и пока запись в пути, модель может уехать
   * дальше. Тогда вернувшееся эхо перестало бы совпадать с `modelText`, документ принял бы
   * собственную печать за правку пользователя и переразобрал бы её — потеряв и structural
   * sharing, и саму последнюю правку (буфер сравнялся бы с уже устаревшим текстом).
   */
  const echoes: string[] = [];
  /** Перерисовка буфера отложена: редактор в фокусе. */
  let pending = false;
  /** Идущая запись буфера; `undefined` — записывать нечего. */
  let writing: Promise<void> | undefined;

  const listeners = new Set<(change: ModelChange<M>) => void>();

  const syncState = (): DocumentSyncState => (failure === undefined ? 'synced' : 'diverged');

  const notify = (reason: ModelChangeReason): void => {
    const change: ModelChange<M> = { model, selection, syncState: syncState(), reason };
    for (const listener of [...listeners]) {
      try {
        listener(change);
      } catch (err) {
        // Упавший подписчик не отменяет уже совершённую правку — политика та же, что в `document.ts`.
        console.error('[document.model] подписчик модели упал; правка не отменена', err);
      }
    }
  };

  const publish = (items: readonly Diagnostic[]): void => {
    diagnostics?.publish(buffer.id, PARSE_DIAGNOSTIC_SOURCE, items);
  };

  /**
   * Догоняет буфер за моделью, пока есть чем.
   *
   * Цикл, а не очередь записей: несколько правок подряд дают несколько печатей, но записать
   * из них надо только ПОСЛЕДНЮЮ. Очередь отправила бы и промежуточные, а каждая промежуточная
   * запись — это лишний проход буфера туда и обратно.
   */
  const runWrites = async (): Promise<void> => {
    for (;;) {
      // Расхождение: буфер принадлежит пользователю, и печать модели в него не идёт.
      if (failure !== undefined) return;
      // Фокус мог вернуться, пока шла предыдущая запись, — тогда снова откладываем.
      if (focused()) {
        pending = true;
        return;
      }
      const text = modelText;
      if (text === buffer.getText()) return;
      // Отправленное запоминается ДО записи: событие буфера прилетит внутри `writeText`.
      echoes.push(text);
      try {
        await writeText(text);
      } finally {
        // Эхо не вернулось: запись отказала или буфер и так был такой. Ждать его больше нечего.
        const at = echoes.indexOf(text);
        if (at !== -1) echoes.splice(at, 1);
      }
      // За время записи модель могла уехать дальше: тогда идём на второй круг.
      if (modelText === text) return;
    }
  };

  const scheduleWrite = (): void => {
    // Уже пишем — свежую печать подхватит тот же цикл.
    if (writing !== undefined) return;
    writing = runWrites()
      .catch((err: unknown) => {
        // Отказ записи не рушит документ: модель осталась истиной, а буфер догонит следующей
        // перерисовкой. Диагностика записи — дело Workspace, у него есть и путь, и причина.
        console.error('[document.model] не удалось перерисовать буфер по модели', err);
      })
      .finally(() => {
        writing = undefined;
      });
  };

  /** Перерисовывает буфер из `print(model)` — или откладывает, если редактор в фокусе. */
  const serialize = (): void => {
    const text = provider.print(model);
    // Соответствие запоминается всегда, даже когда писать нечего: иначе следующее событие
    // буфера сочтёт наш же текст пользовательским и переразберёт его в новую модель.
    modelText = text;
    if (text === buffer.getText()) {
      pending = false;
      return;
    }
    if (focused()) {
      pending = true;
      return;
    }
    pending = false;
    scheduleWrite();
  };

  const subscription = buffer.onDidChangeContent((text) => {
    const echo = echoes.indexOf(text);
    if (echo !== -1) {
      // Вернулась наша же печать. Разбирать её нельзя: разбор дал бы РАВНУЮ, но другую модель,
      // и structural sharing, ради которого модельный документ и существует, пропал бы.
      echoes.splice(echo, 1);
      // Отставшая запись догнала модель и заодно затёрла то, на чём документ разошёлся:
      // буфер снова сериализация модели, расхождения больше нет.
      if (text === modelText && failure !== undefined) {
        failure = undefined;
        publish([]);
        notify('parse');
      }
      return;
    }
    // Буфер и так соответствует модели: печатать и разбирать нечего.
    if (text === modelText) return;

    // Буфер изменил кто-то другой — отложенная перерисовка отменяется. Иначе `flush` затёр бы
    // тем, что человек уже перепечатал, и правка модели молча победила бы правку руками.
    pending = false;

    try {
      model = provider.parse(text);
      modelText = text;
      failure = undefined;
      publish([]);
    } catch (err) {
      // Модель НЕ трогаем: она держит последнее валидное состояние, и именно из него
      // документ починится, когда буфер снова начнёт разбираться.
      failure = toFailure(provider.id, err);
      publish([parseDiagnostic(failure)]);
    }
    // Текстовая правка — граница схлопывания: слить структурную правку до неё со структурной
    // после означало бы шаг отмены, перепрыгивающий через набранный руками текст.
    history.breakMerge();
    notify('parse');
  });

  const document: ModelDocument<M> = {
    kind: 'model',
    providerId: provider.id,
    id: buffer.id,
    ref: buffer.ref,
    // Буферные методы делегируются, а не копируются: `getText` обязан оставаться «тем, что
    // уйдёт в файл при сохранении», а копия отстала бы на первой же записи.
    getText: () => buffer.getText(),
    isDirty: () => buffer.isDirty(),
    onDidChangeContent: (cb) => buffer.onDidChangeContent(cb),
    getModel: () => model,
    getSyncState: syncState,
    getParseFailure: () => failure,
    getSelection: () => selection,
    isStructurallyEditable: () => failure === undefined,
    onDidChangeModel(cb) {
      listeners.add(cb);
      return toDisposable(() => {
        listeners.delete(cb);
      });
    },
  };

  const snapshot = (): ModelSnapshot<M> => ({ model, selection });

  const restore = (state: ModelSnapshot<M>, reason: ModelChangeReason): void => {
    model = state.model;
    selection = state.selection;
    notify(reason);
    serialize();
  };

  return {
    document,

    apply(op, applyOptions) {
      if (failure !== undefined) {
        // Единственное место, где расхождение видно снаружи как отказ. Проверять его здесь,
        // а не в редакторе, обязательно: операции приходят ещё и от ассистента, и от команд.
        return { status: 'rejected', reason: 'diverged', failure };
      }

      let result: ApplyResult<M>;
      try {
        result = provider.apply(model, op);
      } catch (err) {
        // Битая операция не должна портить документ: модель не тронута, состояние прежнее.
        return { status: 'rejected', reason: 'provider-error', error: err };
      }

      history.record(snapshot(), { mergeKey: applyOptions?.mergeKey });
      model = result.model;
      // «Куда смотреть после операции» знает только сама операция: вставка родила узел,
      // перемещение сместило его, удаление оставило соседа.
      if (result.focus !== undefined) selection = [result.focus];
      notify('apply');
      serialize();
      return { status: 'applied', ...result };
    },

    setSelection(next) {
      const same =
        next.length === selection.length && next.every((id, index) => id === selection[index]);
      if (same) return;
      selection = [...next];
      // В историю не пишется: выделение — не шаг правки, оно лишь ЕДЕТ вместе со снимком.
      notify('selection');
    },

    undo() {
      // В расхождении отмена запрещена по той же причине, что и правка: перерисовка вернула бы
      // буферу старый текст поверх того, что пользователь ещё не дописал.
      if (failure !== undefined) return false;
      const state = history.undo(snapshot());
      if (state === undefined) return false;
      restore(state, 'undo');
      return true;
    },

    redo() {
      if (failure !== undefined) return false;
      const state = history.redo(snapshot());
      if (state === undefined) return false;
      restore(state, 'redo');
      return true;
    },

    // Расхождение входит в ответ, потому что в нём отказывают и `undo`, и `redo`:
    // читатель этих предикатов спрашивает «сработает ли», а не «есть ли записи в стеке».
    canUndo: () => failure === undefined && history.canUndo(),
    canRedo: () => failure === undefined && history.canRedo(),

    breakUndoMerge() {
      history.breakMerge();
    },

    async flush() {
      // Отложенное выполняется, если причина откладывать отпала: `runWrites` сам проверит
      // и фокус, и расхождение — вызвать `flush` при живом фокусе безопасно.
      if (pending) {
        pending = false;
        scheduleWrite();
      }
      await writing;
    },

    hasPendingSync: () => pending,

    dispose() {
      subscription.dispose();
      listeners.clear();
      history.clear();
    },
  };
}

/** Документ и, если он модельный, ручки к нему. */
export type Attached<M = unknown> =
  | { readonly document: TextDocument; readonly handle?: undefined }
  | { readonly document: ModelDocument<M>; readonly handle: ModelDocumentHandle<M> };

export interface AttachOptions {
  /** Документ из `workspace.open`. */
  readonly document: Document;
  /** Реестр вкладов: годится и корневой, и вид плагина. */
  readonly extensions: Pick<ExtensionRegistry, 'get'>;
  readonly writeText: (text: string) => void | Promise<void>;
  readonly isTextEditorFocused?: () => boolean;
  readonly diagnostics?: DiagnosticsSink;
  readonly historyLimit?: number;
}

/**
 * Открывает документ во втором виде, если для его ресурса есть провайдер модели.
 *
 * Три исхода, и все три — нормальные:
 *
 * - провайдера нет → документ остаётся текстовым. Это и есть определение `TextDocument`:
 *   не «файл особого сорта», а «никто не вызвался»;
 * - провайдер есть и разбор удался → {@link ModelDocument} с ручками;
 * - провайдер есть, а разбор с первого раза не удался → документ остаётся ТЕКСТОВЫМ,
 *   и публикуется диагностика разбора. Расхождение — состояние документа, у которого модель
 *   когда-то была; у этого её не было ни секунды, и структурному редактору показывать нечего.
 */
export function attachDocumentModel(options: AttachOptions): Attached<unknown> {
  const { document } = options;
  if (!isTextDocument(document)) {
    throw new Error(`документ уже модельный: ${document.id}`);
  }

  // Проба над уже прочитанным текстом: содержимое читается один раз на всех кандидатов,
  // а не по разу на каждого.
  const probe = createEditorProbe(document.getText());
  const provider = resolveModelProvider(options.extensions, document.ref, probe);
  if (provider === undefined) return { document };

  try {
    const handle = createModelDocument<unknown>({
      document,
      provider,
      writeText: options.writeText,
      isTextEditorFocused: options.isTextEditorFocused,
      diagnostics: options.diagnostics,
      historyLimit: options.historyLimit,
    });
    options.diagnostics?.publish(document.id, PARSE_DIAGNOSTIC_SOURCE, []);
    return { document: handle.document, handle };
  } catch (err) {
    if (!(err instanceof ModelParseError)) throw err;
    options.diagnostics?.publish(document.id, PARSE_DIAGNOSTIC_SOURCE, [
      parseDiagnostic(err.failure),
    ]);
    return { document };
  }
}
