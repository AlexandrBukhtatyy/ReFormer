/**
 * Сборка плагина с тяжёлой зависимостью: отложенный код, воркеры, CSS из кода, сжатие.
 *
 * Собранное здесь не только читается, но и ИСПОЛНЯЕТСЯ — графом CommonJS по тем же правилам,
 * что у линковщика оболочки: путь считается от требующего файла, модуль исполняется один раз.
 * Сборка, которая выглядит правильно, но не связывается, ломается у человека при открытии файла.
 */

import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as esbuild from 'esbuild';

import { runCli, type CliIo } from './cli.js';
import { buildPlugin, type BuildResult } from './commands/build.js';
import { createPlugin } from './commands/create.js';

let root: string;
let dir: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'reformer-plugin-chunks-'));
  dir = join(root, 'acme-hello');
  expect((await createPlugin({ dir, cliVersion: '1.0.0' })).ok).toBe(true);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const source = (file: string, code: string) => writeFile(join(dir, 'src', file), code);

/** Точка входа: плагин и то, что тест хочет вызвать снаружи. */
const main = (...lines: string[]) =>
  source(
    'main.ts',
    [
      "import { definePlugin } from '@reformer/builder-plugin-api';",
      ...lines,
      "export default definePlugin({ id: 'acme-hello', activate() {} });",
    ].join('\n')
  );

async function patchManifest(patch: (value: Record<string, unknown>) => void) {
  const file = join(dir, 'manifest.json');
  const value = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
  patch(value);
  await writeFile(file, JSON.stringify(value));
}

const findings = (result: BuildResult) => (result.ok ? [] : result.findings);
const codes = (result: BuildResult) => findings(result).map((finding) => finding.code);
const chunksOf = (result: BuildResult): string[] =>
  result.ok ? result.files.filter((file) => file.startsWith('chunks/')) : [];

/**
 * Исполняет собранный каталог графом CommonJS — как линковщик оболочки.
 *
 * @param ambient имена, которые код увидит глобалами (`Worker`, `Blob`, `URL`)
 */
function link(outDir: string, ambient: Readonly<Record<string, unknown>> = {}) {
  /** Что и в каком порядке было затребовано — файлы сборки путём, модули рантайма именем. */
  const required: string[] = [];
  const loaded = new Map<string, { exports: Record<string, unknown> }>();
  const names = Object.keys(ambient);

  const load = (path: string): Record<string, unknown> => {
    const done = loaded.get(path);
    if (done !== undefined) return done.exports;
    const module = { exports: {} as Record<string, unknown> };
    loaded.set(path, module);
    const requireFrom = (specifier: string): unknown => {
      if (!specifier.startsWith('.')) {
        required.push(specifier);
        return { definePlugin: (plugin: unknown) => plugin };
      }
      const target = posix.join(posix.dirname(path), specifier);
      required.push(target);
      return load(target);
    };
    // `new Function` — так модуль исполняет и линковщик оболочки.
    new Function(
      'exports',
      'require',
      'module',
      ...names,
      readFileSync(join(outDir, path), 'utf8')
    )(module.exports, requireFrom, module, ...names.map((name) => ambient[name]));
    return module.exports;
  };

  return { exports: load('main.js'), required, load };
}

/** Секция сборки собранного манифеста. */
async function builtGraph(outDir: string) {
  const manifest = JSON.parse(await readFile(join(outDir, 'manifest.json'), 'utf8')) as {
    build: {
      format: number;
      files: Record<string, { imports?: string[]; runtime?: string[] }>;
    };
  };
  return manifest.build;
}

/**
 * Оболочка с хост-функцией: отложенный импорт приходит ей, а не `require` плагина.
 *
 * Исполняет названный файл в том же графе — как оболочка — и записывает, что у неё просили.
 */
