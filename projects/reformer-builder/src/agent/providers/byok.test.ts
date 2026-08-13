import { afterEach, describe, expect, it, vi } from 'vitest';
import { createByokProvider, listModels } from './byok';
import type { ProviderConfig } from '../keys';

/** Подменить fetch и запомнить, с чем его позвали. */
function stubFetch(
  response: { ok: boolean; status?: number; body?: unknown },
  calls: Array<{ url: string; headers: Record<string, string> }> = []
) {
  vi.stubGlobal('fetch', (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url, headers: init?.headers ?? {} });
    return Promise.resolve({
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 401),
      statusText: response.ok ? 'OK' : 'Unauthorized',
      json: () => Promise.resolve(response.body ?? {}),
    });
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listModels', () => {
  it('разбирает ответ и сортирует идентификаторы', async () => {
    stubFetch({ ok: true, body: { data: [{ id: 'b-model' }, { id: 'a-model' }] } });
    const config: ProviderConfig = { kind: 'openai', apiKey: 'sk-test' };
    await expect(listModels(config)).resolves.toEqual(['a-model', 'b-model']);
  });

  it('отбрасывает записи без идентификатора', async () => {
    stubFetch({ ok: true, body: { data: [{ id: 'ok' }, {}, { id: '' }] } });
    await expect(listModels({ kind: 'openai', apiKey: 'k' })).resolves.toEqual(['ok']);
  });

  it('неуспешный ответ превращается в ошибку с кодом', async () => {
    stubFetch({ ok: false, status: 401 });
    await expect(listModels({ kind: 'openai', apiKey: 'bad' })).rejects.toThrow(/401/);
  });

  it('Anthropic зовётся с заголовком прямого доступа из браузера', async () => {
    const calls = stubFetch({ ok: true, body: { data: [] } });
    await listModels({ kind: 'anthropic', apiKey: 'sk-ant' });
    expect(calls[0].url).toBe('https://api.anthropic.com/v1/models');
    expect(calls[0].headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(calls[0].headers['x-api-key']).toBe('sk-ant');
    // Ключ Anthropic передаётся своим заголовком, а не Bearer.
    expect(calls[0].headers.authorization).toBeUndefined();
  });

  it('OpenAI зовётся с Bearer', async () => {
    const calls = stubFetch({ ok: true, body: { data: [] } });
    await listModels({ kind: 'openai', apiKey: 'sk-oa' });
    expect(calls[0].url).toBe('https://api.openai.com/v1/models');
    expect(calls[0].headers.authorization).toBe('Bearer sk-oa');
  });

  it('локальный сервер берёт адрес из настроек, хвостовой слеш не задваивается', async () => {
    const calls = stubFetch({ ok: true, body: { data: [] } });
    await listModels({ kind: 'openai-compatible', baseUrl: 'http://localhost:1234/v1/' });
    expect(calls[0].url).toBe('http://localhost:1234/v1/models');
  });
});

describe('createByokProvider', () => {
  it('без ключа облачный канал недоступен и объясняет почему', async () => {
    const provider = createByokProvider({ kind: 'anthropic' });
    await expect(provider.detect()).resolves.toEqual({
      available: false,
      reason: 'Не задан ключ API.',
    });
  });

  it('локальный канал без ключа проверяется запросом, а не отвергается заранее', async () => {
    stubFetch({ ok: true, body: { data: [{ id: 'llama' }] } });
    const provider = createByokProvider({ kind: 'openai-compatible' });
    await expect(provider.detect()).resolves.toEqual({ available: true });
  });

  it('недоступный канал возвращает причину, а не бросает', async () => {
    stubFetch({ ok: false, status: 403 });
    const provider = createByokProvider({ kind: 'openai', apiKey: 'bad' });
    const detection = await provider.detect();
    expect(detection.available).toBe(false);
    expect(detection.reason).toContain('403');
  });

  it('канал заявляет tool-calling: без него правки схемы невозможны', () => {
    const provider = createByokProvider({ kind: 'anthropic', apiKey: 'k', model: 'm' });
    expect(provider.capabilities().tools).toBe(true);
    expect(provider.origin).toBe('browser');
    expect(createByokProvider({ kind: 'openai-compatible' }).origin).toBe('loopback');
  });

  it('имя канала показывает выбранную модель', () => {
    expect(
      createByokProvider({ kind: 'openai', apiKey: 'k', model: 'gpt-x' }).displayName
    ).toContain('gpt-x');
  });
});
