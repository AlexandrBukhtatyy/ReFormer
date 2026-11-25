/**
 * Пакеты `@reformer/*`, которые страницы бенчмарка потребляют из `dist`: защита от устаревшей
 * сборки и отпечаток содержимого для сведений о сборке.
 *
 * Тесты в `src` (`*.test.*`, `*.spec.*`, `__tests__/`) в `dist` не попадают, поэтому на свежесть не
 * влияют: правка теста после сборки пакета не делает её устаревшей.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$|[\\/]__tests__[\\/]/;

function newestMtime(dir, skip = () => false) {
  let newest = 0;
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = path.join(d, name);
      if (skip(p)) continue;
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else newest = Math.max(newest, s.mtimeMs);
    }
  };
  walk(dir);
  return newest;
}

function hashDir(dir) {
  const h = createHash('sha256');
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const p = path.join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else h.update(name).update(readFileSync(p));
    }
  };
  walk(dir);
  return h.digest('hex').slice(0, 16);
}

/**
 * Проверить, что `dist` каждого пакета новее его `src`, и вернуть версии с отпечатком `dist`.
 *
 * @param {string} repo - корень открытой части (`oss/`)
 * @param {string[]} dirs - каталоги пакетов в `packages/`
 * @param {string} order - порядок пересборки — для текста ошибки
 * @returns {Record<string, { version: string, distHash: string }>}
 */
export function checkReformerPackages(repo, dirs, order) {
  const packages = {};
  for (const pkg of dirs) {
    const pkgDir = path.join(repo, 'packages', pkg);
    const pkgDist = path.join(pkgDir, 'dist');
    if (!existsSync(pkgDist)) {
      throw new Error(
        `packages/${pkg}/dist отсутствует — соберите пакеты: npm run build:stackblitz -w <пакет>`
      );
    }
    const srcTime = newestMtime(path.join(pkgDir, 'src'), (p) => TEST_FILE.test(p));
    const distTime = newestMtime(pkgDist);
    if (srcTime > distTime) {
      throw new Error(`packages/${pkg}/dist старее src — пересоберите (${order})`);
    }
    const { name, version } = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
    packages[name] = { version, distHash: hashDir(pkgDist) };
  }
  return packages;
}
