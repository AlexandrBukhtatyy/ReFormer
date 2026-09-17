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

import { buildPlugin, type BuildResult } from './commands/build.js';
import { createPlugin } from './commands/create.js';
import { startDev, type DevSession } from './commands/dev.js';
import { formatFinding, type Finding } from './commands/findings.js';
import { packPlugin } from './commands/pack.js';
import { validatePlugin } from './commands/validate.js';

export interface CliIo {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
  /** Каталог, относительно которого читаются пути аргументов. */
  readonly cwd: string;
  /**
   * Чем ждать конца `dev`: сеанс наблюдения живёт, пока его не закроют. Процесс ждёт сигнала,
   * тест — закрывает сразу после первой сборки.
   */
  readonly waitDev?: (session: DevSession) => Promise<void>;
}

const USAGE = `Использование: reformer-plugin <команда> [аргументы]

Команды:
  create <каталог> [--id <id>] [--name <имя>]  новый плагин из шаблона
  validate [каталог]                           проверить плагин правилами оболочки
  build [каталог] [--out <каталог>]            собрать в каталог, который оболочка грузит как есть
  dev [каталог] --project <каталог проекта>    собирать в .ui_builder/plugins/<id>/ на каждое сохранение
  pack [каталог] [--out <каталог>]             собрать и упаковать в npm-архив

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
        out: { type: 'string' },
        project: { type: 'string' },
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
  const printFindings = (findings: readonly Finding[]): void => {
    for (const finding of findings) io.err(formatFinding(finding));
  };
  /** Печатает отказы или заметки сборки; `true` — сборка удалась. */
  const printBuild = (result: BuildResult): result is Extract<BuildResult, { ok: true }> => {
    if (!result.ok) {
      printFindings(result.findings);
      return false;
    }
    for (const notice of result.notices) io.out(`! ${notice}`);
    return true;
  };

  // Параметры принимаются только теми командами, которым они что-то значат: молча
  // проигнорированный `--out` у validate хуже отказа.
  const accepted: Record<string, readonly string[]> = {
    create: ['id', 'name'],
    validate: [],
    build: ['out'],
    dev: ['project'],
    pack: ['out'],
  };
  const extra = Object.keys(values).filter(
    (key) => key !== 'help' && key !== 'version' && !(accepted[command] ?? []).includes(key)
  );
  if (command in accepted && extra.length > 0) {
    io.err(`${command}: параметры ${extra.map((key) => `--${key}`).join(', ')} не принимаются`);
    return 2;
  }

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
      const result = await validatePlugin(path(target ?? '.'));
      if (result.ok) {
        io.out(`✓ ${result.manifest.id} ${result.manifest.version}: оболочка его примет`);
        return 0;
      }
      printFindings(result.findings);
      return 1;
    }
    case 'build': {
      const result = await buildPlugin({
        dir: path(target ?? '.'),
        outDir: values.out === undefined ? undefined : path(values.out),
      });
      if (!printBuild(result)) return 1;
      io.out(`✓ ${result.manifest.id} ${result.manifest.version} собран в ${result.outDir}`);
      return 0;
    }
    case 'dev': {
      if (values.project === undefined) {
        io.err('dev: не указан --project — корень проекта, в котором плагин будет подхвачен');
        return 2;
      }
      const session = startDev({
        dir: path(target ?? '.'),
        project: path(values.project),
        onBuild: (result) => {
          if (printBuild(result)) {
            io.out(`✓ ${new Date().toLocaleTimeString()} собран в ${result.outDir}`);
          }
        },
      });
      await session.ready;
      await (io.waitDev ?? waitForSignal)(session);
      session.close();
      return 0;
    }
    case 'pack': {
      const result = await packPlugin({
        dir: path(target ?? '.'),
        destination: values.out === undefined ? undefined : path(values.out),
      });
      if (!result.ok) {
        printFindings(result.findings);
        return 1;
      }
      for (const notice of result.notices) io.out(`! ${notice}`);
      io.out(`✓ ${result.file}`);
      return 0;
    }
    default:
      io.err(`неизвестная команда «${command}»`);
      io.err(USAGE);
      return 2;
  }
}

/** Ждёт Ctrl+C: `dev` работает, пока его не остановят. */
function waitForSignal(): Promise<void> {
  return new Promise((done) => {
    process.once('SIGINT', () => done());
  });
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
