import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parsePluginManifest } from '@reformer/builder-plugin-api/tooling';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runCli, type CliIo } from './cli.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'reformer-plugin-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function io(): CliIo & { readonly lines: { out: string[]; err: string[] } } {
  const lines = { out: [] as string[], err: [] as string[] };
  return {
    lines,
    cwd: root,
    out: (line) => lines.out.push(line),
    err: (line) => lines.err.push(line),
  };
}

async function create(dir = 'acme-hello', ...args: string[]): Promise<string> {
  const code = await runCli(['create', dir, ...args], io());
  expect(code).toBe(0);
  return join(root, dir);
}

async function patchJson(file: string, patch: (value: Record<string, unknown>) => void) {
  const value = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
  patch(value);
  await writeFile(file, JSON.stringify(value));
}

describe('create', () => {
  it('созданный плагин сразу проходит validate', async () => {
    await create();
    const run = io();

    expect(await runCli(['validate', 'acme-hello'], run)).toBe(0);
    expect(run.lines.out).toEqual(['✓ acme-hello 0.1.0: оболочка его примет']);
  });

  it('скопированный в каталог проекта, он проходит и разбор оболочки', async () => {
    // Исходники без сборки — рабочий способ разработки: оболочка сама транспилирует `main.ts`.
    // Значит манифест шаблона обязан годиться и поставке `project`, а не только стадии исходников.
    const dir = await create();
    const text = await readFile(join(dir, 'manifest.json'), 'utf8');

    expect(parsePluginManifest(text, { kind: 'project', dir: 'acme-hello' }).ok).toBe(true);
  });

  it('берёт идентификатор и имя из параметров', async () => {
    const dir = await create('folder', '--id', 'acme.forms', '--name', 'Acme Forms');
    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as {
      id: string;
      name: string;
    };
    const main = await readFile(join(dir, 'src/main.ts'), 'utf8');

    expect(manifest).toMatchObject({ id: 'acme.forms', name: 'Acme Forms' });
    expect(main).toContain("id: 'acme.forms'");
  });

  it('идентификатор проверяет разбор манифеста оболочки', async () => {
    const run = io();

    expect(await runCli(['create', 'x', '--id', 'bad id'], run)).toBe(1);
    expect(run.lines.err[0]).toContain('не годится в идентификаторы');
  });

  it('в непустой каталог не пишет', async () => {
    await create();
    const run = io();

    expect(await runCli(['create', 'acme-hello'], run)).toBe(1);
    expect(run.lines.err[0]).toContain('не пуст');
  });
});

describe('validate', () => {
  async function findings(dir: string): Promise<string[]> {
    const run = io();
    expect(await runCli(['validate', dir], run)).toBe(1);
    return run.lines.err;
  }

  it('без манифеста — отказ, а не исключение', async () => {
    expect(await findings('.')).toEqual(['✗ manifest.json: в каталоге нет manifest.json']);
  });

  it('отказ разбора манифеста — первым и единственным', async () => {
    const dir = await create();
    await patchJson(join(dir, 'manifest.json'), (m) => {
      m.apiVersion = '^99';
    });

    const errors = await findings('acme-hello');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('оболочка даёт API');
  });

  it('собирает ВСЕ отказы файлов вокруг манифеста', async () => {
    const dir = await create();
    await rm(join(dir, 'src/main.ts'));
    await writeFile(join(dir, 'locales/en.json'), '{"command":{"hello":"Hi"}}');
    await patchJson(join(dir, 'manifest.json'), (m) => {
      m.styles = { file: 'styles.css' };
    });
    await patchJson(join(dir, 'package.json'), (p) => {
      p.version = '0.2.0';
    });

    const errors = await findings('acme-hello');
    expect(errors).toHaveLength(4);
    expect(errors[0]).toBe('✗ src/main.ts: точки входа «src/main.ts» нет');
    expect(errors[1]).toContain('styles.css');
    expect(errors[2]).toContain('словарь локали «en»');
    expect(errors[3]).toContain('версия package.json («0.2.0»)');
  });

  it('точка входа, не являющаяся кодом, — отказ', async () => {
    const dir = await create();
    await patchJson(join(dir, 'manifest.json'), (m) => {
      m.main = 'README.md';
    });

    expect((await findings('acme-hello'))[0]).toContain('не файл кода');
  });
});

describe('аргументы', () => {
  it('без команды — справка и код 2', async () => {
    const run = io();

    expect(await runCli([], run)).toBe(2);
    expect(run.lines.out[0]).toContain('Использование');
  });

  it('неизвестная команда и неизвестный параметр — код 2', async () => {
    expect(await runCli(['publish'], io())).toBe(2);
    expect(await runCli(['validate', '--force'], io())).toBe(2);
  });

  it('версия — из package.json CLI', async () => {
    const run = io();
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };

    expect(await runCli(['--version'], run)).toBe(0);
    expect(run.lines.out).toEqual([pkg.version]);
  });
});
