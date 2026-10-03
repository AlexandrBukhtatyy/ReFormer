/**
 * Резолвер ошибок по умолчанию — по активной локали.
 *
 * Проверяется шов cdk с `@reformer/core/i18n`: без `ValidationMessagesProvider` текст ошибки даёт
 * локаль, смонтированный провайдер заменяет её целиком. Сам порядок источников текста
 * (`messageKey` → `message` → словарь → код) покрыт в ядре — `tests/i18n/validation-message.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ValidationError } from '@reformer/core';
import { extendLocale, I18nProvider } from '@reformer/core/i18n';
import { en } from '@reformer/core/locale/en';
import { ru } from '@reformer/core/locale/ru';
import { makeFileError } from '../components/file-upload/file-upload-core';
import {
  createMessageResolver,
  defaultErrorResolver,
  useValidationErrorResolver,
  ValidationMessagesProvider,
} from './error-resolver';

function Probe({ error }: { error: ValidationError }) {
  const resolve = useValidationErrorResolver();
  return <p>{resolve(error)}</p>;
}

const REQUIRED: ValidationError = { code: 'required', message: '' };
const TOO_SHORT: ValidationError = { code: 'minLength', message: '', params: { minLength: 8 } };

describe('useValidationErrorResolver без ValidationMessagesProvider', () => {
  it('без I18nProvider — английская фраза, а не код и не «invalid»', () => {
    expect(renderToStaticMarkup(<Probe error={REQUIRED} />)).toBe('<p>This field is required</p>');
    expect(renderToStaticMarkup(<Probe error={TOO_SHORT} />)).toBe(
      '<p>Enter at least 8 characters</p>'
    );
  });

  it('под I18nProvider — текст на языке локали', () => {
    const html = renderToStaticMarkup(
      <I18nProvider locale={ru}>
        <Probe error={REQUIRED} />
        <Probe error={TOO_SHORT} />
      </I18nProvider>
    );

    expect(html).toBe('<p>Обязательное поле</p><p>Не меньше 8 символов</p>');
  });

  it('явное сообщение автора правила важнее словаря локали', () => {
    const html = renderToStaticMarkup(
      <I18nProvider locale={ru}>
        <Probe error={{ code: 'required', message: 'Укажите номер телефона' }} />
      </I18nProvider>
    );

    expect(html).toBe('<p>Укажите номер телефона</p>');
  });

  it('messageKey автора берётся из словаря приложения', () => {
    const locale = extendLocale(ru, { messages: { 'profile.name.required': 'Как вас зовут?' } });

    const html = renderToStaticMarkup(
      <I18nProvider locale={locale}>
        <Probe error={{ code: 'required', message: '', messageKey: 'profile.name.required' }} />
      </I18nProvider>
    );

    expect(html).toBe('<p>Как вас зовут?</p>');
  });
});

describe('ValidationMessagesProvider — полное переопределение', () => {
  it('таблица заменяет резолвер по локали, в том числе для кодов вне таблицы', () => {
    const table = createMessageResolver({ required: () => 'Заполните поле' });

    const html = renderToStaticMarkup(
      <I18nProvider locale={ru}>
        <ValidationMessagesProvider resolver={table}>
          <Probe error={REQUIRED} />
          <Probe error={TOO_SHORT} />
        </ValidationMessagesProvider>
      </I18nProvider>
    );

    // minLength в таблице нет: откат идёт на код, а не на словарь локали.
    expect(html).toBe('<p>Заполните поле</p><p>minLength</p>');
  });

  it('defaultErrorResolver остаётся готовым резолвером «сообщение или код»', () => {
    const html = renderToStaticMarkup(
      <I18nProvider locale={ru}>
        <ValidationMessagesProvider resolver={defaultErrorResolver}>
          <Probe error={REQUIRED} />
        </ValidationMessagesProvider>
      </I18nProvider>
    );

    expect(html).toBe('<p>required</p>');
  });
});

describe('ошибки отбора файлов', () => {
  it('makeFileError кладёт пустое сообщение — текст даёт резолвер', () => {
    const error = makeFileError('fileExists', { fileName: 'a.png' });

    expect(error).toEqual({ code: 'fileExists', message: '', params: { fileName: 'a.png' } });
    expect(renderToStaticMarkup(<Probe error={error} />)).toBe(
      '<p>File a.png has already been added</p>'
    );
  });

  it('у каждого кода отбора есть текст в словарях ядра', () => {
    const dir = fileURLToPath(new URL('../components/file-upload', import.meta.url));
    const codes = new Set<string>();
    for (const name of ['file-upload-core.ts', 'useFileUpload.ts']) {
      const text = readFileSync(`${dir}/${name}`, 'utf8');
      for (const match of text.matchAll(/makeFileError\(\s*'([^']+)'/g)) codes.add(match[1]!);
    }

    expect(codes.size).toBeGreaterThan(5);
    for (const code of codes) {
      expect(en.messages, `en: ${code}`).toHaveProperty([`validation.${code}`]);
      expect(ru.messages, `ru: ${code}`).toHaveProperty([`validation.${code}`]);
    }
  });

  it('тексты отбора закрывают подстановки параметрами, которые отбор реально передаёт', () => {
    const errors = [
      makeFileError('fileType', { accept: 'image/*', fileName: 'a.pdf' }),
      makeFileError('maxFileSize', { maxFileSize: 1024, fileName: 'a.png', actualSize: 4096 }),
      makeFileError('minFileSize', { minFileSize: 1024, fileName: 'a.png', actualSize: 10 }),
      makeFileError('fileExists', { fileName: 'a.png' }),
      makeFileError('maxFiles', { maxFiles: 3, fileName: 'a.png' }),
      makeFileError('maxTotalFileSize', { maxTotalFileSize: 2048, fileName: 'a.png' }),
      makeFileError('uploadAborted', { fileName: 'a.png' }),
      makeFileError('uploadFailed', { fileName: 'a.png', reason: 'сеть' }),
    ];

    for (const error of errors) {
      const html = renderToStaticMarkup(
        <I18nProvider locale={ru}>
          <Probe error={error} />
        </I18nProvider>
      );
      expect(html, error.code).not.toMatch(/[{}]/);
      expect(html, error.code).not.toContain(`<p>${error.code}</p>`);
    }
  });
});
