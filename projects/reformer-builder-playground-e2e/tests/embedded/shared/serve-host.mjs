/**
 * Сервер прогона `embedded`: dev-сервер приложения-образца над его КОПИЕЙ.
 *
 * Запускается конфигом Playwright как `webServer` — раньше общей подготовки прогона
 * (`tests/shared/global-setup.ts`), поэтому всё, что серверу нужно, готовит сам:
 *
 * 1. собранные пакеты, без которых не соберутся плагины (тем же списком, что общая подготовка);
 * 2. плагины билдера для поставки и их каталог в статике приложения — встроенный билдер
 *    берёт плагины оттуда, а не из открытого проекта;
 * 3. копию приложения: тесты правят его исходники, и рабочее дерево репозитория остаётся
 *    нетронутым;
 * 4. dev-сервер Vite над копией.
 *
 * Запуск: `node tests/embedded/shared/serve-host.mjs --port 5185`.
 *
 * @module tests/embedded/shared/serve-host
 */

import { execFileSync, execSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
/** `tests/embedded/shared` → пакет e2e → `projects` → корень. */
const REPO_ROOT = path.resolve(here, '../../../../..');
const BUILDER_DIR = path.join(REPO_ROOT, 'projects', 'reformer-builder');
const HOST_EXAMPLE_DIR = path.join(REPO_ROOT, 'projects', 'reformer-builder-host-example');
/** Тот же путь — `HOST_E2E_DIR` в `tests/shared/paths.ts`; там же сказано, почему он такой. */
const HOST_E2E_DIR = path.join(REPO_ROOT, '.tmp', 'e2e-host-example');

const portAt = process.argv.indexOf('--port');
const port = portAt === -1 ? '5185' : process.argv[portAt + 1];

/** npm из корня репозитория. Одной строкой через оболочку: на Windows `npm` — командный файл. */
const npm = (command) => {
  execSync(`npm ${command}`, { cwd: REPO_ROOT, stdio: 'inherit' });
};

// 1. Пакеты, которые сборка плагинов берёт собранными.
const requiredBuilds = JSON.parse(
  readFileSync(path.resolve(here, '../../shared/required-builds.json'), 'utf8')
);
for (const { dir, file, name } of requiredBuilds) {
  if (!existsSync(path.join(REPO_ROOT, 'packages', dir, 'dist', file))) {
    npm(`run build -w ${name}`);
  }
}

// 2. Плагины для поставки. Каждый раз, а не «если нет»: устаревшая сборка незаметно
// проверяла бы вчерашний плагин.
npm('run plugins:dist -w reformer-builder-playground');

// 3. Копия приложения — то, что видит git: отслеживаемые и новые файлы без игнорируемых.
// Прежняя копия сносится целиком: в ней правки прошлого прогона.
rmSync(HOST_E2E_DIR, { recursive: true, force: true });
const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  {
    cwd: HOST_EXAMPLE_DIR,
    encoding: 'utf8',
  }
)
  .split('\0')
  .filter((file) => file !== '' && existsSync(path.join(HOST_EXAMPLE_DIR, file)));
for (const file of files) {
  const target = path.join(HOST_E2E_DIR, file);
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(path.join(HOST_EXAMPLE_DIR, file), target);
}

// Каталог плагинов — в статику копии: приложение раздаёт его билдеру по своему адресу.
execFileSync(
  process.execPath,
  [
    path.join(BUILDER_DIR, 'scripts', 'collect-application-plugins.mjs'),
    '--list',
    path.join(BUILDER_DIR, 'application-plugins.embedded.json'),
    '--out',
    path.join(HOST_E2E_DIR, 'public', 'builder-plugins'),
  ],
  { cwd: REPO_ROOT, stdio: 'inherit' }
);

// 4. Dev-сервер. Своих `node_modules` у копии нет — сборщик и зависимости приложения
// находятся подъёмом до корня репозитория, как и у оригинала.
// Исполняемый файл сборщика пакет наружу не объявляет — он находится от его манифеста.
const vitePackage = createRequire(path.join(HOST_EXAMPLE_DIR, 'package.json')).resolve(
  'vite/package.json'
);
const vite = path.join(path.dirname(vitePackage), 'bin', 'vite.js');
const server = spawn(process.execPath, [vite, '--port', port, '--strictPort'], {
  cwd: HOST_E2E_DIR,
  stdio: 'inherit',
});
server.on('exit', (code) => {
  process.exit(code ?? 0);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.kill();
  });
}
