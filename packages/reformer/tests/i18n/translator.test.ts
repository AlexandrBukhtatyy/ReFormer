import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LOCALE, type FormLocale } from '../../src/i18n/locale';
import { createI18n, translateBuiltin } from '../../src/i18n/translator';
import { ru as coreRu } from '../../src/locale/ru';

afterEach(() => {
  vi.restoreAllMocks();
});

const BUILTIN = {
  'kit.select.clear': 'Clear selection',
  'kit.select.selected': 'Selected: {count}',
  'kit.files.added': '{count, plural, one{# file added} other{# files added}}',
};

describe('translateBuiltin — ключ пакета', () => {
  it('берёт сообщение локали и форматирует по её языку', () => {
    const locale: FormLocale = {
      code: 'ru',
      messages: {
        'kit.files.added':
          '{count, plural, one{Добавлен # файл} few{Добавлено # файла} other{Добавлено # файлов}}',
      },
    };

    expect(translateBuiltin(locale, BUILTIN, 'kit.files.added', { count: 3 })).toBe(
      'Добавлено 3 файла'
    );
  });

  it('ключа нет в локали — встроенный английский, по английским правилам', () => {
    const locale: FormLocale = { code: 'ru', messages: {} };

    expect(translateBuiltin(locale, BUILTIN, 'kit.select.clear')).toBe('Clear selection');
    // 21 по-русски — форма «one», но встроенная таблица английская: там это «other».
    expect(translateBuiltin(locale, BUILTIN, 'kit.files.added', { count: 21 })).toBe(
      '21 files added'
    );
  });

  it('без провайдера (локаль по умолчанию) пакет говорит встроенным английским', () => {
    expect(translateBuiltin(DEFAULT_LOCALE, BUILTIN, 'kit.select.selected', { count: 4 })).toBe(
      'Selected: 4'
    );
  });

  it('битое сообщение локали откатывается на встроенное и сообщает об этом один раз', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const locale: FormLocale = {
      code: 'ru',
      messages: { 'kit.select.selected': 'Выбрано: {count' },
    };

    expect(translateBuiltin(locale, BUILTIN, 'kit.select.selected', { count: 2 })).toBe(
      'Selected: 2'
    );
    expect(translateBuiltin(locale, BUILTIN, 'kit.select.selected', { count: 5 })).toBe(
      'Selected: 5'
    );
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]![0])).toContain('kit.select.selected');
  });

  it('сообщение-не-строка из сетевого словаря не роняет рендер', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const locale = { code: 'ru', messages: { 'kit.select.clear': 42 } } as unknown as FormLocale;

    expect(translateBuiltin(locale, BUILTIN, 'kit.select.clear')).toBe('Clear selection');
  });

  it('пропущенная подстановка видна как {name}, а не маркером и не исключением', () => {
    expect(translateBuiltin(DEFAULT_LOCALE, BUILTIN, 'kit.select.selected')).toBe(
      'Selected: {count}'
    );
  });

  it('ключ, которого нет нигде, возвращается как есть', () => {
    expect(translateBuiltin(DEFAULT_LOCALE, BUILTIN, 'kit.unknown')).toBe('kit.unknown');
  });

  it('ключи из прототипа объекта словарём не считаются', () => {
    expect(translateBuiltin(DEFAULT_LOCALE, BUILTIN, 'constructor')).toBe('constructor');
    expect(translateBuiltin(DEFAULT_LOCALE, BUILTIN, 'toString')).toBe('toString');
  });
});

