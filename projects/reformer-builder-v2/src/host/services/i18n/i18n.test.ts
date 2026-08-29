import { describe, expect, it, vi } from 'vitest';

import { createI18nService, FALLBACK_LOCALE, type I18nServiceOptions } from './i18n';
import { MessageSyntaxError } from './message-format';

/**
 * Словари Host для тестов. Настоящие `locales/*.json` проверяются отдельно — через загрузчик
 * по умолчанию; здесь нужен управляемый набор, в том числе ключ, которого нет в `ru`.
 */
const HOST_MESSAGES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  en: {
    'app.title': 'ReFormer Builder v2',
    'app.hello': 'Hello, {name}',
    'files.count': '{count, plural, one{# file} other{# files}}',
    'only.en': 'English only',
  },
  ru: {
    'app.title': 'ReFormer Builder v2',
    'app.hello': 'Привет, {name}',
    'files.count': '{count, plural, one{# файл} few{# файла} many{# файлов} other{# файла}}',
  },
};

const create = (options: I18nServiceOptions = {}) =>
  createI18nService({
    dev: true,
    loadHostMessages: (locale) => Promise.resolve(HOST_MESSAGES[locale] ?? {}),
    ...options,
  });

/**
 * Ожидаемые строки с числами считаются через `Intl`, а не пишутся литералом.
 *
 * `Intl.NumberFormat('ru')` разделяет группы неразрывным пробелом U+00A0: литерал «1 234»
 * с обычным пробелом выглядит идентично и не совпадает.
 */
const num = (locale: string, value: number): string => new Intl.NumberFormat(locale).format(value);

const BROKEN_PLURAL = '{count, plural, one{# файл}}';

describe('словарь Host', () => {
  it('до первого setLocale словарь пуст, и это видно маркером', () => {
    const i18n = create();

    expect(i18n.locale).toBe(FALLBACK_LOCALE);
    expect(i18n.t('app.title')).toBe('⟦app.title⟧');
  });

  it('setLocale загружает словарь и меняет активную локаль', async () => {
    const i18n = create();

    await i18n.setLocale('ru');

    expect(i18n.locale).toBe('ru');
    expect(i18n.t('app.hello', { name: 'мир' })).toBe('Привет, мир');
  });

  it('setLocale текущей локали догружает её словарь и не считается сменой', async () => {
    const i18n = create();
    const seen = vi.fn();
    i18n.onDidChangeLocale(seen);

    await i18n.setLocale(FALLBACK_LOCALE);

    expect(i18n.t('app.title')).toBe('ReFormer Builder v2');
    expect(seen).not.toHaveBeenCalled();
  });

  it('словарь локали загружается один раз', async () => {
    const load = vi.fn((locale: string) => Promise.resolve(HOST_MESSAGES[locale] ?? {}));
    const i18n = create({ loadHostMessages: load });

    await i18n.setLocale('ru');
    await i18n.setLocale('en');
    await i18n.setLocale('ru');

    expect(load.mock.calls.map(([locale]) => locale)).toEqual(['ru', 'en']);
  });

  it('загрузчик по умолчанию подключает настоящие locales/*.json', async () => {
    const i18n = createI18nService({ dev: true });

    await i18n.setLocale('ru');
    expect(i18n.t('app.shell.placeholder')).toBe('Каркас проекта. Оболочки ещё нет.');

    await i18n.setLocale('en');
    expect(i18n.t('app.shell.placeholder')).toBe('Project skeleton. There is no shell yet.');
  });

  it('множественные формы считаются по активной локали', async () => {
    const i18n = create();

    await i18n.setLocale('ru');
    expect(i18n.t('files.count', { count: 1 })).toBe('1 файл');
    // Через Intl, а не литералом: в ru разделитель групп — неразрывный пробел.
    expect(i18n.t('files.count', { count: 1234 })).toBe(`${num('ru', 1234)} файла`);

    await i18n.setLocale('en');
    expect(i18n.t('files.count', { count: 1234 })).toBe(`${num('en', 1234)} files`);
  });
});

