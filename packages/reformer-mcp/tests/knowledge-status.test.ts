/**
 * `reformer://status` и путь «у сервера нет индексов» (аудит 2026-11: C1, B3; ReFormer-j356.9).
 *
 * Сервер, не нашедший пакеты, раньше отвечал тем же голосом, что исправный: справка пуста, а
 * проверка импортов объявляла несуществующим код самого генератора. Здесь проверено, что статус
 * показывает окружение, а пробел окружения не выдаётся за ошибку кода.
 */

import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it } from 'vitest';
import { createKnowledge } from '../src/core/knowledge';
import { describeKnowledge, knowledgeGaps, REQUIRED_PACKAGES } from '../src/core/status';
import { createResourceCatalog } from '../src/core/server/resource-catalog';
import { validateCode } from '../src/core/validate/code';
import { createBrowserKnowledge } from '../src/platform/browser/knowledge';
import { cliKnowledge, cliPlatformStatus } from '../src/platform/cli/knowledge';

const EMPTY_DOCS = { has: () => false, read: () => null };

/** Текст ресурса: у `reformer://status` он всегда текстовый. */
function resourceText(result: ReadResourceResult): string {
  const first = result.contents[0];
  if (!first || !('text' in first) || typeof first.text !== 'string') {
    throw new Error('ресурс без текста');
  }
  return first.text;
}

describe('reformer://status — CLI в монорепо', () => {
  it('находит все библиотечные пакеты с индексами, проверка типов доступна', () => {
    const resources = createResourceCatalog(cliKnowledge);
    expect(resources.list().map((entry) => entry.uri)).toContain('reformer://status');
    const status = JSON.parse(resourceText(resources.read('reformer://status')));

    expect(status.profile).toBe('node');
    expect(status.ready).toBe(true);
    for (const name of REQUIRED_PACKAGES) {
      const entry = status.packages.find((p: { name: string }) => p.name === name);
      expect(entry?.root, name).toBeTruthy();
      expect(entry?.index, name).toBeTruthy();
      expect(entry?.docs, name).toBe(true);
    }
    expect(status.typecheck.available).toBe(true);
    expect(status.uiKitCatalog.found).toBe(true);
    expect(status.uiKitCatalog.components).toBeGreaterThan(100);
    expect(knowledgeGaps(status)).toEqual([]);
  });
});

describe('знание без индексов', () => {
  const blind = createKnowledge({
    docs: EMPTY_DOCS,
    index: { read: () => null },
    status: cliPlatformStatus,
  });

  it('статус не готов и называет пробелы', () => {
    const status = describeKnowledge(blind, cliPlatformStatus());
    expect(status.ready).toBe(false);
    const gaps = knowledgeGaps(status);
    expect(gaps).toHaveLength(REQUIRED_PACKAGES.length);
    expect(gaps[0]).toContain('llms-index.json is missing');
  });

  it('проверка импортов не объявляет несуществующим код генератора (ReFormer-j356.9)', async () => {
    const code = [
      "import { createForm } from '@reformer/core';",
      "import { required } from '@reformer/core/validators';",
      "import { Input } from '@reformer/ui-kit';",
      'export const x = [createForm, required, Input];',
    ].join('\n');
    const { diagnostics, limitations, unindexed } = await validateCode(blind, code);
    expect(diagnostics.filter((d) => d.code === 'RF002')).toEqual([]);
    expect(unindexed).toEqual(['@reformer/core', '@reformer/ui-kit']);
    expect(limitations.join('\n')).toContain('are not checked');
  });
});

describe('reformer://status — браузер', () => {
  it('показывает вшитые пакеты и честно говорит, что компилятора нет', () => {
    const { knowledge } = createBrowserKnowledge({
      version: '7.0.0-test',
      index: {
        schemaVersion: 1,
        builtAt: '2026-11-11T00:00:00.000Z',
        packages: {},
      },
    });
    const status = JSON.parse(
      resourceText(createResourceCatalog(() => knowledge).read('reformer://status'))
    );
    expect(status).toMatchObject({
      profile: 'browser',
      server: { version: '7.0.0-test', buildId: '2026-11-11T00:00:00.000Z' },
      ready: false,
      typecheck: { available: false },
    });
  });
});
