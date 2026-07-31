import { afterEach, describe, expect, it, vi } from 'vitest';
import { getClientCatalog, getRuntimeConfig, resetRuntimeState } from './state';
import { loadRuntimeBundle, RuntimeBundleError, validateRuntimeConfig } from './load';

/** Response-подобная заглушка для мока fetch. */
function jsonResponse(body: unknown, contentType = 'application/json') {
  return {
    ok: true,
    headers: { get: () => contentType },
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  resetRuntimeState();
  vi.unstubAllGlobals();
});

describe('validateRuntimeConfig', () => {
  it('пустой конфиг валиден', () => {
    expect(validateRuntimeConfig({}).valid).toBe(true);
  });

  it('полный валидный конфиг проходит', () => {
    const res = validateRuntimeConfig({
      version: '1.0',
      branding: { productName: 'Acme', title: 'Acme Forms' },
      palette: { order: ['Поля ввода'], collapsedByDefault: ['HTML'], glyphs: { X: 'Xx' } },
      components: { exclude: ['Chart'], synthetic: { wizard: false, htmlTags: ['div'] } },
      ui: { theme: 'dark', leftPanel: null, rightOpen: false, preview: 'code' },
      project: { ignoreDirs: ['fixtures'], seedSchema: null },
    });
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it('неизвестный ключ отклоняется (additionalProperties: false)', () => {
    expect(validateRuntimeConfig({ paletteX: {} }).valid).toBe(false);
  });

  it('невалидный enum отклоняется', () => {
    expect(validateRuntimeConfig({ ui: { theme: 'neon' } }).valid).toBe(false);
    expect(validateRuntimeConfig({ ui: { preview: 'nope' } }).valid).toBe(false);
  });
});

describe('loadRuntimeBundle — fallback без launcher', () => {
  it('сетевой сбой fetch → дефолты, без throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    await expect(loadRuntimeBundle()).resolves.toBeUndefined();
    expect(getRuntimeConfig()).toEqual({});
    expect(getClientCatalog()).toBeNull();
  });

  it('404 → дефолты', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response));
    await loadRuntimeBundle();
    expect(getRuntimeConfig()).toEqual({});
  });

  it('не-JSON ответ (dev/hosted SPA-fallback) → дефолты', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse('<html>', 'text/html')));
    await loadRuntimeBundle();
    expect(getRuntimeConfig()).toEqual({});
  });
});

describe('loadRuntimeBundle — применение bundle', () => {
  it('валидный конфиг применяется', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ config: { ui: { theme: 'dark' } }, catalog: null }))
    );
    await loadRuntimeBundle();
    expect(getRuntimeConfig().ui?.theme).toBe('dark');
  });

  it('валидный клиентский каталог применяется', async () => {
    const catalog = { version: '9.9', components: [{ name: 'X', role: 'field', propsSchema: {} }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ config: null, catalog })));
    await loadRuntimeBundle();
    expect(getClientCatalog()?.version).toBe('9.9');
  });

  it('невалидный конфиг → RuntimeBundleError(source=config)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ config: { ui: { theme: 'neon' } }, catalog: null }))
    );
    await expect(loadRuntimeBundle()).rejects.toBeInstanceOf(RuntimeBundleError);
    await expect(loadRuntimeBundle()).rejects.toMatchObject({ source: 'config' });
  });

  it('невалидный каталог → RuntimeBundleError(source=catalog)', async () => {
    // role вне enum контракта каталога.
    const bad = { version: '1.0', components: [{ name: 'X', role: 'widget', propsSchema: {} }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ config: null, catalog: bad })));
    await expect(loadRuntimeBundle()).rejects.toMatchObject({ source: 'catalog' });
  });
});
