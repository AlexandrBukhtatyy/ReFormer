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

import { toDisposable } from '@reformer/builder-plugin-api/internal';
import type { ExtensionRegistry } from '@reformer/builder-plugin-api/internal';
import type { Diagnostic } from '@reformer/builder-plugin-api/internal';
import type { Document } from '@reformer/builder-plugin-api/internal';
import type { Disposable, ResourceId, WriteOptions } from '@reformer/builder-plugin-api/internal';
import type { DiagnosticsSink } from '../workspace';
import { createModelHistory, type ModelHistory, type ModelSnapshot } from './history';
import { createEditorProbe, resolveModelProvider } from './provider';
import {
  type ApplyResult,
  type CompositionLayout,
  type DocumentModelProvider,
  type DocumentSyncState,
  type ModelChange,
  type ModelChangeReason,
  type ModelDocument,
  type ModelDocumentHandle as SdkModelDocumentHandle,
  type NodeId,
  type ParseFailure,
} from '@reformer/builder-plugin-api/internal';

/** Источник диагностик разбора: по нему `publish` замещает прошлый результат. */
export const PARSE_DIAGNOSTIC_SOURCE = 'document.model';

/** Документ без провайдера модели: истина — буфер. Это ровно то, что отдаёт Workspace. */
export interface TextDocument extends Document {
  readonly kind: 'text';
}

// Форма модельного документа — в SDK (`workspace/model/model-document`): редактор модели —
// плагин стека, и тип ручки у него обязан быть ТЕМ ЖЕ, что отдаёт оболочка, а не копией.
// Здесь — реализация и то, что принадлежит только владельцу: время жизни ручки.
export type {
  ApplyOptions,
  ApplyOutcome,
  ApplyRejection,
  DocumentSyncState,
  ModelChange,
  ModelChangeReason,
  ModelDocument,
  ParseFailure,
} from '@reformer/builder-plugin-api/internal';

/**
 * Ручка модельного документа вместе с временем жизни.
 *
 * `dispose` — только у владельца: ручку открыла оболочка вместе с вкладкой, и закрыть её
 * вправе только она. Плагины получают ту же ручку службой моделей — без этого метода.
 */
export interface ModelDocumentHandle<M> extends SdkModelDocumentHandle<M> {
  dispose(): void;
  /** Файлы частей, которые документ держит сейчас. У документа одним файлом — пусто. */
  parts(): readonly ResourceId[];
  /**
   * Части, выпавшие из документа (шаг удалили, форму собрали в один файл). Их файлы удаляются
   * при сохранении документа, а не сразу: удаление идёт мимо рабочей копии прямо в источник,
   * и отмена до сохранения должна возвращать часть без следа.
   */
  removedParts(): readonly ResourceId[];
  /** Эти части удалены (сохранением) — ждать их удаления больше не нужно. */
  forgetRemoved(ids: readonly ResourceId[]): void;
}

/**
 * Файлы частей составного документа — то, что документу нужно от рабочей области сверх буфера
 * корня. Внедряется, как и `writeText`: документ не знает ни рабочей области, ни путей.
 */
export interface ModelPartsPort {
  /** Тексты частей, прочитанные до открытия, по спецификатору ссылки. */
  readonly initial: ReadonlyMap<string, string>;
  /** Адрес части по спецификатору ссылки (относительно файла корня). */
  resolve(spec: string): ResourceId;
  /**
   * Записать часть в рабочую копию; несуществующий файл создаётся. `created` — части у документа
   * до этой записи не было (новый шаг, «разбить»): дереву проекта пора перечитать её каталог.
   */
  write(id: ResourceId, text: string, created: boolean, options?: WriteOptions): Promise<void>;
  /** Рабочая копия части; `null` — файла нет. */
  read(id: ResourceId): Promise<string | null>;
  /** Ресурсы рабочей области изменились: запись, слияние, откат. */
  onDidChange(cb: (ids: readonly ResourceId[]) => void): Disposable;
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
  readonly writeText: (text: string, options?: WriteOptions) => void | Promise<void>;
  /**
   * В фокусе ли текстовый редактор ЭТОГО документа.
   *
   * Функция, а не флаг: фокус меняется чаще, чем документ, и опрашивать его надо в момент
   * решения. Про конкретный редактор здесь не знает никто — ответ даёт реестр
   * `./text-editor-focus`, в который пишет каждый текстовый редактор, а сюда его сводит
   * композиция. По умолчанию «не в фокусе»: документ без редактора перерисовывается всегда.
   */
  readonly isTextEditorFocused?: () => boolean;
  /** Куда уходит ошибка разбора. Форма совпадает с `DiagnosticsService.publish`. */
  readonly diagnostics?: DiagnosticsSink;
  readonly selection?: readonly NodeId[];
  readonly historyLimit?: number;
  /**
   * Файлы частей — у провайдера с `composition`. Без порта документ одним файлом, даже если
   * провайдер умеет больше: читать части ему нечем.
   */
  readonly parts?: ModelPartsPort;
}

