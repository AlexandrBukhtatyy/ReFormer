/**
 * Оркестрация Mode B (спека §7): открыть/переоткрыть проект → скан (обнаружение схем + резолв
 * prettier), открыть схему-файл, сохранить (валидация-гейт → diff-модалка → защищённая запись).
 * Мост между store и io; здесь же тосты.
 *
 * @module reformer-builder/app/save-actions
 */

import { toast } from '@reformer/ui-kit/sonner';
import { ensureSchema } from '../model';
import {
  fsAccessSupported,
  pickDirectory,
  ensurePermission,
  readFile,
  readPrettierConfigs,
} from '../io/fs-access';
import { saveDirHandle, loadDirHandle } from '../io/handle-store';
import { scanDirectory, formsOf, type TreeEntry } from '../io/discovery';
import { resolvePrinterOptions } from '../io/prettier-config';
import { prepareSave, commitSave, type SavePlan } from '../io/save';
import { downloadSchema } from '../io/export';
import { validateSchema } from '../io/validate';
import { editorActions } from '../store';
import type { TabState } from '../store';
import { projectActions, projectStore } from '../store/project-store';
import { saveDialogActions } from '../store/save-dialog';

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const isAbort = (e: unknown): boolean => e instanceof DOMException && e.name === 'AbortError';

/** Скан каталога: обнаружение схем + резолв prettier. */
async function scan(dir: FileSystemDirectoryHandle): Promise<void> {
  // Имя каталога показываем сразу (до конца скана), чтобы UI отреагировал на выбор.
  projectActions.set({ dirHandle: dir, dirName: dir.name, scanning: true, error: null, tree: [] });
  try {
    const [tree, configs] = await Promise.all([scanDirectory(dir), readPrettierConfigs(dir)]);
    const printer = resolvePrinterOptions(configs);
    projectActions.set({ tree, printer, scanning: false, canReopen: true, error: null });
    const forms = formsOf(tree).length;
    console.debug('[reformer-builder] scan', dir.name, '→ файлов/папок:', tree.length, 'схем:', forms);
    if (printer.notice) toast(printer.notice);
    toast(
      forms > 0
        ? `Найдено схем: ${forms} (записей: ${tree.length})`
        : `Схемы форм не найдены (записей: ${tree.length})`
    );
  } catch (e) {
    console.error('[reformer-builder] scan failed:', e);
    projectActions.set({ scanning: false, error: msg(e) });
    toast('Ошибка сканирования: ' + msg(e));
  }
}

/** «Открыть проект…» — пикер каталога + скан (спека §7.1). */
export async function openProject(): Promise<void> {
  console.debug('[reformer-builder] openProject, FS Access поддержка =', fsAccessSupported());
  if (!fsAccessSupported()) {
    toast('Нужен Chromium (File System Access API)');
    return;
  }
  let dir: FileSystemDirectoryHandle;
  try {
    console.debug('[reformer-builder] вызываю showDirectoryPicker…');
    dir = await pickDirectory();
    console.debug('[reformer-builder] выбран каталог:', dir.name);
  } catch (e) {
    console.warn('[reformer-builder] pickDirectory прервано/ошибка:', e);
    if (isAbort(e)) return;
    toast('Не удалось открыть проект: ' + msg(e));
    return;
  }
  // Сканируем СРАЗУ (UI обновляется), persist handle — в фоне (не блокирует и не валит скан).
  await scan(dir);
  void saveDirHandle(dir).catch((e) => {
    console.warn('[reformer-builder] persist handle failed:', e);
  });
}

/** «Переоткрыть <папка>» — handle из IndexedDB + подтверждение разрешения (спека §7.1 Q29). */
export async function reopenProject(): Promise<void> {
  const dir = await loadDirHandle();
  if (!dir) return;
  const ok = await ensurePermission(dir);
  if (!ok) {
    toast('Доступ к каталогу не подтверждён');
    return;
  }
  await scan(dir);
}

/** Проверить при старте, есть ли сохранённый каталог (показать «Переоткрыть»). */
export async function checkReopen(): Promise<void> {
  const dir = await loadDirHandle();
  projectActions.setCanReopen(dir != null);
}

/** Открыть распознанную схему из дерева во вкладке (read → parse → ensureSchema). */
export async function openSchemaFile(d: TreeEntry): Promise<void> {
  if (!d.handle) return;
  const handle = d.handle;
  try {
    const { text, lastModified } = await readFile(handle);
    const schema = ensureSchema(JSON.parse(text));
    editorActions.openTab(
      d.path,
      { kind: 'file', name: d.name, path: d.path, handle, rawText: text, lastModified },
      schema
    );
  } catch (e) {
    toast('Не удалось открыть схему: ' + msg(e));
  }
}

/** Триггер сохранения (Cmd+S / кнопка): валидация-гейт → Mode B diff-модалка или Mode A export. */
export async function triggerSave(tab: TabState): Promise<void> {
  const v = validateSchema(tab.schema);
  if (!v.valid) {
    toast(`Сохранение заблокировано: ${v.errors.length} ошибок`, { description: v.errors[0] });
    return;
  }
  if (tab.source.kind === 'file' && tab.source.handle) {
    try {
      const options = projectStore.getState().printer?.options ?? {};
      const plan = await prepareSave(tab, options);
      saveDialogActions.open(plan);
    } catch (e) {
      toast('Ошибка подготовки сохранения: ' + msg(e));
    }
  } else {
    downloadSchema(tab.schema, tab.source.name);
    editorActions.markSaved();
    toast('Схема экспортирована');
  }
}

/** Подтвердить запись из diff-модалки → защищённая запись + обновление baseline. */
export async function confirmSave(plan: SavePlan): Promise<void> {
  if (!plan.handle) {
    saveDialogActions.close();
    return;
  }
  saveDialogActions.setSaving(true);
  try {
    const lastModified = await commitSave(plan.handle, plan.newText);
    editorActions.commitSaved(plan.newText, lastModified);
    saveDialogActions.close();
    toast('Сохранено в файл');
  } catch (e) {
    saveDialogActions.setSaving(false);
    toast('Ошибка записи: ' + msg(e));
  }
}
