/**
 * Слой файлов плагинов приложения: индекс вместо списка каталога, чтение по адресу.
 *
 * Проверяется то, на что опирается загрузчик: он обходит каталог вопросами «что здесь лежит»
 * и «дай манифест», различая «нет» и «пусто». Отвечай слой на них неточно — плагин домена
 * не нашёлся бы или каждый пробный манифест стоил бы запроса в сеть. И то, что отсутствие слоя —
 * обычное состояние, а не отказ запуска.
 *
 * @module shell/platform/plugin/application/files.test
 */

import { describe, expect, it, vi } from 'vitest';
import { isSourceError } from '@/shell/platform/source/errors';
import {
  createApplicationFiles,
  loadApplicationFiles,
  parseApplicationPluginIndex,
  type ApplicationPluginIndex,
} from './files';

const INDEX: ApplicationPluginIndex = {
  version: 1,
  files: [
    'hello/manifest.json',
    'hello/main.js',
    'forms/kits/manifest.json',
    'forms/kits/main.js',
    'forms/kits/chunks/data.js',
    'forms/preview/manifest.json',
  ],
};

const BASE = 'http://app.test/plugins/';

/** Сеть, отдающая текст по адресу; неизвестный адрес — 404. */
function network(bodies: Record<string, string>) {
  return vi.fn((input: RequestInfo | URL) => {
    const body = bodies[String(input)];
    return Promise.resolve(
      body === undefined ? new Response('нет', { status: 404 }) : new Response(body)
    );
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

const names = (entries: readonly { name: string; kind: string }[]) =>
  entries.map((entry) => `${entry.kind === 'directory' ? '/' : ''}${entry.name}`).sort();

describe('разбор индекса', () => {
  it('принимает известную версию со списком путей', () => {
    expect(parseApplicationPluginIndex(INDEX)).toEqual(INDEX);
  });

  it('чужая версия, не список и не объект — не индекс', () => {
    expect(parseApplicationPluginIndex({ version: 2, files: [] })).toBeNull();
    expect(parseApplicationPluginIndex({ version: 1, files: 'a' })).toBeNull();
    expect(parseApplicationPluginIndex(null)).toBeNull();
    expect(parseApplicationPluginIndex('<!doctype html>')).toBeNull();
  });

  it('путь, выходящий за каталог плагинов, отвергает индекс целиком', () => {
    for (const path of ['../secret.js', '/etc/passwd', 'a//b.js', 'a\\b.js', 'a/./b.js', '']) {
      expect(parseApplicationPluginIndex({ version: 1, files: [path] }), path).toBeNull();
    }
  });
});

describe('список каталога — из индекса', () => {
  const files = createApplicationFiles({ baseUrl: BASE, index: INDEX, fetch: network({}) });

  it('корень слоя: плагины верхнего уровня и каталоги доменов', async () => {
    expect(names(await files.list('plugins'))).toEqual(['/forms', '/hello']);
  });

  it('каталог домена и каталог плагина — уровнями ниже, с путями внутри слоя', async () => {
    expect(names(await files.list('plugins/forms'))).toEqual(['/kits', '/preview']);
    const plugin = await files.list('plugins/forms/kits');
    expect(names(plugin)).toEqual(['/chunks', 'main.js', 'manifest.json']);
    expect(plugin.find((entry) => entry.name === 'main.js')?.path).toBe(
      'plugins/forms/kits/main.js'
    );
  });

  it('каталога нет — отказ «не найдено», а не пустой список', async () => {
    await expect(files.list('plugins/absent')).rejects.toSatisfy((error) =>
      isSourceError(error, 'not-found')
    );
    await expect(files.list('.ui_builder/plugins')).rejects.toSatisfy((error) =>
      isSourceError(error, 'not-found')
    );
  });

  it('пустой индекс — пустой корень, а не отказ', async () => {
    const empty = createApplicationFiles({
      baseUrl: BASE,
      index: { version: 1, files: [] },
      fetch: network({}),
    });
    expect(await empty.list('plugins')).toEqual([]);
  });

  it('слой исполняет код сам: открытый проект для этого не нужен', () => {
    expect(files.capabilities.executesCode).toBe(true);
    expect(files.id).toBe('application');
  });
});

describe('чтение файла — запросом по адресу', () => {
  it('читает файл из индекса по его адресу внутри каталога плагинов', async () => {
    const fetchFn = network({ [`${BASE}forms/kits/main.js`]: 'module.exports = {};' });
    const files = createApplicationFiles({
      baseUrl: 'http://app.test/plugins',
      index: INDEX,
      fetch: fetchFn,
    });

    expect(await files.read('plugins/forms/kits/main.js')).toEqual({
      text: 'module.exports = {};',
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('файла нет в индексе — «не найдено» без запроса в сеть', async () => {
    const fetchFn = network({});
    const files = createApplicationFiles({ baseUrl: BASE, index: INDEX, fetch: fetchFn });

    // Так загрузчик узнаёт каталог домена: манифеста в нём нет.
    await expect(files.read('plugins/forms/manifest.json')).rejects.toSatisfy((error) =>
      isSourceError(error, 'not-found')
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('файл из индекса пропал с сервера — «не найдено»; сбой сети — отказ сети', async () => {
    const gone = createApplicationFiles({ baseUrl: BASE, index: INDEX, fetch: network({}) });
    await expect(gone.read('plugins/hello/main.js')).rejects.toSatisfy((error) =>
      isSourceError(error, 'not-found')
    );

    const offline = createApplicationFiles({
      baseUrl: BASE,
      index: INDEX,
      fetch: (() => Promise.reject(new TypeError('offline'))) as typeof fetch,
    });
    await expect(offline.read('plugins/hello/main.js')).rejects.toSatisfy((error) =>
      isSourceError(error, 'network')
    );
  });
});

describe('слой приложения необязателен', () => {
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

  it('индекс есть — слой собран и читает файлы от того же адреса', async () => {
    const fetchFn = vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        String(input) === `${BASE}index.json` ? json(INDEX) : new Response('{"id":"hello"}')
      )
    ) as unknown as typeof fetch;

    const files = await loadApplicationFiles({ baseUrl: BASE, fetch: fetchFn });

    expect(files).not.toBeNull();
    expect(names(await files!.list('plugins'))).toEqual(['/forms', '/hello']);
    expect((await files!.read('plugins/hello/manifest.json')).text).toBe('{"id":"hello"}');
  });

  it('индекса нет, сеть недоступна, вместо индекса страница приложения — слоя нет', async () => {
    const page = new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } });
    const answers: (() => Promise<Response>)[] = [
      () => Promise.resolve(new Response('нет', { status: 404 })),
      () => Promise.reject(new TypeError('offline')),
      () => Promise.resolve(page),
    ];
    for (const answer of answers) {
      expect(
        await loadApplicationFiles({ baseUrl: BASE, fetch: answer as typeof fetch })
      ).toBeNull();
    }
  });

  it('битый индекс — слоя нет, и об этом сказано', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const files = await loadApplicationFiles({
      baseUrl: BASE,
      fetch: (() => Promise.resolve(json({ version: 7 }))) as typeof fetch,
    });

    expect(files).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
