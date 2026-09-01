import { describe, expect, it } from 'vitest';

import { definePlugin } from './types';

describe('definePlugin', () => {
  it('возвращает тот же объект', () => {
    const plugin = { id: 'acme', activate: () => {} };

    expect(definePlugin(plugin)).toBe(plugin);
  });

  it('не даёт объявить плагин с пустым идентификатором', () => {
    // Пустой id стал бы пространством имён хранилища и пометкой на вкладах: диагностика
    // превратилась бы в «вклад плагина «»».
    expect(() => definePlugin({ id: '', activate: () => {} })).toThrow(/пуст/);
    expect(() => definePlugin({ id: '   ', activate: () => {} })).toThrow(/пуст/);
  });

  it('замораживает объявление: id — ключ во всех реестрах и меняться не может', () => {
    const plugin = definePlugin({ id: 'acme', activate: () => {} });

    expect(Object.isFrozen(plugin)).toBe(true);
  });
});
