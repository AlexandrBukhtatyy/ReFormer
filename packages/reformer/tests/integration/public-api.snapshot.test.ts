/**
 * Публичный API `@reformer/core` целиком: имена и виды экспортов каждого входа сабпата.
 *
 * Сабпаты пакета (`exports` в `package.json`) — контракт с потребителями: исчезнувшее имя ломает
 * их сборку, лишнее становится API, которое придётся поддерживать. Снимок перечисляет каждый вход —
 * значения и типы — с видом экспорта (функция, класс, объект, массив, константа, тип): любое
 * добавление, удаление или смена вида видны в диффе снимка, а не только на ревью. Значения и их
 * вид берутся из модулей в рантайме, полный список имён (вместе с типами, которых в рантайме нет) —
 * из компилятора TypeScript.
 *
 * Рядом — то, чего снимок не видит: список входов сверен с `package.json`; входы без React не
 * тянут React ни в рантайме, ни в типах; `./signals` — тот же рантайм, что `@preact/signals-core`,
 * и ручки модели заявки живут в нём; `CORE_RUNTIME_TOKEN` различает копии ядра; одно имя в
 * нескольких входах — одно значение или намеренно разные. Точечные проверки имён корня и
 * сабпатов — `tests/core/utils/root-exports.test.ts`, штамп рантайма в юните —
 * `tests/core/utils/runtime-token.test.ts`.
 *
 * Обновление снимка — `npx vitest run -u tests/integration/public-api.snapshot.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as preactSignals from '@preact/signals-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { disposeForm } from '../test-utils/dispose-form';
import * as root from '../../src/index';
import * as model from '../../src/model/index';
import * as behaviors from '../../src/form/behaviors/index';
import * as validation from '../../src/form/validation/index';
import * as validators from '../../src/form/validators/index';
import * as i18n from '../../src/i18n';
import * as signals from '../../src/signals';
import * as react from '../../src/react';
import * as locale from '../../src/locale/index';
import * as localeEn from '../../src/locale/en';
import * as localeRu from '../../src/locale/ru';
import { annuityPayment } from './fixtures/loan-application/behavior';
import { createLoanForm, type LoanForm } from './fixtures/loan-application/create-loan-form';

/** Корень пакета `@reformer/core` с `/` в конце. */
const PACKAGE_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Модуль входа: пространство имён ESM. */
type EntryModule = Readonly<Record<string, unknown>>;

/** Вход сабпата: исходник (от корня пакета), модуль и его повторная загрузка. */
interface Entry {
  readonly source: string;
  readonly module: EntryModule;
  readonly load: () => Promise<EntryModule>;
}

/** Входы-модули `package.json` — кроме гранулярных правил `./validators/<правило>`. */
const ENTRIES: Readonly<Record<string, Entry>> = {
  '.': { source: 'src/index.ts', module: root, load: () => import('../../src/index') },
  './model': {
    source: 'src/model/index.ts',
    module: model,
    load: () => import('../../src/model/index'),
  },
  './behaviors': {
    source: 'src/form/behaviors/index.ts',
    module: behaviors,
    load: () => import('../../src/form/behaviors/index'),
  },
  './validation': {
    source: 'src/form/validation/index.ts',
    module: validation,
    load: () => import('../../src/form/validation/index'),
  },
  './validators': {
    source: 'src/form/validators/index.ts',
    module: validators,
    load: () => import('../../src/form/validators/index'),
  },
  './i18n': { source: 'src/i18n.ts', module: i18n, load: () => import('../../src/i18n') },
  './signals': {
    source: 'src/signals.ts',
    module: signals,
    load: () => import('../../src/signals'),
  },
  './react': { source: 'src/react.ts', module: react, load: () => import('../../src/react') },
  './locale': {
    source: 'src/locale/index.ts',
    module: locale,
    load: () => import('../../src/locale/index'),
  },
  './locale/en': {
    source: 'src/locale/en.ts',
    module: localeEn,
    load: () => import('../../src/locale/en'),
  },
  './locale/ru': {
    source: 'src/locale/ru.ts',
    module: localeRu,
    load: () => import('../../src/locale/ru'),
  },
};

