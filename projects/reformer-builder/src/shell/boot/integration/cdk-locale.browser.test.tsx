/**
 * Строки cdk вживую: статусы загрузки файлов для скринридера и запасной текст ошибки загрузки
 * данных — по языку активной локали.
 *
 * Тест живёт в билдере по той же причине, что и `i18n-provider.browser.test.tsx`: у cdk нет
 * браузерного прогона (его тесты рендерят через `renderToStaticMarkup`), а здесь проверяется то,
 * что без эффектов и событий не увидеть:
 *
 * - статус попадает в aria-live после действия пользователя;
 * - уже показанный статус и подписи кнопок переводятся при смене языка сами, без повторного
 *   действия и без перемонтирования списка файлов;
 * - отказ загрузки без текста получает фразу на языке, активном в момент отказа.
 *
 * Идёт против собранного `dist` cdk — того артефакта, который получит приложение, включая
 * загрузчик `loadCdkLocale` с чанком на язык.
 *
 * @module shell/boot/integration/cdk-locale.browser.test
 */

import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { createLocaleLoader, I18nProvider } from '@reformer/core/i18n';
import { AsyncBoundary } from '@reformer/cdk/async-boundary';
import { FileUpload, useFileUploadContext } from '@reformer/cdk/file-upload';
import { loadCdkLocale } from '@reformer/cdk/locale';
import { renderReact } from '@/testing/render';

const file = (name: string, bytes: number) => new File([new Uint8Array(bytes)], name);

/** Кнопки вместо пикера: тест сам решает, какие файлы «выбраны». */
function Pick() {
  const { addFiles } = useFileUploadContext();
  return (
    <>
      <button type="button" onClick={() => addFiles([file('photo.png', 1536)])}>
        add one
      </button>
      <button
        type="button"
        onClick={() => addFiles([file('a.txt', 1), file('b.txt', 2), file('c.txt', 3)])}
      >
        add three
      </button>
    </>
  );
}

function Uploader() {
  return (
    <FileUpload.Root multiple maxFiles={3}>
      <Pick />
      <FileUpload.ClearTrigger>clear</FileUpload.ClearTrigger>
      <FileUpload.ItemGroup>
        {(item) => (
          <FileUpload.Item key={item.key} item={item}>
            <FileUpload.ItemName />
            <FileUpload.ItemSize data-testid="size" />
            <FileUpload.ItemDeleteTrigger>×</FileUpload.ItemDeleteTrigger>
          </FileUpload.Item>
        )}
      </FileUpload.ItemGroup>
    </FileUpload.Root>
  );
}

function Failing() {
  return (
    <AsyncBoundary.Root
      // Отказ без текста: не Error и не строка.
      load={() => Promise.reject({ status: 500 })}
    >
      <AsyncBoundary.Error>
        {({ error }) => <p data-testid="load-error">{String(error)}</p>}
      </AsyncBoundary.Error>
    </AsyncBoundary.Root>
  );
}

const loadLocale = createLocaleLoader([loadCdkLocale]);

function App({ initial, children }: { initial: string; children: React.ReactNode }) {
  const [lang, setLang] = useState(initial);
  return (
    <>
      {['ru', 'en'].map((code) => (
        <button key={code} type="button" onClick={() => setLang(code)}>
          lang {code}
        </button>
      ))}
      <I18nProvider lang={lang} load={loadLocale} fallback={<p>loading locale…</p>}>
        {children}
      </I18nProvider>
    </>
  );
}

const click = (name: string) => page.getByRole('button', { name, exact: true }).click();
const live = () => page.getByRole('status');

describe('cdk: статусы загрузки файлов', () => {
  it('без провайдера статус и подписи английские', async () => {
    renderReact(<Uploader />);

    await click('add one');
    await expect.element(live()).toHaveTextContent('File photo.png added');
    await expect.element(page.getByRole('button', { name: 'Remove file photo.png' })).toBeVisible();
    await expect.element(page.getByTestId('size')).toHaveTextContent('1.5 KB');

    await click('add three');
    // Лимит три файла: один уже в списке, из трёх новых проходят два.
    await expect.element(live()).toHaveTextContent('File c.txt rejected');

    await click('clear');
    await expect.element(live()).toHaveTextContent('File list cleared');
  });

  it('под русской локалью — русские, число файлов подставляется', async () => {
    renderReact(
      <App initial="ru">
        <Uploader />
      </App>
    );

    await click('add three');
    await expect.element(live()).toHaveTextContent('Добавлено файлов: 3');

    await click('Удалить файл b.txt');
    await expect.element(live()).toHaveTextContent('Файл b.txt удалён');

    await click('clear');
    await expect.element(live()).toHaveTextContent('Список файлов очищен');
  });

  it('смена языка переводит уже показанный статус и подписи, список файлов на месте', async () => {
    renderReact(
      <App initial="ru">
        <Uploader />
      </App>
    );

    await click('add one');
    await expect.element(live()).toHaveTextContent('Файл photo.png добавлен');
    await expect.element(page.getByTestId('size')).toHaveTextContent('1,5 КБ');
    const item = document.querySelector('[role="listitem"]');
    expect(item).not.toBeNull();

    await click('lang en');

    await expect.element(live()).toHaveTextContent('File photo.png added');
    await expect.element(page.getByRole('button', { name: 'Remove file photo.png' })).toBeVisible();
    await expect.element(page.getByTestId('size')).toHaveTextContent('1.5 KB');
    // Тот же DOM-узел: элемент списка не перемонтирован.
    expect(document.querySelector('[role="listitem"]')).toBe(item);
    expect(item!.isConnected).toBe(true);
  });
});

describe('cdk: ошибка загрузки данных без текста', () => {
  it('без провайдера — английская фраза', async () => {
    renderReact(<Failing />);
    await expect.element(page.getByTestId('load-error')).toHaveTextContent('Unknown error');
  });

  it('под русской локалью — русская', async () => {
    renderReact(
      <App initial="ru">
        <Failing />
      </App>
    );
    await expect.element(page.getByTestId('load-error')).toHaveTextContent('Неизвестная ошибка');
  });
});
