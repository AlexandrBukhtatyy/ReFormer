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
  writeFile,
  readPrettierConfigs,
} from '../io/fs-access';
import { saveDirHandle, loadDirHandle } from '../io/handle-store';
import {
  createDirectory,
  createFile,
  deletePath,
  joinPath,
  renamePath,
  uniqueName,
} from '../io/fs-ops';
import {
  formJsonTemplate,
  modelTsTemplate,
  validationTsTemplate,
  behaviorTsTemplate,
  uiTsTemplate,
  registryTsTemplate,
  indexTsxTemplate,
  resolveFormDirFiles,
  type FormDirFiles,
} from './form-templates';

export type { FormDirFiles } from './form-templates';
import { scanDirectory, formsOf, type TreeEntry } from '../io/discovery';
import { resolvePrinterOptions } from '../io/prettier-config';
import { prepareSave, commitSave, type SavePlan } from '../io/save';
import { downloadSchema } from '../io/export';
import { validateSchema } from '../io/validate';
import { effectiveMock } from '../canvas/mock-data';
import { dirPickerAvailable, exportExampleToDirectory } from '../codegen/deliver';
import { showValidationErrors } from './validation-toast';
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
    console.debug(
      '[reformer-builder] scan',
      dir.name,
      '→ файлов/папок:',
      tree.length,
      'схем:',
      forms
    );
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

/** Monaco-язык по расширению файла (подсветка). Незнакомое — plaintext. */
function languageOf(name: string): string {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    json: 'json',
    jsonc: 'json',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    htm: 'html',
    xml: 'xml',
    svg: 'xml',
    md: 'markdown',
    mdx: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
    sh: 'shell',
    bash: 'shell',
    py: 'python',
    sql: 'sql',
    toml: 'ini',
    ini: 'ini',
  };
  return map[ext] ?? 'plaintext';
}

/** Открыть произвольный (не-схемный) файл на редактирование в Monaco (code-вкладка, спека §7). */
export async function openCodeFile(d: TreeEntry): Promise<void> {
  if (!d.handle) return;
  const handle = d.handle;
  try {
    const { text, lastModified } = await readFile(handle);
    editorActions.openCodeTab(
      d.path,
      { kind: 'file', name: d.name, path: d.path, handle, rawText: text, lastModified },
      text,
      languageOf(d.name)
    );
  } catch (e) {
    toast('Не удалось открыть файл: ' + msg(e));
  }
}

/** Сохранить code-вкладку прямой записью в файл (без diff-модалки — она схемо-специфична). */
export async function saveCodeTab(tab: TabState): Promise<void> {
  if (tab.source.kind !== 'file' || !tab.source.handle || tab.text == null) {
    toast('Файл нельзя сохранить (нет доступа к файлу)');
    return;
  }
  try {
    await writeFile(tab.source.handle, tab.text);
    editorActions.markCodeSaved();
    toast('Файл сохранён');
  } catch (e) {
    toast('Ошибка сохранения: ' + msg(e));
  }
}

// ── файловые операции дерева (контекстное меню) ──────────────────────────────

/** Корневой handle открытого проекта. */
function projectRoot(): FileSystemDirectoryHandle | null {
  return projectStore.getState().dirHandle;
}

/** Пере-сканировать текущий проект (после файловой операции — обновить дерево). */
export async function rescanProject(): Promise<void> {
  const dir = projectRoot();
  if (dir) await scan(dir);
}

/** Открыть только что созданный файл: схему — в canvas, прочее — code-вкладкой. */
async function openCreatedFile(
  path: string,
  name: string,
  handle: FileSystemFileHandle,
  asForm: boolean
): Promise<void> {
  const entry: TreeEntry = { path, name, kind: 'file', depth: 0, handle };
  if (asForm) await openSchemaFile(entry);
  else await openCodeFile(entry);
}

/** Создать пустой файл `name` в каталоге `dirPath` и открыть его в редакторе. */
export async function createFileEntry(dirPath: string, name: string): Promise<void> {
  const root = projectRoot();
  if (!root) {
    toast('Проект не открыт');
    return;
  }
  try {
    const handle = await createFile(root, dirPath, name, '');
    await rescanProject();
    await openCreatedFile(joinPath(dirPath, name), name, handle, false);
  } catch (e) {
    toast('Не удалось создать файл: ' + msg(e));
  }
}

/** Создать каталог `name` в каталоге `dirPath`. */
export async function createFolderEntry(dirPath: string, name: string): Promise<void> {
  const root = projectRoot();
  if (!root) {
    toast('Проект не открыт');
    return;
  }
  try {
    await createDirectory(root, dirPath, name);
    await rescanProject();
  } catch (e) {
    toast('Не удалось создать папку: ' + msg(e));
  }
}

/** Удалить файл/каталог по пути (рекурсивно). */
export async function deleteEntry(path: string): Promise<void> {
  const root = projectRoot();
  if (!root) {
    toast('Проект не открыт');
    return;
  }
  try {
    await deletePath(root, path);
    await rescanProject();
    toast('Удалено');
  } catch (e) {
    toast('Не удалось удалить: ' + msg(e));
  }
}

/** Переименовать файл/каталог. */
export async function renameEntry(
  path: string,
  kind: 'file' | 'directory',
  newName: string
): Promise<void> {
  const root = projectRoot();
  if (!root) {
    toast('Проект не открыт');
    return;
  }
  try {
    await renamePath(root, path, kind, newName);
    await rescanProject();
  } catch (e) {
    toast('Не удалось переименовать: ' + msg(e));
  }
}

