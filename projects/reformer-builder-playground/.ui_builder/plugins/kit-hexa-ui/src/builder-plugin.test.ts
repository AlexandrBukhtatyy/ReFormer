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
import plugin, { HEXA_UI_KIT } from './builder-plugin';

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

/** Источник кита, который вносит плагин. */
function contributedSource(): KitSource {
  return activate().contributed[0]?.value as KitSource;
}

/** Символ, который каталог обещает от кита, и вход пакета, откуда он импортируется. */
interface DeclaredSymbol {
  readonly symbol: string;
  /** Подпуть входа (`<пакет>/<подпуть>`); нет — главный вход. Правило то же, что у кодогена. */
  readonly subpath?: string;
  /**
   * Превью компонент не рисует — в namespace он не нужен: запись `limited` (вместо неё заглушка)
   * либо служебная (`palette: false` — `Field`, `Upload`, `PopupConfigProvider`…: узлом схемы она
   * не становится). Инфраструктура и адаптеры кита служебные тоже, но превью их рисует — они
   * идут в список отдельно, своими символами из блока `kit`.
   */
  readonly notRendered?: boolean;
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
      notRendered: record.preview?.mode === 'limited' || record.palette === false,
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

/** Файл пространства имён. */
const NAMESPACE_FILE = path.join(PACKAGE_DIR, 'src/namespace.ts');

/**
 * Программа компилятора над исходниками кита — одна на весь файл: компилятор читает объявления
 * типов HexaUI (больше тысячи файлов, секунды), и делать это дважды незачем. HexaUI при этом не
 * исполняется.
 */
let compiled: { program: ts.Program; checker: ts.TypeChecker } | undefined;
function compile(files: readonly string[]): { program: ts.Program; checker: ts.TypeChecker } {
  if (compiled === undefined) {
    const { config } = ts.readConfigFile(path.join(PACKAGE_DIR, 'tsconfig.json'), ts.sys.readFile);
    const { options } = ts.parseJsonConfigFileContent(config, ts.sys, PACKAGE_DIR);
    const program = ts.createProgram([...files], options);
    compiled = { program, checker: program.getTypeChecker() };
  }
  return compiled;
}

/** Все корневые файлы, которые проверяют тесты ниже: входы пакета и пространство имён. */
function rootFiles(): string[] {
  const entries = Object.values(pkg.exports as Record<string, string>)
    .filter((target) => /\.tsx?$/.test(target))
    .map((target) => path.resolve(PACKAGE_DIR, target));
  return [...entries, NAMESPACE_FILE];
}

/**
 * Ключи `HEXA_UI_NAMESPACE` — глазами компилятора: свойства типа объекта, с учётом разворота
 * `...fields`. Разбор литерала по исходнику разворот бы не увидел.
 */
function namespaceKeys(): Set<string> {
  const { program, checker } = compile(rootFiles());
  const source = program.getSourceFile(NAMESPACE_FILE);
  const module = source === undefined ? undefined : checker.getSymbolAtLocation(source);
  const exported =
    module === undefined
      ? undefined
      : checker.tryGetMemberInModuleExports('HEXA_UI_NAMESPACE', module);
  if (exported?.valueDeclaration === undefined) return new Set();
  const type = checker.getTypeOfSymbolAtLocation(exported, exported.valueDeclaration);
  return new Set(type.getProperties().map((property) => property.getName()));
}

/**
 * Имена, под которыми вход отдаёт ЗНАЧЕНИЯ, — глазами компилятора: так вход видит приложение,
 * и здесь же рождается `TS2305 … has no exported member`.
 */
function valueExports(file: string): Set<string> {
  const { program, checker } = compile(rootFiles());
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
    // Кит с загрузчиком каталога представляется шапкой — без неё реестр его не примет.
    expect(declaredKitId(contributed[0]?.value as KitSource)).toBe('hexa-ui');
  });

  it('пространство имён грузится по запросу, а не при активации', async () => {
    const source = contributedSource();

    expect(loads.count).toBe(0);
    const namespace = await source.namespace?.();

    expect(loads.count).toBe(1);
    expect(namespace).toEqual({ marker: true });
  });

  it('каталог — загрузчиком, и загружается тот самый catalog.json', async () => {
    const source = contributedSource();

    expect(typeof source.catalog).toBe('function');
    const loaded = await (source.catalog as () => Promise<CatalogJson>)();

    expect(loaded).toEqual(catalog);
  });

  it('шапка совпадает с блоком kit каталога: реестр сверяет их после загрузки', () => {
    expect(contributedSource().kit).toBe(HEXA_UI_KIT);
    expect(HEXA_UI_KIT).toEqual({
      id: catalog.kit?.id,
      label: catalog.kit?.label,
      package: catalog.kit?.package,
    });
  });

  it('каталог проходит контракт SDK — ту же проверку, что у реестра китов', async () => {
    const validate = await loadCatalogValidator();

    expect(validate(catalog)).toEqual({ valid: true, errors: [] });
  });

  // Запас по времени: компилятор читает объявления типов HexaUI — больше тысячи файлов, секунды.
  it('каждый символ каталога, который превью рисует вживую, есть в пространстве имён', () => {
    const keys = namespaceKeys();
    const symbols = declaredSymbols()
      .filter((declared) => declared.notRendered !== true)
      .map((declared) => declared.symbol);

    // Проверка не пуста: компилятор нашёл объект с развёрнутыми полями, а каталог — свои записи.
    expect(keys.size).toBeGreaterThan(50);
    expect(keys.has('DatePicker')).toBe(true);
    expect(symbols.length).toBeGreaterThan(10);
    expect(symbols.filter((symbol) => !keys.has(symbol))).toEqual([]);
  }, 60_000);
});

