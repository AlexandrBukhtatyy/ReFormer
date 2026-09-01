/**
 * Подставной каталог File System Access — единственный способ проверить адаптер в `node`.
 *
 * Живой выбор каталога автоматизацией не проходится, а самого API вне Chromium нет вовсе,
 * поэтому адаптер проверяется против структурной имитации хэндлов. Образец — фикстура v1
 * (`projects/reformer-builder/src/io/__fixtures__/fake-fs.ts`), но она воспроизводит только
 * успешный путь, а весь смысл адаптера — в ответах-отказах.
 *
 * **Что здесь обязано быть воспроизведено, иначе имитация бесполезна:**
 *
 * - **`NotFoundError` и `TypeMismatchError` как ОБЫЧНЫЙ ответ**, а не как авария. На втором
 *   держится главное улучшение против v1: вид ресурса сообщает сам отказ, поэтому `stat`
 *   обходится одним обращением вместо двух. Имитация, бросающая `new Error('нет файла')`,
 *   этот путь не проверяет вовсе.
 * - **Атомарность записи на `close()`**: тело меняется в конце, а не по `write()`.
 * - **Время модификации, растущее шагами**: ревизия адаптера — это оно, и запись обязана
 *   его двигать, иначе конфликт не проверить.
 * - **Ленивое тело**: `size` и `lastModified` доступны без чтения содержимого. На этом
 *   стоит счётчик {@link FakeFsControls.bodyReads}, которым проверяется запрет N+1.
 * - **Разрешения** — чтобы отказ пользователя в диалоге проверялся, а не предполагался.
 *
 * @module host/source/testing
 */

import type { FsDirectoryHandle, FsFile, FsFileHandle, FsWritable } from './fs-access';

interface FakeFileNode {
  kind: 'file';
  name: string;
  content: string;
  lastModified: number;
}

interface FakeDirNode {
  kind: 'directory';
  name: string;
  children: Map<string, FakeNode>;
}

type FakeNode = FakeFileNode | FakeDirNode;

/** Ошибка в форме `DOMException`: важен `name`, по нему адаптер и различает ответы. */
class FakeDomError extends Error {
  constructor(name: string, message: string) {
    super(message);
    this.name = name;
  }
}

interface FakeState {
  now: number;
  bodyReads: number;
  lookups: number;
  listings: number;
  permission: PermissionState;
  permissionRequests: number;
  fault: Error | null;
  nodes: WeakMap<object, FakeDirNode>;
}