describe('пространство имён плагина', () => {
  it('ключи плагина префиксуются его идентификатором', () => {
    const i18n = create();
    const acme = i18n.forPlugin('acme');

    acme.contribute(FALLBACK_LOCALE, { 'panel.title': 'Acme panel' });

    expect(acme.t('panel.title')).toBe('Acme panel');
  });

  it('словарь плагина не виден Host — ни под коротким ключом, ни под полным', () => {
    const i18n = create();
    i18n.forPlugin('acme').contribute(FALLBACK_LOCALE, { 'panel.title': 'Acme panel' });

    expect(i18n.t('panel.title')).toBe('⟦panel.title⟧');
    expect(i18n.t('acme.panel.title')).toBe('⟦acme.panel.title⟧');
  });

  it('два плагина с одинаковыми ключами не пересекаются', () => {
    const i18n = create();
    const acme = i18n.forPlugin('acme');
    const other = i18n.forPlugin('other');

    acme.contribute(FALLBACK_LOCALE, { 'panel.title': 'Acme panel' });
    other.contribute(FALLBACK_LOCALE, { 'panel.title': 'Other panel' });

    expect(acme.t('panel.title')).toBe('Acme panel');
    expect(other.t('panel.title')).toBe('Other panel');
  });

  it('идентификатор с точкой не даёт добраться до словаря вложенного плагина', () => {
    const i18n = create();
    const acme = i18n.forPlugin('acme');
    const nested = i18n.forPlugin('acme.sub');

    // При хранении «плоским префиксом» обе записи заняли бы ключ acme.sub.title.
    acme.contribute(FALLBACK_LOCALE, { 'sub.title': 'from acme' });
    nested.contribute(FALLBACK_LOCALE, { title: 'from acme.sub' });

    expect(acme.t('sub.title')).toBe('from acme');
    expect(nested.t('title')).toBe('from acme.sub');
  });

  it('повторный forPlugin отдаёт тот же объект', () => {
    const i18n = create();

    expect(i18n.forPlugin('acme')).toBe(i18n.forPlugin('acme'));
    expect(i18n.forPlugin('acme')).not.toBe(i18n.forPlugin('other'));
  });

  it('в виде плагина нет способа назвать чужой pluginId', () => {
    const i18n = create();
    const acme = i18n.forPlugin('acme');

    expect(Object.keys(acme).sort()).toEqual(['contribute', 't']);
    expect('forPlugin' in acme).toBe(false);
  });

  it('пустой идентификатор плагина отвергается', () => {
    const i18n = create();

    expect(() => i18n.forPlugin('   ')).toThrow(/пуст/);
  });

  it('повторный contribute дополняет словарь, а не заменяет его', () => {
    const i18n = create();
    const acme = i18n.forPlugin('acme');

    acme.contribute(FALLBACK_LOCALE, { 'panel.title': 'Acme panel' });
    acme.contribute(FALLBACK_LOCALE, { 'panel.empty': 'Nothing here' });

    expect(acme.t('panel.title')).toBe('Acme panel');
    expect(acme.t('panel.empty')).toBe('Nothing here');
  });
});

describe('отсутствующий ключ', () => {
  it('в разработке — заметный маркер', async () => {
    const i18n = create({ dev: true });
    await i18n.setLocale('ru');

    expect(i18n.t('files.title')).toBe('⟦files.title⟧');
  });

  it('в разработке маркер виден, даже если резервный словарь ключ прикрыл бы', async () => {
    const i18n = create({ dev: true });
    await i18n.setLocale('ru');

    expect(i18n.t('only.en')).toBe('⟦only.en⟧');
  });

  it('в сборке — откат на en', async () => {
    const i18n = create({ dev: false });
    await i18n.setLocale('ru');

    expect(i18n.t('only.en')).toBe('English only');
  });

  it('в сборке промах в обеих локалях даёт маркер, а не сам ключ', async () => {
    const i18n = create({ dev: false });
    await i18n.setLocale('ru');

    expect(i18n.t('files.title')).toBe('⟦files.title⟧');
  });

  it('откат форматируется по правилам резервной локали, а не активной', async () => {
    const i18n = create({ dev: false });
    const acme = i18n.forPlugin('acme');
    acme.contribute('en', { 'files.count': '{count, plural, one{# file} other{# files}}' });
    acme.contribute('ru', { 'panel.title': 'Панель' });

    await i18n.setLocale('ru');

    // Английский разделитель групп, английская форма: сообщение английское.
    expect(acme.t('files.count', { count: 1234 })).toBe(`${num('en', 1234)} files`);
  });

  it('маркер плагина называет ключ вместе с пространством имён', () => {
    const i18n = create({ dev: true });

    expect(i18n.forPlugin('acme').t('panel.title')).toBe('⟦acme.panel.title⟧');
  });

  it('по умолчанию режим берётся из import.meta.env.DEV', async () => {
    // Vitest выполняет тесты в режиме разработки, поэтому умолчание обязано дать маркер.
    expect(import.meta.env.DEV).toBe(true);
    const i18n = createI18nService({
      loadHostMessages: (locale) => Promise.resolve(HOST_MESSAGES[locale] ?? {}),
    });

    await i18n.setLocale('ru');

    expect(i18n.t('only.en')).toBe('⟦only.en⟧');
  });
});

