/**
 * Выбор профиля до сборки приложения: что считается выбором, а что — его отсутствием.
 *
 * Отсюда имя идёт прямо в сборку состава, поэтому граница одна и жёсткая: либо непустая строка,
 * либо `null`. Всё остальное — мусор в хранилище, отказ хранилища, его отсутствие — обязано
 * читаться как «человек ничего не выбирал», а не как исключение на пути запуска.
 *
 * @module shell/boot/stored-preset.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorkspaceMetaStore } from '@/shell/platform/workspace/storage/idb';
import { createMemoryIndexedDb } from '@/shell/platform/workspace/storage/testing';
import { PRESET_SETTINGS_KEY, readStoredPreset } from './stored-preset';

/** Кладёт запись области `user` так, как её оставила бы служба настроек. */
async function withUserSettings(values: Record<string, unknown>): Promise<IDBFactory> {
  const { factory } = createMemoryIndexedDb();
  const store = createWorkspaceMetaStore({ factory });
  await store.putAppSettings('user', values);
  store.dispose();
  return factory;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('readStoredPreset', () => {
  it('записи нет — выбора нет', async () => {
    const { factory } = createMemoryIndexedDb();

    await expect(readStoredPreset({ factory })).resolves.toBeNull();
  });

  it('имя профиля читается из области user, соседние настройки не мешают', async () => {
    const factory = await withUserSettings({
      'host.theme': 'dark',
      [PRESET_SETTINGS_KEY]: 'rjsf.builder',
    });

    await expect(readStoredPreset({ factory })).resolves.toBe('rjsf.builder');
  });

  it('не-строка и пустая строка — мусор, а не выбор', async () => {
    for (const value of [42, null, ['rjsf.builder'], '   ']) {
      const factory = await withUserSettings({ [PRESET_SETTINGS_KEY]: value });

      await expect(readStoredPreset({ factory })).resolves.toBeNull();
    }
  });

  it('IndexedDB в окружении нет — выбора нет, и запуск не падает', async () => {
    // Окружение тестов — `node`: глобального `indexedDB` нет, как в приватном окне части движков.
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(readStoredPreset()).resolves.toBeNull();
  });

  it('хранилище отпускается: чтение не держит соединение за собой', async () => {
    const memory = createMemoryIndexedDb();

    await readStoredPreset({ factory: memory.factory });
    await readStoredPreset({ factory: memory.factory });

    // Удерживай чтение своё хранилище, второе взяло бы то же соединение из пула — открытий
    // было бы одно. Два открытия означают, что первое соединение закрыто.
    expect(memory.control.opens).toBe(2);
  });
});
