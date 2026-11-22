/**
 * Клиент реестра — на подставном `fetch`.
 *
 * Сеть здесь не нужна и вредна: проверяется не то, что npmjs.org работает, а то, ЧЕМУ из
 * ответа мы верим. Половина случаев — ответы, которых от честного реестра не бывает: ссылка
 * на чужой хост, пакет без подписи, заголовок с враньём о размере. Настоящая сеть таких
 * не выдаёт по заказу, а именно они здесь и важны.
 *
 * @module shell/platform/plugin/npm/registry.test
 */

import { describe, expect, it, vi } from 'vitest';

import { createNpmRegistryClient, type NpmPackageRef } from './registry';

const REGISTRY = 'https://registry.example.org';

interface VersionDist {
  readonly tarball?: string;
  readonly integrity?: string;
}

/** Пакумент в объёме, который читает клиент. */
function packument(versions: Readonly<Record<string, VersionDist | null>>): string {
  return JSON.stringify({
    name: 'acme-hello',
    versions: Object.fromEntries(
      Object.entries(versions).map(([version, dist]) => [
        version,
        dist === null ? {} : { version, dist },
      ])
    ),
  });
}

const tarballOf = (version: string): VersionDist => ({
  tarball: `${REGISTRY}/acme-hello/-/acme-hello-${version}.tgz`,
  integrity: `sha512-подпись-${version}`,
});

/** `fetch`, отвечающий заготовленным телом на запрос пакумента и байтами на архив. */
function fakeFetch(
  body: string,
  tarball: { bytes?: Uint8Array; status?: number; contentLength?: string } = {}
) {
  // Подпись задана типом, а не параметрами: тело о заголовках не знает, но тест сверяет
  // `Accept` по второму аргументу вызова — и без подписи он был бы `unknown`.
  return vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>((input) => {
    const url = String(input);
    if (url.endsWith('.tgz')) {
      const bytes = tarball.bytes ?? new Uint8Array([1, 2, 3]);
      return Promise.resolve(
        new Response(bytes as BodyInit, {
          status: tarball.status ?? 200,
          headers:
            tarball.contentLength === undefined
              ? undefined
              : { 'content-length': tarball.contentLength },
        })
      );
    }
    return Promise.resolve(new Response(body, { status: 200 }));
  });
}

const clientWith = (fetch: ReturnType<typeof fakeFetch>, sizeLimit?: number) =>
  createNpmRegistryClient({
    registry: REGISTRY,
    fetch: fetch as unknown as typeof globalThis.fetch,
    ...(sizeLimit === undefined ? {} : { sizeLimit }),
  });

describe('выбор версии', () => {
  it('берёт максимальную подходящую под диапазон', async () => {
    const fetch = fakeFetch(
      packument({
        '1.0.0': tarballOf('1.0.0'),
        '1.4.2': tarballOf('1.4.2'),
        '2.0.0': tarballOf('2.0.0'),
      })
    );

    const result = await clientWith(fetch).resolve('acme-hello', '^1');

    expect(result.ok && result.value).toMatchObject({
      version: '1.4.2',
      integrity: 'sha512-подпись-1.4.2',
    });
  });

  it('просит СОКРАЩЁННЫЙ пакумент: полный — мегабайты ради трёх полей', async () => {
    const fetch = fakeFetch(packument({ '1.0.0': tarballOf('1.0.0') }));

    await clientWith(fetch).resolve('acme-hello', '^1');

    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      headers: { Accept: 'application/vnd.npm.install-v1+json' },
    });
  });

  it('область кодируется так, как требует реестр', async () => {
    const fetch = fakeFetch(packument({ '1.0.0': tarballOf('1.0.0') }));

    await clientWith(fetch).resolve('@acme/hello', '^1');

    expect(String(fetch.mock.calls[0]?.[0])).toBe(`${REGISTRY}/@acme%2fhello`);
  });

  it('нет версии под диапазон — отдельная причина, а не «пакета нет»', async () => {
    const fetch = fakeFetch(packument({ '2.0.0': tarballOf('2.0.0') }));

    const result = await clientWith(fetch).resolve('acme-hello', '^1');

    expect(result.ok || result.problem.code).toBe('no-version');
  });
});