/**
 * Загрузчики модулей каталога `validators/` (без type-тестов). Грузится только то, что
 * `package.json` объявляет входом `./validators/<правило>`; служебные модули остаются нетронутыми.
 */
const VALIDATOR_SOURCES = import.meta.glob<EntryModule>([
  '../../src/form/validators/*.ts',
  '!../../src/form/validators/*.type-test.ts',
]);

/** Ключ `import.meta.glob` для гранулярного входа `./validators/<правило>`. */
const validatorSourceKey = (subpath: string): string =>
  `../../src/form/validators/${subpath.slice('./validators/'.length)}.ts`;

/** `exports` из `package.json` пакета. */
const PACKAGE_EXPORTS = (
  JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as {
    exports: Record<string, unknown>;
  }
).exports;

const GRANULAR = /^\.\/validators\/[a-z-]+$/;
const JSON_ASSET = /\.json$/;

/** Гранулярные входы правил — по `package.json`. */
const GRANULAR_SUBPATHS = Object.keys(PACKAGE_EXPORTS)
  .filter((subpath) => GRANULAR.test(subpath))
  .sort();

/** Путь от корня пакета с прямыми слешами — так пути пишет компилятор. */
const absolute = (source: string): string => join(PACKAGE_ROOT, source).replace(/\\/g, '/');

// ─── Компилятор TypeScript ─────────────────────────────────────────────────────────────────

/** Программа над всеми входами пакета: настройки пакета, без глобальных типов и без вывода. */
function createEntriesProgram(): ts.Program {
  const config = ts.readConfigFile(join(PACKAGE_ROOT, 'tsconfig.json'), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, PACKAGE_ROOT);
  const roots = [
    ...Object.values(ENTRIES).map((entry) => absolute(entry.source)),
    ...GRANULAR_SUBPATHS.map((subpath) =>
      absolute(`src/form/validators/${subpath.slice('./validators/'.length)}.ts`)
    ),
  ];
  return ts.createProgram(roots, {
    ...parsed.options,
    noEmit: true,
    declaration: false,
    emitDeclarationOnly: false,
    skipLibCheck: true,
    types: [],
  });
}

let entriesProgram: ts.Program | undefined;

/** Программа строится один раз на файл: разбор исходников — самая дорогая часть проверки. */
const program = (): ts.Program => (entriesProgram ??= createEntriesProgram());

/** Все имена экспорта модуля — значения и типы, включая реэкспорт `export *`. */
function exportNames(source: string): string[] {
  const file = program().getSourceFile(absolute(source));
  if (file === undefined) throw new Error(`компилятор не нашёл исходник входа «${source}»`);
  const checker = program().getTypeChecker();
  const symbol = checker.getSymbolAtLocation(file);
  if (symbol === undefined) throw new Error(`«${source}» — не модуль`);
  return checker
    .getExportsOfModule(symbol)
    .map((exported) => exported.name)
    .sort();
}

