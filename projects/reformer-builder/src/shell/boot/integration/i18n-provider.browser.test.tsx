/**
 * Провайдер локализации ядра вживую: загрузка языка, переключение на лету, отказ.
 *
 * `I18nProvider` живёт в `@reformer/core/i18n`, но проверяется здесь: у ядра нет браузерного
 * прогона (его тесты рендерят через `renderToStaticMarkup`, где эффекты не выполняются), а связка
 * «эффект запускает загрузку → хранилище меняет состояние → дерево перерисовывается» видна только
 * в настоящем React DOM. Оболочка билдера — первый потребитель провайдера, и тест идёт против
 * собранного `dist` ядра, то есть проверяет ровно тот артефакт, который получит приложение.
 *
 * Порядок прихода ответов и удержание прежнего языка покрыты юнит-тестами хранилища в ядре
 * (`packages/reformer/tests/i18n/locale-store.test.ts`). Здесь — то, чего они не видят: что всё это
 * доходит до экрана и что поддерево при смене языка не перемонтируется.
 *
 * @module shell/boot/integration/i18n-provider.browser.test
 */

import { StrictMode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import {
  createLocaleLoader,
  I18nProvider,
  useI18n,
  useMessages,
  type FormLocale,
  type LocaleLoad,
} from '@reformer/core/i18n';
import { renderReact } from '@/testing/render';

/** Встроенная английская таблица условного пакета. */
const KIT_EN = {
  'kit.clear': 'Clear selection',
  'kit.files': '{count, plural, one{# file} other{# files}}',
};

const LOCALES: Readonly<Record<string, FormLocale>> = {
  ru: {
    code: 'ru',
    messages: {
      'kit.clear': 'Очистить выбор',
      'kit.files': '{count, plural, one{# файл} few{# файла} other{# файлов}}',
    },
  },
  en: { code: 'en', messages: {} },
  de: { code: 'de', messages: { 'kit.clear': 'Auswahl löschen' } },
};

/**
 * Загрузчик, чьи ответы тест отпускает вручную.
 *
 * `resolve`/`reject` сначала дожидаются самого запроса: провайдер отправляет его из эффекта, то
 * есть не в том же тике, где тест смонтировал дерево или щёлкнул по кнопке.
 */
function controlledLoad() {
  const waiting = new Map<string, { resolve(): void; reject(error: unknown): void }>();
  const requested = (code: string) =>
    vi.waitFor(() => {
      const request = waiting.get(code);
      if (request === undefined) throw new Error(`запрос за «${code}» ещё не отправлен`);
      waiting.delete(code);
      return request;
    });
  const load: LocaleLoad = vi.fn(
    (code: string) =>
      new Promise<FormLocale>((resolve, reject) => {
        waiting.set(code, { resolve: () => resolve(LOCALES[code]!), reject });
      })
  );
  return {
    load,
    resolve: async (code: string) => (await requested(code)).resolve(),
    reject: async (code: string, error: unknown) => (await requested(code)).reject(error),
  };
}

function Probe() {
  const t = useMessages(KIT_EN);
  const { code, pending, error, fileSize } = useI18n();
  const [clicks, setClicks] = useState(0);
  return (
    <section>
      <p data-testid="clear">{t('kit.clear')}</p>
      <p data-testid="files">{t('kit.files', { count: 3 })}</p>
      <p data-testid="size">{fileSize(1536)}</p>
      <p data-testid="code">{code}</p>
      <p data-testid="pending">{String(pending)}</p>
      <p data-testid="error">{error instanceof Error ? error.message : ''}</p>
      <button type="button" onClick={() => setClicks((n) => n + 1)}>
        clicks: {clicks}
      </button>
      <input aria-label="note" />
    </section>
  );
}

function App({
  load,
  onError,
}: {
  load: LocaleLoad;
  onError?: (e: unknown, lang: string) => void;
}) {
  const [lang, setLang] = useState('ru');
  return (
    <>
      {['ru', 'en', 'de', 'xx'].map((code) => (
        <button key={code} type="button" onClick={() => setLang(code)}>
          lang {code}
        </button>
      ))}
      <I18nProvider lang={lang} load={load} fallback={<p>loading locale…</p>} onError={onError}>
        <Probe />
      </I18nProvider>
    </>
  );
}

const text = (testId: string) => page.getByTestId(testId);
const switchTo = (code: string) => page.getByRole('button', { name: `lang ${code}` }).click();

describe('I18nProvider: загрузка первой локали', () => {
  it('до ответа рисуется fallback, после — дерево на загруженном языке', async () => {
    const { load, resolve } = controlledLoad();
    renderReact(<App load={load} />);

    await expect.element(page.getByText('loading locale…')).toBeVisible();
    expect(document.querySelector('[data-testid="clear"]')).toBeNull();

    await resolve('ru');

    await expect.element(text('clear')).toHaveTextContent('Очистить выбор');
    await expect.element(text('files')).toHaveTextContent('3 файла');
    await expect.element(text('code')).toHaveTextContent('ru');
    await expect.element(text('pending')).toHaveTextContent('false');
    expect(document.body.textContent).not.toContain('loading locale…');
  });

  it('локаль в кэше загрузчика — fallback не показывается вовсе', async () => {
    const load = createLocaleLoader([(code) => LOCALES[code]]);
    await load.preload('ru');

    const { container } = renderReact(<App load={load} />);

    // Синхронно после монтирования, без ожидания: первый кадр уже на русском.
    await vi.waitFor(() => expect(container.textContent).toContain('Очистить выбор'));
    expect(container.textContent).not.toContain('loading locale…');
  });

  it('под StrictMode загрузчик с кэшем не запрашивает язык дважды', async () => {
    const source = vi.fn((code: string) => Promise.resolve(LOCALES[code]));
    const load = createLocaleLoader([source]);

    renderReact(
      <StrictMode>
        <App load={load} />
      </StrictMode>
    );

    await expect.element(text('clear')).toHaveTextContent('Очистить выбор');
    expect(source).toHaveBeenCalledTimes(1);
  });
});

describe('I18nProvider: переключение на лету', () => {
  it('прежний язык остаётся на экране, пока новый грузится, и pending это показывает', async () => {
    const { load, resolve } = controlledLoad();
    renderReact(<App load={load} />);
    await resolve('ru');
    await expect.element(text('clear')).toHaveTextContent('Очистить выбор');

    await switchTo('en');

    await expect.element(text('pending')).toHaveTextContent('true');
    await expect.element(text('clear')).toHaveTextContent('Очистить выбор');
    await expect.element(text('code')).toHaveTextContent('ru');

    await resolve('en');

    await expect.element(text('clear')).toHaveTextContent('Clear selection');
    await expect.element(text('files')).toHaveTextContent('3 files');
    await expect.element(text('size')).toHaveTextContent('1.5 KB');
    await expect.element(text('pending')).toHaveTextContent('false');
  });

  it('состояние поддерева переживает смену языка: дерево не перемонтируется', async () => {
    const { load, resolve } = controlledLoad();
    renderReact(<App load={load} />);
    await resolve('ru');
    await expect.element(text('clear')).toBeVisible();

    await page.getByRole('button', { name: /clicks/ }).click();
    await page.getByRole('button', { name: /clicks/ }).click();
    await page.getByLabelText('note').fill('черновик');
    const input = document.querySelector('input[aria-label="note"]');

    await switchTo('en');
    await resolve('en');
    await expect.element(text('clear')).toHaveTextContent('Clear selection');

    await expect.element(page.getByRole('button', { name: 'clicks: 2' })).toBeVisible();
    await expect.element(page.getByLabelText('note')).toHaveValue('черновик');
    // Тот же DOM-узел: поле не пересоздавалось.
    expect(document.querySelector('input[aria-label="note"]')).toBe(input);
    expect(input?.isConnected).toBe(true);
  });

  it('при быстром переключении применяется только последний запрос', async () => {
    const { load, resolve } = controlledLoad();
    renderReact(<App load={load} />);
    await resolve('ru');
    await expect.element(text('clear')).toBeVisible();

    await switchTo('en');
    await switchTo('de');
    // Устаревший ответ приходит последним — и не должен ничего менять.
    await resolve('de');
    await expect.element(text('clear')).toHaveTextContent('Auswahl löschen');
    await resolve('en');

    await expect.element(text('code')).toHaveTextContent('de');
    await expect.element(text('clear')).toHaveTextContent('Auswahl löschen');
  });

  it('неполная локаль: чего нет в словаре, говорит встроенным английским', async () => {
    const { load, resolve } = controlledLoad();
    renderReact(<App load={load} />);
    await resolve('ru');
    await expect.element(text('clear')).toBeVisible();

    await switchTo('de');
    await resolve('de');

    await expect.element(text('clear')).toHaveTextContent('Auswahl löschen');
    await expect.element(text('files')).toHaveTextContent('3 files');
  });
});

describe('I18nProvider: отказ загрузки', () => {
  it('язык на экране не меняется, ошибка доходит до useI18n и onError', async () => {
    const { load, resolve, reject } = controlledLoad();
    const onError = vi.fn();
    renderReact(<App load={load} onError={onError} />);
    await resolve('ru');
    await expect.element(text('clear')).toBeVisible();

    await switchTo('xx');
    await expect.element(text('pending')).toHaveTextContent('true');
    await reject('xx', new Error('локаль xx: 404'));

    await expect.element(text('error')).toHaveTextContent('локаль xx: 404');
    await expect.element(text('pending')).toHaveTextContent('false');
    await expect.element(text('clear')).toHaveTextContent('Очистить выбор');
    expect(onError).toHaveBeenCalledExactlyOnceWith(expect.any(Error), 'xx');
  });

  it('возврат к прежнему языку после ошибки её сбрасывает', async () => {
    const { load, resolve, reject } = controlledLoad();
    renderReact(<App load={load} />);
    await resolve('ru');
    await expect.element(text('clear')).toBeVisible();
    await switchTo('xx');
    await reject('xx', new Error('404'));
    await expect.element(text('error')).toHaveTextContent('404');

    await switchTo('ru');

    await expect.element(text('error')).toHaveTextContent('');
    await expect.element(text('code')).toHaveTextContent('ru');
  });
});