describe('createI18n — ручка локали', () => {
  const locale: FormLocale = {
    code: 'ru',
    messages: {
      'cart.items': '{count, plural, one{# товар} few{# товара} other{# товаров}}',
      'profile.title': 'Профиль',
    },
  };

  it('для одного объекта локали — одна ручка', () => {
    expect(createI18n(locale)).toBe(createI18n(locale));
    expect(createI18n({ ...locale })).not.toBe(createI18n(locale));
  });

  it('несёт локаль и код', () => {
    const i18n = createI18n(locale);

    expect(i18n.locale).toBe(locale);
    expect(i18n.code).toBe('ru');
  });

  it('has смотрит только в словарь локали', () => {
    const i18n = createI18n(locale);

    expect(i18n.has('profile.title')).toBe(true);
    expect(i18n.has('format.fileSize.kb')).toBe(false);
    expect(i18n.has('toString')).toBe(false);
  });

  describe('t — ключ приложения', () => {
    it('переводит по словарю локали', () => {
      const i18n = createI18n(locale);

      expect(i18n.t('profile.title')).toBe('Профиль');
      expect(i18n.t('cart.items', { count: 3 })).toBe('3 товара');
    });

    it('ключа нет — defaultMessage, отформатированный как английский', () => {
      const i18n = createI18n(locale);

      expect(i18n.t('cart.empty', undefined, 'Your cart is empty')).toBe('Your cart is empty');
      expect(
        i18n.t('cart.total', { count: 21 }, '{count, plural, one{# item} other{# items}}')
      ).toBe('21 items');
    });

    it('ключа нет и defaultMessage не задан — сам ключ и одно предупреждение', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const i18n = createI18n({ code: 'ru', messages: {} });

      expect(i18n.t('app.unknown')).toBe('app.unknown');
      expect(i18n.t('app.unknown')).toBe('app.unknown');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]![0])).toContain('app.unknown');
    });

    it('с defaultMessage предупреждения нет: неполная локаль — законный сценарий', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      createI18n({ code: 'de', messages: {} }).t('app.title', undefined, 'Title');
      expect(warn).not.toHaveBeenCalled();
    });

    it('битый defaultMessage не роняет перевод', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(createI18n({ code: 'ru', messages: {} }).t('app.x', undefined, '{broken')).toBe(
        'app.x'
      );
    });
  });

  describe('number и date', () => {
    it('число — по правилам языка', () => {
      expect(createI18n({ code: 'en', messages: {} }).number(1234.5)).toBe('1,234.5');
      // В русском разделитель разрядов — неразрывный пробел; сравниваем без привязки к его коду.
      expect(createI18n(locale).number(1234.5).replace(/\s/g, ' ')).toBe('1 234,5');
      expect(createI18n(locale).number(0.256, { style: 'percent' }).replace(/\s/g, ' ')).toBe(
        '26 %'
      );
    });

    it('дата — по правилам языка', () => {
      const date = new Date(2024, 0, 15);

      expect(createI18n({ code: 'en', messages: {} }).date(date, { dateStyle: 'long' })).toBe(
        'January 15, 2024'
      );
      expect(createI18n(locale).date(date, { dateStyle: 'long' })).toBe('15 января 2024 г.');
    });
  });

  describe('fileSize', () => {
    const en = createI18n(DEFAULT_LOCALE);
    const ruI18n = createI18n(coreRu);

    it('без провайдера — английские единицы', () => {
      expect(en.fileSize(0)).toBe('0 B');
      expect(en.fileSize(512)).toBe('512 B');
      expect(en.fileSize(1024)).toBe('1 KB');
      expect(en.fileSize(1536)).toBe('1.5 KB');
      expect(en.fileSize(5_242_880)).toBe('5 MB');
      expect(en.fileSize(1024 ** 3 * 2.25)).toBe('2.3 GB');
      expect(en.fileSize(1024 ** 4 * 3)).toBe('3 TB');
    });

    it('в русской локали — русские единицы и десятичная запятая', () => {
      expect(ruI18n.fileSize(512)).toBe('512 Б');
      expect(ruI18n.fileSize(1024)).toBe('1 КБ');
      expect(ruI18n.fileSize(1536)).toBe('1,5 КБ');
      expect(ruI18n.fileSize(5_242_880)).toBe('5 МБ');
    });

    it('без разделителя разрядов и выше терабайта не уходит', () => {
      expect(en.fileSize(1023)).toBe('1023 B');
      expect(en.fileSize(1024 ** 5 * 2)).toBe('2048 TB');
    });

    it('некорректный размер — пустая строка', () => {
      expect(en.fileSize(-1)).toBe('');
      expect(en.fileSize(Number.NaN)).toBe('');
      expect(en.fileSize(Number.POSITIVE_INFINITY)).toBe('');
    });

    it('единицы локали без своих ключей берутся из встроенной таблицы ядра', () => {
      expect(createI18n({ code: 'de', messages: {} }).fileSize(1536)).toBe('1,5 KB');
    });
  });
});