describe('чему из ответа не верим', () => {
  it('архив на чужом хосте — отказ, хотя подпись на месте', async () => {
    // Подпись приезжает ТЕМ ЖЕ ответом, поэтому чужой хост отдал бы другой архив вместе
    // с подписью к нему, и проверка подписи перестала бы что-либо значить.
    const fetch = fakeFetch(
      packument({
        '1.0.0': { tarball: 'https://cdn.example.net/acme-hello.tgz', integrity: 'sha512-x' },
      })
    );

    const result = await clientWith(fetch).resolve('acme-hello', '^1');

    expect(result.ok || result.problem.code).toBe('untrusted');
    expect(result.ok || result.problem.message).toContain('cdn.example.net');
  });

  it('пакет без подписи не устанавливается', async () => {
    const fetch = fakeFetch(
      packument({ '1.0.0': { tarball: `${REGISTRY}/acme-hello/-/acme-hello-1.0.0.tgz` } })
    );

    const result = await clientWith(fetch).resolve('acme-hello', '^1');

    expect(result.ok || result.problem.code).toBe('untrusted');
    expect(result.ok || result.problem.message).toContain('подписи');
  });

  it('имя пакета проверяется ДО запроса', async () => {
    const fetch = fakeFetch('{}');

    const result = await clientWith(fetch).resolve('../../etc/passwd', '^1');

    expect(result.ok || result.problem.code).toBe('package-name');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('404 и прочий отказ реестра различаются', async () => {
    // «Пакета нет» чинится другим действием, чем «реестр лежит»: первое — опечаткой в имени,
    // второе — ожиданием. Один код на оба оставил бы человека гадать, что делать.
    const status = async (code: number) => {
      const fetch = vi.fn(() => Promise.resolve(new Response('', { status: code })));
      return clientWith(fetch as never).resolve('acme-hello', '^1');
    };

    expect(await status(404)).toMatchObject({ problem: { code: 'not-found' } });
    expect(await status(503)).toMatchObject({ problem: { code: 'network' } });
  });
});

describe('скачивание', () => {
  const ref: NpmPackageRef = {
    name: 'acme-hello',
    version: '1.0.0',
    tarball: `${REGISTRY}/acme-hello/-/acme-hello-1.0.0.tgz`,
    integrity: 'sha512-x',
  };

  it('отдаёт байты как есть: подпись сверяет разбор пакета, а не клиент', async () => {
    const bytes = new Uint8Array([7, 7, 7]);
    const result = await clientWith(fakeFetch('{}', { bytes })).download(ref);

    expect(result.ok && [...result.value]).toEqual([7, 7, 7]);
  });

  it('Content-Length больше потолка — отказ до чтения тела', async () => {
    const fetch = fakeFetch('{}', { contentLength: String(50 * 1024 * 1024) });

    const result = await clientWith(fetch).download(ref);

    expect(result.ok || result.problem.code).toBe('too-large');
  });

  it('соврал заголовок — ловит фактический размер', async () => {
    // Заголовок пишет та же сторона, что и архив: верить ему на слово значит согласиться
    // качать сколько дадут.
    const fetch = fakeFetch('{}', { bytes: new Uint8Array(200), contentLength: '10' });

    const result = await clientWith(fetch, 100).download(ref);

    expect(result.ok || result.problem.code).toBe('too-large');
  });

  it('сеть отвалилась — отказ данными, а не исключение', async () => {
    const fetch = vi.fn(() => Promise.reject(new Error('нет сети')));

    const result = await clientWith(fetch as never).download(ref);

    expect(result.ok || result.problem.code).toBe('network');
    expect(result.ok || result.problem.message).toContain('нет сети');
  });
});
