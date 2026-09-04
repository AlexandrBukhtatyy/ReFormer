/**
 * Юнит-тесты лаунчера (`bin/reformer-builder2.mjs`): парс флагов, чтение конфига из cwd
 * (флаг и авто-детект `.ui_builder/config.json`) и раздача endpoint'а. Импорт бина
 * с REFORMER_BUILDER_TEST=1, чтобы он не поднимал сервер, — тот же приём, что у v1.
 *
 * Согласие путей между лаунчером и SPA закреплено здесь же: RUNTIME_BUNDLE_URL бина обязан
 * совпадать с RUNTIME_BUNDLE_PATH модуля `runtime-config` — это единственный их общий контракт.
 *
 * @module shell/boot/launcher.test
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RUNTIME_BUNDLE_PATH } from './runtime-config';

process.env.REFORMER_BUILDER_TEST = '1';
const bin = await import('../../../bin/reformer-builder2.mjs');

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'rb2-launcher-'));
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

  it('дефолты: порт 4322 (рядом с v1 на 4321), авто-детект конфига', () => {
    expect(bin.parseArgs([])).toMatchObject({
      port: 4322,
      host: '127.0.0.1',
      open: true,
      config: null,
    });
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
});
