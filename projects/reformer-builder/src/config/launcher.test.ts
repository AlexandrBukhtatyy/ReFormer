/**
 * Юнит-тесты launcher'а (`bin/reformer-builder.mjs`): парс новых флагов, сборка runtime-bundle из
 * файлов (флаги/авто-детект) и раздача endpoint'а. Импорт бина с REFORMER_BUILDER_TEST=1, чтобы он
 * не поднимал сервер.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.REFORMER_BUILDER_TEST = '1';
const bin = await import('../../bin/reformer-builder.mjs');

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'rb-launcher-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('parseArgs — новые флаги', () => {
  it('--catalog/--config (пробел и =-форма) + --no-open/--port', () => {
    expect(bin.parseArgs(['--catalog', 'c.json', '--config', 'b.json', '--no-open'])).toMatchObject(
      { catalog: 'c.json', config: 'b.json', open: false }
    );
    expect(
      bin.parseArgs(['--catalog=x/c.json', '--config=y/b.json', '--port', '5000'])
    ).toMatchObject({ catalog: 'x/c.json', config: 'y/b.json', port: 5000 });
  });

  it('дефолт — пути не заданы (авто-детект в cwd)', () => {
    expect(bin.parseArgs([])).toMatchObject({ catalog: null, config: null, open: true });
  });
});

describe('loadRuntimeBundle', () => {
  it('авто-детект одноимённых файлов в cwd', async () => {
    await writeFile(
      join(dir, 'component-catalog.json'),
      JSON.stringify({ version: '3.3', components: [] })
    );
    await writeFile(
      join(dir, 'reformer-builder.config.json'),
      JSON.stringify({ ui: { theme: 'dark' } })
    );
    const { payload, sources } = await bin.loadRuntimeBundle({ catalog: null, config: null }, dir);
    expect(payload.catalog).toEqual({ version: '3.3', components: [] });
    expect(payload.config).toEqual({ ui: { theme: 'dark' } });
    expect(sources.catalog).toBe(join(dir, 'component-catalog.json'));
    expect(sources.config).toBe(join(dir, 'reformer-builder.config.json'));
  });

  it('явный флаг с относительным путём резолвится от cwd', async () => {
    await writeFile(join(dir, 'custom.json'), JSON.stringify({ version: '4.4', components: [] }));
    const { payload } = await bin.loadRuntimeBundle({ catalog: 'custom.json', config: null }, dir);
    expect(payload.catalog).toEqual({ version: '4.4', components: [] });
  });

  it('нет файлов (авто-детект) → пустой bundle, без падения', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'rb-empty-'));
    const { payload, sources } = await bin.loadRuntimeBundle(
      { catalog: null, config: null },
      empty
    );
    expect(payload).toEqual({ catalog: null, config: null });
    expect(sources).toEqual({ catalog: null, config: null });
    await rm(empty, { recursive: true, force: true });
  });
});

describe('createRequestHandler — endpoint runtime.json', () => {
  it('отдаёт bundle-body с application/json по RUNTIME_BUNDLE_URL', async () => {
    const body = Buffer.from(JSON.stringify({ catalog: null, config: { ui: { theme: 'dark' } } }));
    const handler = bin.createRequestHandler('/does/not/matter/index.html', body);

    let status = 0;
    let headers: Record<string, unknown> = {};
    let ended: unknown;
    const res = {
      writeHead(code: number, h: Record<string, unknown>) {
        status = code;
        headers = h;
      },
      end(chunk: unknown) {
        ended = chunk;
      },
    };
    await handler({ method: 'GET', url: bin.RUNTIME_BUNDLE_URL }, res);

    expect(status).toBe(200);
    expect(String(headers['Content-Type'])).toContain('application/json');
    expect(JSON.parse(String(ended))).toEqual({ catalog: null, config: { ui: { theme: 'dark' } } });
  });
});
