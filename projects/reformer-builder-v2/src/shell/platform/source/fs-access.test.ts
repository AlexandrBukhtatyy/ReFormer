/**
 * Тесты адаптера File System Access — того, чего общий набор проверить не может.
 *
 * Общий набор (`contract.test.ts`) спрашивает с адаптера ПОВЕДЕНИЕ, одинаковое у всех
 * источников. Здесь проверяется цена этого поведения и перевод ответов конкретного API:
 * сколько обращений стоит `stat` (в v1 — два), во что превращаются `DOMException`, и что
 * происходит с разрешением, которого не дали.
 *
 * @module host/source/fs-access.test
 */

import { describe, expect, it } from 'vitest';

import { isSourceError } from './errors';
import type { SourceErrorKind } from './errors';
import {
  createFsAccessSource,
  createFsSourceFactory,
  ensureFsPermission,
  fsAccessSupported,
  pickFsDirectory,
} from './fs-access';
import type { FsDirectoryHandle, FsFileHandle } from './fs-access';
import { createFakeDirectory } from './testing';
import { isSourceUnavailable } from './types';

const FILES = {
  'package.json': '{"name":"demo"}',
  'src/forms/credit/schema.json': '{"root":{}}',
};

/** Ошибка в форме `DOMException`: адаптер различает ответы API именно по `name`. */
const domError = (name: string): Error => {
  const error = new Error(`имитация ${name}`);
  error.name = name;
  return error;
};

describe('цена операций', () => {
  it('существование выясняется ОДНИМ обращением, а не двумя', async () => {
    const { root, controls } = createFakeDirectory(FILES);
    const source = createFsAccessSource(root);
    controls.forget();

    expect(await source.stat('missing.json')).toBeNull();

    // В v1 (io/fs-ops.ts, existsIn) здесь было два обращения: сначала как к файлу,
    // потом как к каталогу — и вид ресурса всё равно терялся.
    expect(controls.lookups).toBe(1);
  });

  it('вид каталога сообщает сам отказ, второе обращение не нужно', async () => {
    const { root, controls } = createFakeDirectory(FILES);
    const source = createFsAccessSource(root);
    controls.forget();

    expect((await source.stat('src'))?.kind).toBe('directory');
    expect(controls.lookups).toBe(1);
  });

  it('листинг каталога — одно перечисление и ни одного чтения тела', async () => {
    const { root, controls } = createFakeDirectory(FILES);
    const source = createFsAccessSource(root);
    controls.forget();

    await source.list('src/forms/credit');

    expect(controls.listings).toBe(1);
    // Ровно то, чего нельзя повторять из v1: там обход читал каждый .json-кандидат.
    expect(controls.bodyReads).toBe(0);
  });
});

describe('перевод отказов', () => {
  const cases: [string, SourceErrorKind][] = [
    ['NotFoundError', 'not-found'],
    ['NotAllowedError', 'unauthorized'],
    ['SecurityError', 'forbidden'],
    ['NoModificationAllowedError', 'forbidden'],
    ['QuotaExceededError', 'budget'],
    ['AbortError', 'aborted'],
  ];

  it.each(cases)('%s становится отказом «%s»', async (name, kind) => {
    const { root, controls } = createFakeDirectory(FILES);
    const source = createFsAccessSource(root);
    controls.breakNext(domError(name));

    const error = await source.read('package.json').catch((err: unknown) => err);

    expect(isSourceError(error, kind)).toBe(true);
  });

  it('неопознанный сбой считается транспортным, а не отсутствием файла', async () => {
    const { root, controls } = createFakeDirectory(FILES);
    const source = createFsAccessSource(root);
    controls.breakNext(new Error('диск отвалился'));

    const error = await source.read('package.json').catch((err: unknown) => err);

    // «Нет файла» отправило бы вызывающего дальше с пустотой; транспортный отказ его остановит.
    expect(isSourceError(error, 'network')).toBe(true);
    expect((error as Error).cause).toBeInstanceOf(Error);
  });
});

describe('запись', () => {
  it('двигает время модификации, то есть ревизию', async () => {
    const { root, controls } = createFakeDirectory(FILES);
    const source = createFsAccessSource(root);
    const write = source.write;
    if (write === undefined) throw new Error('каталог открыт на запись');

    const before = (await source.stat('package.json'))?.revision;
    const written = await write.call(source, 'package.json', 'новое');

    expect(written.revision).not.toBe(before);
    expect(controls.textOf('package.json')).toBe('новое');
  });

  it('браузер без createWritable отвечает «не умею», а не падает', async () => {
    const { root } = createFakeDirectory(FILES);
    // Хэндл файла без записи — так выглядит движок, где File System Access только на чтение.
    const readOnlyRoot: FsDirectoryHandle = {
      ...root,
      async getFileHandle(name, options) {
        const handle = await root.getFileHandle(name, options);
        const stripped: FsFileHandle = {
          kind: 'file',
          name: handle.name,
          getFile: () => handle.getFile(),
        };
        return stripped;
      },
    };
    const source = createFsAccessSource(readOnlyRoot);
    const write = source.write;
    if (write === undefined) throw new Error('метод объявлен: возможность заявлена');

    const error = await write.call(source, 'package.json', 'новое').catch((err: unknown) => err);

    expect(isSourceError(error, 'unsupported')).toBe(true);
  });
});

