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
  copyPath,
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
  formBehaviorTsTemplate,
  renderBehaviorTsTemplate,
} from './form-templates';
import { formsOf, insertChildren, scanLevel, scanTree, type TreeEntry } from '../io/discovery';
import { resolvePrinterOptions } from '../io/prettier-config';
import { prepareSave, commitSave, type SavePlan } from '../io/save';
import { downloadSchema } from '../io/export';
import { validateSchema } from '../io/validate';
import { effectiveMock } from '../canvas/mock-data';
import { dirPickerAvailable, exportExampleToDirectory } from '../codegen/deliver';
import { showValidationErrors } from './validation-toast';
import { editorActions, editorStore } from '../store';
import type { OpenOptions, TabState } from '../store';
import { projectActions, projectStore } from '../store/project-store';
import { fileClipboardActions, fileClipboardStore } from '../store/file-clipboard';
import { reloadTemplates } from '../store/templates-store';
import { saveDialogActions } from '../store/save-dialog';

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const isAbort = (e: unknown): boolean => e instanceof DOMException && e.name === 'AbortError';

/**
 * Скан каталога: содержимое КОРНЯ (обнаружение схем) + резолв prettier. Вложенные каталоги
 * читаются лениво — при раскрытии в панели файлов ({@link loadDirectory}).
 */
async function scan(dir: FileSystemDirectoryHandle): Promise<void> {
  // Имя каталога показываем сразу (до конца скана), чтобы UI отреагировал на выбор.
  projectActions.set({
    dirHandle: dir,
    dirName: dir.name,
    scanning: true,
    error: null,
    tree: [],
    loadedDirs: new Set(),
    loadingDirs: new Set(),
  });
  try {
    const [tree, configs] = await Promise.all([scanLevel(dir), readPrettierConfigs(dir)]);
    const printer = resolvePrinterOptions(configs);
    projectActions.set({
      tree,
      loadedDirs: new Set(['']),
      printer,
      scanning: false,
      canReopen: true,
      error: null,
    });
    // Шаблоны проекта живут в его каталоге — перечитываем на каждый скан (в фоне, скан не блокируем).
    void reloadTemplates();
    const forms = formsOf(tree).length;
    console.debug(
      '[reformer-builder] scan',
      dir.name,
      '→ записей в корне:',
      tree.length,
      'схем:',
      forms
    );
    if (printer.notice) toast(printer.notice);
    toast(
      forms > 0
        ? `Открыт проект «${dir.name}»: в корне ${tree.length} записей, схем: ${forms}`
        : `Открыт проект «${dir.name}»: в корне ${tree.length} записей`
    );
  } catch (e) {
    console.error('[reformer-builder] scan failed:', e);
    projectActions.set({ scanning: false, error: msg(e) });
    toast('Ошибка сканирования: ' + msg(e));
  }
}

/** Убрать путь из множества (новый Set — стор сравнивает по ссылке). */
function without(set: ReadonlySet<string>, path: string): Set<string> {
  const next = new Set(set);
  next.delete(path);
  return next;
}

/**
 * Догрузить содержимое каталога при раскрытии в дереве (ленивая загрузка, один уровень).
 * Идемпотентна: уже загруженный или загружаемый каталог игнорируется.
 */
