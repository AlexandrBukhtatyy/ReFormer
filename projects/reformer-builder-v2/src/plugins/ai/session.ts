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
 * @module plugins/ai/session
 */

import type { FormRules } from '@/lib/form-model/rules';
import type { Disposable, ResourceId } from '@/sdk';
import type { ChangeSet } from './core/changeset';

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
}

/**
 * Форма ДО хода — точка восстановления реплики пользователя.
 *
 * Правки ассистента применяются сразу, поэтому отменять их надо не «до применения», а после:
 * снимок возвращает форму такой, какой она была, когда запрос ещё не прозвучал.
 */
export interface TurnSnapshot {
  readonly resource: ResourceId;
  /** Текст буфера на начало хода. Им же проверяется конфликт при применении. */
  readonly text: string;
  /**
   * Правила на начало хода. Отдельно от текста, потому что и живут отдельно: ход, изменивший
   * ТОЛЬКО правила, иначе кнопкой «Восстановить» не отменялся бы вовсе.
   */
  readonly rules: FormRules;
}

/** Реплика диалога в интерфейсе. */
export interface ChatEntry {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly text: string;
  /** Есть только у реплики пользователя и только когда ход шёл по открытой форме. */
  readonly snapshot?: TurnSnapshot;
  /**
   * Рассуждение модели. Рядом с ответом, но отдельным полем: обратно в модель уходит только
   * `text` (`./history`), а на экране это свёрнутый блок. Смешать их в одно поле нельзя —
   * черновик мысли попал бы и в ленту как ответ, и в контекст следующего хода.
   */
  readonly reasoning: string;
  /** Вызовы инструментов, сделанные в рамках этой реплики. */
  readonly tools: readonly ToolLogEntry[];
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
}

const INITIAL: AiSessionState = Object.freeze({
  settingsOpen: false,
  status: 'idle',
  entries: Object.freeze([]),
  pending: null,
  conflict: false,
  error: null,
});

/** Хранилище сессии. Живёт вне React — как и остальные хранилища проекта. */
export interface AiSession {
  /** Снимок для `useSyncExternalStore`: та же ссылка, пока состояние не менялось. */
  get(): AiSessionState;
  subscribe(listener: () => void): Disposable;

  setSettingsOpen(open: boolean): void;
  /** Реплика пользователя плюс пустая реплика ассистента, которая наполняется по ходу. */
  startTurn(text: string, snapshot?: TurnSnapshot): void;
  appendText(chunk: string): void;
  appendReasoning(chunk: string): void;
  logTool(entry: ToolLogEntry): void;
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
  restoreTo(id: string): TurnSnapshot | null;
  /** Очистить диалог. */
  reset(): void;
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
        console.error('[plugins/ai] подписчик сессии упал', error);
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
    commit({ ...state, entries: [...state.entries.slice(0, -1), fn(last)] });
  };

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

    startTurn(text, snapshot) {
      commit({
        ...state,
        status: 'running',
        error: null,
        conflict: false,
        entries: [
          ...state.entries,
          {
            id: nextId(),
            role: 'user',
            text,
            reasoning: '',
            tools: [],
            ...(snapshot ? { snapshot } : {}),
          },
          { id: nextId(), role: 'assistant', text: '', reasoning: '', tools: [] },
        ],
      });
    },

    appendText(chunk) {
      updateLast((entry) => ({ ...entry, text: entry.text + chunk }));
    },

    appendReasoning(chunk) {
      updateLast((entry) => ({ ...entry, reasoning: entry.reasoning + chunk }));
    },

    logTool(entry) {
      updateLast((last) => ({ ...last, tools: [...last.tools, entry] }));
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