function linkWithHost(outDir: string) {
  const asked: string[] = [];
  const stand: { current?: ReturnType<typeof link> } = {};
  const host = (target: string): Promise<unknown> => {
    asked.push(target);
    return Promise.resolve().then(() => stand.current?.load(target.slice('./'.length)));
  };
  stand.current = link(outDir, { __reformerImport: host });
  return { ...stand.current, asked };
}

describe('отложенный импорт кода', () => {
  beforeEach(async () => {
    await source('engine.ts', "export const ENGINE = 'тяжёлый движок';\n");
    await main("export const loadEngine = () => import('./engine');");
  });

  it('уезжает файлом в chunks/, а в main.js его кода нет', async () => {
    const result = await buildPlugin({ dir });

    expect(findings(result)).toEqual([]);
    expect(result).toMatchObject({ notices: [] });
    const [chunk, ...rest] = chunksOf(result);
    expect(rest).toEqual([]);
    expect(chunk).toMatch(/^chunks\/engine-[A-Z0-9]+\.js$/);

    const out = join(dir, 'dist');
    expect(await readFile(join(out, 'main.js'), 'utf8')).not.toContain('тяжёлый движок');
    const code = await readFile(join(out, chunk), 'utf8');
    expect(code).toContain('тяжёлый движок');
    // Первая строка — пометка сборки: по ней следующая сборка узнает файл своим.
    expect(code.startsWith('/* @reformer-plugin-chunk acme-hello */\n')).toBe(true);
    // Нативного `import()` в собранном нет нигде: его в браузере не разрешил бы никто.
    expect(code).not.toMatch(/\bimport\(/);
    expect(await readFile(join(out, 'main.js'), 'utf8')).not.toMatch(/\bimport\(/);
  });

  it('исполняется при первом обращении, а не при загрузке плагина', async () => {
    const result = await buildPlugin({ dir });
    const [chunk] = chunksOf(result);

    const built = link(join(dir, 'dist'));
    expect(built.required).not.toContain(chunk);

    const engine = await (built.exports.loadEngine as () => Promise<{ ENGINE: string }>)();

    expect(engine.ENGINE).toBe('тяжёлый движок');
    expect(built.required).toContain(chunk);
  });

  it('модуль, нужный и main.js, и отложенному файлу, существует в одном экземпляре', async () => {
    // Состояние модуля (настройка загрузчика, реестр) обязано быть общим: вложенный дважды,
    // модуль раздвоил бы его, и «настроил здесь — прочитал там» молча перестало бы работать.
    await source('state.ts', 'export const state = { configured: "" };\n');
    await source(
      'engine.ts',
      "import { state } from './state';\nexport const read = () => state.configured;\n"
    );
    await main(
      "import { state } from './state';",
      'export const configure = (value: string) => { state.configured = value; };',
      "export const loadEngine = () => import('./engine');"
    );

    const result = await buildPlugin({ dir });
    // Общий чанк `main.js` требует сразу — и пробный запуск сборки его нашёл: заметок нет.
    expect(result).toMatchObject({ ok: true, notices: [] });
    expect(chunksOf(result)).toHaveLength(2);

    const built = link(join(dir, 'dist'));
    (built.exports.configure as (value: string) => void)('настроено');
    const engine = await (built.exports.loadEngine as () => Promise<{ read: () => string }>)();

    expect(engine.read()).toBe('настроено');
  });

  it('модуль данных из отложенного файла находится: в chunks/ он сосед, а не вложенный каталог', async () => {
    await source('corpus.json', '{ "title": "Справка" }');
    await source('engine.ts', "export const loadCorpus = () => import('./corpus.json');\n");

    const result = await buildPlugin({ dir });
    expect(findings(result)).toEqual([]);
    expect(chunksOf(result)).toContain('chunks/corpus.js');

    const built = link(join(dir, 'dist'));
    const engine = await (
      built.exports.loadEngine as () => Promise<{
        loadCorpus: () => Promise<{ default: unknown }>;
      }>
    )();

    expect((await engine.loadCorpus()).default).toEqual({ title: 'Справка' });
  });

  it('пересборка убирает чанк, которого больше нет, а чужой файл в chunks/ не трогает', async () => {
    expect((await buildPlugin({ dir })).ok).toBe(true);
    await writeFile(join(dir, 'dist/chunks/notes.js'), '// не сборка: положено руками');
    // Модуль данных прежней сборщицы: пометка у него была другая, а убрать его всё равно надо.
    await writeFile(
      join(dir, 'dist/chunks/corpus.js'),
      '/* @reformer-plugin-data acme-hello */\nmodule.exports = {};\n'
    );

    await main();
    expect((await buildPlugin({ dir })).ok).toBe(true);

    expect(await readdir(join(dir, 'dist/chunks'))).toEqual(['notes.js']);
  });

  it('сжатие: код короче и по-прежнему исполняется', async () => {
    await source(
      'engine.ts',
      [
        '/** Длинное пояснение, которого в сжатой сборке быть не должно. */',
        'export function describeEngine(nameOfTheEngine: string): string {',
        '  const prefixOfTheDescription = "движок";',
        '  return `${prefixOfTheDescription}: ${nameOfTheEngine}`;',
        '}',
      ].join('\n')
    );

    const plain = await buildPlugin({ dir, outDir: join(root, 'plain') });
    const packed = await buildPlugin({ dir, outDir: join(root, 'packed'), minify: true });
    expect(findings(plain)).toEqual([]);
    expect(findings(packed)).toEqual([]);

    const size = async (out: string, result: BuildResult) =>
      (await readFile(join(root, out, chunksOf(result)[0]), 'utf8')).length;
    expect(await size('packed', packed)).toBeLessThan(await size('plain', plain));
    const packedCode = await readFile(join(root, 'packed', chunksOf(packed)[0]), 'utf8');
    expect(packedCode).not.toContain('Длинное пояснение');
    // Пометка чанка сжатие переживает: без неё следующая сборка не узнала бы файл своим.
    expect(packedCode.startsWith('/* @reformer-plugin-chunk acme-hello */\n')).toBe(true);

    const built = link(join(root, 'packed'));
    const engine = await (
      built.exports.loadEngine as () => Promise<{ describeEngine: (name: string) => string }>
    )();
    expect(engine.describeEngine('monaco')).toBe('движок: monaco');
  });
});

describe('чтение по требованию: вызов оболочки вместо require', () => {
  beforeEach(async () => {
    await source('engine.ts', "export const ENGINE = 'тяжёлый движок';\n");
    await main("export const loadEngine = () => import('./engine');");
  });

  it('манифест называет каждый файл кода и то, что ему нужно сразу', async () => {
    await source('state.ts', 'export const state = { touched: 0 };\n');
    await source('corpus.json', '{ "title": "Справка" }');
    await source(
      'engine.ts',
      [
        "import { state } from './state';",
        'export const touch = () => ++state.touched;',
        "export const loadCorpus = () => import('./corpus.json');",
      ].join('\n')
    );
    await main(
      "import { state } from './state';",
      'export const STATE = state;',
      "export const loadEngine = () => import('./engine');"
    );

    const result = await buildPlugin({ dir });
    expect(findings(result)).toEqual([]);

    const chunks = chunksOf(result);
    const engine = chunks.find((file) => file.startsWith('chunks/engine-')) ?? '';
    const shared = chunks.find((file) => file.startsWith('chunks/chunk-')) ?? '';
    const build = await builtGraph(join(dir, 'dist'));
    expect(build.format).toBe(1);
    // Назван каждый файл кода: оболочка читает только названное.
    expect(Object.keys(build.files).sort()).toEqual(['main.js', ...chunks].sort());
    expect(Object.keys(build.files)[0]).toBe('main.js');
    expect(build.files['main.js']).toEqual({
      imports: [shared],
      runtime: ['@reformer/builder-plugin-api'],
    });
    expect(build.files[engine]).toEqual({ imports: [shared] });
    expect(build.files['chunks/corpus.js']).toEqual({});
    // Отложенных рёбер в графе нет: их называет код в момент импорта.
    expect(JSON.stringify(build.files['main.js'])).not.toContain('engine-');
  });

  it('оболочка получает путь от корня плагина — из какого бы файла ни шёл импорт', async () => {
    await source('deep.ts', "export const DEEP = 'глубже';\n");
    await source('corpus.json', '{ "title": "Справка" }');
    await source(
      'engine.ts',
      [
        "export const loadDeep = () => import('./deep');",
        "export const loadCorpus = () => import('./corpus.json');",
      ].join('\n')
    );

    const result = await buildPlugin({ dir });
    expect(findings(result)).toEqual([]);
    const chunks = chunksOf(result);
    const engineFile = chunks.find((file) => file.startsWith('chunks/engine-')) ?? '';
    const deepFile = chunks.find((file) => file.startsWith('chunks/deep-')) ?? '';

    const built = linkWithHost(join(dir, 'dist'));
    const engine = (await (built.exports.loadEngine as () => Promise<unknown>)()) as {
      loadDeep: () => Promise<unknown>;
      loadCorpus: () => Promise<unknown>;
    };
    await engine.loadDeep();
    await engine.loadCorpus();

    // Из `chunks/engine-….js` сосед назван так же, как назвал бы его `main.js`: хост-функция
    // одна на граф и не знает, из какого файла её позвали.
    expect(built.asked).toEqual([`./${engineFile}`, `./${deepFile}`, './chunks/corpus.js']);
    // Запасной путь не сработал: ни один чанк не затребован через `require` плагина.
    expect(built.required.filter((name) => name.startsWith('chunks/'))).toEqual([]);
  });

  it('без хост-функции — запасной путь: каталог остаётся самодостаточным графом CommonJS', async () => {
    // Так собранный плагин исполняет оболочка, которая о секции `build` не знает.
    await source('deep.ts', "export const DEEP = 'глубже';\n");
    await source('engine.ts', "export const loadDeep = () => import('./deep');\n");

    const result = await buildPlugin({ dir });
    expect(findings(result)).toEqual([]);
    const chunks = chunksOf(result);

    const built = link(join(dir, 'dist'));
    expect(built.required.filter((name) => name.startsWith('chunks/'))).toEqual([]);
    const engine = await (
      built.exports.loadEngine as () => Promise<{ loadDeep: () => Promise<{ DEEP: string }> }>
    )();

    expect((await engine.loadDeep()).DEEP).toBe('глубже');
    expect(built.required.filter((name) => name.startsWith('chunks/')).sort()).toEqual(
      [...chunks].sort()
    );
  });

  it('обёртка экспортов запасного пути — та же, что давал отложенный require', async () => {
    // Эталон — помощник esbuild, которым импорт оборачивался, пока был `require`.
    const reference = await esbuild.transform('export const wrap = (name) => import(name);', {
      loader: 'js',
      format: 'cjs',
      supported: { 'dynamic-import': false },
    });
    const wrapWith = (value: unknown): Promise<object> => {
      const module = { exports: {} as { wrap: (name: string) => Promise<object> } };
      new Function('exports', 'require', 'module', reference.code)(
        module.exports,
        () => value,
        module
      );
      return module.exports.wrap('x');
    };
    const shape = (namespace: object) => ({
      proto: Object.getPrototypeOf(namespace) as unknown,
      properties: Object.getOwnPropertyNames(namespace).map((key) => [
        key,
        Object.getOwnPropertyDescriptor(namespace, key)?.enumerable,
        (namespace as Record<string, unknown>)[key],
      ]),
    });

    await source('object.json', '{ "title": "Справка", "default": "своё" }');
    await source('list.json', '[1, 2]');
    await source(
      'engine.ts',
      "export const ENGINE = 'движок';\nexport default function engine() {}\n"
    );
    await main(
      "export const loadEngine = () => import('./engine');",
      "export const loadObject = () => import('./object.json');",
      "export const loadList = () => import('./list.json');"
    );
    const result = await buildPlugin({ dir });
    expect(findings(result)).toEqual([]);
    const engineFile = chunksOf(result).find((file) => file.startsWith('chunks/engine-')) ?? '';

    const built = link(join(dir, 'dist'));
    const cases: ReadonlyArray<readonly [string, string]> = [
      ['loadEngine', engineFile],
      ['loadObject', 'chunks/object.js'],
      ['loadList', 'chunks/list.js'],
    ];
    for (const [loader, file] of cases) {
      const actual = await (built.exports[loader] as () => Promise<object>)();
      const expected = await wrapWith(built.load(file));

      expect(shape(actual), file).toEqual(shape(expected));
    }
  });

  it('пакет оболочки, импортированный отложенно, не числится нужным сразу', async () => {
    await main("export const loadReact = () => import('react');");

    const result = await buildPlugin({ dir });
    expect(findings(result)).toEqual([]);
    const out = join(dir, 'dist');
    const code = await readFile(join(out, 'main.js'), 'utf8');

    expect(code).toContain('__reformerImport("react")');
    expect((await builtGraph(out)).files['main.js'].runtime).toEqual([
      '@reformer/builder-plugin-api',
    ]);
    // Оболочке, читающей каталог целиком, пакет назван подсказкой — тем же правилом, которым
    // она собирает спецификаторы из текста: иначе он остался бы непрогретым.
    expect(code).toMatch(/\brequire\s*\(\s*['"]react['"]\s*\)/);

    const built = link(out);
    expect(built.required).not.toContain('react');
    await (built.exports.loadReact as () => Promise<unknown>)();
    expect(built.required).toContain('react');
  });

  it('строка, похожая на импорт, остаётся строкой', async () => {
    await main(
      'export const TEXT = \'пример: import("./engine")\';',
      "export const loadEngine = () => import('./engine');"
    );

    const result = await buildPlugin({ dir });
    expect(findings(result)).toEqual([]);

    const built = linkWithHost(join(dir, 'dist'));
    expect(built.exports.TEXT).toBe('пример: import("./engine")');
    expect(built.asked).toEqual([]);
  });

  it('комментарий внутри import() переписыванию не мешает', async () => {
    await main("export const loadEngine = () => import(/* движок */ './engine');");

    const result = await buildPlugin({ dir });
    expect(findings(result)).toEqual([]);
    const [chunk] = chunksOf(result);

    const built = linkWithHost(join(dir, 'dist'));
    const engine = (await (built.exports.loadEngine as () => Promise<unknown>)()) as {
      ENGINE: string;
    };

    expect(built.asked).toEqual([`./${chunk}`]);
    expect(engine.ENGINE).toBe('тяжёлый движок');
  });

  it('вычисляемый спецификатор не переписывается и сборку не роняет', async () => {
    await main(
      'export const loadByName = (name: string) => import(name);',
      "export const loadEngine = () => import('./engine');"
    );

    const result = await buildPlugin({ dir });
    expect(findings(result)).toEqual([]);

    // Читать заранее по вычисляемому имени нечего: такой импорт остаётся отложенным `require`.
    const built = linkWithHost(join(dir, 'dist'));
    await (built.exports.loadByName as (name: string) => Promise<unknown>)('react');
    expect(built.asked).toEqual([]);
    expect(built.required).toContain('react');
  });

  it('импорт данных с атрибутом типа откладывается так же, как без него', async () => {
    // Атрибут под целевую версию снимает сам esbuild: до оболочки он не доезжает.
    await source('corpus.json', '{ "title": "Справка" }');
    await main(
      "export const loadCorpus = () => import('./corpus.json', { with: { type: 'json' } });"
    );

    const result = await buildPlugin({ dir });
    expect(findings(result)).toEqual([]);

    const built = linkWithHost(join(dir, 'dist'));
    const corpus = await (built.exports.loadCorpus as () => Promise<unknown>)();

    expect(built.asked).toEqual(['./chunks/corpus.js']);
    expect(corpus).toEqual({ title: 'Справка' });
  });

  it('файл с вызовом оболочки остаётся строгим: директива — первой', async () => {
    await source('deep.ts', "export const DEEP = 'глубже';\n");
    await source(
      'engine.ts',
      [
        'export const STRICT = (function (this: unknown) { return this === undefined; })();',
        "export const loadDeep = () => import('./deep');",
      ].join('\n')
    );
    await main(
      'export const STRICT = (function (this: unknown) { return this === undefined; })();',
      "export const loadEngine = () => import('./engine');"
    );

    const result = await buildPlugin({ dir });
    expect(findings(result)).toEqual([]);
    const out = join(dir, 'dist');
    const engineFile = chunksOf(result).find((file) => file.startsWith('chunks/engine-')) ?? '';

    expect((await readFile(join(out, 'main.js'), 'utf8')).split('\n')[0]).toBe('"use strict";');
    // У чанка первая строка — пометка сборки; она комментарий и директиве не мешает.
    expect((await readFile(join(out, engineFile), 'utf8')).split('\n').slice(0, 2)).toEqual([
      '/* @reformer-plugin-chunk acme-hello */',
      '"use strict";',
    ]);
    const built = link(out);
    expect(built.exports.STRICT).toBe(true);
    const engine = await (built.exports.loadEngine as () => Promise<{ STRICT: boolean }>)();
    expect(engine.STRICT).toBe(true);
  });

  it('сжатие вызов оболочки переживает', async () => {
    const outDir = join(root, 'packed');
    const result = await buildPlugin({ dir, outDir, minify: true });
    expect(findings(result)).toEqual([]);
    const [chunk] = chunksOf(result);

    const built = linkWithHost(outDir);
    const engine = (await (built.exports.loadEngine as () => Promise<unknown>)()) as {
      ENGINE: string;
    };

    expect(built.asked).toEqual([`./${chunk}`]);
    expect(engine.ENGINE).toBe('тяжёлый движок');
  });

  it('сборка называет, сколько кода читается сразу и сколько — по требованию', async () => {
    const result = await buildPlugin({ dir });
    expect(findings(result)).toEqual([]);
    const out = join(dir, 'dist');
    const [chunk] = chunksOf(result);
    const bytes = async (file: string) => Buffer.byteLength(await readFile(join(out, file)));

    expect(result.ok && result.code).toEqual({
      eager: await bytes('main.js'),
      deferred: await bytes(chunk),
      deferredFiles: 1,
    });

    const lines: string[] = [];
    const io: CliIo = { cwd: root, out: (line) => lines.push(line), err: () => undefined };
    expect(await runCli(['build', 'acme-hello', '--out', 'printed'], io)).toBe(0);
    expect(lines[1]).toMatch(/^ {2}код: сразу \d+ КБ, по требованию \d+ КБ \(файлов: 1\)$/);
  });
});

describe('модуль рантайма, названный через require вложенной зависимости', () => {
  it('назван в main.js так, чтобы оболочка его увидела и прогрела', async () => {
    // CommonJS-зависимость зовёт `require('react')`. В ESM-сборке этот вызов идёт через
    // помощника esbuild под другим именем, а оболочка ищет модули рантайма по слову `require`.
    await source('legacy.cjs', "module.exports = { react: require('react') };\n");
    await main("import legacy from './legacy.cjs';", 'export const LEGACY = legacy;');

    for (const minify of [false, true]) {
      const outDir = join(root, minify ? 'packed' : 'plain');
      expect(findings(await buildPlugin({ dir, outDir, minify }))).toEqual([]);

      // То же правило, которым оболочка собирает спецификаторы из текста файлов плагина.
      const visible = /\brequire\s*\(\s*['"]react['"]\s*\)/;
      expect(await readFile(join(outDir, 'main.js'), 'utf8')).toMatch(visible);
      // Подсказка ничего не исполняет: модуль требуется один раз — самой зависимостью.
      expect(link(outDir).required.filter((name) => name === 'react')).toHaveLength(1);
    }
  });
});

describe('?worker', () => {
  /** Подставные глобалы браузера: записывают, что и из чего было создано. */
  function browser() {
    const blobs: string[] = [];
    const created: Array<{ url: string; options: unknown }> = [];
    class Blob {
      readonly text: string;
      constructor(parts: string[]) {
        this.text = parts.join('');
      }
    }
    class Worker {
      constructor(url: string, options: unknown) {
        created.push({ url, options });
      }
    }
    const URL = {
      createObjectURL: (blob: Blob) => {
        blobs.push(blob.text);
        return `blob:${String(blobs.length)}`;
      },
    };
    return { ambient: { Blob, Worker, URL }, blobs, created };
  }

  beforeEach(async () => {
    await source('helper.ts', 'export const reply = (text: string) => `эхо: ${text}`;\n');
    await source(
      'echo.worker.ts',
      [
        "import { reply } from './helper';",
        'self.onmessage = (event: MessageEvent<string>) => self.postMessage(reply(event.data));',
      ].join('\n')
    );
  });

  it('даёт конструктор: воркер собран отдельно и запускается из Blob-URL', async () => {
    await main(
      "import EchoWorker from './echo.worker?worker';",
      'export const start = (name: string) => new EchoWorker({ name });'
    );

    expect(findings(await buildPlugin({ dir }))).toEqual([]);

    const env = browser();
    const built = link(join(dir, 'dist'), env.ambient);
    // До первого воркера адрес не заводится: плагин, не открывший редактор, ничего не создал.
    expect(env.blobs).toEqual([]);

    const start = built.exports.start as (name: string) => unknown;
    start('первый');
    start('второй');

    // Адрес один на вид воркера; параметры конструктора доходят до `Worker`.
    expect(env.blobs).toHaveLength(1);
    expect(env.created).toEqual([
      { url: 'blob:1', options: { name: 'первый' } },
      { url: 'blob:1', options: { name: 'второй' } },
    ]);
    // Воркер самостоятелен: его зависимость вложена в него, а не осталась импортом.
    expect(env.blobs[0]).toContain('эхо: ');
    expect(env.blobs[0]).not.toMatch(/\b(import|require)\b/);
  });

  it('из отложенного модуля — текст воркера лежит в его чанке, а не в main.js', async () => {
    await source(
      'engine.ts',
      "import EchoWorker from './echo.worker?worker';\nexport const start = () => new EchoWorker();\n"
    );
    await main("export const loadEngine = () => import('./engine');");

    const result = await buildPlugin({ dir });
    expect(findings(result)).toEqual([]);

    expect(await readFile(join(dir, 'dist/main.js'), 'utf8')).not.toContain('эхо: ');
    expect(await readFile(join(dir, 'dist', chunksOf(result)[0]), 'utf8')).toContain('эхо: ');
  });

  it('воркер с ошибкой сборки — отказ, а не пустой воркер', async () => {
    await source('echo.worker.ts', "import { missing } from './нет-такого';\nvoid missing;\n");
    await main("import EchoWorker from './echo.worker?worker';", 'export const W = EchoWorker;');

    expect(codes(await buildPlugin({ dir }))).toEqual(['build-failed']);
  });
});

describe('CSS из кода', () => {
  /** 1×1 прозрачный GIF: на его месте у настоящей библиотеки — файл шрифта со значками. */
  const PIXEL = Buffer.from('R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', 'base64');

  beforeEach(async () => {
    await mkdir(join(dir, 'src/vendor'));
    await writeFile(join(dir, 'src/vendor/icons.gif'), PIXEL);
    await source(
      'vendor/widget.css',
      '.vendor-widget { background: url(./icons.gif); }\n.vendor-widget .row { margin: 0; }\n'
    );
    await source('vendor/widget.ts', "import './widget.css';\nexport const WIDGET = 'виджет';\n");
    await source('styles.css', '.own-panel { color: red; }\n');
    await main("import { WIDGET } from './vendor/widget';", 'export const USED = WIDGET;');
  });

  const declareStyles = () =>
    patchManifest((manifest) => {
      manifest.styles = { file: 'src/styles.css', isolation: 'scoped' };
    });

  it('без разрешения — отказ, и он называет параметр', async () => {
    await declareStyles();

    const result = await buildPlugin({ dir });

    expect(codes(result)).toEqual(['css-from-code']);
    expect(findings(result)[0].message).toContain('--bundle-css');
  });

  it('с разрешением, но без объявленной таблицы — отказ: изолировать оболочке нечего', async () => {
    const result = await buildPlugin({ dir, bundleCss: true });

    expect(codes(result)).toEqual(['css-from-code']);
    expect(findings(result)[0].message).toContain('styles');
  });

  it('дописывается в объявленную таблицу — перед правилами автора, файл вложен data-URL', async () => {
    await declareStyles();

    const result = await buildPlugin({ dir, bundleCss: true });

    expect(findings(result)).toEqual([]);
    // Таблица одна — та, что объявлена манифестом: отдельного CSS-файла в сборке нет.
    expect(result.ok && result.files.filter((file) => file.endsWith('.css'))).toEqual([
      'styles.css',
    ]);
    const css = await readFile(join(dir, 'dist/styles.css'), 'utf8');
    expect(css).toContain('.vendor-widget .row');
    expect(css).toMatch(/url\("?data:image\/gif;base64,/);
    // Правила автора — после чужих: на равной специфичности побеждают они.
    expect(css.indexOf('.own-panel')).toBeGreaterThan(css.indexOf('.vendor-widget'));
    // Код при этом собран как обычно: импорт CSS из него исчез.
    expect(link(join(dir, 'dist')).exports.USED).toBe('виджет');
  });

  it('CSS отложенного модуля — в той же таблице: оболочка читает стили один раз', async () => {
    await declareStyles();
    await main("export const loadWidget = () => import('./vendor/widget');");

    const result = await buildPlugin({ dir, bundleCss: true });

    expect(findings(result)).toEqual([]);
    expect(result.ok && result.files.filter((file) => file.endsWith('.css'))).toEqual([
      'styles.css',
    ]);
    expect(await readFile(join(dir, 'dist/styles.css'), 'utf8')).toContain('.vendor-widget .row');
  });

  it('сжатие действует и на таблицу', async () => {
    await declareStyles();

    expect(findings(await buildPlugin({ dir, bundleCss: true, minify: true }))).toEqual([]);

    const css = await readFile(join(dir, 'dist/styles.css'), 'utf8');
    expect(css).toContain('.vendor-widget .row{margin:0}');
    expect(css).toContain('.own-panel{color:red}');
  });
});

describe('командная строка: параметры сборки', () => {
  function io(): CliIo & { lines: { out: string[]; err: string[] } } {
    const lines = { out: [] as string[], err: [] as string[] };
    return {
      lines,
      cwd: root,
      out: (line) => lines.out.push(line),
      err: (line) => lines.err.push(line),
    };
  }

  it('build принимает --minify и --bundle-css', async () => {
    await source('panel.css', '.panel { color: red; }\n');
    await source('styles.css', '.own { margin: 0; }\n');
    await patchManifest((manifest) => {
      manifest.styles = { file: 'src/styles.css', isolation: 'scoped' };
    });
    await main("import './panel.css';");

    const run = io();
    expect(await runCli(['build', 'acme-hello', '--minify', '--bundle-css'], run)).toBe(0);

    expect(await readFile(join(dir, 'dist/styles.css'), 'utf8')).toContain('.panel{color:red}');
  });

  it('validate их не принимает: молча проигнорированный параметр хуже отказа', async () => {
    const run = io();

    expect(await runCli(['validate', 'acme-hello', '--minify'], run)).toBe(2);
    expect(run.lines.err.join('\n')).toContain('--minify');
  });
});