/** Спецификаторы модулей, на которые ссылается файл: импорт, реэкспорт, `import()` в коде и типах. */
function moduleSpecifiers(file: ts.SourceFile): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      found.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      found.push(node.arguments[0].text);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      found.push(node.argument.literal.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/** Файлы, достижимые из входа по импортам — и значений, и типов. В зависимости не спускаемся. */
function reachableFiles(source: string): Set<string> {
  const options = program().getCompilerOptions();
  const seen = new Set<string>();
  const queue = [absolute(source)];
  while (queue.length > 0) {
    const fileName = queue.pop() as string;
    if (seen.has(fileName)) continue;
    seen.add(fileName);
    const file = fileName.includes('/node_modules/')
      ? undefined
      : program().getSourceFile(fileName);
    if (file === undefined) continue;
    for (const specifier of moduleSpecifiers(file)) {
      const resolved = ts.resolveModuleName(specifier, fileName, options, ts.sys).resolvedModule;
      if (resolved !== undefined) queue.push(resolved.resolvedFileName.replace(/\\/g, '/'));
    }
  }
  return seen;
}

// ─── Вид экспорта ──────────────────────────────────────────────────────────────────────────

/** Класс: синтаксис `class` либо функция-конструктор с методами на прототипе. */
function isClass(value: (...args: never[]) => unknown): boolean {
  if (/^class\b/.test(Function.prototype.toString.call(value))) return true;
  const prototype = (value as { prototype?: object }).prototype;
  return (
    prototype !== undefined &&
    Object.getOwnPropertyNames(prototype).some((key) => key !== 'constructor')
  );
}

/** Вид экспорта: значение — по рантайму, имя, которого в рантайме нет, — тип. */
function kindOf(name: string, module: EntryModule): string {
  if (!(name in module)) return 'тип';
  const value = module[name];
  if (typeof value === 'function') {
    return isClass(value as (...args: never[]) => unknown) ? 'класс' : 'функция';
  }
  if (value !== null && typeof value === 'object') {
    const kind = Array.isArray(value) ? 'массив' : 'объект';
    return Object.isFrozen(value) ? `${kind}, заморожен` : kind;
  }
  return `константа: ${typeof value}`;
}

/**
 * Имена и виды экспортов входа по алфавиту. Значение рантайма, которого не видит компилятор, —
 * ошибка: такое имя не попало бы в снимок типов потребителя.
 */
function describeExports(source: string, module: EntryModule): Record<string, string> {
  const names = exportNames(source);
  const unknown = Object.keys(module).filter((name) => !names.includes(name));
  if (unknown.length > 0) {
    throw new Error(`«${source}»: значения без объявления для компилятора — ${unknown.join(', ')}`);
  }
  return Object.fromEntries(names.map((name) => [name, kindOf(name, module)]));
}

// ─── Сборки заявки ────────────────────────────────────────────────────────────────────────

/** Сборки текущего теста: после теста их поведение снимается. */
const assembled: LoanForm[] = [];

function build(): LoanForm {
  const built = createLoanForm();
  assembled.push(built);
  return built;
}

afterEach(() => {
  for (const { bundle } of assembled.splice(0)) disposeForm(bundle.form);
});

// Разбор исходников компилятором занимает секунды, под покрытием и нагрузкой — десятки секунд.
// Программа строится до тестов: иначе её цену платил бы первый тест и не укладывался в свой таймаут.
beforeAll(() => {
  program();
}, 120_000);

// ─── Входы и снимок ────────────────────────────────────────────────────────────────────────

describe('public API — входы сабпатов', () => {
  it('PA-01: каждый вход `package.json` описан тестом — модуль, гранулярное правило или JSON локали', () => {
    const subpaths = Object.keys(PACKAGE_EXPORTS);
    const classified = Object.fromEntries(
      subpaths.map((subpath) => {
        if (subpath in ENTRIES) return [subpath, 'модуль'];
        if (GRANULAR.test(subpath)) {
          return [
            subpath,
            validatorSourceKey(subpath) in VALIDATOR_SOURCES ? 'правило' : 'нет исходника',
          ];
        }
        if (JSON_ASSET.test(subpath)) {
          return [
            subpath,
            subpath.replace(JSON_ASSET, '') in ENTRIES ? 'JSON локали' : 'нет модуля',
          ];
        }
        return [subpath, 'не описан'];
      })
    );

    expect(Object.keys(ENTRIES).filter((subpath) => !subpaths.includes(subpath))).toEqual([]);
    expect(
      Object.entries(classified).filter(
        ([, kind]) => !['модуль', 'правило', 'JSON локали'].includes(kind)
      )
    ).toEqual([]);
  });

  // поведение под вопросом: `CORE_RUNTIME_TOKEN` и `DEFAULT_LOCALE` заморожены, а
  // `FIELD_WRAPPER_ONLY_PROPS`, `CORE_LOCALES` и локали `en` / `ru` экспортированы изменяемыми —
  // от правки потребителем их защищает только тип `readonly`.
  it.each(Object.keys(ENTRIES))('PA-02 · %s — имена и виды экспортов', (subpath) => {
    const entry = ENTRIES[subpath];

    expect(describeExports(entry.source, entry.module)).toMatchSnapshot();
  });

  it('PA-02 · ./validators/<правило> — гранулярные входы: имена и виды, значение — то же, что в ./validators', async () => {
    const described: Record<string, Record<string, string>> = {};
    const differs: string[] = [];
    // Общий вход грузится тем же способом, что и гранулярные: после `vi.resetModules()` соседнего
    // теста повторная загрузка даёт новые экземпляры модулей, и сравнивать их со статическим
    // импортом файла нельзя.
    const barrel = await ENTRIES['./validators'].load();
    for (const subpath of GRANULAR_SUBPATHS) {
      const module = await VALIDATOR_SOURCES[validatorSourceKey(subpath)]();
      const source = `src/form/validators/${subpath.slice('./validators/'.length)}.ts`;
      described[subpath] = describeExports(source, module);
      for (const name of Object.keys(module)) {
        if (module[name] !== barrel[name]) differs.push(`${subpath}: ${name}`);
      }
    }

    expect(differs).toEqual([]);
    expect(described).toMatchSnapshot();
  });

  it('PA-03: одно имя в нескольких входах — одно значение либо намеренно разные', () => {
    const owners = new Map<string, string[]>();
    for (const [subpath, entry] of Object.entries(ENTRIES)) {
      for (const name of Object.keys(entry.module)) {
        owners.set(name, [...(owners.get(name) ?? []), subpath]);
      }
    }
    const shared: Record<string, string> = {};
    for (const [name, subpaths] of [...owners].sort(([left], [right]) =>
      left.localeCompare(right)
    )) {
      if (subpaths.length < 2) continue;
      const values = new Set(subpaths.map((subpath) => ENTRIES[subpath].module[name]));
      shared[name] =
        `${subpaths.join(' ')} — ${values.size === 1 ? 'одно значение' : 'разные значения'}`;
    }

    // Разные значения под одним именем — намеренные пары: оператор поведения формы
    // (`./behaviors`) — обёртка над примитивом модели (`./model`) с регистрацией отписки и
    // пометкой derived [ReFormer-x6y]; `apply` / `applyEach` поведения и валидации — разные
    // контракты; `effect` поведения снимается вместе со схемой, `effect` рантайма — нет.
    expect(shared).toMatchSnapshot();
  });
});

// ─── React ─────────────────────────────────────────────────────────────────────────────────

/** Модули React, которые тянет только вход `./react`. */
const REACT_MODULES = ['react', 'react/jsx-runtime', 'react-dom', 'use-sync-external-store/shim'];

/** Путь для сообщения: зависимость — от `node_modules`, исходник — от корня пакета. */
const displayPath = (fileName: string): string => {
  const dependency = fileName.lastIndexOf('/node_modules/');
  return dependency >= 0 ? fileName.slice(dependency + 1) : fileName.slice(absolute('').length);
};

/** Файл из React или из платформенного слоя ядра. */
const isReactFile = (fileName: string): boolean =>
  /\/node_modules\/(?:@types\/)?(?:react|react-dom|use-sync-external-store)\//.test(fileName) ||
  fileName.startsWith(absolute('src/platforms/'));

describe('public API — React только во входе ./react', () => {
  afterEach(() => {
    for (const id of REACT_MODULES) vi.doUnmock(id);
    vi.resetModules();
  });

  it('PA-04: без React грузятся все входы, кроме ./react', async () => {
    for (const id of REACT_MODULES) {
      vi.doMock(id, () => {
        throw new Error(`[PA-04] модуль «${id}» недоступен`);
      });
    }
    vi.resetModules();

    const loaded: Record<string, string> = {};
    for (const [subpath, entry] of Object.entries(ENTRIES)) {
      loaded[subpath] = await entry.load().then(
        () => 'загружен',
        () => 'не загружен'
      );
    }

    expect(loaded).toEqual({
      ...Object.fromEntries(Object.keys(ENTRIES).map((subpath) => [subpath, 'загружен'])),
      // Контроль: вход React без React не грузится — значит, недоступность React настоящая.
      './react': 'не загружен',
    });
  });

  it('PA-05: ни значения, ни типы входов без React не ссылаются на React и платформенный слой', () => {
    const reactFiles = Object.fromEntries(
      Object.entries(ENTRIES).map(([subpath, entry]) => [
        subpath,
        [...reachableFiles(entry.source)].filter(isReactFile).map(displayPath),
      ])
    );

    // Контроль обхода: корень доходит до сборки формы, вход React — до React.
    expect(reachableFiles('src/index.ts')).toContain(absolute('src/form/form-bundle.ts'));
    expect(reactFiles['./react']).toContain('node_modules/@types/react/index.d.ts');
    expect({ ...reactFiles, './react': [] }).toEqual(
      Object.fromEntries(Object.keys(ENTRIES).map((subpath) => [subpath, []]))
    );
  });
});

// ─── ./signals и штамп рантайма ───────────────────────────────────────────────────────────

describe('public API — ./signals и CORE_RUNTIME_TOKEN', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('PA-06: ./signals — рантайм @preact/signals-core как есть, плюс метка isSignal', () => {
    const runtime = Object.keys(signals).filter((name) => name !== 'isSignal');

    expect(runtime.sort()).toEqual([
      'Signal',
      'batch',
      'computed',
      'effect',
      'signal',
      'untracked',
    ]);
    for (const name of runtime) {
      expect((signals as EntryModule)[name], name).toBe((preactSignals as EntryModule)[name]);
    }
  });

  it('PA-07: ручки модели заявки — сигналы этого рантайма: effect, batch и untracked из ./signals видят модель', () => {
    const { bundle } = build();
    const { model } = bundle;
    const payments: number[] = [];
    const amounts: number[] = [];
    const stopPayments = signals.effect(() => {
      payments.push(model.$.loan.monthlyPayment.value);
    });
    // Срок читается без подписки: этот эффект перезапускает только сумма.
    const stopAmounts = signals.effect(() => {
      amounts.push(
        (model.$.loan.amount.value ?? 0) + signals.untracked(() => model.loan.term ?? 0)
      );
    });

    expect(model.$.loan.amount).toBeInstanceOf(signals.Signal);
    expect(signals.isSignal(model.$.loan.amount)).toBe(true);

    // Сумма и срок отдельными записями — платёж пересчитан на каждую; те же записи в batch — один
    // раз, на итоговых значениях. Ставка не меняется: срок не длиннее пяти лет.
    model.loan.patch({ amount: 500_000, term: 36 });
    model.loan.amount = 600_000;
    model.loan.term = 48;
    signals.batch(() => {
      model.loan.amount = 700_000;
      model.loan.term = 24;
    });
    stopPayments();
    stopAmounts();
    model.loan.amount = 800_000;

    expect(payments).toEqual([
      0,
      annuityPayment(500_000, 36, 15.9),
      annuityPayment(600_000, 36, 15.9),
      annuityPayment(600_000, 48, 15.9),
      annuityPayment(700_000, 24, 15.9),
    ]);
    expect(amounts).toEqual([0, 500_036, 600_036, 700_024]);
  });

  it('PA-08: CORE_RUNTIME_TOKEN — вторая копия ядра узнаётся по штампу: её реестры свои, сигналы общие', async () => {
    const { bundle } = build();
    const payment = bundle.model.$.loan.monthlyPayment;

    vi.resetModules();
    const copy = (await import('../../src/index')) as typeof root;

    expect(Object.isFrozen(root.CORE_RUNTIME_TOKEN)).toBe(true);
    expect(copy.CORE_RUNTIME_TOKEN).not.toBe(root.CORE_RUNTIME_TOKEN);
    expect(copy.CORE_RUNTIME_TOKEN).toEqual(root.CORE_RUNTIME_TOKEN);
    // Почему дубль опасен: пометку `compute` видит только своя копия — bulk-запись через чужую
    // копию затёрла бы производное поле.
    expect([root.isDerived(payment), copy.isDerived(payment)]).toEqual([true, false]);
    // Рантайм сигналов при этом один: копия узнаёт ручки чужой модели.
    expect(copy.isValueSignal(bundle.model.$.loan.amount)).toBe(true);
  });
});
