/**
 * Локальные копии черновиков — вкладок, за которыми нет файла в проекте (Mode A и правленый
 * предпросмотр шаблона). Хранятся в IndexedDB, чтобы пережить перезагрузку страницы: другого
 * места у них нет, ⌘S для них — экспорт скачиванием, а не запись на диск.
 *
 * Копия живёт ровно столько, сколько открыта вкладка: её закрытие удаляет запись безвозвратно
 * (подтверждение — `app/close-actions`). Схема кладётся как есть (structured clone), поэтому
 * снаружи нужен только id вкладки.
 *
 * База и версионирование — общие для билдера ({@link ./idb}).
 *
 * @module reformer-builder/io/draft-store
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type { MockDraft, TabSource } from '../store/types';
import { DRAFTS_STORE, idbTx } from './idb';

/**
 * Запись черновика. Хранит только то, что нельзя восстановить заново: схему, baseline для dirty,
 * правки мок-данных и позицию в форме. История undo/redo не сохраняется — снимки схем весят
 * непропорционально пользе от них после перезагрузки.
 */
export interface DraftRecord {
  /** id вкладки (он же ключ записи). */
  id: string;
  /** Происхождение вкладки — `new` либо `template`; файловых черновиков не бывает. */
  source: TabSource;
  /** Текущая схема. */
  schema: JsonFormSchema;
  /** Baseline для dirty (последний экспорт). */
  savedSchema: JsonFormSchema;
  /** Правки мок-данных превью. */
  mock?: MockDraft;
  /** Активный шаг wizard. */
  activeStep: number;
  /** Были ли правки схемы (предпросмотр шаблона становится черновиком только после первой). */
  touched: boolean;
  /** Момент появления черновика — задаёт порядок восстановления вкладок. */
  createdAt: number;
  /** Момент последней записи. */
  updatedAt: number;
}

/**
 * Все черновики в порядке появления (он же порядок вкладок — таб-бар всегда добавляет справа).
 * Недоступная IndexedDB (приватный режим, отключённое хранилище) — не ошибка: пустой список,
 * билдер работает как раньше, просто без переживания перезагрузки.
 */
export async function loadDrafts(): Promise<DraftRecord[]> {
  try {
    const all = await idbTx<DraftRecord[]>(DRAFTS_STORE, 'readonly', (s) => s.getAll());
    return all.sort((a, b) => a.createdAt - b.createdAt);
  } catch (e) {
    console.warn('[reformer-builder] черновики недоступны:', e);
    return [];
  }
}

/** Записать/перезаписать черновик. */
export async function saveDraft(record: DraftRecord): Promise<void> {
  await idbTx(DRAFTS_STORE, 'readwrite', (s) => s.put(record, record.id));
}

/** Удалить локальную копию черновика (закрытие вкладки — операция безвозвратная). */
export async function deleteDraft(id: string): Promise<void> {
  await idbTx(DRAFTS_STORE, 'readwrite', (s) => s.delete(id));
}
