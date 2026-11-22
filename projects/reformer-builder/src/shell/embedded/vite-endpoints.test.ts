/**
 * Адреса билдера на dev-сервере приложения (`vite/endpoints.mjs`): кто отвечает на запрос.
 *
 * Обработчик чистый — конфиг и интерфейс приходят параметрами, — поэтому проверяется
 * поддельными запросом и ответом, без dev-сервера. Согласие адресов с SPA закреплено здесь же:
 * префикс плагина обязан быть тем, под которым оболочка ищет конфиг и плагины.
 *
 * @module shell/embedded/vite-endpoints.test
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RUNTIME_BUNDLE_PATH } from '@/shell/boot/runtime-config';
import {
  APPLICATION_INDEX_FILE,
  APPLICATION_ROOT_DIR,
} from '@/shell/platform/plugin/application/files';

import type { RevisionMemo } from '../../../bin/plugins-index.mjs';

const { BUILDER_URL_PREFIX, createBuilderEndpoints } = await import('../../../vite/endpoints.mjs');

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

let plugins: string;
beforeAll(async () => {
  plugins = await mkdtemp(join(tmpdir(), 'rb-endpoints-'));
  for (const plugin of ['base/files', 'forms/preview']) {
    await mkdir(join(plugins, plugin), { recursive: true });
    await writeFile(join(plugins, plugin, 'manifest.json'), '{}');
    await writeFile(join(plugins, plugin, 'main.js'), 'module.exports = {};');
  }
});
afterAll(async () => {
  await rm(plugins, { recursive: true, force: true });
});

interface Stand {
  readonly ui: ReturnType<typeof vi.fn>;
  readonly next: ReturnType<typeof vi.fn>;
  readonly readConfig: ReturnType<typeof vi.fn>;
  /** Запрос к обработчику; обещание завершается, когда на него ответили или отдали дальше. */
  request(url: string, method?: string): Promise<FakeRes>;
}

function stand(
  options: { livePlugins?: boolean; config?: unknown; revisions?: RevisionMemo } = {}
): Stand {
  const ui = vi.fn();
  const next = vi.fn();
  const readConfig = vi.fn(() => Promise.resolve(options.config ?? null));
  const handler = createBuilderEndpoints({
    readConfig,
    plugins:
      options.livePlugins === false
        ? null
        : {
            dir: plugins,
            include: ['base/files'],
            ...(options.revisions === undefined ? {} : { revisions: options.revisions }),
          },
    ui,
  });
  return {
    ui,
    next,
    readConfig,
    request(url, method = 'GET') {
      return new Promise<FakeRes>((resolve) => {
        const res = fakeRes();
        const settled = (): void => {
          resolve(res);
        };
        const end = res.end.bind(res);
        res.end = (body) => {
          end(body);
          settled();
        };
        ui.mockImplementation(settled);
        next.mockImplementation(settled);
        handler({ url, method, headers: {} }, res, next);
      });
    },
  };
}

describe('согласие адресов плагина и SPA', () => {
  it('конфиг запуска и плагины приложения лежат под префиксом билдера', () => {
    expect(RUNTIME_BUNDLE_PATH).toBe(`${BUILDER_URL_PREFIX}runtime.json`);
    // SPA ищет плагины в `plugins/` от базового адреса сборки, а база у неё — префикс.
    expect(`${BUILDER_URL_PREFIX}${APPLICATION_ROOT_DIR}/${APPLICATION_INDEX_FILE}`).toBe(
      '/__reformer-builder/plugins/index.json'
    );
  });
});

describe('адреса приложения', () => {
  it('запрос без префикса обработчик не трогает', async () => {
    const { request, next, ui } = stand();

    const res = await request('/src/main.tsx');

    expect(next).toHaveBeenCalledWith();
    expect(ui).not.toHaveBeenCalled();
    expect(res.status).toBe(0);
  });

  it('похожий адрес — не префикс: `/__reformer-builder-other` принадлежит приложению', async () => {
    const { request, next } = stand();

    await request('/__reformer-builder-other/x');

    expect(next).toHaveBeenCalledWith();
  });
});

