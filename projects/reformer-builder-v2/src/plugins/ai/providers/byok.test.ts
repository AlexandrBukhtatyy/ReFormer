import { afterEach, describe, expect, it, vi } from 'vitest';
import { createByokProvider, listModels, tuningOf } from './byok';
import type { ProviderConfig } from '../config';

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
      reason: 'provider.noApiKey',
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

describe('чем канал удешевляет ход', () => {
  it('Anthropic помечает префикс — иначе три тысячи токенов оплачиваются каждый шаг', () => {
    expect(tuningOf({ kind: 'anthropic' }).cacheBreakpoints).toBe(true);
    expect(tuningOf({ kind: 'anthropic' }).promptCacheKey).toBeUndefined();
  });

  it('OpenAI кэширует сам, ему нужен только общий ключ разговора', () => {
    const tuning = tuningOf({ kind: 'openai' });
    expect(tuning.cacheBreakpoints).toBe(false);
    expect(tuning.promptCacheKey).toBeTruthy();
    // Ключ уходит на сервер как есть, поэтому в нём не должно быть ничего, кроме случайного id.
    expect(tuning.promptCacheKey).toMatch(/^rb-[a-z0-9]+$/);
  });

  it('ключ кэша один на сессию — иначе автокэш промахивается каждый ход', () => {
    expect(tuningOf({ kind: 'openai' }).promptCacheKey).toBe(
      tuningOf({ kind: 'openai' }).promptCacheKey
    );
  });

  it('локальный канал не повторяет запрос дважды', () => {
    // Не ответивший localhost не оживёт ни через две секунды, ни через четыре: повторы здесь —
    // это шесть секунд мёртвого времени на шаг, а не запас надёжности.
    expect(tuningOf({ kind: 'openai-compatible' }).maxRetries).toBe(1);
    expect(tuningOf({ kind: 'openai-compatible' }).cacheBreakpoints).toBe(false);
  });

  it('потолок ответа по умолчанию не задан — его ставит пользователь, а не мы', () => {
    // Зашитое число обрывало ответ think-модели на полуслове: рассуждение съедало вывод целиком,
    // и ход заканчивался по `length`, не дойдя до правок.
    for (const kind of ['anthropic', 'openai', 'openai-compatible'] as const) {
      expect(tuningOf({ kind }).maxOutputTokens).toBeUndefined();
    }
  });

  it('заданный потолок доходит до канала', () => {
    expect(tuningOf({ kind: 'anthropic', maxOutputTokens: 4096 }).maxOutputTokens).toBe(4096);
  });
});
