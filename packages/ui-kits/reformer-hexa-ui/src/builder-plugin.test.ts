import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import {
  declaredKitId,
  exportNameFor,
  KitSourcePoint,
  type CatalogJson,
  type KitSource,
} from '@reformer/builder-plugin-api';
import { loadCatalogValidator } from '@reformer/builder-plugin-api/tooling';
import catalogJson from '../catalog.json';
import manifest from '../manifest.json';
import pkg from '../package.json';
import plugin from './builder-plugin';

// Пространство имён — сами компоненты HexaUI; в node они не исполняются. Двойник считает загрузки:
// по нему видно, КОГДА плагин грузит namespace.
const loads = vi.hoisted(() => ({ count: 0 }));
vi.mock('./namespace', () => {
  loads.count += 1;
  return { HEXA_UI_NAMESPACE: { marker: true } };
});

const catalog = catalogJson as unknown as CatalogJson;

/** Активирует плагин на контексте-двойнике и отдаёт, что он внёс. */
function activate() {
  const contributed: { point: string; value: unknown; id: string | undefined }[] = [];
  const ctx = {
    id: manifest.id,
    subscriptions: [] as { dispose(): void }[],
    extensions: {
      contribute: (point: { id: string }, value: unknown, meta?: { id?: string }) => {
        contributed.push({ point: point.id, value, id: meta?.id });
        return { dispose: () => undefined };
      },
    },
  };
  void plugin.activate(ctx as never);
  return { contributed, ctx };
}

/** Ключи объекта `HEXA_UI_NAMESPACE` — по исходнику, не исполняя HexaUI. */
function namespaceKeys(): string[] {
  const source = readFileSync(new URL('./namespace.ts', import.meta.url), 'utf8');
  const file = ts.createSourceFile('namespace.ts', source, ts.ScriptTarget.ES2022, true);
  const keys: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(file) === 'HEXA_UI_NAMESPACE' &&
      node.initializer !== undefined &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const property of node.initializer.properties) {
        if (property.name !== undefined) keys.push(property.name.getText(file));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return keys;
}

describe('плагин кита HexaUI', () => {
  it('идентификатор кода и версия совпадают с манифестом', () => {
    // Иначе оболочка откажет в загрузке (id-mismatch), а упаковка разойдётся с манифестом.
    expect(plugin.id).toBe(manifest.id);
    expect(pkg.version).toBe(manifest.version);
  });

  it('вносит кит в точку источников китов — и только его', () => {
    const { contributed, ctx } = activate();

    expect(contributed.map((entry) => [entry.point, entry.id])).toEqual([
      [KitSourcePoint.id, 'hexa-ui'],
    ]);
    // Вклад снимается вместе с плагином: подписка отдана контексту.
    expect(ctx.subscriptions).toHaveLength(1);
    expect(declaredKitId(contributed[0]?.value as KitSource)).toBe('hexa-ui');
  });

  it('пространство имён грузится по запросу, а не при активации', async () => {
    const { contributed } = activate();
    const source = contributed[0]?.value as KitSource;

    expect(loads.count).toBe(0);
    const namespace = await source.namespace?.();

    expect(loads.count).toBe(1);
    expect(namespace).toEqual({ marker: true });
  });

  it('каталог проходит контракт SDK — ту же проверку, что у реестра китов', async () => {
    const validate = await loadCatalogValidator();

    expect(validate(catalog)).toEqual({ valid: true, errors: [] });
  });

  it('каждый символ каталога есть в пространстве имён', () => {
    const keys = new Set(namespaceKeys());
    const symbols = [
      ...catalog.components.map((record) => exportNameFor(record)),
      catalog.kit?.infra?.fieldWrapper,
      catalog.kit?.infra?.fieldFrame,
      catalog.kit?.adapters?.provider?.symbol,
    ].filter((symbol): symbol is string => typeof symbol === 'string');

    // Проверка не пуста: разбор исходника нашёл объект.
    expect(keys.size).toBeGreaterThan(10);
    expect(symbols.filter((symbol) => !keys.has(symbol))).toEqual([]);
  });
});
