/**
 * Рабочая копия формы — каталог в OPFS на каждую открытую вкладку.
 *
 * **Зачем.** Три схемы формы (`validation.ts`, `form.behavior.ts`, `renderer.behavior.ts`)
 * редактируются как файлы. У формы, открытой из проекта, файлы есть на диске; у формы, собранной
 * в билдере, их нет вовсе — и раньше это заставляло держать тексты отдельным полем в сторе,
 * заводить в живом превью вторую ветку чтения «из памяти» и мириться с тем, что неполный набор
 * файлов не линкуется (`renderer.behavior.ts` импортирует ЗНАЧЕНИЯ из `./validation` и `./api`).
 * Рабочая копия снимает все три: у вкладки всегда есть настоящий каталог с полным модулем.
 *
 * **Почему `io/fs-ops` не переписан.** Он написан против структурного типа
 * (`type Root = FileSystemDirectoryHandle`, доступ через локальный `FsDirHandle`), а
 * `navigator.storage.getDirectory()` возвращает ровно такой хэндл. Весь path-слой — `createFile`,
 * `listFilesDeep`, `readTextFile`, `deletePath`, `existsIn` — работает над OPFS без единой правки.
 *
 * **Сборка мусора обязательна.** Каталоги OPFS живут, пока их не удалить. Без манифеста
 * `tabId → каталог` и подметания на старте за месяц работы здесь накопятся сотни брошенных копий
 * от закрытых вкладок и упавших сессий, молча занимая пользовательскую квоту.
 *
 * @module reformer-builder/io/opfs
 */

import { createFileDeep, listFilesDeep, readTextFile } from './fs-ops';

/** Корневой каталог рабочих копий внутри OPFS. */
const ROOT_DIR = 'workdirs';

/** Ключ манифеста в localStorage: какие каталоги принадлежат живым вкладкам. */
const MANIFEST_KEY = 'rb.opfs.workdirs';

type Root = FileSystemDirectoryHandle;

/** Доступ к OPFS. `null` — хранилище недоступно (приватный режим, старый браузер). */
export async function opfsRoot(): Promise<Root | null> {
  try {
    const storage = navigator.storage as { getDirectory?: () => Promise<Root> } | undefined;
    if (!storage?.getDirectory) return null;
    return await storage.getDirectory();
  } catch {
    return null;
  }
}

/** Поддерживается ли рабочая копия в этом браузере. */
export function opfsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function';
}

/**
 * Имя каталога вкладки.
 *
 * id вкладки в Mode B — это путь файла (`src/forms/loan/renderer.schema.json`), а он содержит `/`
 * и стал бы вложенными каталогами. Поэтому имя кодируется — иначе `deletePath` по имени вкладки
 * снёс бы не то, что нужно.
 */
export function workdirName(tabId: string): string {
  return encodeURIComponent(tabId);
}

/** Путь каталога вкладки от корня OPFS. */
export function workdirPath(tabId: string): string {
  return `${ROOT_DIR}/${workdirName(tabId)}`;
}

/** Манифест живых каталогов: имя каталога → id вкладки. */
function readManifest(): Record<string, string> {
  try {
    const raw = localStorage.getItem(MANIFEST_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeManifest(next: Record<string, string>): void {
  try {
    localStorage.setItem(MANIFEST_KEY, JSON.stringify(next));
  } catch {
    // Хранилище недоступно — рабочая копия всё равно создастся, просто сборка мусора не узнает
    // о ней. Ронять из-за этого открытие формы нельзя.
  }
}

/** Пометить каталог живым. */
export function claimWorkdir(tabId: string): void {
  const m = readManifest();
  m[workdirName(tabId)] = tabId;
  writeManifest(m);
}

/** Снять пометку (вкладку закрыли). */
export function releaseWorkdir(tabId: string): void {
  const m = readManifest();
  delete m[workdirName(tabId)];
  writeManifest(m);
}

/** Список файлов рабочей копии: имя → текст. Прямые дети каталога. */
export async function readWorkdir(tabId: string): Promise<Record<string, string>> {
  const root = await opfsRoot();
  if (!root) return {};
  const dir = workdirPath(tabId);
  const out: Record<string, string> = {};
  let names: string[];
  try {
    names = (await listFilesDeep(root, dir)).filter((rel) => !rel.includes('/'));
  } catch {
    return {};
  }
  for (const name of names) {
    try {
      out[name] = await readTextFile(root, `${dir}/${name}`);
    } catch {
      // Файл исчез между листингом и чтением — не повод валить всю сборку.
    }
  }
  return out;
}

/** Прочитать один файл рабочей копии; `null` — файла нет. */
export async function readWorkdirFile(tabId: string, name: string): Promise<string | null> {
  const root = await opfsRoot();
  if (!root) return null;
  try {
    return await readTextFile(root, `${workdirPath(tabId)}/${name}`);
  } catch {
    return null;
  }
}

/** Записать файл рабочей копии. Каталог создаётся при необходимости. */
export async function writeWorkdirFile(
  tabId: string,
  name: string,
  content: string
): Promise<boolean> {
  const root = await opfsRoot();
  if (!root) return false;
  await createFileDeep(root, workdirPath(tabId), name, content);
  claimWorkdir(tabId);
  return true;
}

/** Записать набор файлов разом — материализация копии. */
export async function writeWorkdir(tabId: string, files: Record<string, string>): Promise<boolean> {
  const root = await opfsRoot();
  if (!root) return false;
  for (const [name, content] of Object.entries(files)) {
    await createFileDeep(root, workdirPath(tabId), name, content);
  }
  claimWorkdir(tabId);
  return true;
}

/** Удалить каталог вкладки. */
export async function removeWorkdir(tabId: string): Promise<void> {
  releaseWorkdir(tabId);
  const root = await opfsRoot();
  if (!root) return;
  try {
    const parent = await root.getDirectoryHandle(ROOT_DIR);
    await parent.removeEntry(workdirName(tabId), { recursive: true });
  } catch {
    // Каталога не было — цель достигнута.
  }
}

/**
 * Подмести брошенные каталоги.
 *
 * `alive` — id вкладок, восстановленных в этой сессии. Всё, чего нет ни среди них, ни в манифесте,
 * осталось от закрытых вкладок и упавших сессий. Возвращает число убранных — вызывающий может
 * сказать об этом в логе, но молча копить их нельзя.
 */
export async function sweepWorkdirs(alive: readonly string[]): Promise<number> {
  const root = await opfsRoot();
  if (!root) return 0;
  const keep = new Set(alive.map(workdirName));
  const manifest = readManifest();

  let parent: FileSystemDirectoryHandle;
  try {
    parent = await root.getDirectoryHandle(ROOT_DIR);
  } catch {
    return 0;
  }

  const names: string[] = [];
  const iterable = parent as unknown as {
    values(): AsyncIterableIterator<{ kind: string; name: string }>;
  };
  for await (const entry of iterable.values()) {
    if (entry.kind === 'directory') names.push(entry.name);
  }

  let removed = 0;
  for (const name of names) {
    if (keep.has(name)) continue;
    try {
      await parent.removeEntry(name, { recursive: true });
      delete manifest[name];
      removed += 1;
    } catch {
      // Каталог занят или уже удалён — следующая уборка попробует снова.
    }
  }
  // Манифест переписываем ЖИВЫМИ: записи об удалённых иначе копились бы вечно.
  writeManifest(Object.fromEntries([...keep].map((n) => [n, manifest[n] ?? n])));
  return removed;
}
