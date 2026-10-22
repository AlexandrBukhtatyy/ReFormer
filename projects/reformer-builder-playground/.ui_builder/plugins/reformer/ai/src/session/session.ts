/**
 * Состояние сессии ассистента: лента диалога, статус хода и набор, ждущий решения.
 *
 * ## Почему это отдельное хранилище, а не часть документа
 *
 * Диалог, статус хода и ожидающий решения набор изменений к ДОКУМЕНТУ не относятся: они не
 * должны попадать ни в буфер, ни в журнал, ни в историю отмены. Тот же вывод был сделан в v1
 * (`agent/session.ts` вне `editorStore`), и он здесь только усилился: в v2 документ живёт в
 * рабочей области, то есть в платформе, а диалог — предметное состояние плагина.
 *
 * Форма хранилища — та же, что у хранилищ оболочки и у сеанса редактора схемы: `get`/`subscribe`
 * со снимком, стабильным по ссылке. Читают его и компоненты через `useSyncExternalStore`, и
 * мост, который живёт вне React.
 *
 * ## Снимок берётся ТЕКСТОМ, а не схемой
 *
 * В v1 точкой восстановления была ссылка на иммутабельную схему вкладки. Здесь истина — буфер
 * рабочей области, поэтому снимок хранит ТЕКСТ: вернуть форму значит записать этот текст
 * обратно тем же `writeText`. Ссылка на разобранную схему точкой восстановления быть не может —
 * её нельзя сравнить с тем, что человек успел напечатать руками.
 *
 * @module plugins/reformer/ai/session/session
 */

import type { FormRules } from '../../../core/form-model';
import type { Disposable, ResourceId } from '@reformer/builder-plugin-api';
import type { ChangeSet } from '../model/changeset';
import type { AskAnswer, AskQuestion } from '../model/types';
import type { RulesFileBase } from './rules-file';

/** Что делает ассистент прямо сейчас. */
export type AgentStatus =
  /** Ждёт запроса. */
  | 'idle'
  /** Идёт ход: модель думает и вызывает инструменты. */
  | 'running'
  /** Ход закончен, изменения ждут решения пользователя. */
  | 'review'
  /** Ход прервался ошибкой. */
  | 'error';

/** Показанный пользователю вызов инструмента. */
export interface ToolLogEntry {
  readonly name: string;
  readonly ok: boolean;
  /** Что изменилось — строка журнала операций. */
  readonly summary?: string;
  readonly error?: string;
  /**
   * Инструмент только читает. Упавшее чтение форму не задевает, а упавшая правка — задевает:
   * по этому признаку мост отличает ход «все правки отказали» от хода, где модель лишь смотрела.
   */
  readonly readOnly?: boolean;
}

/**
 * Форма ДО хода — точка восстановления реплики пользователя.
 *
 * Правки ассистента применяются сразу, поэтому отменять их надо не «до применения», а после:
 * снимок возвращает форму такой, какой она была, когда запрос ещё не прозвучал.
 */
export interface TurnSnapshot {
  readonly resource: ResourceId;
  /**
   * Путь документа формы от корня проекта. По нему реплика показывает, какую форму правил ход,
   * а следующий ход узнаёт, что пользователь переключился на другую форму.
   */
  readonly path?: string;
  /** Текст буфера на начало хода. Им же проверяется конфликт при применении. */
  readonly text: string;
  /**
   * Правила на начало хода. Отдельно от текста, потому что и живут отдельно: ход, изменивший
   * ТОЛЬКО правила, иначе кнопкой «Восстановить» не отменялся бы вовсе.
   */
  readonly rules: FormRules;
  /**
   * Идентификатор хода. Форму возвращает текст, а записи инструментов плагинов этого хода и
   * следующих мост находит по нему. Нет — у реплик, начатых до того, как ход его получил.
   */
  readonly txId?: string;
}

