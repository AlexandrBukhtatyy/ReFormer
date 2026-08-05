/**
 * Состояние списка шаблонов форм: встроенный + локальные (IndexedDB) + проектные
 * (`.reformer/templates`, если проект открыт). Отдельный стор — как `project-store`, чтобы не
 * мешать редакторному.
 *
 * @module reformer-builder/store/templates-store
 */

import { useSyncExternalStore } from 'react';
import { loadLocalTemplates, loadProjectTemplates } from '../io/template-repo';
import { builtinTemplates, type FormTemplate } from '../templates';
import { createStore } from './create-store';
import { projectStore } from './project-store';

/** Состояние панели/диалогов шаблонов. */
export interface TemplatesState {
  /** Встроенные первыми, дальше проектные и локальные (по имени). */
  items: FormTemplate[];
  loading: boolean;
  /** Ошибка чтения хранилищ (показываем в панели). */
  error: string | null;
}

const initial: TemplatesState = { items: builtinTemplates(), loading: false, error: null };

export const templatesStore = createStore<TemplatesState>(initial);

const byName = (a: FormTemplate, b: FormTemplate): number => a.name.localeCompare(b.name);

/**
 * Перечитать все источники. Проектные читаются только при открытом проекте, поэтому вызывается
 * после скана проекта и после любых изменений шаблонов.
 */
export async function reloadTemplates(): Promise<void> {
  templatesStore.setState((s) => ({ ...s, loading: true }));
  const root = projectStore.getState().dirHandle;
  try {
    const [local, project] = await Promise.all([
      loadLocalTemplates(),
      root ? loadProjectTemplates(root) : Promise.resolve([]),
    ]);
    templatesStore.setState({
      items: [...builtinTemplates(), ...project.sort(byName), ...local.sort(byName)],
      loading: false,
      error: null,
    });
  } catch (e) {
    templatesStore.setState((s) => ({
      ...s,
      loading: false,
      error: e instanceof Error ? e.message : String(e),
    }));
  }
}

/** Подписаться на срез состояния шаблонов. */
export function useTemplates<T>(selector: (s: TemplatesState) => T): T {
  return useSyncExternalStore(
    templatesStore.subscribe,
    () => selector(templatesStore.getState()),
    () => selector(templatesStore.getState())
  );
}