/** Модель вместе с раскладкой по файлам — единица истории отмены. */
interface Laid<M> {
  readonly model: M;
  readonly layout: CompositionLayout;
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
  // В снимке отмены — модель ВМЕСТЕ с раскладкой по файлам: «разбить по файлам» модель не
  // меняет, и без раскладки в снимке такой шаг было бы нечем отменить.
  const history: ModelHistory<Laid<M>> = createModelHistory<Laid<M>>({
    limit: options.historyLimit,
  });
  const composite =
    options.parts !== undefined && provider.composition !== undefined
      ? { port: options.parts, composition: provider.composition }
      : undefined;
  /**
   * Тексты частей, которым соответствует модель, — по спецификатору ссылки. Та же защита от
   * эха, что `modelText` у корня: вернувшаяся своя запись с этим текстом не разбирается.
   */
  const partTexts = new Map<string, string>();
  /** Части, выпавшие из документа: их файлы удаляются при сохранении. */
  const removed = new Map<string, ResourceId>();
  /** Части, которых нет в рабочей области: повторно не читаются, пока их не запишут. */
  const unavailable = new Set<string>();
  let layout: CompositionLayout = undefined;
  /**
   * Пометка записей последней правки (`ApplyOptions.write`): кто правит и каким шагом. Идёт
   * со ВСЕМИ файлами, которые правка трогает, — корнем и частями. Отмена и перестройка —
   * действия человека, у них пометки нет.
   */
  let mark: WriteOptions | undefined;

