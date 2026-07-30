#!/usr/bin/env node
/**
 * reformer-builder — локальный запуск визуального билдера ReFormer-схем.
 *
 * Опубликованный пакет несёт УЖЕ собранный SPA в `dist/` (каталог компонентов @reformer/ui-kit вшит
 * в бандл на этапе сборки). Этот скрипт — zero-dependency статик-сервер на встроенных модулях Node:
 * поднимает `dist/` на localhost и открывает браузер. Серверной логики у билдера нет — вся работа с
 * файлами проекта идёт в браузере через File System Access API (нужен Chromium-браузер).
 *
 * Использование:
 *   npx reformer-builder [--port <n>] [--host <h>] [--no-open]
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extname, join, normalize, sep } from 'node:path';

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

function parseArgs(argv) {
  const opts = { port: 4321, host: '127.0.0.1', open: true, help: false, version: false };
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
  -p, --port <n>    Порт (по умолчанию 4321; занят — берётся следующий свободный)
      --host <h>    Хост (по умолчанию 127.0.0.1)
      --no-open     Не открывать браузер автоматически
  -h, --help        Показать эту справку
  -v, --version     Показать версию

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
  // Отбрасываем query/hash уже сделано вызывающим; нормализуем и запрещаем выход за distDir.
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

function createRequestHandler(indexHtmlPath) {
  return async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end('Method Not Allowed');
      return;
    }
    const pathname = (req.url || '/').split('?')[0].split('#')[0];
    const target = resolveFsPath(pathname === '/' ? '/index.html' : pathname);
    if (target === null) {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }
    try {
      const info = await stat(target);
      if (info.isDirectory()) {
        // Каталог → отдаём его index.html, иначе SPA-fallback.
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
  return new Promise((resolve, reject) => {
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
        resolve(port);
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
        `Похоже, пакет установлен без бандла — переустановите @reformer/builder.`
    );
    process.exit(1);
  }

  const server = createServer(createRequestHandler(indexHtmlPath));
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
  console.log(`  Режим «открыть папку проекта» требует Chromium-браузер (File System Access API).`);
  console.log(`  Остановить: Ctrl+C\n`);

  if (opts.open) openBrowser(url);

  const shutdown = () => {
    server.close(() => process.exit(0));
    // На случай зависших соединений — жёсткий выход.
    setTimeout(() => process.exit(0), 500).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(`reformer-builder: ${err?.stack || err}`);
  process.exit(1);
});
