#!/usr/bin/env node
// Guard: `npm i @reformer/…@beta` должен ставиться ДЕФОЛТНЫМ npm, без --legacy-peer-deps.
//
// check-peer-ranges.mjs проверяет строку в манифесте, этот скрипт — поведение npm: собирает
// пакеты с prerelease-версиями и ставит их в чистый проект. Разделение нужно, потому что
// правило semver про prerelease неочевидно и «безобидная» правка диапазона ломает установку
// только у потребителя:
//
//   npm error Could not resolve dependency:
//   npm error peer @reformer/core@">=1.1.0" from @reformer/cdk@11.3.1-beta.1
//
// Внутри монорепо это не воспроизводится НИКОГДА: версии в рабочем дереве стабильные
// (6.0.0 удовлетворяет ">=1.1.0"), а корневой .npmrc много месяцев глушил ошибку флагом
// legacy-peer-deps=true. Поэтому здесь всё подменяется руками:
//
//   • версии — фальшивые prerelease, причём РАЗНЫЕ по major/minor/patch у каждого пакета.
//     Это не стилистика: одинаковый кортеж прошёл бы даже через "^900.0.0-0", и тест
//     зеленел бы на диапазоне, который в реальности ломается (у develop-бет расходятся
//     и мажоры, и минорные: core 11.0.0-beta.3 против cdk 11.3.1-beta.1);
//   • окружение — без npm_config_*, плюс явный --no-legacy-peer-deps. Одного вычищенного
//     env мало: флаг может прийти из ~/.npmrc разработчика и снова сделать тест бесполезным.
//
// Тарболы намеренно МАНИФЕСТНЫЕ (в них только package.json): peer-конфликт решается по
// метаданным, содержимое dist на резолв не влияет. Поэтому проверка не требует сборки и
// стоит в CI до всех build-шагов — рядом с манифестным гейтом.

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// npm запускаем через его JS-entry (`npm_execpath` выставляет сам npm при `npm run`):
// с Node 20+ execFile не умеет спавнить `npm.cmd` без shell, а shell на Windows
// ломается о пробелы в путях. Fallback — на случай прямого `node scripts/...`.
const npmExecpath = process.env.npm_execpath;
const viaNode = Boolean(npmExecpath?.endsWith('.js'));
const onWindows = process.platform === 'win32';

// Конфиг монорепо не должен протекать в песочницу: `npm run` экспортирует его через
// npm_config_*, и legacy-peer-deps=true из корневого .npmrc сделал бы проверку вечно зелёной.
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) => !key.toLowerCase().startsWith('npm_config_') && !key.startsWith('npm_package_')
  )
);