/** Импорт значения из модуля: статический, реэкспорт или `import()`; типы не в счёт. */
interface ValueImport {
  readonly from: string;
  readonly specifier: string;
  /** `import()` — модуль грузится лениво, отдельным файлом сборки. */
  readonly dynamic: boolean;
}

/** Значимые импорты файла исходников — по синтаксису, без компилятора. */
function valueImportsOf(file: string): ValueImport[] {
  const source = ts.createSourceFile(
    file,
    ts.sys.readFile(file) ?? '',
    ts.ScriptTarget.ES2022,
    true
  );
  const found: ValueImport[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const typeOnly = ts.isImportDeclaration(node)
        ? node.importClause?.isTypeOnly === true
        : node.isTypeOnly;
      if (!typeOnly)
        found.push({ from: file, specifier: node.moduleSpecifier.text, dynamic: false });
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      found.push({ from: file, specifier: node.arguments[0].text, dynamic: true });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** Файл исходников по относительному спецификатору: `.ts`, `.tsx` или `index` каталога. */
function resolveLocal(from: string, specifier: string): string | undefined {
  const base = path.resolve(path.dirname(from), specifier);
  return [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')].find((candidate) =>
    ts.sys.fileExists(candidate)
  );
}

/**
 * Подпути HexaUI, которые в пространство имён статически не входят: движки редакторов и
 * календарей (поля грузят их лениво) и компоненты, статически тянущие их за собой.
 */
const HEAVY_SUBPATHS = [
  'code-compare',
  'code-viewer',
  'datepicker',
  'field-set',
  'license-card',
  'quick-filter',
  'rich-text-editor',
  'table',
  'terminal',
].map((subpath) => `@kaspersky/hexa-ui/${subpath}`);

describe('пространство имён — без лишнего веса', () => {
  // Главный вход HexaUI реэкспортирует всё. Коснись его граф пространства имён — и esbuild при
  // делении кода сочтёт достижимыми из пространства имён редакторы и календари, которые поля
  // грузят лениво (`import()` с подпутей), и положит их в общий чанк, грузящийся сразу: так
  // пространство имён однажды выросло с четырёх мегабайт до девяти.
  it('граф пространства имён: HexaUI — с подпутей, тяжёлое — только лениво', () => {
    const seen = new Set<string>();
    const queue = [NAMESPACE_FILE];
    const offenders: string[] = [];
    for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
      if (seen.has(file)) continue;
      seen.add(file);
      for (const { from, specifier, dynamic } of valueImportsOf(file)) {
        const heavy = !dynamic && HEAVY_SUBPATHS.includes(specifier);
        if (specifier === '@kaspersky/hexa-ui' || heavy) {
          offenders.push(`${path.relative(PACKAGE_DIR, from)} → ${specifier}`);
        }
        if (specifier.startsWith('.')) {
          const local = resolveLocal(from, specifier);
          if (local !== undefined) queue.push(local);
        }
      }
    }

    // Обход не пуст: дошёл до полей, визарда и палитры.
    expect(seen.size).toBeGreaterThan(10);
    expect(offenders).toEqual([]);
  });
});

describe('пакет кита HexaUI — вход для приложения', () => {
  // Превью билдера берёт компоненты из namespace и пропуска во входе не замечает, а модуль формы,
  // напечатанный кодогеном по каталогу (`import { Button } from '@reformer/kit-hexa-ui'`), с ним
  // не компилируется. Так во входе не было тринадцати записей каталога из двадцати одной.
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

  it('всё, что отдаёт пространство имён, вход тоже экспортирует — под теми же именами', () => {
    const exported = valueExports(entryFile(undefined));

    expect([...namespaceKeys()].filter((key) => !exported.has(key))).toEqual([]);
  }, 60_000);
});
