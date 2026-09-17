#!/usr/bin/env node
/**
 * `reformer-plugin` — точка входа командной строки.
 *
 * Разбор аргументов и печать отделены от процесса: {@link runCli} получает argv и куда писать,
 * а возвращает код выхода. Так команды проверяются тестом целиком, без запуска дочернего
 * процесса, а `process` трогает только последняя строка файла.
 *
 * @module @reformer/builder-plugin-cli/cli
 */

import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { createPlugin } from './commands/create.js';
import { validatePlugin } from './commands/validate.js';

export interface CliIo {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
  /** Каталог, относительно которого читаются пути аргументов. */
  readonly cwd: string;
}

const USAGE = `Использование: reformer-plugin <команда> [аргументы]

Команды:
  create <каталог> [--id <id>] [--name <имя>]  новый плагин из шаблона
  validate [каталог]                           проверить плагин правилами оболочки

Параметры:
  -h, --help     эта справка
  -v, --version  версия CLI`;

/** Версия CLI из его собственного package.json: `dist/cli.js` → `../package.json`. */
export function cliVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };
  return pkg.version;
}

export async function runCli(argv: readonly string[], io: CliIo): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        id: { type: 'string' },
        name: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    });
  } catch (error) {
    io.err(error instanceof Error ? error.message : String(error));
    io.err(USAGE);
    return 2;
  }

  const { values, positionals } = parsed;
  if (values.version === true) {
    io.out(cliVersion());
    return 0;
  }
  const [command, target, ...rest] = positionals;
  if (values.help === true || command === undefined) {
    io.out(USAGE);
    return command === undefined && values.help !== true ? 2 : 0;
  }
  if (rest.length > 0) {
    io.err(`лишние аргументы: ${rest.join(' ')}`);
    return 2;
  }

  const path = (value: string): string => resolve(io.cwd, value);

  switch (command) {
    case 'create': {
      if (target === undefined) {
        io.err('create: не указан каталог нового плагина');
        return 2;
      }
      const result = await createPlugin({
        dir: path(target),
        id: values.id,
        name: values.name,
        cliVersion: cliVersion(),
      });
      if (!result.ok) {
        io.err(`✗ ${result.message}`);
        return 1;
      }
      io.out(`✓ плагин создан в ${result.dir}`);
      for (const file of result.files) io.out(`  ${file}`);
      return 0;
    }
    case 'validate': {
      if (values.id !== undefined || values.name !== undefined) {
        io.err('validate: параметры --id и --name не принимаются');
        return 2;
      }
      const result = await validatePlugin(path(target ?? '.'));
      if (result.ok) {
        io.out(`✓ ${result.manifest.id} ${result.manifest.version}: оболочка его примет`);
        return 0;
      }
      for (const finding of result.findings) {
        io.err(
          `✗ ${finding.file ?? ''}${finding.file === undefined ? '' : ': '}${finding.message}`
        );
      }
      return 1;
    }
    default:
      io.err(`неизвестная команда «${command}»`);
      io.err(USAGE);
      return 2;
  }
}

/** Запущен ли файл как программа, а не импортирован (тестом). Через ссылку npm — тоже. */
function isMain(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  const code = await runCli(process.argv.slice(2), {
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
    cwd: process.cwd(),
  });
  process.exitCode = code;
}
