import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
import manifest from './manifest.json';
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

/** Символ, который каталог обещает от кита, и вход пакета, откуда он импортируется. */
interface DeclaredSymbol {
  readonly symbol: string;
  /** Подпуть входа (`<пакет>/<подпуть>`); нет — главный вход. Правило то же, что у кодогена. */
  readonly subpath?: string;
}

/**
 * Всё, что каталог называет символом кита: записи (`exportName` либо имя записи), обёртка и рамка
 * поля, адаптеры. По этим именам билдер берёт компоненты из namespace, а кодоген печатает импорт
 * из пакета — поэтому оба места сверяются с ОДНИМ списком.
 */
function declaredSymbols(): DeclaredSymbol[] {
  const infra = catalog.kit?.infra;
  const named: (Partial<DeclaredSymbol> | null | undefined)[] = [
    ...catalog.components.map((record) => ({
      symbol: exportNameFor(record),
      subpath: record.subpath,
    })),
    { symbol: infra?.fieldWrapper },
    { symbol: infra?.fieldFrame },
    ...Object.values(catalog.kit?.adapters ?? {}),
  ];
  return named.filter(
    (declared): declared is DeclaredSymbol => typeof declared?.symbol === 'string'
  );
}

/** Каталог пакета кита. */
const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url));

/** Файл входа пакета: то, что `exports` из `package.json` называет для подпутя (главный — `.`). */
function entryFile(subpath: string | undefined): string {
  const key = subpath === undefined ? '.' : `./${subpath}`;
  const target = (pkg.exports as Record<string, string | undefined>)[key];
  if (target === undefined) throw new Error(`package.json: в exports нет входа «${key}»`);
  return path.resolve(PACKAGE_DIR, target);
}

/**
 * Имена, под которыми вход отдаёт ЗНАЧЕНИЯ, — глазами компилятора: так вход видит приложение,
 * и здесь же рождается `TS2305 … has no exported member`. HexaUI при этом не исполняется —
 * компилятор читает только объявления типов.
 */
function valueExports(file: string): Set<string> {
  const { config } = ts.readConfigFile(path.join(PACKAGE_DIR, 'tsconfig.json'), ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(config, ts.sys, PACKAGE_DIR);
  const program = ts.createProgram([file], options);
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(file);
  const entry = source === undefined ? undefined : checker.getSymbolAtLocation(source);
  /** Идёт по цепочке реэкспортов до самого объявления; `undefined` — значения приложению нет. */
  const valueBehind = (exported: ts.Symbol): ts.Symbol | undefined => {
    let symbol: ts.Symbol | undefined = exported;
    while (symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0) {
      // `export type { X }` и `export { type X }`: имя есть, а импортировать его значением нельзя.
      if (symbol.declarations?.some(ts.isTypeOnlyImportOrExportDeclaration)) return undefined;
      symbol = checker.getImmediateAliasedSymbol(symbol);
    }
    // Реэкспорт имени, которого в исходном модуле нет, компилятор сводит к «неизвестному» символу.
    if (symbol === undefined || checker.isUnknownSymbol(symbol)) return undefined;
    return (symbol.flags & ts.SymbolFlags.Value) !== 0 ? symbol : undefined;
  };
  const exported = entry === undefined ? [] : checker.getExportsOfModule(entry);
  return new Set(
    exported.filter((symbol) => valueBehind(symbol) !== undefined).map((symbol) => symbol.getName())
  );
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
    const symbols = declaredSymbols().map((declared) => declared.symbol);

    // Проверка не пуста: разбор исходника нашёл объект, а каталог — свои записи.
    expect(keys.size).toBeGreaterThan(10);
    expect(symbols.length).toBeGreaterThan(10);
    expect(symbols.filter((symbol) => !keys.has(symbol))).toEqual([]);
  });
});

describe('пакет кита HexaUI — вход для приложения', () => {
  // Превью билдера берёт компоненты из namespace и пропуска во входе не замечает, а модуль формы,
  // напечатанный кодогеном по каталогу (`import { Button } from '@reformer/kit-hexa-ui'`), с ним
  // не компилируется. Так во входе не было тринадцати записей каталога из двадцати одной.
  //
  // Запас по времени: компилятор читает объявления типов HexaUI — больше тысячи файлов, секунды.
  it('каждый символ каталога вход экспортирует значением — под именем экспорта записи', () => {
    const declared = declaredSymbols();
    const entries = new Map(
      [...new Set(declared.map(({ subpath }) => subpath))].map(
        (subpath) => [subpath, valueExports(entryFile(subpath))] as const
      )
    );

    // Проверка не пуста: компилятор нашёл главный вход и его экспорты.
    expect(entries.get(undefined)?.size ?? 0).toBeGreaterThan(10);
    expect(
      declared
        .filter(({ symbol, subpath }) => entries.get(subpath)?.has(symbol) !== true)
        .map(({ symbol }) => symbol)
    ).toEqual([]);
  }, 60_000);
});
