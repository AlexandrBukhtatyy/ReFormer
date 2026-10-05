/**
 * Полнота словарей плагинов домена: ключ, забытый в одной локали, обязан падать здесь,
 * а не маркером на экране.
 *
 * Правило — то же, которым билдер сверяет словари оболочки и встроенных плагинов
 * (`shell/platform/services/i18n/dictionary-checks`): расхождение в любую сторону — отказ.
 *
 * @module plugins/rjsf/integration/i18n-completeness.test
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
import { RJSF_EDITOR_MESSAGES } from '../editor/src/messages';
import { RJSF_RENDER_MESSAGES } from '../render/src/messages';

/** Словари плагинов домена. Имя владельца — каталог плагина в домене. */
const DICTIONARIES: ReadonlyArray<readonly [string, Dictionary]> = [
  ['editor', RJSF_EDITOR_MESSAGES],
  ['render', RJSF_RENDER_MESSAGES],
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
