/**
 * Тексты замечаний в cdk: локаль по умолчанию, словарь формы поверх неё и полный резолвер.
 *
 * Проверяется шов cdk с `@reformer/core`: без `ValidationMessagesProvider` текст даёт локаль,
 * `messages` накладываются поверх внешних провайдеров и локали, `resolver` заменяет их целиком.
 * Сам порядок источников текста (словарь формы → локаль → встроенный английский → код) покрыт
 * в ядре — `tests/i18n/validation-message.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ValidationIssue } from '@reformer/core';
import { defineIssueMessages, extendLocale } from '@reformer/core/i18n';
import { I18nProvider } from '@reformer/core/react';
import { en } from '@reformer/core/locale/en';
import { ru } from '@reformer/core/locale/ru';
import { makeFileError } from '../components/file-upload/file-upload-core';
import { useIssueMessageResolver, ValidationMessagesProvider } from './error-resolver';

function Probe({ issue }: { issue: ValidationIssue }) {
  const resolve = useIssueMessageResolver();
  return <p>{resolve(issue)}</p>;
}

const REQUIRED: ValidationIssue = { code: 'required' };
const TOO_SHORT: ValidationIssue = { code: 'minLength', params: { minLength: 8 } };
const PHONE: ValidationIssue = { code: 'phone.required' };

const FORM = defineIssueMessages({
  'phone.required': 'Укажите номер телефона',
  minLength: 'Пароль — от {minLength} символов',
});
const INNER = defineIssueMessages({ 'phone.required': 'Нужен телефон для связи' });

describe('useIssueMessageResolver без ValidationMessagesProvider', () => {
  it('без I18nProvider — английская фраза, а не код', () => {
    expect(renderToStaticMarkup(<Probe issue={REQUIRED} />)).toBe('<p>This field is required</p>');
    expect(renderToStaticMarkup(<Probe issue={TOO_SHORT} />)).toBe(
      '<p>Enter at least 8 characters</p>'
    );
  });

  it('под I18nProvider — текст на языке локали', () => {
    const html = renderToStaticMarkup(
      <I18nProvider locale={ru}>
        <Probe issue={REQUIRED} />
        <Probe issue={TOO_SHORT} />
      </I18nProvider>
    );

    expect(html).toBe('<p>Обязательное поле</p><p>Не меньше 8 символов</p>');
  });

  it('свой код находится в словаре приложения по ключу validation.<код>', () => {
    const locale = extendLocale(ru, {
      messages: { 'validation.profile.name.required': 'Как вас зовут?' },
    });

    const html = renderToStaticMarkup(
      <I18nProvider locale={locale}>
        <Probe issue={{ code: 'profile.name.required' }} />
      </I18nProvider>
    );

    expect(html).toBe('<p>Как вас зовут?</p>');
  });
});

describe('ValidationMessagesProvider messages — словарь формы поверх локали', () => {
  it('записи словаря важнее локали, остальные коды идут в локаль', () => {
    const html = renderToStaticMarkup(
      <I18nProvider locale={ru}>
        <ValidationMessagesProvider messages={FORM}>
          <Probe issue={PHONE} />
          <Probe issue={TOO_SHORT} />
          <Probe issue={REQUIRED} />
        </ValidationMessagesProvider>
      </I18nProvider>
    );

    expect(html).toBe(
      '<p>Укажите номер телефона</p><p>Пароль — от 8 символов</p><p>Обязательное поле</p>'
    );
  });

  it('вложенный провайдер накладывает свои записи поверх внешнего', () => {
    const html = renderToStaticMarkup(
      <I18nProvider locale={ru}>
        <ValidationMessagesProvider messages={FORM}>
          <ValidationMessagesProvider messages={INNER}>
            <Probe issue={PHONE} />
            <Probe issue={TOO_SHORT} />
          </ValidationMessagesProvider>
          <Probe issue={PHONE} />
        </ValidationMessagesProvider>
      </I18nProvider>
    );

    expect(html).toBe(
      '<p>Нужен телефон для связи</p><p>Пароль — от 8 символов</p><p>Укажите номер телефона</p>'
    );
  });
});

describe('ValidationMessagesProvider resolver — полное переопределение', () => {
  const resolver = (issue: ValidationIssue): string => `[${issue.code}]`;

  it('резолвер заменяет локаль и внешние словари, в том числе для кодов вне них', () => {
    const html = renderToStaticMarkup(
      <I18nProvider locale={ru}>
        <ValidationMessagesProvider messages={FORM}>
          <ValidationMessagesProvider resolver={resolver}>
            <Probe issue={REQUIRED} />
            <Probe issue={PHONE} />
          </ValidationMessagesProvider>
        </ValidationMessagesProvider>
      </I18nProvider>
    );

    expect(html).toBe('<p>[required]</p><p>[phone.required]</p>');
  });

  it('словарь того же или вложенного провайдера важнее резолвера', () => {
    const html = renderToStaticMarkup(
      <I18nProvider locale={ru}>
        <ValidationMessagesProvider resolver={resolver} messages={FORM}>
          <Probe issue={PHONE} />
          <Probe issue={REQUIRED} />
          <ValidationMessagesProvider messages={INNER}>
            <Probe issue={PHONE} />
            <Probe issue={REQUIRED} />
          </ValidationMessagesProvider>
        </ValidationMessagesProvider>
      </I18nProvider>
    );

    expect(html).toBe(
      '<p>Укажите номер телефона</p><p>[required]</p><p>Нужен телефон для связи</p><p>[required]</p>'
    );
  });
});

describe('ошибки отбора файлов', () => {
  it('makeFileError даёт только код и параметры — текст даёт резолвер', () => {
    const error = makeFileError('fileExists', { fileName: 'a.png' });

    expect(error).toEqual({ code: 'fileExists', params: { fileName: 'a.png' } });
    expect(makeFileError('uploadAborted')).toEqual({ code: 'uploadAborted' });
    expect(renderToStaticMarkup(<Probe issue={error} />)).toBe(
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
          <Probe issue={error} />
        </I18nProvider>
      );
      expect(html, error.code).not.toMatch(/[{}]/);
      expect(html, error.code).not.toContain(`<p>${error.code}</p>`);
    }
  });
});