/**
 * Точка восстановления хода РЕЖИМА ФАЙЛОВ.
 *
 * Текста здесь нет: ход правит сколько угодно файлов модуля, и что было до него, помнит мост —
 * журналом хода по `txId`. Снимок только называет ход, к состоянию до которого вернуться.
 */
export interface FilesTurnSnapshot {
  readonly mode: 'files';
  /** Документ формы, по модулю которого шёл ход. */
  readonly resource: ResourceId;
  /** Путь документа формы от корня проекта — см. {@link TurnSnapshot.path}. */
  readonly path?: string;
  /** Идентификатор хода — по нему мост находит журнал. */
  readonly txId: string;
}

/** Путь формы, которую правил ход реплики, — у реплик без формы его нет. */
export function snapshotPath(entry: Pick<ChatEntry, 'snapshot'>): string | undefined {
  return entry.snapshot?.path;
}

/** Точка восстановления реплики — структурного хода или хода режима файлов. */
export type EntrySnapshot = TurnSnapshot | FilesTurnSnapshot;

/** Снимок ли это хода режима файлов. */
export function isFilesSnapshot(snapshot: EntrySnapshot): snapshot is FilesTurnSnapshot {
  return 'mode' in snapshot && snapshot.mode === 'files';
}

/**
 * Ресурс, прикреплённый к реплике: адрес и имя для чипа.
 *
 * Содержимое здесь не хранится: оно читается в момент отправки и уходит модели только в своём
 * ходе, а дальше в истории остаётся ссылкой — иначе один прикреплённый файл вытеснял бы из
 * бюджета истории весь разговор.
 */
export interface AttachmentRef {
  readonly uri: string;
  readonly name: string;
  /** Прочитать не удалось — чип показывает это вместо молчаливого пропуска. */
  readonly error?: string;
}

/** Предел вложений на одну реплику. */
export const ATTACHMENT_LIMIT = 8;

/** Чем кончилась попытка прикрепить. */
export type AttachOutcome = 'attached' | 'duplicate' | 'limit';

/**
 * Карточка вопросов модели — один вызов `ask_user`.
 *
 * Живёт в реплике ассистента, а не отдельным состоянием: вопрос — часть ответа модели, и в ленте
 * он стоит там, где модель его задала, а после ответа остаётся там же — с ответом.
 */
export interface AskCard {
  readonly id: string;
  readonly questions: readonly AskQuestion[];
  /** Ответы по порядку вопросов — когда человек ответил. */
  readonly answers?: readonly AskAnswer[];
  /** Ход остановили, не дождавшись ответа. */
  readonly cancelled?: true;
}

/** Реплика диалога в интерфейсе. */
export interface ChatEntry {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly text: string;
  /** Ресурсы, прикреплённые к реплике пользователя. */
  readonly attachments?: readonly AttachmentRef[];
  /** Есть только у реплики пользователя и только когда ход шёл по открытой форме. */
  readonly snapshot?: EntrySnapshot;
  /**
   * Рассуждение модели. Рядом с ответом, но отдельным полем: обратно в модель уходит только
   * `text` (`./history`), а на экране это свёрнутый блок. Смешать их в одно поле нельзя —
   * черновик мысли попал бы и в ленту как ответ, и в контекст следующего хода.
   */
  readonly reasoning: string;
  /** Вызовы инструментов, сделанные в рамках этой реплики. */
  readonly tools: readonly ToolLogEntry[];
  /** Вопросы модели человеку — по карточке на вызов `ask_user`. */
  readonly asks?: readonly AskCard[];
}

/**
 * Карточка, ждущая ответа, или `null`. Ждать может только карточка идущего хода — в последней
 * реплике ассистента.
 */
export function openAskOf(state: AiSessionState): AskCard | null {
  if (state.status !== 'running') return null;
  const last = state.entries.at(-1);
  if (last?.role !== 'assistant') return null;
  return last.asks?.find((card) => card.answers === undefined && card.cancelled !== true) ?? null;
}