/** Имя формы из пути каталога (последний сегмент) — для комментариев в .ts-шаблонах. */
function formNameOf(dirPath: string): string {
  return dirPath.split('/').filter(Boolean).pop() ?? 'форма';
}

/** Сгенерировать одиночный артефакт формы в каталоге и открыть его. */
async function generateOne(
  dirPath: string,
  name: string,
  content: string,
  asForm: boolean
): Promise<void> {
  const root = projectRoot();
  if (!root) {
    toast('Проект не открыт');
    return;
  }
  try {
    const finalName = await uniqueName(root, dirPath, name);
    const handle = await createFile(root, dirPath, finalName, content);
    await rescanProject();
    await openCreatedFile(joinPath(dirPath, finalName), finalName, handle, asForm);
  } catch (e) {
    toast('Не удалось сгенерировать: ' + msg(e));
  }
}

/** Сгенерировать файл модели (model.ts) в каталоге. */
export function generateModel(dirPath: string): Promise<void> {
  return generateOne(dirPath, 'model.ts', modelTsTemplate(formNameOf(dirPath)), false);
}

/** Сгенерировать схему формы (form.json) в каталоге — открывается в canvas. */
export function generateFormSchema(dirPath: string): Promise<void> {
  return generateOne(dirPath, 'form.json', formJsonTemplate(), true);
}

/** Сгенерировать схему валидации (validation.ts) в каталоге. */
export function generateValidation(dirPath: string): Promise<void> {
  return generateOne(dirPath, 'validation.ts', validationTsTemplate(formNameOf(dirPath)), false);
}

/** Сгенерировать схему поведения формы (behavior.ts) в каталоге. */
export function generateBehavior(dirPath: string): Promise<void> {
  return generateOne(dirPath, 'behavior.ts', behaviorTsTemplate(formNameOf(dirPath)), false);
}

/** Сгенерировать схему поведения UI (ui.ts) в каталоге. */
export function generateUiBehavior(dirPath: string): Promise<void> {
  return generateOne(dirPath, 'ui.ts', uiTsTemplate(formNameOf(dirPath)), false);
}

/** Сгенерировать каталог формы `<formName>/` с выбранными файлами; form.json открыть в canvas. */
export async function generateFormDirectory(
  parentPath: string,
  formName: string,
  which: FormDirFiles
): Promise<void> {
  const root = projectRoot();
  if (!root) {
    toast('Проект не открыт');
    return;
  }
  try {
    const files = resolveFormDirFiles(which);
    const folder = await uniqueName(root, parentPath, formName);
    await createDirectory(root, parentPath, folder);
    const dirPath = joinPath(parentPath, folder);

    let formHandle: FileSystemFileHandle | null = null;
    if (files.model) await createFile(root, dirPath, 'model.ts', modelTsTemplate(formName));
    if (files.form) formHandle = await createFile(root, dirPath, 'form.json', formJsonTemplate());
    if (files.validation)
      await createFile(root, dirPath, 'validation.ts', validationTsTemplate(formName));
    if (files.behavior)
      await createFile(root, dirPath, 'behavior.ts', behaviorTsTemplate(formName));
    if (files.ui) await createFile(root, dirPath, 'ui.ts', uiTsTemplate(formName));
    if (files.registry)
      await createFile(root, dirPath, 'registry.ts', registryTsTemplate(formName));
    if (files.component) await createFile(root, dirPath, 'index.tsx', indexTsxTemplate(formName));

    await rescanProject();
    if (formHandle)
      await openCreatedFile(joinPath(dirPath, 'form.json'), 'form.json', formHandle, true);
    toast(`Форма «${formName}» создана`);
  } catch (e) {
    toast('Не удалось создать форму: ' + msg(e));
  }
}

/** Триггер сохранения (Cmd+S / кнопка): валидация-гейт → Mode B diff-модалка или Mode A export. */
export async function triggerSave(tab: TabState): Promise<void> {
  const v = validateSchema(tab.schema);
  if (!v.valid) {
    showValidationErrors(v.errors, tab.schema);
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

/**
 * Экспортировать активную форму как полноценный пример (renderer-json): выбор папки →
 * запись сгенерированных файлов → App.tsx-сниппет в буфер. User-owned файлы при повторном
 * экспорте не затираются (безопасная регенерация).
 */
export async function exportExample(tab: TabState): Promise<void> {
  if (tab.kind === 'code') {
    toast('Экспорт примера доступен только для формы');
    return;
  }
  if (!dirPickerAvailable()) {
    toast('Экспорт примера требует Chromium-браузера (File System Access API)');
    return;
  }
  const formName = tab.source.name.replace(/\.(form\.)?json$/i, '') || 'form';
  const mock = effectiveMock(tab.schema, tab.mockText);
  try {
    const res = await exportExampleToDirectory(tab.schema, mock, formName);
    try {
      await navigator.clipboard.writeText(res.snippet);
    } catch {
      /* буфер недоступен — сниппет продублирован в README.md */
    }
    const skipped = res.skipped.length ? `, пропущено ${res.skipped.length} (ваши файлы)` : '';
    toast(
      `Пример «${res.dir}»: записано ${res.written.length} файлов${skipped}. Сниппет для App.tsx — в буфере и README.md.`
    );
  } catch (e) {
    if ((e as Error).name === 'AbortError') return; // пользователь отменил выбор папки
    toast('Не удалось создать пример: ' + msg(e));
  }
}
