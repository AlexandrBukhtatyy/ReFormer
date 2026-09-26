import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { parsePluginManifest } from '@reformer/builder-plugin-api/tooling';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runCli, type CliIo } from './cli.js';
import { buildPlugin, type BuildResult } from './commands/build.js';
import { createPlugin } from './commands/create.js';
import { startDev } from './commands/dev.js';
import { packPlugin } from './commands/pack.js';

let root: string;
let dir: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'reformer-plugin-build-'));
  dir = join(root, 'acme-hello');
  const created = await createPlugin({ dir, cliVersion: '1.0.0' });
  expect(created.ok).toBe(true);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const main = (code: string) => writeFile(join(dir, 'src/main.ts'), code);

async function patchManifest(patch: (value: Record<string, unknown>) => void) {
  const file = join(dir, 'manifest.json');
  const value = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
  patch(value);
  await writeFile(file, JSON.stringify(value));
}

const codes = (result: BuildResult) => (result.ok ? [] : result.findings.map((f) => f.code));

describe('build', () => {
  it('шаблон собирается в каталог, который проходит разбор оболочки', async () => {
    const result = await buildPlugin({ dir });

    expect(result).toMatchObject({ ok: true, notices: [] });
    const out = join(dir, 'dist');
    const manifest = await readFile(join(out, 'manifest.json'), 'utf8');
    const code = await readFile(join(out, 'main.js'), 'utf8');

    expect(JSON.parse(manifest)).toMatchObject({ main: 'main.js' });
    expect(parsePluginManifest(manifest, { kind: 'project', dir: 'acme-hello' }).ok).toBe(true);
    // Контракт — внешний: оболочка подставит свой экземпляр.
    expect(code).toContain('require("@reformer/builder-plugin-api")');
    expect(await readFile(join(out, 'locales/ru.json'), 'utf8')).toContain('command.hello');
  });

  it('пересобирает поверх своей же сборки, но не поверх чужого каталога', async () => {
    expect((await buildPlugin({ dir })).ok).toBe(true);
    expect((await buildPlugin({ dir })).ok).toBe(true);

    const foreign = join(root, 'project');
    await mkdir(foreign);
    await writeFile(join(foreign, 'notes.txt'), 'не трогать');

    expect(codes(await buildPlugin({ dir, outDir: foreign }))).toEqual(['output-not-ours']);
    expect(await readFile(join(foreign, 'notes.txt'), 'utf8')).toBe('не трогать');
  });

  it('@reformer/*, которого оболочка не даёт, — отказ, а не вложенная копия', async () => {
    await main(`import { x } from '@reformer/not-a-runtime-module';\nexport default x;\n`);

    expect(codes(await buildPlugin({ dir }))).toEqual(['module-unavailable']);
  });

  it('CSS из кода — отказ: стили объявляются в манифесте', async () => {
    await writeFile(join(dir, 'src/panel.css'), '.panel { color: red }');
    await main(
      `import './panel.css';\nimport { definePlugin } from '@reformer/builder-plugin-api';\n` +
        `export default definePlugin({ id: 'acme-hello', activate() {} });\n`
    );

    expect(codes(await buildPlugin({ dir }))).toEqual(['css-from-code']);
  });

  it('объявленные стили собираются в styles.css с развёрнутыми @import', async () => {
    await writeFile(join(dir, 'src/base.css'), '.base { margin: 0 }');
    await writeFile(join(dir, 'src/styles.css'), '@import "./base.css";\n.panel { color: red }');
    await patchManifest((m) => {
      m.styles = { file: 'src/styles.css', isolation: 'scoped' };
    });

    expect((await buildPlugin({ dir })).ok).toBe(true);
    const css = await readFile(join(dir, 'dist/styles.css'), 'utf8');
    const manifest = JSON.parse(await readFile(join(dir, 'dist/manifest.json'), 'utf8')) as {
      styles: unknown;
    };

    expect(css).toContain('.base');
    expect(manifest.styles).toEqual({ file: 'styles.css', isolation: 'scoped' });
  });

  it('id кода, расходящийся с манифестом, — отказ', async () => {
    await main(
      `import { definePlugin } from '@reformer/builder-plugin-api';\n` +
        `export default definePlugin({ id: 'other', activate() {} });\n`
    );

    expect(codes(await buildPlugin({ dir }))).toEqual(['id-mismatch']);
  });

  describe('provides', () => {
    beforeEach(async () => {
      await patchManifest((m) => {
        m.provides = [{ id: 'acme.greeter', version: '1.0.0' }];
      });
    });

    it('обещанное, но не зарегистрированное, — отказ', async () => {
      const result = await buildPlugin({ dir });

      expect(codes(result)).toEqual(['provides-unregistered']);
      expect(result.ok || result.findings[0]?.message).toContain('«acme.greeter» версии 1.0.0');
    });

    it('зарегистрированное токеном контракта — сборка проходит', async () => {
      await main(
        `import { defineService, definePlugin } from '@reformer/builder-plugin-api';\n` +
          `const Greeter = defineService<{ greet(): string }>('acme.greeter');\n` +
          `export default definePlugin({\n` +
          `  id: 'acme-hello',\n` +
          `  activate(ctx) {\n` +
          `    ctx.subscriptions.push(ctx.services.register(Greeter, { greet: () => 'hi' }));\n` +
          `  },\n` +
          `});\n`
      );

      expect(await buildPlugin({ dir })).toMatchObject({ ok: true, notices: [] });
    });

    it('activate, падающий вне оболочки, — заметка «не проверено», а не отказ', async () => {
      await main(
        `import { definePlugin } from '@reformer/builder-plugin-api';\n` +
          `declare const document: { body: { append(x: unknown): void } };\n` +
          `export default definePlugin({\n` +
          `  id: 'acme-hello',\n` +
          `  activate() { document.body.append('x'); },\n` +
          `});\n`
      );
      const result = await buildPlugin({ dir });

      expect(result.ok).toBe(true);
      expect(result.ok && result.notices[0]).toContain('«provides» и каталоги китов не проверены');
    });
  });

  describe('кит, внесённый плагином', () => {
    /** Плагин, вносящий в точку китов источник, записанный выражением. */
    const kitPlugin = (source: string) =>
      main(
        `import { definePlugin, KitSourcePoint } from '@reformer/builder-plugin-api';\n` +
          `export default definePlugin({\n` +
          `  id: 'acme-hello',\n` +
          `  activate(ctx) {\n` +
          `    ctx.subscriptions.push(ctx.extensions.contribute(KitSourcePoint, ${source}));\n` +
          `  },\n` +
          `});\n`
      );

    const VALID_RECORD = { name: 'Input', role: 'field', propsSchema: {} };
    const kit = (id: string) => ({ id, label: id, package: `@acme/${id}` });
    const catalog = (id: string, components: unknown[] = [VALID_RECORD]) =>
      JSON.stringify({ version: '2.1', kit: kit(id), components });

    it('каталог по контракту — сборка проходит, пространство имён не грузится', async () => {
      // Загрузчик пространства имён бросает: вызови его сухая активация — сборка упала бы.
      await kitPlugin(
        `{ catalog: ${catalog('acme')}, namespace: () => { throw new Error('DOM нужен'); } }`
      );

      expect(await buildPlugin({ dir })).toMatchObject({ ok: true, notices: [] });
    });

    it('каталог, не проходящий контракт, — отказ той же проверкой, что у реестра китов', async () => {
      await kitPlugin(`{ catalog: ${catalog('acme', [{ name: 'Input' }])} }`);

      const result = await buildPlugin({ dir });

      expect(codes(result)).toEqual(['kit-invalid-catalog']);
      expect(result.ok || result.findings[0]?.message).toContain('«acme»');
    });

    it('ленивый каталог без шапки — кит без имени, реестр его не примет', async () => {
      await kitPlugin(`{ catalog: () => Promise.resolve(${catalog('acme')}) }`);

      expect(codes(await buildPlugin({ dir }))).toEqual(['kit-no-id']);
    });

    it('шапка и каталог называют кит по-разному — отказ', async () => {
      await kitPlugin(
        `{ kit: ${JSON.stringify(kit('a'))}, catalog: () => Promise.resolve(${catalog('b')}) }`
      );

      expect(codes(await buildPlugin({ dir }))).toEqual(['kit-mismatch']);
    });

    it('каталог, не загрузившийся вне оболочки, — заметка «не проверен», а не отказ', async () => {
      await kitPlugin(
        `{ kit: ${JSON.stringify(kit('acme'))}, catalog: () => Promise.reject(new Error('нужен fetch')) }`
      );

      const result = await buildPlugin({ dir });

      expect(result.ok).toBe(true);
      expect(result.ok && result.notices[0]).toContain('каталог кита «acme» не загрузился');
    });
  });
});