/** Набор изменений, ждущий решения, вместе с адресом, к которому его применять. */
export interface PendingChanges {
  readonly set: ChangeSet;
  readonly resource: ResourceId;
  /** Текст буфера на начало хода: с ним сверяется расхождение перед применением. */
  readonly baseText: string;
  /**
   * Идентификатор хода — он же `txId` записи журнала.
   *
   * Живёт здесь, а не в мосте, потому что набор переживает ход: кнопку «Применить» жмут
   * когда угодно после, и к этому моменту у моста не осталось ничего от той попытки. Без
   * него запись отложенного применения принадлежала бы неизвестно какому ходу.
   */
  readonly txId?: string;
  /**
   * Файл правил формы на начало хода — куда писать правила набора и с чем сверять расхождение.
   * Нет — у платформы нет файлового доступа, и правила живут только в памяти моста.
   */
  readonly rulesFile?: RulesFileBase;
}

/**
 * Состояние панели ассистента.
 *
 * Видимости здесь НЕТ намеренно: показана панель или нет — решает оболочка по `when` вклада.
 * Отдельный флаг был бы вторым источником истины и рано или поздно разошёлся бы с первым.
 */
export interface AiSessionState {
  /** Показана форма настройки канала вместо ленты диалога. */
  readonly settingsOpen: boolean;
  readonly status: AgentStatus;
  readonly entries: readonly ChatEntry[];
  /** Набор изменений, ожидающий «Применить / Отклонить». */
  readonly pending: PendingChanges | null;
  /** Буфер разошёлся с базой хода: форму правили руками, пока ассистент работал. */
  readonly conflict: boolean;
  readonly error: string | null;
  /** Прикреплённое к следующей реплике — чипы над полем ввода. */
  readonly attachments: readonly AttachmentRef[];
  /**
   * Есть ход, который можно отменить «Отменить последний ход».
   *
   * В состоянии сессии, хотя знает об этом мост: кнопка в шапке перерисовывается по изменениям
   * сессии, а мост запоминает ход и после последнего изменения ленты — в `finally` хода. Кнопка,
   * спрашивавшая мост в момент перерисовки, оставалась недоступной до случайной перерисовки.
   */
  readonly undoable: boolean;
}

const INITIAL: AiSessionState = Object.freeze({
  settingsOpen: false,
  status: 'idle',
  entries: Object.freeze([]),
  pending: null,
  conflict: false,
  error: null,
  attachments: Object.freeze([]),
  undoable: false,
});

/** Хранилище сессии. Живёт вне React — как и остальные хранилища проекта. */
export interface AiSession {
  /** Снимок для `useSyncExternalStore`: та же ссылка, пока состояние не менялось. */
  get(): AiSessionState;
  subscribe(listener: () => void): Disposable;