/** Рычаги имитации: счётчики, сбои и разрешения. */
export interface FakeFsControls {
  /** Сколько раз отдали ТЕЛО файла. После листинга обязан оставаться нулём. */
  readonly bodyReads: number;
  /** Сколько раз искали запись по имени. `stat` отсутствующего обязан стоить одного поиска. */
  readonly lookups: number;
  /** Сколько раз перечисляли содержимое каталога. */
  readonly listings: number;
  /** Сколько раз спрашивали разрешение. */
  readonly permissionRequests: number;
  /** Обнуляет счётчики. */
  forget(): void;
  /** Следующее обращение к хэндлу сорвётся. Без аргумента — неопознанный сбой ввода-вывода. */
  breakNext(error?: Error): void;
  /** Ответ на запрос разрешения. */
  setPermission(state: PermissionState): void;
  /** Текущее содержимое файла — правка и проверка мимо адаптера. */
  textOf(path: string): string | undefined;
  put(path: string, text: string): void;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const ticksApart = 1000;

/** Снимок файла. Тело читается лениво — метаданные его не трогают. */
function snapshot(node: FakeFileNode, state: FakeState): FsFile {
  return {
    size: encoder.encode(node.content).length,
    lastModified: node.lastModified,
    // Браузер часто молчит о типе, и это штатный случай: тогда решает таблица расширений ядра.
    type: '',
    async text() {
      state.bodyReads += 1;
      return node.content;
    },
    async arrayBuffer() {
      state.bodyReads += 1;
      return encoder.encode(node.content).buffer as ArrayBuffer;
    },
  };
}

function fileHandleFor(node: FakeFileNode, parent: FakeDirNode, state: FakeState): FsFileHandle {
  return {
    kind: 'file',
    name: node.name,

    async getFile() {
      throwArmedFault(state);
      return snapshot(node, state);
    },

    async createWritable(): Promise<FsWritable> {
      throwArmedFault(state);
      let buffer = '';
      return {
        async write(data) {
          buffer += typeof data === 'string' ? data : decoder.decode(data);
        },
        async close() {
          // Коммит на закрытии, как в спецификации: до него файл не менялся.
          node.content = buffer;
          node.lastModified = nextTick(state);
        },
      };
    },

    async move(target, name) {
      throwArmedFault(state);
      const destination = state.nodes.get(target);
      if (destination === undefined) throw new FakeDomError('NotFoundError', 'чужой каталог');
      parent.children.delete(node.name);
      node.name = name ?? node.name;
      destination.children.set(node.name, node);
    },
  };
}

function directoryHandleFor(node: FakeDirNode, state: FakeState): FsDirectoryHandle {
  const handle: FsDirectoryHandle = {
    kind: 'directory',
    name: node.name,

    async getFileHandle(name, options) {
      throwArmedFault(state);
      state.lookups += 1;
      const child = node.children.get(name);
      if (child !== undefined && child.kind === 'file') return fileHandleFor(child, node, state);
      // Имя занято каталогом. Ответ спецификации — и он же сообщает ВИД, поэтому второе
      // обращение (как в v1) не нужно.
      if (child !== undefined) throw new FakeDomError('TypeMismatchError', `каталог: ${name}`);
      if (options?.create !== true) throw new FakeDomError('NotFoundError', `нет файла ${name}`);
      const created: FakeFileNode = {
        kind: 'file',
        name,
        content: '',
        lastModified: nextTick(state),
      };
      node.children.set(name, created);
      return fileHandleFor(created, node, state);
    },

    async getDirectoryHandle(name, options) {
      throwArmedFault(state);
      state.lookups += 1;
      const child = node.children.get(name);
      if (child !== undefined && child.kind === 'directory')
        return directoryHandleFor(child, state);
      if (child !== undefined) throw new FakeDomError('TypeMismatchError', `файл: ${name}`);
      if (options?.create !== true) throw new FakeDomError('NotFoundError', `нет каталога ${name}`);
      const created: FakeDirNode = { kind: 'directory', name, children: new Map() };
      node.children.set(name, created);
      return directoryHandleFor(created, state);
    },

    async removeEntry(name, options) {
      throwArmedFault(state);
      const child = node.children.get(name);
      if (child === undefined) throw new FakeDomError('NotFoundError', `нет ${name}`);
      if (child.kind === 'directory' && child.children.size > 0 && options?.recursive !== true) {
        throw new FakeDomError('InvalidModificationError', `каталог не пуст: ${name}`);
      }
      node.children.delete(name);
    },

    async *values() {
      throwArmedFault(state);
      state.listings += 1;
      for (const child of node.children.values()) {
        yield child.kind === 'file'
          ? fileHandleFor(child, node, state)
          : directoryHandleFor(child, state);
      }
    },

    async move(target, name) {
      throwArmedFault(state);
      const destination = state.nodes.get(target);
      if (destination === undefined) throw new FakeDomError('NotFoundError', 'чужой каталог');
      node.name = name ?? node.name;
      destination.children.set(node.name, node);
    },

    async queryPermission() {
      return state.permission;
    },

    async requestPermission() {
      state.permissionRequests += 1;
      return state.permission;
    },
  };

  // Хэндл каталога надо уметь узнать обратно: `move()` принимает именно его, а не путь.
  state.nodes.set(handle, node);
  return handle;
}

function nextTick(state: FakeState): number {
  state.now += ticksApart;
  return state.now;
}

/** Бросает заказанный сбой, если он был заказан. Одноразовый. */
function throwArmedFault(state: FakeState): void {
  const fault = state.fault;
  if (fault === null) return;
  state.fault = null;
  throw fault;
}

function ensureDirNode(root: FakeDirNode, path: string): FakeDirNode {
  let current = root;
  for (const segment of path.split('/').filter(Boolean)) {
    const child = current.children.get(segment);
    if (child !== undefined && child.kind === 'directory') {
      current = child;
      continue;
    }
    const created: FakeDirNode = { kind: 'directory', name: segment, children: new Map() };
    current.children.set(segment, created);
    current = created;
  }
  return current;
}

function findFileNode(root: FakeDirNode, path: string): FakeFileNode | undefined {
  const segments = path.split('/').filter(Boolean);
  const name = segments.pop();
  if (name === undefined) return undefined;
  let current: FakeDirNode = root;
  for (const segment of segments) {
    const child: FakeNode | undefined = current.children.get(segment);
    if (child === undefined || child.kind !== 'directory') return undefined;
    current = child;
  }
  const found = current.children.get(name);
  return found !== undefined && found.kind === 'file' ? found : undefined;
}

/**
 * Подставной каталог с заданным содержимым.
 *
 * @param files путь → текст. Недостающие каталоги создаются, как при распаковке архива.
 */
export function createFakeDirectory(files: Readonly<Record<string, string>> = {}): {
  readonly root: FsDirectoryHandle;
  readonly controls: FakeFsControls;
} {
  const state: FakeState = {
    now: 1_700_000_000_000,
    bodyReads: 0,
    lookups: 0,
    listings: 0,
    permission: 'granted',
    permissionRequests: 0,
    fault: null,
    nodes: new WeakMap(),
  };
  const rootNode: FakeDirNode = { kind: 'directory', name: 'project', children: new Map() };

  const put = (path: string, text: string): void => {
    const segments = path.split('/').filter(Boolean);
    const name = segments.pop();
    if (name === undefined) throw new Error(`пустой путь в фикстуре: ${path}`);
    const parent = ensureDirNode(rootNode, segments.join('/'));
    const existing = parent.children.get(name);
    if (existing !== undefined && existing.kind === 'file') {
      existing.content = text;
      existing.lastModified = nextTick(state);
      return;
    }
    parent.children.set(name, {
      kind: 'file',
      name,
      content: text,
      lastModified: nextTick(state),
    });
  };

  for (const [path, text] of Object.entries(files)) put(path, text);

  const controls: FakeFsControls = {
    get bodyReads() {
      return state.bodyReads;
    },
    get lookups() {
      return state.lookups;
    },
    get listings() {
      return state.listings;
    },
    get permissionRequests() {
      return state.permissionRequests;
    },
    forget() {
      state.bodyReads = 0;
      state.lookups = 0;
      state.listings = 0;
      state.permissionRequests = 0;
    },
    breakNext(error) {
      state.fault = error ?? new Error('ввод-вывод сорвался');
    },
    setPermission(permission) {
      state.permission = permission;
    },
    textOf(path) {
      return findFileNode(rootNode, path)?.content;
    },
    put,
  };

  return { root: directoryHandleFor(rootNode, state), controls };
}
