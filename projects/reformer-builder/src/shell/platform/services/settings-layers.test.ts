/**
 * Переезд настроек проекта из браузера в файл — и то, что при нём нельзя потерять.
 *
 * Здесь проверяется не «куда пишем», а честность перехода: у открытых проектов в IndexedDB
 * уже что-то записано, и человек не должен ни заметить переезда, ни лишиться настроек.
 * Отсюда три вопроса, на которые отвечают проверки ниже: читаем ли прежнее, пока файла нет;
 * переносим ли прежнее ЦЕЛИКОМ при первой записи; куда пишем, если папку открыли на чтение.
 *
 * @module shell/platform/services/settings-layers.test
 */

import { describe, expect, it } from 'vitest';

import type { SettingsScope } from '@reformer/builder-plugin-api/internal';
import { createLayeredSettingsBackend } from './settings-layers';
import type { SettingsBackend } from './settings';
import type { ProjectSettingsBackend } from './settings-project';

/** Хранилище-двойник: две области в памяти. */
function memoryBackend(initial: Partial<Record<SettingsScope, Record<string, unknown>>> = {}) {
  const bags: Record<SettingsScope, Record<string, unknown>> = {
    user: { ...initial.user },
    workspace: { ...initial.workspace },
  };
  const backend: SettingsBackend = {
    read: (scope) => Promise.resolve({ ...bags[scope] }),
    write: (scope, key, value) => {
      bags[scope][key] = value;
      return Promise.resolve();
    },
    remove: (scope, key) => {
      delete bags[scope][key];
      return Promise.resolve();
    },
  };
  return { backend, bags };
}

/** Файл проекта-двойник: право записи задаётся, содержимое видно. */
function fileBackend(initial: Record<string, unknown> = {}, writable = true) {
  const file: Record<string, unknown> = { ...initial };
  const backend: ProjectSettingsBackend = {
    useSource: () => {},
    writable: () => writable,
    read: (scope) => Promise.resolve(scope === 'workspace' ? { ...file } : {}),
    write: (scope, key, value) => {
      if (scope !== 'workspace') return Promise.resolve();
      if (!writable) return Promise.reject(new Error('источник не принимает запись'));
      file[key] = value;
      return Promise.resolve();
    },
    remove: (scope, key) => {
      if (scope !== 'workspace') return Promise.resolve();
      delete file[key];
      return Promise.resolve();
    },
  };
  return { backend, file };
}

describe('чтение', () => {
  it('пока файла нет — читаем прежнее место', async () => {
    // Человек не должен заметить переезда: он открыл проект и увидел свои настройки.
    const browser = memoryBackend({ workspace: { kit: 'acme' }, user: { theme: 'dark' } });
    const project = fileBackend();
    const layered = createLayeredSettingsBackend({
      browser: browser.backend,
      project: project.backend,
    });

    expect(await layered.read('workspace')).toEqual({ kit: 'acme' });
    expect(await layered.read('user')).toEqual({ theme: 'dark' });
  });

  it('появился файл — прежнее место перестаёт читаться', async () => {
    const browser = memoryBackend({ workspace: { kit: 'старый' } });
    const project = fileBackend({ kit: 'новый' });
    const layered = createLayeredSettingsBackend({
      browser: browser.backend,
      project: project.backend,
    });

    expect(await layered.read('workspace')).toEqual({ kit: 'новый' });
  });

  it('область user из файла не читается вовсе', async () => {
    const browser = memoryBackend({ user: { theme: 'dark' } });
    const project = fileBackend({ theme: 'light' });
    const layered = createLayeredSettingsBackend({
      browser: browser.backend,
      project: project.backend,
    });

    expect(await layered.read('user')).toEqual({ theme: 'dark' });
  });
});

describe('первая запись', () => {
  it('переносит прежние значения ЦЕЛИКОМ, а не только изменённый ключ', async () => {
    // Иначе переключение одной галочки обнулило бы остальные: файл стал бы старше прежней
    // записи и при этом главнее её.
    const browser = memoryBackend({ workspace: { kit: 'acme', 'plugins.enabled': ['a'] } });
    const project = fileBackend();
    const layered = createLayeredSettingsBackend({
      browser: browser.backend,
      project: project.backend,
    });

    await layered.read('workspace');
    await layered.write('workspace', 'theme', 'dark');

    expect(project.file).toEqual({ kit: 'acme', 'plugins.enabled': ['a'], theme: 'dark' });
  });

  it('прежнее место не чистится: туда можно вернуться', async () => {
    const browser = memoryBackend({ workspace: { kit: 'acme' } });
    const project = fileBackend();
    const layered = createLayeredSettingsBackend({
      browser: browser.backend,
      project: project.backend,
    });

    await layered.write('workspace', 'theme', 'dark');

    expect(browser.bags.workspace).toEqual({ kit: 'acme' });
  });

  it('второй записи перенос не повторяется', async () => {
    const browser = memoryBackend({ workspace: { kit: 'acme' } });
    const project = fileBackend();
    const layered = createLayeredSettingsBackend({
      browser: browser.backend,
      project: project.backend,
    });

    await layered.write('workspace', 'theme', 'dark');
    // Прежнее значение меняется ПОСЛЕ переезда — оно уже не должно доехать до файла.
    await browser.backend.write('workspace', 'kit', 'другой');
    await layered.write('workspace', 'locale', 'ru');

    expect(project.file).toEqual({ kit: 'acme', theme: 'dark', locale: 'ru' });
  });
});

describe('источник без записи', () => {
  it('настройка сохраняется в прежнее место, а файл остаётся нетронутым', async () => {
    // Потерять настройку человека из-за того, что папку открыли на чтение, — худший исход;
    // записать в такую папку невозможно физически. Отсюда названная деградация.
    const browser = memoryBackend();
    const project = fileBackend({}, false);
    const layered = createLayeredSettingsBackend({
      browser: browser.backend,
      project: project.backend,
    });

    await layered.write('workspace', 'theme', 'dark');

    expect(browser.bags.workspace).toEqual({ theme: 'dark' });
    expect(project.file).toEqual({});
  });
});

describe('снятие записи', () => {
  it('убирает ключ и из файла, и из прежнего места', async () => {
    // Иначе снятое значение вернулось бы при следующем открытии проекта без файла —
    // то есть «вернуться к глобальному» работало бы через раз.
    const browser = memoryBackend({ workspace: { theme: 'dark' } });
    const project = fileBackend({ theme: 'dark' });
    const layered = createLayeredSettingsBackend({
      browser: browser.backend,
      project: project.backend,
    });

    await layered.remove('workspace', 'theme');

    expect(project.file).toEqual({});
    expect(browser.bags.workspace).toEqual({});
  });
});
