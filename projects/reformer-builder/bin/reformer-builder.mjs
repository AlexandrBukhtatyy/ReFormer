#!/usr/bin/env node
/**
 * reformer-builder — локальный запуск визуального билдера ReFormer.
 *
 * Опубликованный пакет несёт УЖЕ собранный SPA в `dist/`. Этот скрипт — zero-dependency
 * статик-сервер на встроенных модулях Node (перенесён из первой версии билдера, она же
 * в истории git): поднимает `dist/` на localhost и открывает браузер. Серверной
 * логики у билдера нет — вся работа с файлами проекта идёт в браузере через File System Access
 * (нужен Chromium-браузер).
 *
 * Конфигурация уровня запуска — ОДИН файл: конфиг билдера (брендинг, дефолты UI). Launcher
 * читает его с диска и отдаёт SPA по `/__reformer-builder/runtime.json`; без флага `--config`
 * пытается авто-подхватить `<cwd>/.ui_builder/config.json` — тот же конвенционный каталог,
 * в котором живут плагины, шаблоны и цели кодогена открытого проекта. Частый случай «запустил
 * в корне проекта и его же открыл» даёт один каталог конфигурации без дублей.
 *
 * Каталога компонентов (`--catalog` первой версии) здесь НЕТ намеренно: сторонний ui-kit
 * встраивается плагином (`.ui_builder/plugins/`), а не файлом данных — плагин привозит
 * и каталог, и код компонентов.
 *
 * Использование:
 *   npx reformer-builder [--port <n>] [--host <h>] [--no-open] [--config <path>]
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extname, join, normalize, resolve, sep } from 'node:path';

/** URL, по которому SPA забирает конфиг (совпадает с RUNTIME_BUNDLE_PATH в shell/boot/runtime-config). */
export const RUNTIME_BUNDLE_URL = '/__reformer-builder/runtime.json';

/** Путь авто-детекта конфига в cwd, если флаг `--config` не задан. */
const DEFAULT_CONFIG_FILE = join('.ui_builder', 'config.json');

// Без хвостового разделителя: иначе `distDir + sep` даёт двойной слэш и проверка
// границы каталога в resolveFsPath() никогда не совпадает (все запросы → 400).
const distDir = fileURLToPath(new URL('../dist/', import.meta.url)).replace(/[\\/]+$/, '');
const pkgUrl = new URL('../package.json', import.meta.url);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

async function readVersion() {
  try {
    return JSON.parse(await readFile(pkgUrl, 'utf8')).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Прочитать и распарсить конфиг. Явно переданный (`--config`) файл обязателен — при ошибке
 * чтения/парсинга завершаемся с сообщением. Авто-детект: отсутствие файла — тихий пропуск
 * (вшитые дефолты); присутствует, но битый JSON — ошибка: файл явно предназначен
 * к использованию, и молча проигнорировать его значило бы обмануть положившего.
 */
async function readRuntimeFile(path, { explicit }) {
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch (err) {
    if (explicit) {
      console.error(`reformer-builder: не удалось прочитать конфиг "${path}": ${err.message}`);
      process.exit(1);
    }
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error(`reformer-builder: невалидный JSON в конфиге "${path}": ${err.message}`);
    process.exit(1);
  }
}

/**
 * Собрать runtime-bundle для SPA. Путь берётся из флага, иначе — авто-детект
 * `<cwd>/.ui_builder/config.json`. Структурную валидацию делает SPA (точные сообщения
 * о полях — его словарь); здесь ловим только отсутствие и JSON-синтаксис.
 */
export async function loadRuntimeBundle(opts, cwd) {
  const configPath = resolve(cwd, opts.config ?? DEFAULT_CONFIG_FILE);
  const config = await readRuntimeFile(configPath, { explicit: Boolean(opts.config) });
  return {
    payload: { config: config ?? null },
    sources: { config: config === null ? null : configPath },
  };
}

export function parseArgs(argv) {
  const opts = {
    // 4321 — исторический порт билдера: он записан в чужих package.json и в памяти людей.
    port: 4321,
    host: '127.0.0.1',
    open: true,
    help: false,
    version: false,
    /** Явно переданный путь к конфигу (null — не задан, будет авто-детект в cwd). */
    config: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--version' || a === '-v') opts.version = true;
    else if (a === '--no-open') opts.open = false;
    else if (a === '--open') opts.open = true;
    else if (a === '--port' || a === '-p') opts.port = Number(argv[++i]);
    else if (a.startsWith('--port=')) opts.port = Number(a.slice('--port='.length));
    else if (a === '--host') opts.host = String(argv[++i]);
    else if (a.startsWith('--host=')) opts.host = a.slice('--host='.length);
    else if (a === '--config') opts.config = String(argv[++i]);
    else if (a.startsWith('--config=')) opts.config = a.slice('--config='.length);
    else {
      console.error(`reformer-builder: неизвестный аргумент "${a}" (см. --help)`);
      process.exit(1);
    }
  }
  if (!Number.isInteger(opts.port) || opts.port < 0 || opts.port > 65535) {
    console.error(`reformer-builder: некорректный --port (ожидается 0..65535)`);
    process.exit(1);
  }
  return opts;
}

function printHelp() {
  console.log(`reformer-builder — визуальный билдер ReFormer-схем (локальный запуск)

Использование:
  npx reformer-builder [опции]

Опции:
  -p, --port <n>       Порт (по умолчанию 4321; занят — берётся следующий свободный)
      --host <h>       Хост (по умолчанию 127.0.0.1)
      --no-open        Не открывать браузер автоматически
      --config <path>  Конфиг билдера (JSON): брендинг, дефолты UI
  -h, --help           Показать эту справку
  -v, --version        Показать версию

Без --config билдер пытается подхватить .ui_builder/config.json из текущей папки;
если его нет — работает на вшитых дефолтах. Плагины, шаблоны форм и цели кодогена
живут в .ui_builder/ ОТКРЫТОГО проекта и читаются самим приложением.

Примечание: режим «открыть папку проекта» (File System Access API) работает только в
Chromium-браузерах (Chrome/Edge/Arc/Brave).`);
}

/** Открыть URL в браузере по умолчанию (best-effort; сбой не фатален). */
function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  let args;
  if (platform === 'darwin') {
    cmd = 'open';
    args = [url];
  } else if (platform === 'win32') {
    cmd = 'cmd';
    args = ['/c', 'start', '', url];
  } else {
    cmd = 'xdg-open';
    args = [url];
  }
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  } catch {
    /* игнорируем — пользователь откроет URL вручную */
  }
}

