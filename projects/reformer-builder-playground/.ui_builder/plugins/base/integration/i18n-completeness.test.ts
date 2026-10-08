/**
 * Словари плагинов домена base: полнота локалей и разбор сообщений.
 *
 * Те же проверки, что у словарей билдера (`shell/platform/services/i18n/dictionary-checks`):
 * словари уехали из билдера вместе с плагинами, а требования к ним — нет.
 *
 * @module plugins/base/integration/i18n-completeness.test
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  brokenMessages,
  extraLocales,
  missingKeys,
  type Dictionary,
} from '@/shell/platform/services/i18n/dictionary-checks';
import { APP_PREVIEW_MESSAGES } from '../app-preview/src/messages';
import { MARKDOWN_MESSAGES } from '../markdown-editor/src/messages';
import { FILES_MESSAGES } from '../files/src/messages';
import { MONACO_MESSAGES } from '../monaco-editor/src/messages';

const DICTIONARIES: ReadonlyArray<readonly [string, Dictionary]> = [
  ['app-preview', APP_PREVIEW_MESSAGES],
  ['markdown-editor', MARKDOWN_MESSAGES],
  ['files', FILES_MESSAGES],
  ['monaco-editor', MONACO_MESSAGES],
];

describe('словари: наборы ключей совпадают во всех локалях', () => {
  it.each(DICTIONARIES)('%s', (owner, dictionary) => {
    expect(missingKeys(owner, dictionary)).toEqual([]);
  });

  it('локалей у каждого словаря ровно столько, сколько умеет приложение', () => {
    expect(DICTIONARIES.flatMap(([owner, dictionary]) => extraLocales(owner, dictionary))).toEqual(
      []
    );
  });
});

describe('словари: сообщения разбираются и подставляют одно и то же', () => {
  it.each(DICTIONARIES)('%s', (owner, dictionary) => {
    const { broken, mismatched } = brokenMessages(owner, dictionary);

    expect(broken).toEqual([]);
    expect(mismatched).toEqual([]);
  });
});

describe('словари: список проверяемых не отстаёт от домена', () => {
  it('каждый плагин домена со словарём попал в проверку', () => {
    // Плагин со словарём узнаётся по файлам: каталог `locales/` или модуль `messages.ts`.
    const domain = fileURLToPath(new URL('..', import.meta.url));
    const withMessages = readdirSync(domain)
      .filter((name) => statSync(`${domain}/${name}`).isDirectory())
      .filter(
        (name) =>
          existsSync(`${domain}/${name}/src/locales`) ||
          existsSync(`${domain}/${name}/src/messages.ts`)
      )
      .sort();

    expect(withMessages).toEqual(DICTIONARIES.map(([owner]) => owner).sort());
  });
});
