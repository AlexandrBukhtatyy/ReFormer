/**
 * Провайдер и хуки. Рендер — через `renderToStaticMarkup`: эффекты там не выполняются, поэтому
 * здесь проверяется то, что видно на первом синхронном кадре. Сама загрузка (порядок ответов,
 * ошибки, удержание прежнего языка) проверена на хранилище без React — `locale-store.test.ts`.
 */
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createLocaleLoader } from '../../src/i18n/loader';
import type { FormLocale } from '../../src/i18n/locale';
import { I18N_CONTEXT_MARKER, I18nContext } from '../../src/platforms/react/i18n/context';
import { useI18n, useMessages, useValidationMessage } from '../../src/platforms/react/i18n/hooks';
import { I18nProvider } from '../../src/platforms/react/i18n/provider';
import { ru as coreRu } from '../../src/locale/ru';

/** Встроенная английская таблица условного пакета. */
const KIT_EN = {
  'kit.select.clear': 'Clear selection',
  'kit.select.selected': 'Selected: {count}',
} as const;

const RU: FormLocale = {
  code: 'ru',
  messages: {
    'kit.select.clear': 'Очистить выбор',
    'kit.select.selected': 'Выбрано: {count}',
    'app.title': 'Профиль',
  },
};

function Probe() {
  const t = useMessages(KIT_EN);
  const { code, pending, t: appT, fileSize } = useI18n();
  return (
    <p data-code={code} data-pending={String(pending)}>
      {t('kit.select.clear')}|{t('kit.select.selected', { count: 3 })}|
      {appT('app.title', undefined, 'Profile')}|{fileSize(1536)}
    </p>
  );
}

describe('без провайдера', () => {
  it('пакет говорит встроенным английским, ключ приложения — своим defaultMessage', () => {
    const html = renderToStaticMarkup(<Probe />);

    expect(html).toContain('data-code="en"');
    expect(html).toContain('data-pending="false"');
    expect(html).toContain('Clear selection|Selected: 3|Profile|1.5 KB');
  });
});

describe('I18nProvider — готовая локаль', () => {
  it('подписи пакета, ключи приложения и форматы идут по локали', () => {
    const html = renderToStaticMarkup(
      <I18nProvider locale={RU}>
        <Probe />
      </I18nProvider>
    );

    expect(html).toContain('data-code="ru"');
    expect(html).toContain('Очистить выбор|Выбрано: 3|Профиль|1,5 KB');
  });

  it('неполная локаль: чего нет в словаре — встроенным английским', () => {
    const partial: FormLocale = { code: 'de', messages: { 'kit.select.clear': 'Auswahl löschen' } };

    const html = renderToStaticMarkup(
      <I18nProvider locale={partial}>
        <Probe />
      </I18nProvider>
    );

    expect(html).toContain('Auswahl löschen|Selected: 3|Profile');
  });

  it('вложенный провайдер заменяет локаль для своего поддерева', () => {
    const html = renderToStaticMarkup(
      <I18nProvider locale={RU}>
        <Probe />
        <I18nProvider locale={{ code: 'en', messages: {} }}>
          <Probe />
        </I18nProvider>
      </I18nProvider>
    );

    expect(html).toContain('Очистить выбор');
    expect(html).toContain('Clear selection');
  });
});

describe('I18nProvider — провайдер грузит сам', () => {
  it('пока первая локаль не загружена, рисуется fallback, а не дерево', () => {
    const load = vi.fn(async () => RU);

    const html = renderToStaticMarkup(
      <I18nProvider lang="ru" load={load} fallback={<i>…</i>}>
        <Probe />
      </I18nProvider>
    );

    expect(html).toBe('<i>…</i>');
    // Рендер чистый: запрос уходит из эффекта, а не из тела компонента.
    expect(load).not.toHaveBeenCalled();
  });

  it('без fallback до первой загрузки не рисуется ничего — английский не мелькает', () => {
    const html = renderToStaticMarkup(
      <I18nProvider lang="ru" load={async () => RU}>
        <Probe />
      </I18nProvider>
    );

    expect(html).toBe('');
  });

  it('локаль уже в кэше загрузчика — первый кадр синхронный', async () => {
    const load = createLocaleLoader([() => RU]);
    await load.preload('ru');

    const html = renderToStaticMarkup(
      <I18nProvider lang="ru" load={load} fallback={<i>…</i>}>
        <Probe />
      </I18nProvider>
    );

    expect(html).toContain('data-code="ru"');
    expect(html).toContain('data-pending="false"');
    expect(html).toContain('Очистить выбор|Выбрано: 3|Профиль');
  });
});

describe('контекст', () => {
  it('несёт маркер, по которому страж ищет его копии в сборках', () => {
    expect(I18nContext.displayName).toBe(I18N_CONTEXT_MARKER);
    expect(I18N_CONTEXT_MARKER).toBe('ReformerI18nContext');
  });
});

describe('useValidationMessage', () => {
  function ErrorText() {
    const message = useValidationMessage();
    return (
      <p>
        {message({ code: 'required', message: '' })}|
        {message({ code: 'minLength', message: '', params: { minLength: 3 } })}|
        {message({ code: 'required', message: 'Укажите телефон' })}
      </p>
    );
  }

  it('без провайдера — английский текст по коду, явное сообщение — как есть', () => {
    expect(renderToStaticMarkup(<ErrorText />)).toBe(
      '<p>This field is required|Enter at least 3 characters|Укажите телефон</p>'
    );
  });

  it('под провайдером — текст на языке локали', () => {
    const html = renderToStaticMarkup(
      <I18nProvider locale={coreRu}>
        <ErrorText />
      </I18nProvider>
    );

    expect(html).toBe('<p>Обязательное поле|Не меньше 3 символов|Укажите телефон</p>');
  });
});
