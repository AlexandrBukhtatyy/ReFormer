/**
 * Состояние сессии ассистента — отдельный стор, не часть `editorStore`.
 *
 * Разделение принципиальное: `editorStore` отвечает за документ (вкладки, схема, история,
 * выделение), а диалог, статус хода и ожидающий решения набор изменений к документу не относятся
 * и не должны попадать ни в историю, ни в черновики вкладок.
 *
 * @module reformer-builder/agent/session
 */

import { useSyncExternalStore } from 'react';
import { createStore } from '../store/create-store';
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
  name: string;
  ok: boolean;
  /** Что изменилось — строка журнала операций. */
  summary?: string;
  error?: string;
}

/** Реплика диалога в интерфейсе. */
export interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Вызовы инструментов, сделанные в рамках этой реплики. */
  tools: ToolLogEntry[];
}

/**
 * Состояние панели ассистента.
 *
 * Видимости здесь НЕТ намеренно: показана панель или нет — решает раскладка оболочки
 * (`ui.rightPanel === 'agent'`). Отдельный флаг был бы вторым источником истины и рано или поздно
 * разошёлся бы с первым — например, при переключении зоны на инспектор.
 */
export interface AgentSessionState {
  /** Показана форма настройки канала вместо ленты диалога. Управляется кнопкой в шапке панели. */
  settingsOpen: boolean;
  status: AgentStatus;
  entries: ChatEntry[];
  /** Набор изменений, ожидающий Применить/Отклонить. */
  pending: ChangeSet | null;
  /** Черновик разошёлся с активной вкладкой: пользователь правил форму во время хода. */
  conflict: boolean;
  error: string | null;
}

const INITIAL: AgentSessionState = {
  settingsOpen: false,
  status: 'idle',
  entries: [],
  pending: null,
  conflict: false,
  error: null,
};

export const agentSessionStore = createStore<AgentSessionState>(INITIAL);

let counter = 0;
/** Идентификатор реплики. Счётчик, а не случайность: ключи React должны быть воспроизводимы в тестах. */
function nextId(): string {
  counter += 1;
  return `m${counter}`;
}

/** Изменить последнюю реплику ассистента (её текст и журнал растут по ходу). */
function updateLast(
  state: AgentSessionState,
  fn: (entry: ChatEntry) => ChatEntry
): AgentSessionState {
  const last = state.entries.at(-1);
  if (!last || last.role !== 'assistant') return state;
  return { ...state, entries: [...state.entries.slice(0, -1), fn(last)] };
}

export const agentSessionActions = {
  toggleSettings: () =>
    agentSessionStore.setState((s) => ({ ...s, settingsOpen: !s.settingsOpen })),
  setSettings: (settingsOpen: boolean) =>
    agentSessionStore.setState((s) => ({ ...s, settingsOpen })),

  /** Реплика пользователя + пустая реплика ассистента, которая наполняется по ходу. */
  startTurn: (text: string) =>
    agentSessionStore.setState((s) => ({
      ...s,
      status: 'running',
      error: null,
      conflict: false,
      entries: [
        ...s.entries,
        { id: nextId(), role: 'user', text, tools: [] },
        { id: nextId(), role: 'assistant', text: '', tools: [] },
      ],
    })),

  appendText: (chunk: string) =>
    agentSessionStore.setState((s) => updateLast(s, (e) => ({ ...e, text: e.text + chunk }))),

  logTool: (entry: ToolLogEntry) =>
    agentSessionStore.setState((s) => updateLast(s, (e) => ({ ...e, tools: [...e.tools, entry] }))),

  /** Ход завершён: изменения (если есть) уходят на подтверждение. */
  finishTurn: (pending: ChangeSet | null, error?: string) =>
    agentSessionStore.setState((s) => ({
      ...s,
      status: error ? 'error' : pending ? 'review' : 'idle',
      pending,
      error: error ?? null,
    })),

  /** Пометить, что активная вкладка разошлась с базой хода. */
  setConflict: (conflict: boolean) => agentSessionStore.setState((s) => ({ ...s, conflict })),

  /** Решение по набору изменений принято. */
  resolvePending: () =>
    agentSessionStore.setState((s) => ({
      ...s,
      pending: null,
      conflict: false,
      status: 'idle',
    })),

  /** Очистить диалог (кнопка «Новый разговор»). */
  reset: () => agentSessionStore.setState({ ...INITIAL }),
};

/** Подписка на состояние панели. */
export function useAgentSession(): AgentSessionState {
  return useSyncExternalStore(
    agentSessionStore.subscribe,
    () => agentSessionStore.getState(),
    () => agentSessionStore.getState()
  );
}
