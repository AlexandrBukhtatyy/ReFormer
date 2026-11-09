/**
 * Версия билдера — та же, что в `package.json` сборки.
 *
 * Проверка не про формат строки, а про АДРЕС: относительный импорт `package.json` из глубины
 * `src/` легко промахивается мимо своего пакета, и промах молчит — версия читается,
 * но чужая (поймано при заведении модуля: неверный путь дал `1.0.0` вместо `0.0.0`).
 * Молча чужая версия хуже отсутствующей: по ней отказывают в загрузке плагина.
 *
 * @module shell/platform/version.test
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { parsePluginManifest } from '@reformer/builder-plugin-api/internal';
import { BUILDER_VERSION, builderVersionOf, UNRELEASED_VERSION } from './version';

describe('версия билдера', () => {
  it('совпадает с версией своего package.json', () => {
    const manifest = new URL('../../../package.json', import.meta.url);
    const declared = JSON.parse(readFileSync(manifest, 'utf8')) as {
      name: string;
      version: string;
    };

    // Имя сверяется тоже: путь мог привести в чужой пакет, где поле `version` тоже есть.
    expect(declared.name).toBe('@reformer/builder');
    expect(BUILDER_VERSION).toBe(builderVersionOf(declared.version));
  });

  it('заглушка рабочего дерева — «версия неизвестна», а не билдер 0.0.0', () => {
    // semantic-release пишет настоящую версию после сборки, и в бандл выпуска попадает
    // заглушка. Сверка с ней отказывала бы каждому плагину с `compatibility.builder`.
    expect(builderVersionOf(UNRELEASED_VERSION)).toBeUndefined();
    expect(builderVersionOf('3.0.0-beta.16')).toBe('3.0.0-beta.16');
    expect(builderVersionOf('3.1.0')).toBe('3.1.0');
  });

  it('плагин с `compatibility.builder` грузится и у заглушки, и у беты своей линии', () => {
    const text = JSON.stringify({
      id: 'acme',
      name: 'Acme',
      apiVersion: '^1',
      main: 'main.js',
      compatibility: { builder: '^3' },
    });
    const parse = (builder: string) =>
      parsePluginManifest(
        text,
        { kind: 'project', dir: 'acme' },
        { builder: builderVersionOf(builder) }
      );

    expect(parse(UNRELEASED_VERSION).ok).toBe(true);
    expect(parse('3.0.0-beta.16').ok).toBe(true);
    const older = parse('2.0.0');
    expect(!older.ok && older.problem.code).toBe('builder-version');
  });
});