  setSettingsOpen(open: boolean): void;
  /** Есть ли ход, который можно отменить, — ставит мост, см. {@link AiSessionState.undoable}. */
  setUndoable(undoable: boolean): void;
  /** Прикрепить ресурс к следующей реплике. Тот же адрес второй раз не прикрепляется. */
  attach(ref: AttachmentRef): AttachOutcome;
  /** Открепить ресурс от следующей реплики. */
  detach(uri: string): void;
  /**
   * Реплика пользователя плюс пустая реплика ассистента, которая наполняется по ходу.
   * Прикреплённое к реплике уходит с ней (`attachments`), а поле вложений освобождается.
   */
  startTurn(text: string, snapshot?: EntrySnapshot, attachments?: readonly AttachmentRef[]): void;
  /**
   * Ход перешёл на другую форму — на созданную им: снимок реплики пользователя становится снимком
   * новой формы. По нему «Восстановить» вернёт её к состоянию сразу после создания, а следующий
   * ход узнает, о какой форме был этот.
   */
  retarget(snapshot: EntrySnapshot): void;
  /**
   * Дописать кусок ответа. `start` — кусок открывает новый блок (шаг хода, вторая попытка): перед
   * ним встаёт пустая строка. Ведущие пустые строки блока отбрасываются — модели часто начинают
   * рассуждение переводом строки, и в ленте это выглядело дырой над текстом.
   */
  appendText(chunk: string, start?: boolean): void;
  /** Дописать кусок рассуждения — по тем же правилам, что {@link appendText}. */
  appendReasoning(chunk: string, start?: boolean): void;
  logTool(entry: ToolLogEntry): void;
  /** Карточка вопросов модели — в текущую реплику ассистента. */
  askQuestions(card: AskCard): void;
  /** Ответ человека на карточку. `false` — карточки нет или на неё уже ответили. */
  answerAsk(id: string, answers: readonly AskAnswer[]): boolean;
  /** Снять неотвеченные карточки текущей реплики: ход остановлен, ответа не будет. */
  cancelAsks(): void;
  /** Ход завершён: набор (если остался) уходит на подтверждение, замечание — в статус ошибки. */
  finishTurn(pending: PendingChanges | null, error?: string): void;
  /** Пометить, что буфер разошёлся с базой хода. */
  setConflict(conflict: boolean): void;
  /** Решение по набору принято. */
  resolvePending(): void;
  /**
   * Откатить диалог к состоянию перед репликой: она и всё, что после неё, уходят из ленты.
   *
   * Переписка обрезается вместе с формой намеренно: реплики ниже описывают правки, которых
   * больше нет, и их присутствие заставило бы следующий ход строить поверх несуществующего.
   * Саму форму возвращает вызывающий — сессия рабочей областью не распоряжается.
   */
  restoreTo(id: string): EntrySnapshot | null;
  /** Очистить диалог. */
  reset(): void;
}

/**
 * Дописать кусок к тексту реплики.
 *
 * В начале текста и в начале блока ведущие пробелы и переводы строк отбрасываются; перед блоком,
 * идущим за уже написанным, встаёт пустая строка (если её там ещё нет).
 */
function joinChunk(current: string, chunk: string, blockStart: boolean): string {
  if (current !== '' && !blockStart) return current + chunk;
  const piece = chunk.replace(/^\s+/, '');
  if (piece === '') return current;
  if (current === '') return piece;
  const gap = current.endsWith('\n\n') ? '' : current.endsWith('\n') ? '\n' : '\n\n';
  return current + gap + piece;
}