describe('адрес без хвостового слэша', () => {
  it('перенаправляется на адрес со слэшем: от него разрешаются относительные пути сборки', async () => {
    const res = await stand().request('/__reformer-builder?x=1');

    expect(res.status).toBe(302);
    expect(res.headers.Location).toBe('/__reformer-builder/?x=1');
  });
});

describe('конфиг запуска', () => {
  it('отдаётся с признаком «рядом с приложением» — и без файла конфига', async () => {
    const res = await stand().request(RUNTIME_BUNDLE_PATH);

    expect(res.status).toBe(200);
    expect(JSON.parse(String(res.body))).toEqual({ config: null, embedded: true });
  });

  it('читается на каждый запрос: правка файла видна после перезагрузки страницы', async () => {
    const { request, readConfig } = stand({ config: { preset: 'builder.base' } });

    const first = await request(RUNTIME_BUNDLE_PATH);
    await request(RUNTIME_BUNDLE_PATH);

    expect(JSON.parse(String(first.body))).toEqual({
      config: { preset: 'builder.base' },
      embedded: true,
    });
    expect(readConfig).toHaveBeenCalledTimes(2);
  });

  it('запись по адресу конфига не принимается', async () => {
    const res = await stand().request(RUNTIME_BUNDLE_PATH, 'POST');

    expect(res.status).toBe(405);
  });

  it('отказ чтения уходит серверу ошибкой, а не повисшим запросом', async () => {
    const next = vi.fn();
    const failure = new Error('диск');
    const handler = createBuilderEndpoints({
      readConfig: () => Promise.reject(failure),
      plugins: null,
      ui: vi.fn(),
    });

    handler({ url: RUNTIME_BUNDLE_PATH, method: 'GET' }, fakeRes(), next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalledWith(failure);
    });
  });
});

describe('плагины приложения', () => {
  it('индекс несёт только набор, названный сервером', async () => {
    const res = await stand().request('/__reformer-builder/plugins/index.json');

    expect(res.status).toBe(200);
    expect((JSON.parse(String(res.body)) as { files: string[] }).files).toEqual([
      'base/files/main.js',
      'base/files/manifest.json',
    ]);
  });

  it('файл плагина из набора отдаётся с диска, файл остальных — нет', async () => {
    const { request, ui } = stand();

    expect((await request('/__reformer-builder/plugins/base/files/main.js')).status).toBe(200);
    expect((await request('/__reformer-builder/plugins/forms/preview/main.js')).status).toBe(404);
    // Отсутствующий файл плагина интерфейсу не достаётся: страница вместо кода плагина
    // исполнилась бы как код.
    expect(ui).not.toHaveBeenCalled();
  });

  it('живой каталог называет ревизии плагинов, каталог поставки — нет', async () => {
    const index = '/__reformer-builder/plugins/index.json';
    const body = async (options: Parameters<typeof stand>[0]) =>
      JSON.parse(String((await stand(options).request(index)).body)) as {
        revisions?: Record<string, string>;
      };

    expect(Object.keys((await body({ revisions: new Map() })).revisions ?? {})).toEqual([
      'base/files',
    ]);
    expect(await body({})).not.toHaveProperty('revisions');
  });

  it('живого каталога нет — плагины лежат внутри того, что отдаёт интерфейс', async () => {
    const { request, ui } = stand({ livePlugins: false });

    await request('/__reformer-builder/plugins/index.json');

    expect(ui).toHaveBeenCalledTimes(1);
  });
});

describe('интерфейс билдера', () => {
  it('всё остальное под префиксом уходит ему — с тем же запросом', async () => {
    const { request, ui, next } = stand();

    await request('/__reformer-builder/src/main.tsx?t=1');

    expect(ui).toHaveBeenCalledTimes(1);
    expect((ui.mock.calls[0]?.[0] as { url: string }).url).toBe(
      '/__reformer-builder/src/main.tsx?t=1'
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('страница билдера — тоже его', async () => {
    const { request, ui } = stand();

    await request('/__reformer-builder/');

    expect(ui).toHaveBeenCalledTimes(1);
  });
});