export async function loadDirectory(path: string): Promise<void> {
  const state = projectStore.getState();
  if (state.loadedDirs.has(path) || state.loadingDirs.has(path)) return;
  const entry = state.tree.find((e) => e.path === path && e.kind === 'directory');
  const handle = entry?.dirHandle;
  if (!entry || !handle) return;

  projectActions.set({ loadingDirs: new Set(state.loadingDirs).add(path) });
  try {
    const children = await scanLevel(handle, `${path}/`, entry.depth + 1);
    const cur = projectStore.getState();
    projectActions.set({
      tree: insertChildren(cur.tree, path, children),
      loadedDirs: new Set(cur.loadedDirs).add(path),
      loadingDirs: without(cur.loadingDirs, path),
    });
  } catch (e) {
    console.error('[reformer-builder] loadDirectory failed:', path, e);
    projectActions.set({ loadingDirs: without(projectStore.getState().loadingDirs, path) });
    toast('Не удалось прочитать каталог: ' + msg(e));
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

/**
 * Открыть распознанную схему из дерева во вкладке (read → parse → ensureSchema).
 * `opts.preview` — открыть временной вкладкой (одиночный клик в дереве, см. {@link OpenOptions}).
 */
export async function openSchemaFile(d: TreeEntry, opts?: OpenOptions): Promise<void> {
  if (!d.handle) return;
  const handle = d.handle;
  try {
    const { text, lastModified } = await readFile(handle);
    const parsed = JSON.parse(text);
    const schema = ensureSchema(parsed);
    editorActions.openTab(
      d.path,
      { kind: 'file', name: d.name, path: d.path, handle, rawText: text, lastModified },
      schema,
      opts
    );
    // ensureSchema переносит устаревший `text` узла в текстовые `children` (ссылка меняется только
    // при реальной правке). Файл на диске при этом ещё старый — говорим об этом, иначе расхождение
    // редактора и файла выглядит необъяснимо.
    if (schema !== parsed) {
      toast('Схема обновлена под новый формат: текст узлов переехал в children. Сохраните файл.');
    }
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
export async function openCodeFile(d: TreeEntry, opts?: OpenOptions): Promise<void> {
  if (!d.handle) return;
  const handle = d.handle;
  try {
    const { text, lastModified } = await readFile(handle);
    editorActions.openCodeTab(
      d.path,
      { kind: 'file', name: d.name, path: d.path, handle, rawText: text, lastModified },
      text,
      languageOf(d.name),
      opts
    );
  } catch (e) {
    toast('Не удалось открыть файл: ' + msg(e));
  }
}

/**
 * Открыть запись дерева файлов: схему — формой в canvas, прочее — code-вкладкой в Monaco.
 * `opts.preview` — временной вкладкой (одиночный клик); без него — закреплённой (двойной клик),
 * причём уже открытая вкладка тогда просто закрепляется, без повторного чтения файла.
 */
export async function openTreeEntry(entry: TreeEntry, opts?: OpenOptions): Promise<void> {
  if (!opts?.preview && editorStore.getState().tabs[entry.path]) {
    editorActions.pinTab(entry.path);
    return;
  }
  if (entry.isForm) await openSchemaFile(entry, opts);
  else await openCodeFile(entry, opts);
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

/**
 * Пере-сканировать текущий проект (после файловой операции — обновить дерево). Перечитываются
 * корень и только ранее раскрытые каталоги: свёрнутые ветки остаются незагруженными, тостов нет.
 */
export async function rescanProject(): Promise<void> {
  const { dirHandle: dir, loadedDirs } = projectStore.getState();
  if (!dir) return;
  try {
    const tree = await scanTree(dir, loadedDirs);
    projectActions.set({ tree, error: null });
  } catch (e) {
    console.error('[reformer-builder] rescan failed:', e);
    projectActions.set({ error: msg(e) });
    toast('Ошибка обновления дерева: ' + msg(e));
  }
}

/** Открыть только что созданный файл: схему — в canvas, прочее — code-вкладкой. */
export async function openCreatedFile(
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

/** Положить выбранные записи дерева в буфер («Копировать» в контекстном меню). */
export function copyEntries(paths: string[]): void {
  if (!paths.length) return;
  fileClipboardActions.copy(paths);
  toast(paths.length === 1 ? `Скопировано: ${paths[0]}` : `Скопировано записей: ${paths.length}`);
}

/**
 * Вставить содержимое буфера в каталог `dirPath` («Вставить»). Каждая запись копируется отдельно:
 * упавшая (исчезла с диска, папку вставляют в саму себя) не отменяет остальные — про неё отдельный
 * тост. Буфер не очищается: как в файловых менеджерах, копию можно вставить в несколько мест.
 */
export async function pasteEntries(dirPath: string): Promise<void> {
  const root = projectRoot();
  if (!root) {
    toast('Проект не открыт');
    return;
  }
  const paths = fileClipboardStore.getState().paths;
  if (!paths.length) return;

  let done = 0;
  for (const path of paths) {
    try {
      await copyPath(root, path, dirPath);
      done++;
    } catch (e) {
      console.error('[reformer-builder] paste failed:', path, e);
      toast(`Не удалось вставить «${path}»: ` + msg(e));
    }
  }
  if (!done) return;
  await rescanProject();
  toast(done === 1 ? 'Вставлено' : `Вставлено записей: ${done}`);
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

/** Сгенерировать схему поведения формы (form-behavior.ts) в каталоге. */
export function generateFormBehavior(dirPath: string): Promise<void> {
  return generateOne(
    dirPath,
    'form-behavior.ts',
    formBehaviorTsTemplate(formNameOf(dirPath)),
    false
  );
}

/** Сгенерировать схему поведения UI (render-behavior.ts) в каталоге. */
export function generateRenderBehavior(dirPath: string): Promise<void> {
  return generateOne(
    dirPath,
    'render-behavior.ts',
    renderBehaviorTsTemplate(formNameOf(dirPath)),
    false
  );
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
  const mock = effectiveMock(tab.schema, tab.mock);
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