describe('каталог только на чтение', () => {
  it('не объявляет ни возможности записи, ни её методов', () => {
    const { root } = createFakeDirectory(FILES);
    const source = createFsAccessSource(root, { readOnly: true });

    expect(source.capabilities.write).toBe(false);
    expect(source.write).toBeUndefined();
    expect(source.mkdir).toBeUndefined();
    expect(source.remove).toBeUndefined();
    expect(source.move).toBeUndefined();
  });
});

describe('разрешения', () => {
  it('выданное разрешение не переспрашивается', async () => {
    const { root, controls } = createFakeDirectory(FILES);
    controls.setPermission('granted');

    expect(await ensureFsPermission(root)).toBe(true);
    expect(controls.permissionRequests).toBe(0);
  });

  it('невыданное — запрашивается, отказ пользователя виден вызывающему', async () => {
    const { root, controls } = createFakeDirectory(FILES);
    controls.setPermission('denied');

    expect(await ensureFsPermission(root)).toBe(false);
    expect(controls.permissionRequests).toBe(1);
  });

  it('источник без модели разрешений отвечает «доступ есть», а не «метода нет»', async () => {
    const { root } = createFakeDirectory(FILES);
    const withoutPermissions: FsDirectoryHandle = {
      kind: 'directory',
      name: root.name,
      getFileHandle: (name, options) => root.getFileHandle(name, options),
      getDirectoryHandle: (name, options) => root.getDirectoryHandle(name, options),
      removeEntry: (name, options) => root.removeEntry(name, options),
      values: () => root.values(),
    };

    // Иначе переоткрытие отменялось бы у каждого источника, кроме File System Access, —
    // именно в этот шов встанет вход по токену.
    expect(await ensureFsPermission(withoutPermissions)).toBe(true);
  });
});

describe('переоткрытие', () => {
  it('поднимает источник по ключу хэндла', async () => {
    const { root } = createFakeDirectory(FILES);
    const factory = createFsSourceFactory({
      open: async (key) => (key === 'project' ? root : null),
    });

    const source = await factory.restore({ kind: 'fs', handleKey: 'project' });
    if (isSourceUnavailable(source)) throw new Error('источник обязан был восстановиться');

    expect(source.id).toBe('project');
    expect((await source.read('package.json')).text).toBe(FILES['package.json']);
  });

  it('пропавший хэндл — «источника нет», а не авария и не отказ доступа', async () => {
    const factory = createFsSourceFactory({ open: async () => null });

    expect(await factory.restore({ kind: 'fs', handleKey: 'забытый' })).toEqual({
      unavailable: 'missing',
    });
  });

  it('невыданное разрешение — «доступ не дан»: это ДРУГАЯ кнопка в интерфейсе', async () => {
    // Здесь и лежала склейка: оба случая отвечали `null`, и «выбрать проект заново»
    // было неотличимо от «разрешить доступ» — при том, что второе чинится одним нажатием.
    const { root, controls } = createFakeDirectory(FILES);
    controls.setPermission('denied');
    const factory = createFsSourceFactory({ open: async () => root });

    expect(await factory.restore({ kind: 'fs', handleKey: 'project' })).toEqual({
      unavailable: 'denied',
    });
  });

  it('хэндл на месте и разрешение выдано — источник, а не причина', async () => {
    const { root } = createFakeDirectory(FILES);
    const factory = createFsSourceFactory({ open: async () => root });

    expect(isSourceUnavailable(await factory.restore({ kind: 'fs', handleKey: 'project' }))).toBe(
      false
    );
  });

  it('чужой дескриптор не берёт', async () => {
    const { root } = createFakeDirectory(FILES);
    const factory = createFsSourceFactory({ open: async () => root });

    expect(await factory.restore({ kind: 'memory', label: 'чужой' })).toEqual({
      unavailable: 'missing',
    });
  });
});

describe('вход в браузере', () => {
  it('в окружении без File System Access отвечает честно', () => {
    // Тесты идут в `node`: API здесь нет, и это ровно тот ответ, который нужен интерфейсу.
    expect(fsAccessSupported()).toBe(false);
    expect(() => pickFsDirectory()).toThrow(/File System Access/);
  });
});