/** Создать хранилище сессии. */
export function createAiSession(): AiSession {
  let state = INITIAL;
  const listeners = new Set<() => void>();
  let counter = 0;

  /** Идентификатор реплики. Счётчик, а не случайность: ключи React обязаны быть воспроизводимы. */
  const nextId = (): string => {
    counter += 1;
    return `m${counter}`;
  };

  const notify = (): void => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        // Упавший подписчик не отменяет состоявшегося изменения — политика хранилищ проекта.
        console.error('[plugins/reformer/ai] подписчик сессии упал', error);
      }
    }
  };

  const commit = (next: AiSessionState): void => {
    if (next === state) return;
    state = next;
    notify();
  };

  /** Изменить последнюю реплику ассистента: её текст и журнал растут по ходу. */
  const updateLast = (fn: (entry: ChatEntry) => ChatEntry): void => {
    const last = state.entries.at(-1);
    if (!last || last.role !== 'assistant') return;
    const next = fn(last);
    if (next === last) return;
    commit({ ...state, entries: [...state.entries.slice(0, -1), next] });
  };

  /**
   * Открыт ли новый блок, чей первый непустой кусок ещё не пришёл. Отдельно от реплики: блок
   * может начаться с одних переводов строки, и разрыв перед ним обязан дождаться текста.
   */
  const opened = { text: false, reasoning: false };

  return {
    get: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return {
        dispose: () => {
          listeners.delete(listener);
        },
      };
    },

    setSettingsOpen(settingsOpen) {
      commit({ ...state, settingsOpen });
    },

    setUndoable(undoable) {
      if (state.undoable !== undoable) commit({ ...state, undoable });
    },

    attach(ref) {
      if (state.attachments.some((known) => known.uri === ref.uri)) return 'duplicate';
      if (state.attachments.length >= ATTACHMENT_LIMIT) return 'limit';
      commit({ ...state, attachments: [...state.attachments, ref] });
      return 'attached';
    },

    detach(uri) {
      const attachments = state.attachments.filter((ref) => ref.uri !== uri);
      if (attachments.length !== state.attachments.length) commit({ ...state, attachments });
    },

    startTurn(text, snapshot, attachments) {
      opened.text = false;
      opened.reasoning = false;
      commit({
        ...state,
        status: 'running',
        error: null,
        conflict: false,
        attachments: INITIAL.attachments,
        entries: [
          ...state.entries,
          {
            id: nextId(),
            role: 'user',
            text,
            reasoning: '',
            tools: [],
            ...(snapshot ? { snapshot } : {}),
            ...(attachments?.length ? { attachments } : {}),
          },
          { id: nextId(), role: 'assistant', text: '', reasoning: '', tools: [] },
        ],
      });
    },

    retarget(snapshot) {
      let at = state.entries.length - 1;
      while (at >= 0 && state.entries[at].role !== 'user') at -= 1;
      if (at < 0) return;
      const entries = [...state.entries];
      entries[at] = { ...entries[at], snapshot };
      commit({ ...state, entries });
    },

    appendText(chunk, start = false) {
      if (start) opened.text = true;
      updateLast((entry) => {
        const text = joinChunk(entry.text, chunk, opened.text);
        if (text === entry.text) return entry;
        opened.text = false;
        return { ...entry, text };
      });
    },

    appendReasoning(chunk, start = false) {
      if (start) opened.reasoning = true;
      updateLast((entry) => {
        const reasoning = joinChunk(entry.reasoning, chunk, opened.reasoning);
        if (reasoning === entry.reasoning) return entry;
        opened.reasoning = false;
        return { ...entry, reasoning };
      });
    },

    logTool(entry) {
      updateLast((last) => ({ ...last, tools: [...last.tools, entry] }));
    },

    askQuestions(card) {
      updateLast((last) => ({ ...last, asks: [...(last.asks ?? []), card] }));
    },

    answerAsk(id, answers) {
      let answered = false;
      updateLast((last) => {
        const asks = last.asks?.map((card) => {
          if (card.id !== id || card.answers !== undefined || card.cancelled === true) return card;
          answered = true;
          return { ...card, answers };
        });
        return answered && asks ? { ...last, asks } : last;
      });
      return answered;
    },

    cancelAsks() {
      updateLast((last) => {
        if (!last.asks?.some((card) => card.answers === undefined && card.cancelled !== true)) {
          return last;
        }
        const asks = last.asks.map((card) =>
          card.answers === undefined ? { ...card, cancelled: true as const } : card
        );
        return { ...last, asks };
      });
    },

    finishTurn(pending, error) {
      commit({
        ...state,
        status: error !== undefined ? 'error' : pending ? 'review' : 'idle',
        pending,
        error: error ?? null,
      });
    },

    setConflict(conflict) {
      commit({ ...state, conflict });
    },

    resolvePending() {
      commit({ ...state, pending: null, conflict: false, status: 'idle' });
    },

    restoreTo(id) {
      const at = state.entries.findIndex((entry) => entry.id === id);
      if (at < 0) return null;
      const snapshot = state.entries[at].snapshot ?? null;
      commit({
        ...state,
        entries: state.entries.slice(0, at),
        pending: null,
        conflict: false,
        error: null,
        status: 'idle',
      });
      return snapshot;
    },

    reset() {
      commit({ ...INITIAL, settingsOpen: state.settingsOpen });
    },
  };
}