/** Резолв запрошенного пути в файл внутри distDir с защитой от path-traversal. */
function resolveFsPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const rel = normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '');
  const full = join(distDir, rel);
  if (full !== distDir && !full.startsWith(distDir + sep)) return null;
  return full;
}

async function sendFile(res, filePath, statusCode = 200) {
  const body = await readFile(filePath);
  const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(statusCode, {
    'Content-Type': type,
    'Content-Length': body.length,
    'Cache-Control': 'no-cache',
  });
  res.end(body);
}

export function createRequestHandler(indexHtmlPath, runtimeBundleBody) {
  return async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end('Method Not Allowed');
      return;
    }
    const pathname = (req.url || '/').split('?')[0].split('#')[0];
    // Конфиг уровня запуска — отдаём ДО резолва static/dist.
    if (pathname === RUNTIME_BUNDLE_URL) {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': runtimeBundleBody.length,
        'Cache-Control': 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : runtimeBundleBody);
      return;
    }
    const target = resolveFsPath(pathname === '/' ? '/index.html' : pathname);
    if (target === null) {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }
    try {
      const info = await stat(target);
      if (info.isDirectory()) {
        const dirIndex = join(target, 'index.html');
        try {
          await stat(dirIndex);
          await sendFile(res, dirIndex);
          return;
        } catch {
          await sendFile(res, indexHtmlPath);
          return;
        }
      }
      await sendFile(res, target);
    } catch {
      // Файла нет. Реальный отсутствующий ассет (есть расширение) → 404.
      // Навигационный маршрут (без расширения) → SPA-fallback на index.html.
      if (extname(pathname)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
      } else {
        try {
          await sendFile(res, indexHtmlPath);
        } catch {
          res.writeHead(500);
          res.end('Internal Server Error');
        }
      }
    }
  };
}

/** Поднять сервер, при EADDRINUSE — попробовать следующий порт (до +20). */
function listenWithFallback(server, host, startPort, attemptsLeft = 20) {
  return new Promise((resolvePort, reject) => {
    const tryPort = (port) => {
      const onError = (err) => {
        if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
          attemptsLeft--;
          tryPort(port + 1);
        } else {
          reject(err);
        }
      };
      server.once('error', onError);
      server.listen(port, host, () => {
        server.removeListener('error', onError);
        resolvePort(port);
      });
    };
    tryPort(startPort);
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }
  if (opts.version) {
    console.log(await readVersion());
    return;
  }

  const indexHtmlPath = join(distDir, 'index.html');
  try {
    await stat(indexHtmlPath);
  } catch {
    console.error(
      `reformer-builder: не найден собранный dist/ (ожидался ${indexHtmlPath}).\n` +
        `Похоже, пакет установлен без бандла — переустановите его.`
    );
    process.exit(1);
  }

  const runtime = await loadRuntimeBundle(opts, process.cwd());
  const runtimeBundleBody = Buffer.from(JSON.stringify(runtime.payload));

  const server = createServer(createRequestHandler(indexHtmlPath, runtimeBundleBody));
  let port;
  try {
    port = await listenWithFallback(server, opts.host, opts.port);
  } catch (err) {
    console.error(`reformer-builder: не удалось занять порт: ${err.message}`);
    process.exit(1);
  }

  const displayHost = opts.host === '0.0.0.0' ? 'localhost' : opts.host;
  const url = `http://${displayHost}:${port}/`;
  console.log(`\n  reformer-builder v${await readVersion()}`);
  console.log(`  Локальный сервер:  ${url}`);
  if (runtime.sources.config) console.log(`  Конфиг из файла:   ${runtime.sources.config}`);
  console.log(`  Режим «открыть папку проекта» требует Chromium-браузер (File System Access API).`);
  console.log(`  Остановить: Ctrl+C\n`);

  if (opts.open) openBrowser(url);

  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Не запускаем сервер при импорте из тестов (юнит-тесты дёргают экспортированные хелперы).
if (process.env.REFORMER_BUILDER_TEST !== '1') {
  main().catch((err) => {
    console.error(`reformer-builder: ${err?.stack || err}`);
    process.exit(1);
  });
}
