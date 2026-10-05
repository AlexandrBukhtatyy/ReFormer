import { afterEach, describe, expect, it, vi } from 'vitest';
import { hostMessagesWith } from './application-messages';

const host = (locale: string) =>
  Promise.resolve(
    locale === 'ru'
      ? { 'app.title': 'Приложение', 'shell.menu.file': 'Файл' }
      : { 'app.title': 'Application', 'shell.menu.file': 'File' }
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe('тексты приложения поверх словаря оболочки', () => {
  it('без текстов приложения словарь оболочки отдаётся как есть — имя нейтральное', async () => {
    const load = hostMessagesWith(host, undefined);

    expect(await load('ru')).toEqual({ 'app.title': 'Приложение', 'shell.menu.file': 'Файл' });
  });

  it('приложение называет себя: его имя ложится поверх нейтрального, остальное цело', async () => {
    const load = hostMessagesWith(host, {
      ru: { 'app.title': 'Конструктор Acme' },
      en: { 'app.title': 'Acme Builder' },
    });

    expect(await load('ru')).toEqual({
      'app.title': 'Конструктор Acme',
      'shell.menu.file': 'Файл',
    });
    expect((await load('en'))['app.title']).toBe('Acme Builder');
  });

  it('локаль, для которой приложение текстов не дало, остаётся с текстами оболочки', async () => {
    const load = hostMessagesWith(host, { ru: { 'app.title': 'Конструктор Acme' } });

    expect((await load('en'))['app.title']).toBe('Application');
  });

  it('чужой ключ пропускается со словом в консоль: приложение представляется, а не переписывает оболочку', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const load = hostMessagesWith(host, {
      ru: { 'app.title': 'Конструктор Acme', 'shell.menu.file': 'Документ' },
    });

    expect(await load('ru')).toEqual({
      'app.title': 'Конструктор Acme',
      'shell.menu.file': 'Файл',
    });
    expect(String(warn.mock.calls[0]?.[0])).toContain('shell.menu.file');
  });
});