describe('dev', () => {
  it('собирает в каталог плагинов проекта и пересобирает на изменение', async () => {
    const project = join(root, 'project');
    const built: BuildResult[] = [];
    let onSecond: () => void = () => undefined;
    const second = new Promise<void>((done) => {
      onSecond = done;
    });

    const session = startDev({
      dir,
      project,
      debounceMs: 20,
      onBuild: (result) => {
        built.push(result);
        if (built.length === 2) onSecond();
      },
    });
    try {
      await session.ready;
      const target = join(project, '.ui_builder/plugins/acme-hello');
      expect(built[0]?.ok).toBe(true);
      expect(await readFile(join(target, 'main.js'), 'utf8')).toContain('acme-hello');

      await writeFile(
        join(dir, 'locales/ru.json'),
        JSON.stringify({ 'command.hello': 'Изменено' })
      );
      await second;

      expect(await readFile(join(target, 'locales/ru.json'), 'utf8')).toContain('Изменено');
    } finally {
      session.close();
    }
  }, 20_000);
});

describe('pack', () => {
  it('архив содержит сборку и package.json, но не исходники', async () => {
    const result = await packPlugin({ dir });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file).toBe(join(dir, 'acme-hello-0.1.0.tgz'));

    const { stdout } = await promisify(execFile)('tar', ['-tzf', 'acme-hello-0.1.0.tgz'], {
      // Относительный путь: GNU tar читает «C:» в абсолютном пути Windows как имя удалённого хоста.
      cwd: dir,
    });
    const entries = stdout.split(/\r?\n/).filter(Boolean).sort();
    expect(entries).toEqual([
      'package/locales/en.json',
      'package/locales/ru.json',
      'package/main.js',
      'package/manifest.json',
      'package/package.json',
    ]);
  }, 60_000);
});

