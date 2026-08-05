/**
 * Старт сессии редактора: восстановить черновики из локального хранилища, включить их
 * автосохранение и, если восстанавливать нечего, показать стартовую схему.
 *
 * Демо-схема показывается один раз на браузер (флаг в localStorage): после того как пользователь
 * её закрыл — вместе с локальной копией и подтверждением, что это безвозвратно — возвращать её
 * на следующей перезагрузке было бы враньём.
 *
 * @module reformer-builder/app/draft-actions
 */

import { loadDrafts } from '../io/draft-store';
import { editorActions, editorStore, startDraftSync, toTab } from '../store';
import { emptySchema } from '../model';
import { getRuntimeConfig } from '../config/state';
import { seedSchema } from './seed-schema';

/** Флаг «стартовую схему уже показывали» — чтобы закрытая демо-вкладка не воскресала. */
const SEEDED_KEY = 'rb.seeded';

function alreadySeeded(): boolean {
  try {
    return localStorage.getItem(SEEDED_KEY) != null;
  } catch {
    return false; // приватный режим/отключённое хранилище — просто сеем как в первый раз
  }
}

function markSeeded(): void {
  try {
    localStorage.setItem(SEEDED_KEY, '1');
  } catch {
    /* хранилище недоступно — не критично */
  }
}

/**
 * Стартовая схема (Mode A). Клиентский конфиг `project.seedSchema`: объект → кастомный seed;
 * `null` → пустая форма; поле отсутствует → встроенная демо-схема.
 */
function openSeedTab(): void {
  const seed = getRuntimeConfig().project?.seedSchema;
  const schema = seed === undefined ? seedSchema() : (seed ?? emptySchema());
  const name = seed === undefined ? 'credit-application.form.json' : 'untitled.form.json';
  editorActions.openTab(name, { kind: 'new', name }, schema);
}

/**
 * Восстановить черновики и включить их автосохранение; при пустом редакторе — открыть стартовую
 * схему. Возвращает функцию отписки от автосохранения.
 */
export async function bootstrapDrafts(): Promise<() => void> {
  const drafts = await loadDrafts();
  if (drafts.length) editorActions.restoreTabs(drafts.map(toTab));
  // Подписываемся ПОСЛЕ восстановления: иначе восстановленные вкладки посчитались бы новыми
  // и были бы переписаны заново.
  const stop = startDraftSync(drafts);
  if (!editorStore.getState().activeTabId && !alreadySeeded()) {
    markSeeded();
    openSeedTab();
  }
  return stop;
}
