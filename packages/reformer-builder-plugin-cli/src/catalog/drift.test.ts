import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { absoluteFiles, acmeConfig, memoryHost, ROOT } from './__fixtures__/acme-kit.js';
import { diffCatalogs, formatCatalogDiff } from './drift.js';
import { checkKitCatalog, generateKitCatalog } from './index.js';

describe('diffCatalogs', () => {
  it('записи сопоставляются по имени; порядок ключей объекта не значим', () => {
    const before = {
      version: '3.0',
      components: [
        { name: 'A', role: 'container', propsSchema: { properties: { x: { type: 'string' } } } },
        { name: 'B', role: 'container', propsSchema: {} },
      ],
    };
    const after = {
      components: [
        { name: 'C', role: 'field', propsSchema: {} },
        { propsSchema: { properties: { y: { type: 'number' } } }, role: 'container', name: 'A' },
      ],
      version: '3.0',
    };

    expect(diffCatalogs(before, after)).toEqual([
      {
        path: 'components[A].propsSchema.properties.x',
        kind: 'removed',
        before: { type: 'string' },
      },
      { path: 'components[A].propsSchema.properties.y', kind: 'added', after: { type: 'number' } },
      {
        path: 'components[B]',
        kind: 'removed',
        before: { name: 'B', role: 'container', propsSchema: {} },
      },
      {
        path: 'components[C]',
        kind: 'added',
        after: { name: 'C', role: 'field', propsSchema: {} },
      },
    ]);
    expect(diffCatalogs(before, structuredClone(before))).toEqual([]);
  });

  it('порядок элементов обычного массива значим (порядок enum)', () => {
    const entries = diffCatalogs({ enum: ['a', 'b'] }, { enum: ['b', 'a'] });

    expect(entries).toEqual([
      { path: 'enum', kind: 'changed', before: ['a', 'b'], after: ['b', 'a'] },
    ]);
    expect(formatCatalogDiff(entries)).toEqual(['~ enum: ["a","b"] → ["b","a"]']);
  });

  it('длинный дифф обрезается', () => {
    const before = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${String(i)}`, i]));
    const lines = formatCatalogDiff(diffCatalogs(before, {}), 3);

    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe('… и ещё 47');
  });
});

describe('checkKitCatalog — --check', () => {
  let dir: string;
  let out: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'reformer-catalog-'));
    out = join(dir, 'catalog.json');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  function options() {
    return {
      dir: ROOT,
      config: { ...acmeConfig(), out },
      typescript: ts,
      compilerHost: memoryHost(ts, absoluteFiles(ROOT)),
      prettier: false,
    };
  }

  async function writeGenerated(): Promise<void> {
    const generated = await generateKitCatalog(options());
    if (!generated.ok) throw new Error('генерация не удалась');
    await writeFile(out, generated.text);
  }

  it('свежий файл совпадает; форматирование и порядок ключей не влияют', async () => {
    await writeGenerated();
    expect((await checkKitCatalog(options())).ok).toBe(true);

    // Тот же JSON, иначе отформатированный и с другим порядком ключей верхнего уровня.
    const parsed = JSON.parse(await readFile(out, 'utf8')) as Record<string, unknown>;
    const reordered = Object.fromEntries(Object.entries(parsed).reverse());
    await writeFile(out, JSON.stringify(reordered, null, 4));
    expect((await checkKitCatalog(options())).ok).toBe(true);
  });

  it('правка набора пропсов — catalog-drift с диффом', async () => {
    await writeGenerated();
    const parsed = JSON.parse(await readFile(out, 'utf8')) as {
      components: { name: string; propsSchema: { properties: Record<string, unknown> } }[];
    };
    const badge = parsed.components.find((r) => r.name === 'Badge');
    if (badge === undefined) throw new Error('нет Badge');
    delete badge.propsSchema.properties.count;
    badge.propsSchema.properties.extra = { type: 'string' };
    await writeFile(out, JSON.stringify(parsed));

    const result = await checkKitCatalog(options());
    if (result.ok) throw new Error('ожидалось расхождение');
    expect(result.findings).toEqual([
      {
        code: 'catalog-drift',
        message:
          'каталог разошёлся с типами кита (расхождений: 2) — перегенерируйте: reformer-plugin catalog',
        file: 'catalog.json',
      },
    ]);
    expect(result.diff.map((entry) => `${entry.kind} ${entry.path}`)).toEqual([
      'added components[Badge].propsSchema.properties.count',
      'removed components[Badge].propsSchema.properties.extra',
    ]);
  });

  it('нет файла или не JSON — catalog-drift', async () => {
    const missing = await checkKitCatalog(options());
    expect(missing.ok ? undefined : missing.findings[0]?.message).toContain('файла каталога нет');

    await writeFile(out, '{ не json');
    const broken = await checkKitCatalog(options());
    expect(broken.ok ? undefined : broken.findings[0]?.message).toContain('не JSON');
  });
});