const run = (args, cwd) => {
  const [file, argv] = viaNode
    ? [process.execPath, [npmExecpath, ...args]]
    : [onWindows ? 'npm.cmd' : 'npm', onWindows ? args.map((a) => JSON.stringify(a)) : args];
  return execFileSync(file, argv, {
    cwd,
    env: cleanEnv,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
};

/** Публикуемые @reformer/* из packages/* — список берётся из файловой системы, не хардкодится. */
const publishable = readdirSync(path.join(repoRoot, 'packages'))
  .map((entry) => path.join(repoRoot, 'packages', entry, 'package.json'))
  .filter(existsSync)
  .map((manifest) => JSON.parse(readFileSync(manifest, 'utf8')))
  .filter((pkg) => !pkg.private && pkg.name?.startsWith('@reformer/'));

if (publishable.length < 2) {
  console.error('✗ найдено меньше двух публикуемых пакетов — проверять нечего, чините скрипт');
  process.exit(1);
}

/** Заведомо не изданные версии с расходящимися кортежами — см. шапку. */
const fakeVersion = (i) => `${900 + i}.${i}.${i}-beta.${i + 1}`;

const sandbox = mkdtempSync(path.join(os.tmpdir(), 'reformer-peer-prerelease-'));
const staging = path.join(sandbox, 'staging');
const tarballs = path.join(sandbox, 'tarballs');
const consumer = path.join(sandbox, 'consumer');
mkdirSync(staging);
mkdirSync(tarballs);
mkdirSync(consumer);

let failed = false;
try {
  console.log(`  песочница: ${sandbox}`);

  const versions = new Map();
  const dependencies = { react: '^19.0.0', 'react-dom': '^19.0.0' };

  publishable.forEach((pkg, i) => {
    const version = fakeVersion(i);
    versions.set(pkg.name, version);

    // Стейджим ТОЛЬКО манифест: содержимое пакета на резолв не влияет, зато сборка
    // перестаёт быть предусловием. `scripts` выкидываем, чтобы `npm pack` не дёрнул
    // prepack/prepare (сейчас их нет, но появиться могут).
    const dir = path.join(staging, pkg.name.replace('/', '__'));
    mkdirSync(dir);
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ ...pkg, version, scripts: undefined }, null, 2)
    );

    const packed = run(['pack', '--pack-destination', tarballs, '--loglevel=error'], dir);
    const tarball = path.join(tarballs, packed.trim().split('\n').pop().trim());
    dependencies[pkg.name] = `file:${tarball}`;
  });

  writeFileSync(
    path.join(consumer, 'package.json'),
    JSON.stringify(
      { name: 'peer-prerelease-smoke', version: '1.0.0', private: true, dependencies },
      null,
      2
    )
  );

  console.log(`  npm install: ${publishable.length} пакет(ов) с prerelease-версиями…`);
  try {
    run(
      ['install', '--no-audit', '--no-fund', '--no-legacy-peer-deps', '--loglevel=error'],
      consumer
    );
  } catch (error) {
    failed = true;
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim();
    console.error('\n✗ дефолтный npm НЕ ставит пакеты с prerelease-версиями:\n');
    console.error(output.split('\n').slice(0, 25).join('\n'));
    console.error(
      '\n  У потребителя это выглядит как «npm i @reformer/core@beta … падает с ERESOLVE,\n' +
        '  помогает только --legacy-peer-deps». Причина почти всегда одна: внутренний\n' +
        "  peer-диапазон снова стал версионным. Внутренние @reformer/* peer'ы обязаны\n" +
        '  быть "*" — подробности в шапке scripts/check-peer-ranges.mjs.'
    );
  }

  if (!failed) {
    // Защита от молчаливого прохождения: убеждаемся, что установились ИМЕННО подменённые
    // версии. Иначе достаточно опечатки в стейджинге, чтобы тест зеленел, ничего не проверив.
    const wrong = [];
    for (const [name, expected] of versions) {
      const manifest = path.join(consumer, 'node_modules', ...name.split('/'), 'package.json');
      const actual = existsSync(manifest)
        ? JSON.parse(readFileSync(manifest, 'utf8')).version
        : '<не установлен>';
      if (actual !== expected) wrong.push(`${name}: ожидалось ${expected}, в дереве ${actual}`);
    }
    if (wrong.length > 0) {
      failed = true;
      console.error('\n✗ проверка недействительна — в дереве не те версии:');
      for (const line of wrong) console.error(`    ${line}`);
    }
  }

  if (!failed) {
    // Дубликаты @reformer/* смертельны для core: два экземпляра — два несвязанных набора
    // сигналов, форма молча перестаёт реагировать. Версионный peer-диапазон приводит именно
    // к этому, когда npm решает вложить копию вместо конфликта (обычные deps он вкладывает).
    const nested = publishable.flatMap((pkg) => {
      const inner = path.join(
        consumer,
        'node_modules',
        ...pkg.name.split('/'),
        'node_modules',
        '@reformer'
      );
      return existsSync(inner)
        ? readdirSync(inner).map((dup) => `${pkg.name} → @reformer/${dup}`)
        : [];
    });
    if (nested.length > 0) {
      failed = true;
      console.error('\n✗ в дереве вложенные копии @reformer/*:');
      for (const line of nested) console.error(`    ${line}`);
      console.error('\n  Потребитель получит два экземпляра пакета вместо одного.');
    }
  }

  if (!failed) {
    console.log(
      `✓ дефолтный npm ставит все ${publishable.length} пакет(ов) с prerelease-версиями ` +
        `без --legacy-peer-deps, в одном экземпляре каждый`
    );
  }
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
