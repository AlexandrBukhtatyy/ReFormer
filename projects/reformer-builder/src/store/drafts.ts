/**
 * Локальные копии черновиков: связывает стор редактора с {@link module:reformer-builder/io/draft-store}.
 * Черновик (см. `isDraft`) — вкладка без файла в проекте, поэтому её содержимое живёт только в
 * IndexedDB и восстанавливается после перезагрузки страницы.
 *
 * Запись идёт от подписки на стор с дебаунсом: сравниваются только сохраняемые поля (по ссылке —
 * состояние иммутабельно), так что выделение, hover и переключение вкладок записи не порождают.
 * Исчезнувший из состояния черновик удаляется из хранилища — закрытие вкладки безвозвратно.
 *
 * @module reformer-builder/store/drafts
 */

import { deleteDraft, saveDraft, type DraftRecord } from '../io/draft-store';
import { editorStore } from './editor-store';
import { isDraft, makeTab } from './reducers';
import type { EditorState, TabState } from './types';

/** Пауза между правкой и записью в IndexedDB: ввод в поле не должен дёргать хранилище. */
const DEBOUNCE_MS = 400;

/** Черновики состояния (id → вкладка). */
export function draftsOf(state: EditorState): Map<string, TabState> {
  const out = new Map<string, TabState>();
  for (const id of state.order) {
    const tab = state.tabs[id];
    if (tab && isDraft(tab)) out.set(id, tab);
  }
  return out;
}

/** Изменились ли сохраняемые поля вкладки (остальное — выделение, hover, история — не пишем). */
function changed(a: TabState, b: TabState): boolean {
  return (
    a.schema !== b.schema ||
    a.savedSchema !== b.savedSchema ||
    a.mock !== b.mock ||
    a.source !== b.source ||
    a.activeStep !== b.activeStep ||
    a.touched !== b.touched
  );
}

/** Что нужно записать и что удалить при переходе состояния `prev → next`. */
export interface DraftsDelta {
  /** Черновики к записи (новые и изменившиеся). */
  save: TabState[];
  /** id черновиков, которых в новом состоянии больше нет — их копии удаляются. */
  remove: string[];
}

/**
 * Что записать/удалить, чтобы хранилище догнало состояние `next`. `persisted` — снимок уже
 * записанных черновиков (id → вкладка на момент записи), а не предыдущее состояние редактора:
 * вкладка, которой в хранилище ещё нет, обязана попасть в `save`, даже если в сторе она давно.
 */
export function draftsDelta(persisted: Map<string, TabState>, next: EditorState): DraftsDelta {
  const before = persisted;
  const after = draftsOf(next);
  const save: TabState[] = [];
  for (const [id, tab] of after) {
    const old = before.get(id);
    if (!old || changed(old, tab)) save.push(tab);
  }
  const remove: string[] = [];
  for (const id of before.keys()) if (!after.has(id)) remove.push(id);
  return { save, remove };
}

/** Вкладка → запись хранилища. */
export function toRecord(tab: TabState, createdAt: number, updatedAt: number): DraftRecord {
  return {
    id: tab.id,
    source: tab.source,
    schema: tab.schema,
    savedSchema: tab.savedSchema,
    mock: tab.mock,
    activeStep: tab.activeStep,
    touched: tab.touched,
    createdAt,
    updatedAt,
  };
}

/**
 * Запись хранилища → вкладка. История не восстанавливается (не хранится), поэтому undo сразу
 * после перезагрузки ничего не отменит — dirty при этом сохраняется, он считается от `savedSchema`.
 */
export function toTab(record: DraftRecord): TabState {
  const tab = makeTab(record.id, record.source, record.schema);
  return {
    ...tab,
    savedSchema: record.savedSchema,
    mock: record.mock,
    activeStep: record.activeStep,
    touched: record.touched,
  };
}

/**
 * Включить автосохранение черновиков. `known` — уже лежащие в хранилище записи (их `createdAt`
 * переиспользуется, чтобы порядок вкладок не менялся от перезагрузки к перезагрузке).
 * Возвращает функцию отписки.
 */
export function startDraftSync(known: DraftRecord[] = []): () => void {
  const createdAt = new Map(known.map((r) => [r.id, r.createdAt]));
  // Базовая линия — только восстановленные вкладки: они уже лежат в хранилище. Черновик, который
  // успел появиться до подписки (стартовая схема), в неё не попадает и будет записан первым же
  // сбросом — иначе он молча остался бы без локальной копии.
  const knownIds = new Set(known.map((r) => r.id));
  const persisted = new Map<string, TabState>();
  for (const [id, tab] of draftsOf(editorStore.getState())) {
    if (knownIds.has(id)) persisted.set(id, tab);
  }
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    const { save, remove } = draftsDelta(persisted, editorStore.getState());
    const now = Date.now();
    for (const tab of save) {
      const born = createdAt.get(tab.id) ?? now;
      createdAt.set(tab.id, born);
      persisted.set(tab.id, tab);
      void saveDraft(toRecord(tab, born, now)).catch((e: unknown) => {
        console.warn('[reformer-builder] черновик не сохранён:', tab.id, e);
      });
    }
    for (const id of remove) {
      createdAt.delete(id);
      persisted.delete(id);
      void dropDraft(id);
    }
  };

  const schedule = () => {
    if (timer == null) timer = setTimeout(flush, DEBOUNCE_MS);
  };
  const unsubscribe = editorStore.subscribe(schedule);
  schedule(); // догнать то, что уже открыто
  return () => {
    if (timer != null) clearTimeout(timer);
    unsubscribe();
  };
}

/**
 * Удалить локальную копию немедленно (закрытие вкладки: пользователь уже подтвердил, ждать
 * дебаунс нельзя — он не переживёт перезагрузку сразу после закрытия).
 */
export function dropDraft(id: string): Promise<void> {
  return deleteDraft(id).catch((e: unknown) => {
    console.warn('[reformer-builder] черновик не удалён:', id, e);
  });
}
