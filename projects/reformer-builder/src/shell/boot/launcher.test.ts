/**
 * Юнит-тесты лаунчера (`bin/reformer-builder.mjs`): парс флагов, чтение конфига из cwd
 * (флаг и авто-детект `.ui_builder/config.json`) и раздача endpoint'а. Импорт бина
 * с REFORMER_BUILDER_TEST=1, чтобы он не поднимал сервер.
 *
 * Согласие путей между лаунчером и SPA закреплено здесь же: RUNTIME_BUNDLE_URL бина обязан
 * совпадать с RUNTIME_BUNDLE_PATH модуля `runtime-config` — это единственный их общий контракт.
 *
 * @module shell/boot/launcher.test
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RUNTIME_BUNDLE_PATH } from './runtime-config';
import {
  APPLICATION_INDEX_FILE,
  APPLICATION_ROOT_DIR,
  parseApplicationPluginIndex,
} from '@/shell/platform/plugin/application/files';

process.env.REFORMER_BUILDER_TEST = '1';
const bin = await import('../../../bin/reformer-builder.mjs');
const index = await import('../../../bin/plugins-index.mjs');

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'rb-launcher-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('контракт лаунчера и SPA', () => {
  it('URL конфига один на двоих', () => {
    expect(bin.RUNTIME_BUNDLE_URL).toBe(RUNTIME_BUNDLE_PATH);
  });
});

describe('parseArgs', () => {
  it('--config (пробел и =-форма), --no-open, --port', () => {
    expect(bin.parseArgs(['--config', 'b.json', '--no-open'])).toMatchObject({
      config: 'b.json',
      open: false,
    });
    expect(bin.parseArgs(['--config=y/b.json', '--port', '5000'])).toMatchObject({
      config: 'y/b.json',
      port: 5000,
    });
  });

  it('дефолты: порт 4321, авто-детект конфига', () => {
    expect(bin.parseArgs([])).toMatchObject({
      port: 4321,
      host: '127.0.0.1',
      open: true,
      config: null,
      plugins: null,
    });
  });

  it('--plugins (пробел и =-форма) называет каталог плагинов приложения', () => {
    expect(bin.parseArgs(['--plugins', 'out/plugins']).plugins).toBe('out/plugins');
    expect(bin.parseArgs(['--plugins=../p']).plugins).toBe('../p');
  });
});

describe('loadRuntimeBundle', () => {
  it('авто-детект .ui_builder/config.json в cwd', async () => {
    await mkdir(join(dir, '.ui_builder'), { recursive: true });
    await writeFile(
      join(dir, '.ui_builder', 'config.json'),
      JSON.stringify({ branding: { title: 'Формы Acme' } })
    );

    const { payload, sources } = await bin.loadRuntimeBundle({ config: null }, dir);

    expect(payload.config).toEqual({ branding: { title: 'Формы Acme' } });
    expect(sources.config).toBe(join(dir, '.ui_builder', 'config.json'));
  });

  it('явный флаг с относительным путём резолвится от cwd', async () => {
    await writeFile(join(dir, 'custom.json'), JSON.stringify({ defaults: { locale: 'en' } }));
    const { payload } = await bin.loadRuntimeBundle({ config: 'custom.json' }, dir);
    expect(payload.config).toEqual({ defaults: { locale: 'en' } });
  });

  it('нет файла (авто-детект) → пустой bundle, без падения', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'rb2-empty-'));
    const { payload, sources } = await bin.loadRuntimeBundle({ config: null }, empty);
    expect(payload).toEqual({ config: null });
    expect(sources).toEqual({ config: null });
    await rm(empty, { recursive: true, force: true });
  });
});

describe('createRequestHandler', () => {
  interface FakeRes {
    status: number;
    headers: Record<string, unknown>;
    body: unknown;
    writeHead(code: number, headers?: Record<string, unknown>): void;
    end(body?: unknown): void;
  }
  const fakeRes = (): FakeRes => ({
    status: 0,
    headers: {},
    body: undefined,
    writeHead(code, headers) {
      this.status = code;
      this.headers = headers ?? {};
    },
    end(body) {
      this.body = body;
    },
  });

  it('отдаёт конфиг application/json по RUNTIME_BUNDLE_URL', async () => {
    const body = Buffer.from(JSON.stringify({ config: { defaults: { theme: 'dark' } } }));
    const handler = bin.createRequestHandler('/does/not/matter/index.html', body);
    const res = fakeRes();

    await handler({ method: 'GET', url: bin.RUNTIME_BUNDLE_URL }, res);

    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toContain('application/json');
    expect(String(res.body)).toContain('"dark"');
  });

  it('не-GET получает 405, path-traversal получает 400', async () => {
    const handler = bin.createRequestHandler('/x/index.html', Buffer.from('{}'));

    const post = fakeRes();
    await handler({ method: 'POST', url: '/' }, post);
    expect(post.status).toBe(405);

    const traversal = fakeRes();
    await handler({ method: 'GET', url: '/%2e%2e/%2e%2e/etc/passwd' }, traversal);
    // Нормализация срезает ../ до границы dist, дальше путь просто не существует. Здесь
    // важен инвариант «содержимое за пределами dist не отдаётся», а не конкретный код:
    // 400 (вышел за границу), 404 (ассет не найден) или 500 (fallback-index фейковый).
    expect([400, 404, 500]).toContain(traversal.status);
    expect(traversal.body === undefined || typeof traversal.body === 'string').toBe(true);
    expect(String(traversal.body ?? '')).not.toContain('root:');
  });

  describe('кэш браузера: метка версии и «не изменился»', () => {
    // Оболочка спрашивает файлы плагинов с `no-cache`: каждый запуск идёт к серверу. Без метки
    // версии ответом было полное тело — мегабайты на запуск; с ней — пустой 304.
    let root: string;
    beforeAll(async () => {
      root = join(dir, 'static');
      await mkdir(join(root, 'assets'), { recursive: true });
      await mkdir(join(root, 'plugins', 'base', 'files'), { recursive: true });
      await writeFile(join(root, 'index.html'), '<!doctype html><title>оболочка</title>');
      await writeFile(join(root, 'assets', 'index-AbC123.js'), 'console.log("чанк")');
      await writeFile(join(root, 'plugins', 'base', 'files', 'main.js'), 'module.exports = {};');
    });

    const handlerOf = () =>
      bin.createRequestHandler(join(root, 'index.html'), Buffer.from('{}'), { rootDir: root });
    const get = async (url: string, headers: Record<string, string> = {}): Promise<FakeRes> => {
      const res = fakeRes();
      await handlerOf()({ method: 'GET', url, headers }, res);
      return res;
    };
    const PLUGIN = '/plugins/base/files/main.js';

    it('файл отдаётся с меткой; повторный вопрос с ней — 304 без тела', async () => {
      const first = await get(PLUGIN);
      expect(first.status).toBe(200);
      expect(String(first.body)).toBe('module.exports = {};');
      const etag = String(first.headers.ETag);
      expect(etag).toMatch(/^"[0-9a-f]+-[0-9a-f]+"$/);

      const again = await get(PLUGIN, { 'if-none-match': etag });

      expect(again.status).toBe(304);
      expect(again.body).toBeUndefined();
      // Метка и правило кэша едут и с 304: браузер обновляет ими свою запись.
      expect(again.headers.ETag).toBe(etag);
    });

    it('список меток и слабая форма тоже узнаются; чужая метка — полный ответ', async () => {
      const etag = String((await get(PLUGIN)).headers.ETag);

      expect((await get(PLUGIN, { 'if-none-match': `"прежняя", W/${etag}` })).status).toBe(304);
      expect((await get(PLUGIN, { 'if-none-match': '"не-та"' })).status).toBe(200);
    });

    it('файл изменился — метка другая, и старая больше не подходит', async () => {
      const before = String((await get(PLUGIN)).headers.ETag);
      await writeFile(join(root, 'plugins', 'base', 'files', 'main.js'), 'module.exports = 1;');
      // Время изменения сдвигается явно: на быстром диске две записи попадают в одну отметку.
      const later = new Date(Date.now() + 5_000);
      await utimes(join(root, 'plugins', 'base', 'files', 'main.js'), later, later);

      const after = await get(PLUGIN, { 'if-none-match': before });

      expect(after.status).toBe(200);
      expect(after.headers.ETag).not.toBe(before);
      expect(String(after.body)).toBe('module.exports = 1;');
    });

    it('навсегда кэшируются только чанки с хэшем в имени; страница и плагины — с вопросом', async () => {
      expect((await get('/assets/index-AbC123.js')).headers['Cache-Control']).toContain(
        'immutable'
      );
      expect((await get('/')).headers['Cache-Control']).toBe('no-cache');
      expect((await get(PLUGIN)).headers['Cache-Control']).toBe('no-cache');
      // Навигационный маршрут отдаёт страницу приложения — и её тоже переспрашивают.
      expect((await get('/settings')).headers['Cache-Control']).toBe('no-cache');
    });

    it('запрос без заголовков не роняет раздачу', async () => {
      const res = fakeRes();
      await handlerOf()({ method: 'GET', url: PLUGIN }, res);

      expect(res.status).toBe(200);
    });
  });

  describe('каталог плагинов приложения (--plugins)', () => {
    let plugins: string;
    beforeAll(async () => {
      plugins = join(dir, 'app-plugins');
      await mkdir(join(plugins, 'forms', 'kits', 'chunks'), { recursive: true });
      await mkdir(join(plugins, 'forms', 'kits', 'node_modules', 'dep'), { recursive: true });
      await mkdir(join(plugins, '.shared'), { recursive: true });
      await writeFile(join(plugins, 'forms', 'kits', 'manifest.json'), '{"id":"reformer.kits"}');
      await writeFile(join(plugins, 'forms', 'kits', 'main.js'), 'module.exports = {};');
      await writeFile(join(plugins, 'forms', 'kits', 'chunks', 'data.js'), 'module.exports = 1;');
      await writeFile(join(plugins, 'forms', 'kits', 'node_modules', 'dep', 'index.js'), '');
      await writeFile(join(plugins, '.shared', 'vitest.ts'), '');
      await writeFile(join(dir, 'secret.txt'), 'секрет');
    });

    const handlerOf = () =>
      bin.createRequestHandler('/x/index.html', Buffer.from('{}'), { pluginsDir: plugins });

    it('индекс строится с диска: файлы плагинов без node_modules и имён с точки', async () => {
      const res = fakeRes();
      await handlerOf()({ method: 'GET', url: `${bin.PLUGINS_URL_PREFIX}index.json` }, res);

      expect(res.status).toBe(200);
      expect(res.headers['Content-Type']).toContain('application/json');
      expect(JSON.parse(String(res.body))).toEqual({
        version: 1,
        files: ['forms/kits/chunks/data.js', 'forms/kits/main.js', 'forms/kits/manifest.json'],
      });
    });

    it('файл плагина отдаётся из каталога флага, а не из dist', async () => {
      const res = fakeRes();
      await handlerOf()({ method: 'GET', url: `${bin.PLUGINS_URL_PREFIX}forms/kits/main.js` }, res);

      expect(res.status).toBe(200);
      expect(String(res.body)).toBe('module.exports = {};');
    });

    it('файла нет — 404, а не страница приложения', async () => {
      // SPA-fallback вместо кода плагина исполнился бы как код и упал синтаксической ошибкой.
      const res = fakeRes();
      await handlerOf()({ method: 'GET', url: `${bin.PLUGINS_URL_PREFIX}forms/absent` }, res);

      expect(res.status).toBe(404);
    });

    it('выход за каталог плагинов не отдаёт чужой файл', async () => {
      const res = fakeRes();
      await handlerOf()({ method: 'GET', url: `${bin.PLUGINS_URL_PREFIX}%2e%2e/secret.txt` }, res);

      expect([400, 404]).toContain(res.status);
      expect(String(res.body ?? '')).not.toContain('секрет');
    });

    it('без флага адрес плагинов — обычная статика dist', async () => {
      // Файл есть только в каталоге флага: без флага его отдавать неоткуда, что бы ни лежало
      // в собранном `dist/plugins` на этой машине.
      await mkdir(join(plugins, 'only-with-flag'), { recursive: true });
      await writeFile(join(plugins, 'only-with-flag', 'main.js'), 'module.exports = {};');
      const url = `${bin.PLUGINS_URL_PREFIX}only-with-flag/main.js`;

      const withFlag = fakeRes();
      await handlerOf()({ method: 'GET', url }, withFlag);
      expect(withFlag.status).toBe(200);

      const withoutFlag = fakeRes();
      await bin.createRequestHandler('/x/index.html', Buffer.from('{}'))(
        { method: 'GET', url },
        withoutFlag
      );
      expect(withoutFlag.status).toBe(404);
    });
  });
});

describe('индекс плагинов приложения', () => {
  it('формат индекса у лаунчера и оболочки один', async () => {
    const built = await index.buildPluginsIndex(join(dir, 'app-plugins'));

    // Оболочка принимает ровно то, что строит лаунчер: версия и плоский список путей.
    expect(parseApplicationPluginIndex(built)).toEqual(built);
    expect(index.PLUGINS_INDEX_FILE).toBe(APPLICATION_INDEX_FILE);
    expect(bin.PLUGINS_URL_PREFIX).toBe(`/${APPLICATION_ROOT_DIR}/`);
  });

  it('каталога нет — пустой индекс, а не отказ', async () => {
    expect(await index.buildPluginsIndex(join(dir, 'нет-такого'))).toEqual({
      version: 1,
      files: [],
    });
  });
});
