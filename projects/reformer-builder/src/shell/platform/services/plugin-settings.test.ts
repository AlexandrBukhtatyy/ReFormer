/**
 * Настройки плагина поверх службы настроек.
 *
 * Проверяется то, из-за чего эта обёртка существует: адрес ключа (он определяет область
 * хранения и пер-проектность), терпимость к чужому значению в хранилище и сброс СНЯТИЕМ,
 * а не записью пустого объекта.
 *
 * @module shell/platform/services/plugin-settings.test
 */

import { describe, expect, it } from 'vitest';
import { createInMemorySettingsBackend, createSettingsService } from './settings';
import { createPluginSettings, pluginSettingsKey } from './plugin-settings';

async function service() {
  const settings = createSettingsService(createInMemorySettingsBackend({}));
  await settings.hydrate();
  return settings;
}

describe('ключ настроек плагина', () => {
  it('начинается с workspace: область выводится из префикса, и уронить настройку в глобальную нельзя', () => {
    // Без префикса пришлось бы каждый раз помнить третий аргумент `set`, а забытый аргумент
    // означал бы «база из проекта A подставилась в проекте B».
    expect(pluginSettingsKey('hello')).toBe('workspace.plugin.hello.settings');
  });

  it('пустой идентификатор — ошибка, а не ключ с дыркой посередине', () => {
    expect(() => pluginSettingsKey('  ')).toThrow();
  });
});

describe('значения настроек плагина', () => {
  it('пока не записано — пусто, а не undefined', async () => {
    const plugin = createPluginSettings(await service(), 'hello');

    expect(plugin.read()).toEqual({});
  });

  it('записанное читается синхронно: форма рисуется первым кадром', async () => {
    const plugin = createPluginSettings(await service(), 'hello');

    await plugin.write({ endpoint: 'https://example.com', retries: 3 });

    expect(plugin.read()).toEqual({ endpoint: 'https://example.com', retries: 3 });
  });

  it('чужая форма данных в хранилище считается отсутствием, а не роняет чтение', async () => {
    // В хранилище лежит то, что положили прошлые версии приложения или правка руками.
    const settings = await service();
    await settings.set(pluginSettingsKey('hello'), 'строка вместо объекта');

    expect(createPluginSettings(settings, 'hello').read()).toEqual({});
  });

  it('сброс СНИМАЕТ запись, а не пишет пустой объект', async () => {
    // Пустой объект перекрыл бы умолчания плагина, и «сброс» дал бы форму без значений.
    const settings = await service();
    settings.registerDefault(pluginSettingsKey('hello'), { endpoint: 'по умолчанию' });
    const plugin = createPluginSettings(settings, 'hello');
    await plugin.write({ endpoint: 'своё' });

    await plugin.reset();

    expect(plugin.read()).toEqual({ endpoint: 'по умолчанию' });
  });

  it('подписка срабатывает на СВОЙ ключ и молчит на чужой', async () => {
    const settings = await service();
    const plugin = createPluginSettings(settings, 'hello');
    let calls = 0;
    plugin.onDidChange(() => {
      calls += 1;
    });

    await settings.set(pluginSettingsKey('acme'), { x: 1 });
    expect(calls).toBe(0);

    await settings.set(pluginSettingsKey('hello'), { x: 1 });
    expect(calls).toBe(1);
  });
});
