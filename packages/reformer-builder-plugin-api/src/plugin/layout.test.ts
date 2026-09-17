import { describe, expect, it } from 'vitest';

import { isPluginCodeFile } from './layout';
import { parseMessagesBundle } from './messages-bundle';

describe('раскладка каталога плагина', () => {
  it('код узнаётся по расширению без учёта регистра', () => {
    expect(isPluginCodeFile('src/Main.TS')).toBe(true);
    expect(isPluginCodeFile('main.mjs')).toBe(true);
    expect(isPluginCodeFile('locales/ru.json')).toBe(false);
    expect(isPluginCodeFile('styles.css')).toBe(false);
  });
});

describe('словарь плагина', () => {
  it('принимает плоский объект строк', () => {
    expect(parseMessagesBundle('{"command.run":"Запуск"}')).toEqual({
      ok: true,
      bundle: { 'command.run': 'Запуск' },
    });
  });

  it('вложенный объект и массив — отказ с причиной', () => {
    const nested = parseMessagesBundle('{"command":{"run":"Запуск"}}');
    const array = parseMessagesBundle('[]');

    expect(nested.ok || nested.reason).toContain('«command»');
    expect(array.ok || array.reason).toBe('должен быть объектом JSON');
  });
});