describe('разбор словаря — на регистрации', () => {
  it('сообщение без ветки other отвергается с указанием ключа', () => {
    const acme = create().forPlugin('acme');

    expect(() => acme.contribute('ru', { 'files.count': BROKEN_PLURAL })).toThrow(/files\.count/);
  });

  it('отказ называет владельца словаря и локаль', () => {
    const acme = create().forPlugin('acme');

    expect(() => acme.contribute('ru', { 'files.count': BROKEN_PLURAL })).toThrow(/acme/);
    expect(() => acme.contribute('ru', { 'files.count': BROKEN_PLURAL })).toThrow(/«ru»/);
  });

  it('причина отказа сохраняется в cause', () => {
    const acme = create().forPlugin('acme');

    let caught: unknown;
    try {
      acme.contribute('ru', { 'files.count': BROKEN_PLURAL });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).cause).toBeInstanceOf(MessageSyntaxError);
  });

  it('ни один ключ битого словаря не регистрируется', () => {
    const i18n = create();
    const acme = i18n.forPlugin('acme');

    expect(() =>
      acme.contribute(FALLBACK_LOCALE, {
        'panel.title': 'Acme panel',
        'files.count': BROKEN_PLURAL,
      })
    ).toThrow();

    expect(acme.t('panel.title')).toBe('⟦acme.panel.title⟧');
  });

  it('битый словарь Host отвергает setLocale', async () => {
    const i18n = create({
      loadHostMessages: () => Promise.resolve({ 'files.count': BROKEN_PLURAL }),
    });

    await expect(i18n.setLocale('ru')).rejects.toThrow(/files\.count/);
  });

  it('пустая локаль словаря отвергается', () => {
    const acme = create().forPlugin('acme');

    expect(() => acme.contribute('   ', { 'panel.title': 'Acme panel' })).toThrow(/пуст/);
  });
});

describe('смена локали', () => {
  it('уведомляет подписчиков новым значением', async () => {
    const i18n = create();
    const seen = vi.fn();
    i18n.onDidChangeLocale(seen);

    await i18n.setLocale('ru');

    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith('ru');
  });

  it('dispose отписывает', async () => {
    const i18n = create();
    const seen = vi.fn();
    const subscription = i18n.onDidChangeLocale(seen);

    subscription.dispose();
    await i18n.setLocale('ru');

    expect(seen).not.toHaveBeenCalled();
  });

  it('словари плагинов переживают смену локали', async () => {
    const i18n = create();
    const acme = i18n.forPlugin('acme');
    acme.contribute('en', { 'panel.title': 'Acme panel' });
    acme.contribute('ru', { 'panel.title': 'Панель Acme' });

    await i18n.setLocale('ru');
    expect(acme.t('panel.title')).toBe('Панель Acme');

    await i18n.setLocale('en');
    expect(acme.t('panel.title')).toBe('Acme panel');

    await i18n.setLocale('ru');
    expect(acme.t('panel.title')).toBe('Панель Acme');
  });

  it('плагин может внести словарь после смены локали', async () => {
    const i18n = create();
    await i18n.setLocale('ru');

    const acme = i18n.forPlugin('acme');
    acme.contribute('ru', { 'panel.title': 'Панель Acme' });

    expect(acme.t('panel.title')).toBe('Панель Acme');
  });

  it('падение одного подписчика не мешает остальным, но не теряется', async () => {
    const i18n = create();
    const survivor = vi.fn();
    i18n.onDidChangeLocale(() => {
      throw new Error('подписчик упал');
    });
    i18n.onDidChangeLocale(survivor);

    await expect(i18n.setLocale('ru')).rejects.toThrow('подписчик упал');

    // Смена состоялась: подписчик не вправе её отменить.
    expect(survivor).toHaveBeenCalledWith('ru');
    expect(i18n.locale).toBe('ru');
  });

  it('пустая локаль отвергается', async () => {
    const i18n = create();

    await expect(i18n.setLocale('   ')).rejects.toThrow(/пуст/);
    expect(i18n.locale).toBe(FALLBACK_LOCALE);
  });

  it('локаль, которой нет у Host, — не ошибка: словарь плагина работает', async () => {
    const i18n = create();
    const acme = i18n.forPlugin('acme');
    acme.contribute('de', { 'panel.title': 'Acme-Panel' });
    acme.contribute('en', { 'panel.title': 'Acme panel' });

    await i18n.setLocale('de');

    expect(i18n.locale).toBe('de');
    expect(acme.t('panel.title')).toBe('Acme-Panel');
    // У Host словаря на de нет; в разработке это видно маркером.
    expect(i18n.t('app.title')).toBe('⟦app.title⟧');
  });
});
