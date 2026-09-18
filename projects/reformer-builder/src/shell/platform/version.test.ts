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

import { BUILDER_VERSION } from './version';

describe('версия билдера', () => {
  it('совпадает с версией своего package.json', () => {
    const manifest = new URL('../../../package.json', import.meta.url);
    const declared = JSON.parse(readFileSync(manifest, 'utf8')) as {
      name: string;
      version: string;
    };

    // Имя сверяется тоже: путь мог привести в чужой пакет, где поле `version` тоже есть.
    expect(declared.name).toBe('@reformer/builder');
    expect(BUILDER_VERSION).toBe(declared.version);
  });
});