describe('командная строка', () => {
  function io(): CliIo & { readonly lines: { out: string[]; err: string[] } } {
    const lines = { out: [] as string[], err: [] as string[] };
    return {
      lines,
      cwd: root,
      out: (line) => lines.out.push(line),
      err: (line) => lines.err.push(line),
      waitDev: () => Promise.resolve(),
    };
  }

  it('build печатает, куда собрано', async () => {
    const run = io();

    expect(await runCli(['build', 'acme-hello', '--out', 'out'], run)).toBe(0);
    expect(run.lines.out).toEqual([`✓ acme-hello 0.1.0 собран в ${join(root, 'out')}`]);
  });

  it('dev без --project и чужой параметр у команды — код 2', async () => {
    expect(await runCli(['dev', 'acme-hello'], io())).toBe(2);

    const run = io();
    expect(await runCli(['validate', 'acme-hello', '--out', 'x'], run)).toBe(2);
    expect(run.lines.err[0]).toBe('validate: параметры --out не принимаются');
  });

  it('dev собирает один раз и закрывается, когда ожидание завершено', async () => {
    const run = io();

    expect(await runCli(['dev', 'acme-hello', '--project', 'project'], run)).toBe(0);
    expect(run.lines.out[0]).toContain(
      join(root, 'project', '.ui_builder', 'plugins', 'acme-hello')
    );
  });
});

describe('build: вкладываемые пакеты', () => {
  // Каталог плагина — ВНУТРИ репозитория: toolkit вкладывается, и сборке нужно его найти
  // обычным разрешением через `node_modules` рабочей области. Во временном каталоге ОС его нет.
  let local: string;
  let plugin: string;

  beforeEach(async () => {
    const base = join(process.cwd(), '..', '..', '.tmp', 'cli-build-tests');
    await mkdir(base, { recursive: true });
    local = await mkdtemp(join(base, 'stack-'));
    plugin = join(local, 'acme-stack');
    expect((await createPlugin({ dir: plugin, cliVersion: '1.0.0' })).ok).toBe(true);
  });

  afterEach(async () => {
    await rm(local, { recursive: true, force: true });
  });

  it('toolkit вложен в main.js, а не оставлен внешним', async () => {
    await writeFile(
      join(plugin, 'src/main.ts'),
      [
        "import { definePlugin } from '@reformer/builder-plugin-api';",
        "import { withMarker } from '@reformer/builder-toolkit';",
        "export default definePlugin({ id: 'acme-stack', activate() { void withMarker; } });",
        '',
      ].join('\n')
    );

    const result = await buildPlugin({ dir: plugin });
    expect(result.ok ? [] : result.findings).toEqual([]);
    const code = await readFile(join(plugin, 'dist/main.js'), 'utf8');
    // Литерал маркера живёт только в исходнике toolkit: он есть — значит, toolkit вложен.
    expect(code).toContain('// @reformer-generated');
    expect(code).not.toContain('require("@reformer/builder-toolkit")');
  });

  it('бывший пакет стека ReFormer — отказ: код домена во внешний плагин не вкладывается', async () => {
    // Опубликованный `@reformer/builder-stack-reformer` мог остаться у автора плагина в
    // зависимостях. Вложить его — второй экземпляр домена без проверки совместимости; чужой
    // домен расширяют возможностями.
    await writeFile(
      join(plugin, 'src/main.ts'),
      [
        "import { definePlugin } from '@reformer/builder-plugin-api';",
        "import { prepare } from '@reformer/builder-stack-reformer/codegen';",
        "export default definePlugin({ id: 'acme-stack', activate() { void prepare; } });",
        '',
      ].join('\n')
    );

    const result = await buildPlugin({ dir: plugin });
    expect(result.ok ? [] : result.findings.map((finding) => finding.code)).toEqual([
      'module-unavailable',
    ]);
  });

  it('@reformer/* вне списков из кода САМОГО плагина — по-прежнему отказ', async () => {
    await writeFile(
      join(plugin, 'src/main.ts'),
      "import { x } from '@reformer/mcp/dist/core/generate/form-intent.js';\nexport default x;\n"
    );

    const result = await buildPlugin({ dir: plugin });
    expect(result.ok ? [] : result.findings.map((finding) => finding.code)).toEqual([
      'module-unavailable',
    ]);
  });
});
