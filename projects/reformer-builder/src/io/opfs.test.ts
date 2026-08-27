/**
 * Рабочая копия в OPFS.
 *
 * Отдельного внимания стоит сборка мусора: каталоги OPFS живут, пока их не удалить, и без уборки
 * каждая закрытая вкладка оставляла бы после себя копию модуля. Это не «оптимизация потом» —
 * место занимается молча, за счёт квоты пользователя.
 *
 * OPFS в Node нет, поэтому корень подменяется той же заглушкой, что используют тесты `io/fs-ops`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeRoot } from './__fixtures__/fake-fs';

/** Заглушка localStorage — манифест живых каталогов лежит в нём. */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

let root: FileSystemDirectoryHandle;

beforeEach(async () => {
  root = fakeRoot();
  vi.stubGlobal('navigator', { storage: { getDirectory: () => Promise.resolve(root) } });
  vi.stubGlobal('localStorage', fakeStorage());
  vi.resetModules();
});

const opfs = () => import('./opfs');

describe('рабочая копия', () => {
  it('запись и чтение набора файлов', async () => {
    const { writeWorkdir, readWorkdir } = await opfs();
    await writeWorkdir('tab-1', { 'validation.ts': 'a', 'model.ts': 'b' });
    expect(await readWorkdir('tab-1')).toEqual({ 'validation.ts': 'a', 'model.ts': 'b' });
  });

  it('копии разных вкладок не пересекаются', async () => {
    const { writeWorkdir, readWorkdir } = await opfs();
    await writeWorkdir('tab-1', { 'validation.ts': 'первая' });
    await writeWorkdir('tab-2', { 'validation.ts': 'вторая' });
    expect((await readWorkdir('tab-1'))['validation.ts']).toBe('первая');
    expect((await readWorkdir('tab-2'))['validation.ts']).toBe('вторая');
  });

  it('id вкладки с путём не превращается во вложенные каталоги', async () => {
    // id вкладки в Mode B — это путь файла; без кодирования `removeEntry` по имени вкладки снёс бы
    // не то, что нужно.
    const { writeWorkdir, readWorkdir, workdirName } = await opfs();
    const id = 'src/forms/loan/renderer.schema.json';
    expect(workdirName(id)).not.toContain('/');
    await writeWorkdir(id, { 'model.ts': 'x' });
    expect(await readWorkdir(id)).toEqual({ 'model.ts': 'x' });
  });

  it('перезапись файла заменяет содержимое', async () => {
    const { writeWorkdirFile, readWorkdirFile } = await opfs();
    await writeWorkdirFile('t', 'validation.ts', 'старое');
    await writeWorkdirFile('t', 'validation.ts', 'новое');
    expect(await readWorkdirFile('t', 'validation.ts')).toBe('новое');
  });

  it('чтение несуществующего файла — null, а не бросок', async () => {
    const { readWorkdirFile } = await opfs();
    expect(await readWorkdirFile('нет-такой', 'validation.ts')).toBeNull();
  });

  it('удаление копии убирает её целиком', async () => {
    const { writeWorkdir, readWorkdir, removeWorkdir } = await opfs();
    await writeWorkdir('t', { 'a.ts': '1', 'b.ts': '2' });
    await removeWorkdir('t');
    expect(await readWorkdir('t')).toEqual({});
  });
});

describe('сборка мусора', () => {
  it('брошенные копии убираются, живые остаются', async () => {
    const { writeWorkdir, readWorkdir, sweepWorkdirs } = await opfs();
    await writeWorkdir('alive', { 'a.ts': '1' });
    await writeWorkdir('dead-1', { 'a.ts': '1' });
    await writeWorkdir('dead-2', { 'a.ts': '1' });

    const removed = await sweepWorkdirs(['alive']);

    expect(removed).toBe(2);
    expect(await readWorkdir('alive')).toEqual({ 'a.ts': '1' });
    expect(await readWorkdir('dead-1')).toEqual({});
    expect(await readWorkdir('dead-2')).toEqual({});
  });

  it('повторная уборка ничего не находит', async () => {
    const { writeWorkdir, sweepWorkdirs } = await opfs();
    await writeWorkdir('alive', { 'a.ts': '1' });
    await writeWorkdir('dead', { 'a.ts': '1' });
    await sweepWorkdirs(['alive']);
    expect(await sweepWorkdirs(['alive'])).toBe(0);
  });

  it('уборка без единой живой вкладки чистит всё', async () => {
    const { writeWorkdir, sweepWorkdirs, readWorkdir } = await opfs();
    await writeWorkdir('t1', { 'a.ts': '1' });
    await writeWorkdir('t2', { 'a.ts': '1' });
    expect(await sweepWorkdirs([])).toBe(2);
    expect(await readWorkdir('t1')).toEqual({});
  });

  it('уборка на пустом хранилище не падает', async () => {
    const { sweepWorkdirs } = await opfs();
    expect(await sweepWorkdirs(['что-угодно'])).toBe(0);
  });
});

describe('недоступный OPFS', () => {
  it('деградирует, а не падает', async () => {
    vi.stubGlobal('navigator', {});
    vi.resetModules();
    const { opfsSupported, readWorkdir, writeWorkdir } = await opfs();
    expect(opfsSupported()).toBe(false);
    expect(await writeWorkdir('t', { 'a.ts': '1' })).toBe(false);
    expect(await readWorkdir('t')).toEqual({});
  });
});
