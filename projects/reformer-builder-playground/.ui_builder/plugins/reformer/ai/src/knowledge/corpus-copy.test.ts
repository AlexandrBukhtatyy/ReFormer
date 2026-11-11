/**
 * Корпус справки — та же копия, что вшита в воркер MCP (фаза 5 аудита, ReFormer-11oe.6).
 *
 * `generate:knowledge` копирует `dist/knowledge` пакета `@reformer/mcp`, а не собирает корпус сам:
 * две сборки в разное время давали копии из разных текстов. Здесь — что копия не отстала от
 * `dist`. Расхождение значит, что `@reformer/mcp` пересобран после сборки плагина.
 *
 * Копии нет — тест пропускается: артефакт в git не коммитится и собирается `npm run generate:knowledge`.
 *
 * @module plugins/reformer/ai/knowledge/corpus-copy.test
 */

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const copyFile = resolve(__dirname, 'generated/knowledge-manifest.json');
const mcpDir = dirname(createRequire(__filename).resolve('@reformer/mcp/package.json'));
const distFile = join(mcpDir, 'dist/knowledge/knowledge-manifest.json');

const read = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as { corpusHash: string };

describe.runIf(existsSync(copyFile) && existsSync(distFile))('копия корпуса справки', () => {
  // Сверяется хэш содержимого, а не метка сборки: пересборка кода MCP корпус не меняет, а метку
  // кода плагина с воркером сверяет панель MCP (`forms/mcp`, build-check).
  it('совпадает с dist/knowledge @reformer/mcp — тот же corpusHash', () => {
    expect(
      read(copyFile).corpusHash,
      'копия отстала от @reformer/mcp: npm run generate:knowledge'
    ).toBe(read(distFile).corpusHash);
  });
});
