/**
 * Tests for the search_docs tool (ReFormer-wk1 pkg 4).
 *
 * Главный инвариант: каждый reformer://docs/<pkg>/<slug> в выдаче ОБЯЗАН резолвиться
 * через getSectionBySlug — иначе агент получит URI, который ReadResource отвергнет.
 * Плюс контракт краевых случаев (пустой запрос, отсутствие совпадений) и фильтр по пакету.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { searchDocsTool, __resetSearchDocsIndex } from '../src/tools/search-docs';
import { getSectionBySlug, listAvailablePackages } from '../src/utils/docs-parser';

const URI_RE = /reformer:\/\/docs\/([^/\s`]+)\/([^\s`]+)/g;

function extractUris(text: string): Array<{ short: string; slug: string }> {
  const out: Array<{ short: string; slug: string }> = [];
  let m: RegExpExecArray | null;
  URI_RE.lastIndex = 0;
  while ((m = URI_RE.exec(text)) !== null) out.push({ short: m[1], slug: m[2] });
  return out;
}

describe('search_docs', () => {
  beforeEach(() => __resetSearchDocsIndex());

  it('пустой / пробельный query → подсказка, без падения', async () => {
    for (const q of [undefined, '', '   ']) {
      const res = await searchDocsTool({ query: q as string });
      expect(res.content[0].text).toMatch(/query/i);
    }
  });

  it('осмысленный запрос находит секции и каждый URI резолвится через getSectionBySlug', async () => {
    if (listAvailablePackages().length === 0) return; // нет llms.txt на диске — нечего искать
    const res = await searchDocsTool({ query: 'validation' });
    const text = res.content[0].text;
    const uris = extractUris(text);
    expect(uris.length).toBeGreaterThan(0);
    for (const { short, slug } of uris) {
      const pkg = `@reformer/${short}`;
      expect(
        getSectionBySlug(pkg, slug),
        `URI reformer://docs/${short}/${slug} из выдачи не резолвится в секцию`
      ).not.toBeNull();
    }
  });

  it('заведомо бессмысленный запрос → сообщение об отсутствии совпадений (без URI)', async () => {
    const res = await searchDocsTool({ query: 'zzqqxywvunlikelyterm' });
    const text = res.content[0].text;
    expect(text).toMatch(/no documentation sections matched/i);
    expect(extractUris(text)).toHaveLength(0);
  });

  it('limit ограничивает число результатов', async () => {
    if (listAvailablePackages().length === 0) return;
    const res = await searchDocsTool({ query: 'form', limit: 2 });
    const headers = (res.content[0].text.match(/^## @reformer\//gm) || []).length;
    expect(headers).toBeLessThanOrEqual(2);
  });

  it('фильтр package ограничивает выдачу одним пакетом', async () => {
    const available = listAvailablePackages();
    if (!available.includes('@reformer/core')) return;
    const res = await searchDocsTool({ query: 'form', package: '@reformer/core' });
    for (const { short } of extractUris(res.content[0].text)) {
      expect(short).toBe('core');
    }
  });
});