  const initialText = buffer.getText();
  let model: M;
  try {
    const root = provider.parse(initialText);
    if (composite === undefined) {
      model = root;
    } else {
      for (const spec of composite.composition.references(root)) {
        const text = composite.port.initial.get(spec);
        if (text !== undefined) partTexts.set(spec, text);
      }
      const composed = composite.composition.compose(root, partTexts);
      model = composed.model;
      layout = composed.layout;
    }
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
        await writeText(text, mark);
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

  /**
   * Раскладывает модель по файлам: части пишутся сразу (их редактор человек сейчас не держит),
   * выпавшие ждут сохранения. Возвращает модель корня.
   */
  const layOut = (): M => {
    if (composite === undefined) return model;
    const { port, composition } = composite;
    const laid = composition.decompose(model, layout);
    layout = laid.layout;
    const stale = new Set(partTexts.keys());
    for (const [spec, text] of laid.parts) {
      stale.delete(spec);
      removed.delete(spec);
      unavailable.delete(spec);
      const known = partTexts.get(spec);
      if (known === text) continue;
      // Соответствие запоминается ДО записи: событие рабочей области прилетит внутри неё.
      partTexts.set(spec, text);
      port.write(port.resolve(spec), text, known === undefined, mark).catch((err: unknown) => {
        console.error(`[document.model] не удалось записать часть «${spec}»`, err);
      });
    }
    for (const spec of stale) {
      partTexts.delete(spec);
      removed.set(spec, port.resolve(spec));
    }
    return laid.root;
  };

  /**
   * Перерисовывает буфер из `print(model)` — или откладывает, если редактор в фокусе.
   *
   * `root` — модель корня, уже разложенная {@link layOut} ДО уведомления подписчиков: они
   * спрашивают у документа его части, и ответ обязан описывать ту модель, о которой уведомили.
   */
  const serialize = (root: M = layOut()): void => {
    const text = provider.print(root);
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

  /**
   * Модель из разобранного корня: у составного документа — сборка с частями. Части, на которые
   * корень сослался впервые (ссылку дописали руками), дочитываются, и документ пересобирается.
   *
   * @throws если сборка не удалась — тем же путём, что неразбор корня.
   */
  const composeRoot = (root: M): void => {
    if (composite === undefined) {
      model = root;
      return;
    }
    const references = composite.composition.references(root);
    const missing = references.filter((spec) => !partTexts.has(spec) && !unavailable.has(spec));
    if (missing.length > 0) loadParts(missing);
    const composed = composite.composition.compose(root, partTexts);
    model = composed.model;
    layout = composed.layout;
    // Ссылку на часть убрали из корня руками — часть выпала из документа.
    const referenced = new Set(references);
    for (const spec of [...partTexts.keys()]) {
      if (referenced.has(spec)) continue;
      partTexts.delete(spec);
      removed.set(spec, composite.port.resolve(spec));
    }
  };

  /** Пересобрать документ из корня и частей — после внешней правки части. */
  const recompose = (): void => {
    // В расхождении истина корня — буфер; иначе — последняя печать модели (буфер мог отстать
    // из-за фокуса, и собирать из него значило бы потерять последнюю правку).
    const text = failure === undefined ? modelText : buffer.getText();
    try {
      composeRoot(provider.parse(text));
      modelText = text;
      if (failure !== undefined) {
        failure = undefined;
        publish([]);
      }
    } catch (err) {
      failure = toFailure(provider.id, err);
      publish([parseDiagnostic(failure)]);
    }
    history.breakMerge();
    notify('parse');
  };

  /** Дочитать части, на которые корень сослался впервые, и пересобрать документ. */
  const loadParts = (specs: readonly string[]): void => {
    if (composite === undefined) return;
    const { port } = composite;
    for (const spec of specs) unavailable.add(spec);
    void Promise.all(
      specs.map(async (spec) => {
        const text = await port.read(port.resolve(spec)).catch(() => null);
        if (text === null) return;
        unavailable.delete(spec);
        partTexts.set(spec, text);
      })
    ).then(recompose);
  };

  /**
   * Правка части со стороны: вкладка части, слияние, откат. Своя запись возвращается сюда же и
   * отсеивается сравнением с `partTexts` — как эхо корня.
   */
  const partsSubscription = composite?.port.onDidChange((ids) => {
    const { port } = composite;
    const touched = [...partTexts.keys(), ...unavailable].filter((spec) =>
      ids.includes(port.resolve(spec))
    );
    if (touched.length === 0) return;
    void (async () => {
      let changed = false;
      for (const spec of touched) {
        const text = await port.read(port.resolve(spec)).catch(() => null);
        unavailable.delete(spec);
        if (text === null) {
          changed = partTexts.delete(spec) || changed;
        } else if (partTexts.get(spec) !== text) {
          partTexts.set(spec, text);
          changed = true;
        }
      }
      if (changed) recompose();
    })().catch((err: unknown) => {
      console.error('[document.model] не удалось перечитать часть документа', err);
    });
  });

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
      composeRoot(provider.parse(text));
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
    getComposition:
      composite === undefined
        ? undefined
        : () => ({
            layout,
            parts: [...partTexts.keys()].map((spec) => composite.port.resolve(spec)),
          }),
    onDidChangeModel(cb) {
      listeners.add(cb);
      return toDisposable(() => {
        listeners.delete(cb);
      });
    },
  };

  const snapshot = (): ModelSnapshot<Laid<M>> => ({ model: { model, layout }, selection });

  const restore = (state: ModelSnapshot<Laid<M>>, reason: ModelChangeReason): void => {
    mark = undefined;
    model = state.model.model;
    layout = state.model.layout;
    selection = state.selection;
    const root = layOut();
    notify(reason);
    serialize(root);
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
      mark = applyOptions?.write;
      model = result.model;
      // «Куда смотреть после операции» знает только сама операция: вставка родила узел,
      // перемещение сместило его, удаление оставило соседа.
      if (result.focus !== undefined) selection = [result.focus];
      const root = layOut();
      notify('apply');
      serialize(root);
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

    restructure:
      composite === undefined
        ? undefined
        : (mode) => {
            if (failure !== undefined) return false;
            const { layout: next, parts } = composite.composition.decompose(model, layout, mode);
            const same =
              parts.size === partTexts.size &&
              [...parts.keys()].every((spec) => partTexts.has(spec));
            if (same) return false;
            history.record(snapshot());
            mark = undefined;
            layout = next;
            const root = layOut();
            notify('apply');
            serialize(root);
            return true;
          },

    parts: () =>
      composite === undefined
        ? []
        : [...partTexts.keys()].map((spec) => composite.port.resolve(spec)),

    removedParts: () => [...removed.values()],

    forgetRemoved(ids) {
      for (const [spec, id] of [...removed]) if (ids.includes(id)) removed.delete(spec);
    },

    dispose() {
      subscription.dispose();
      partsSubscription?.dispose();
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
  readonly writeText: (text: string, options?: WriteOptions) => void | Promise<void>;
  readonly isTextEditorFocused?: () => boolean;
  readonly diagnostics?: DiagnosticsSink;
  readonly historyLimit?: number;
  /** Части составного документа — из {@link preloadParts}. */
  readonly parts?: ModelPartsPort;
}

/** Доступ к файлам частей без прочитанных текстов — их дочитывает {@link preloadParts}. */
export type PartsAccess = Omit<ModelPartsPort, 'initial'>;

/**
 * Дочитать части документа ДО открытия: модель составного документа обязана собраться сразу —
 * у документа с моделью «последняя валидная модель» есть с первой секунды.
 *
 * Асинхронна, в отличие от {@link attachDocumentModel}: чтение рабочей копии — промис, а разбор
 * и сборка — нет. Отсюда два шага: прочитать здесь, собрать там.
 *
 * @returns Порт частей — у ресурса, чей провайдер умеет `composition`; иначе `undefined`.
 */
export async function preloadParts(
  document: Document,
  extensions: Pick<ExtensionRegistry, 'get'>,
  access: PartsAccess
): Promise<ModelPartsPort | undefined> {
  const text = document.getText();
  const provider = resolveModelProvider(extensions, document.ref, createEditorProbe(text));
  const composition = provider?.composition;
  if (provider === undefined || composition === undefined) return undefined;

  let references: readonly string[] = [];
  try {
    references = composition.references(provider.parse(text));
  } catch {
    // Корень не разбирается — документ откроется текстом, читать части незачем.
  }
  const initial = new Map<string, string>();
  for (const spec of references) {
    let id: ResourceId;
    try {
      id = access.resolve(spec);
    } catch {
      // Ссылка за корень источника: такой части нет, и сборка скажет об этом сама.
      continue;
    }
    const part = await access.read(id);
    if (part !== null) initial.set(spec, part);
  }
  return { ...access, initial };
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
      parts: options.parts,
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
