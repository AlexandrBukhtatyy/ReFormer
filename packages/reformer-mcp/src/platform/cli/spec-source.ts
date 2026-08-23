/**
 * Спека с диска: абсолютный путь либо относительный от CWD сервера.
 *
 * Единственное место, где сервер читает файл ЗА пределами своих пакетов, — и потому
 * единственное, где путь приходит от модели. Оба кандидата резолвятся явно, чтобы поведение
 * не зависело от того, откуда запущен процесс.
 *
 * @module reformer-mcp/platform/cli/spec-source
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { SpecSource } from '../../core/spec/source.js';

export function createCliSpecSource(): SpecSource {
  return {
    describe: () => process.cwd(),

    read: (ref) => {
      for (const p of [ref, resolve(process.cwd(), ref)]) {
        if (!existsSync(p)) continue;
        try {
          return readFileSync(p, 'utf-8');
        } catch {
          return null;
        }
      }
      return null;
    },
  };
}
