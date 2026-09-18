/**
 * Файловый слой настроек: что считается «настроек нет», а что — отказом.
 *
 * Проверяется ровно граница между двумя: отсутствующий и испорченный файл — это нормальное
 * состояние проекта, который правят руками, а источник без записи — настоящий отказ, потому
 * что служба настроек на нём откатывает кэш. Перепутай их, и человек увидел бы на экране
 * значение, которого в файле нет.
 *
 * @module shell/platform/services/settings-project.test
 */

import { describe, expect, it, vi } from 'vitest';

import { createProjectSettingsBackend, PROJECT_SETTINGS_PATH } from './settings-project';
import type { SettingsSource } from './settings-project';

/** Источник-двойник: файлы в памяти, право записи задаётся. */
function fakeSource(
  files: Record<string, string> = {},
  options: { writable?: boolean } = {}
): SettingsSource & { files: Record<string, string>; writes: number } {
  const writable = options.writable ?? true;
  const state = {
    files: { ...files },
    writes: 0,
    capabilities: {
      read: true,
      write: writable,
      tree: true,
      revisions: false,
      executesCode: true,
      auth: 'none',
    } as SettingsSource['capabilities'],
    read: (path: string) => {
      const text = state.files[path];
      if (text === undefined) return Promise.reject(new Error(`нет файла ${path}`));
      return Promise.resolve({ text } as Awaited<ReturnType<SettingsSource['read']>>);
    },
    ...(writable
      ? {
          write: (path: string, text: string) => {
            state.files[path] = text;
            state.writes += 1;
            return Promise.resolve({ ok: true } as never);
          },
        }
      : {}),
  };
  return state as SettingsSource & { files: Record<string, string>; writes: number };
}

describe('чтение', () => {
  it('без проекта и без файла — пусто, а не отказ', async () => {
    const backend = createProjectSettingsBackend();

    expect(await backend.read('workspace')).toEqual({});

    backend.useSource(fakeSource());
    expect(await backend.read('workspace')).toEqual({});
  });

  it('испорченный JSON читается как отсутствие настроек', async () => {
    // Файл правят руками, и сломанная скобка не повод не открыть проект. То же правило
    // уже действует для конфига запуска.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const backend = createProjectSettingsBackend();
    backend.useSource(fakeSource({ [PROJECT_SETTINGS_PATH]: '{ сломано' }));

    expect(await backend.read('workspace')).toEqual({});
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('не объект — тоже отсутствие, а не половина настроек', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const backend = createProjectSettingsBackend();
    backend.useSource(fakeSource({ [PROJECT_SETTINGS_PATH]: '[1, 2]' }));

    expect(await backend.read('workspace')).toEqual({});
    spy.mockRestore();
  });

  it('область user — не его вопрос', async () => {
    const backend = createProjectSettingsBackend();
    backend.useSource(fakeSource({ [PROJECT_SETTINGS_PATH]: '{"theme":"dark"}' }));

    expect(await backend.read('user')).toEqual({});
    expect(await backend.read('workspace')).toEqual({ theme: 'dark' });
  });

  it('смена проекта сбрасывает снимок', async () => {
    const backend = createProjectSettingsBackend();
    backend.useSource(fakeSource({ [PROJECT_SETTINGS_PATH]: '{"kit":"acme"}' }));
    expect(await backend.read('workspace')).toEqual({ kit: 'acme' });

    backend.useSource(fakeSource());
    expect(await backend.read('workspace')).toEqual({});
  });
});

describe('запись', () => {
  it('пишет файл целиком, с отступами и переводом строки', async () => {
    // Файл лежит в git и его читают люди: однострочный JSON давал бы конфликт слияния
    // на каждой правке любого ключа.
    const source = fakeSource();
    const backend = createProjectSettingsBackend();
    backend.useSource(source);

    await backend.write('workspace', 'theme', 'dark');
    await backend.write('workspace', 'kit', 'acme');

    expect(source.files[PROJECT_SETTINGS_PATH]).toBe(`{\n  "theme": "dark",\n  "kit": "acme"\n}\n`);
  });

  it('снятие ключа переписывает файл без него', async () => {
    const source = fakeSource({ [PROJECT_SETTINGS_PATH]: '{"theme":"dark","kit":"acme"}' });
    const backend = createProjectSettingsBackend();
    backend.useSource(source);

    await backend.remove('workspace', 'theme');

    expect(JSON.parse(source.files[PROJECT_SETTINGS_PATH] ?? '{}')).toEqual({ kit: 'acme' });
  });

  it('снятие того, чего нет, файл не трогает', async () => {
    const source = fakeSource({ [PROJECT_SETTINGS_PATH]: '{"kit":"acme"}' });
    const backend = createProjectSettingsBackend();
    backend.useSource(source);

    await backend.remove('workspace', 'theme');

    expect(source.writes).toBe(0);
  });

  it('источник без записи — отказ, а не молчаливый успех', async () => {
    // Служба настроек откатывает кэш по отказу записи. Ответь мы «записали», на экране
    // осталось бы значение, которого в файле нет.
    const backend = createProjectSettingsBackend();
    backend.useSource(fakeSource({}, { writable: false }));

    expect(backend.writable()).toBe(false);
    await expect(backend.write('workspace', 'theme', 'dark')).rejects.toThrow('не принимает');
  });

  it('без проекта писать некуда', async () => {
    const backend = createProjectSettingsBackend();

    expect(backend.writable()).toBe(false);
    await expect(backend.write('workspace', 'theme', 'dark')).rejects.toThrow();
  });
});
