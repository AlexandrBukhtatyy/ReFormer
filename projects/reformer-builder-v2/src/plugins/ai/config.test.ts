/**
 * Настройки канала: разбор пределов и — главное — разделение «настройки / секрет».
 *
 * Второй набор проверок в v1 был невозможен: там весь объект вместе с ключом уходил одной записью
 * в `localStorage`. Здесь проверяется ровно то, ради чего хранилище переделывали, — что ключ не
 * попадает в обычное хранилище НИ ПРИ КАКИХ настройках, а по умолчанию не переживает и сессию.
 *
 * @module plugins/ai/config.test
 */

import { describe, expect, it } from 'vitest';
import {
  API_KEY_SECRET,
  clearProviderConfig,
  limitsFrom,
  loadProviderConfig,
  saveProviderConfig,
  SETTINGS_KEY,
  type ConfigStore,
} from './config';

/**
 * Двойник хранилища плагина: две раздельные карты плюс отметка о том, просили ли `persist`.
 *
 * Память сессии и постоянная копия здесь одно и то же — разделение проверяет `host/plugin/storage`,
 * а нас интересует, ЧТО куда положили и с каким флагом.
 */
function store(): ConfigStore & {
  data: Map<string, unknown>;
  secrets_: Map<string, string>;
  persisted: boolean | undefined;
} {
  const data = new Map<string, unknown>();
  const secrets_ = new Map<string, string>();
  const self = {
    data,
    secrets_,
    persisted: undefined as boolean | undefined,
    storage: {
      get: <T>(key: string) => Promise.resolve(data.get(key) as T | undefined),
      set: <T>(key: string, value: T) => {
        data.set(key, value);
        return Promise.resolve();
      },
      delete: (key: string) => {
        data.delete(key);
        return Promise.resolve();
      },
    },
    secrets: {
      get: (key: string) => Promise.resolve(secrets_.get(key)),
      set: (key: string, value: string, opts?: { persist?: boolean }) => {
        secrets_.set(key, value);
        self.persisted = opts?.persist === true;
        return Promise.resolve();
      },
      delete: (key: string) => {
        secrets_.delete(key);
        return Promise.resolve();
      },
    },
  };
  return self;
}

describe('хранение настроек канала', () => {
  it('ключ уходит в секреты, всё остальное — в обычное хранилище', async () => {
    const s = store();
    await saveProviderConfig(s, { kind: 'anthropic', model: 'claude-x', apiKey: 'sk-секрет' });

    expect(s.secrets_.get(API_KEY_SECRET)).toBe('sk-секрет');
    // Ровно то, что переделывали: в обычном хранилище ключа нет ни под каким именем.
    expect(JSON.stringify([...s.data.values()])).not.toContain('sk-секрет');
    expect(s.data.get(SETTINGS_KEY)).toEqual({ kind: 'anthropic', model: 'claude-x' });
  });

  it('по умолчанию ключ не переживает перезагрузку — persist надо попросить', async () => {
    const s = store();
    await saveProviderConfig(s, { kind: 'openai', apiKey: 'k' });
    expect(s.persisted).toBe(false);

    await saveProviderConfig(s, { kind: 'openai', apiKey: 'k' }, { persistKey: true });
    expect(s.persisted).toBe(true);
  });

  it('пустой ключ СТИРАЕТ секрет, а не пишет пустую строку', async () => {
    const s = store();
    await saveProviderConfig(s, { kind: 'openai', apiKey: 'k' });
    await saveProviderConfig(s, { kind: 'openai' });
    expect(s.secrets_.has(API_KEY_SECRET)).toBe(false);
  });

  it('чтение склеивает настройки с ключом', async () => {
    const s = store();
    await saveProviderConfig(s, { kind: 'openai-compatible', model: 'qwen', apiKey: 'ollama' });
    expect(await loadProviderConfig(s)).toEqual({
      kind: 'openai-compatible',
      model: 'qwen',
      apiKey: 'ollama',
    });
  });

  it('настройки без ключа — законное состояние, а не отсутствие настроек', async () => {
    // Сессия кончилась, секрет ушёл, настройки остались. Канал при этом поднимается: у локального
    // сервера ключ не нужен вовсе, а у платного об отсутствии скажет detect().
    const s = store();
    await saveProviderConfig(s, { kind: 'openai', model: 'gpt-x', apiKey: 'k' });
    s.secrets_.clear();
    expect(await loadProviderConfig(s)).toEqual({ kind: 'openai', model: 'gpt-x' });
  });

  it('пустое и испорченное хранилище дают null, а не мусор в настройках', async () => {
    const s = store();
    expect(await loadProviderConfig(s)).toBeNull();
    // Записала прежняя версия плагина: вид канала не тот, которого мы ждём.
    s.data.set(SETTINGS_KEY, { kind: 'llama.cpp' });
    expect(await loadProviderConfig(s)).toBeNull();
  });

  it('очистка забывает и настройки, и ключ', async () => {
    const s = store();
    await saveProviderConfig(s, { kind: 'anthropic', apiKey: 'k' }, { persistKey: true });
    await clearProviderConfig(s);
    expect(await loadProviderConfig(s)).toBeNull();
    expect(s.secrets_.size).toBe(0);
  });
});

describe('limitsFrom', () => {
  it('пустые поля не заводят ключей — это «без предела», а не ноль', () => {
    // Ключ со значением 0 прочитался бы как «ноль шагов»: ход остановился бы, не начавшись, а
    // ответ оборвался бы на первом токене. Отсутствие ключа и ноль здесь — противоположности.
    expect(limitsFrom({ maxSteps: '', maxOutputTokens: '', maxInputTokens: '' })).toEqual({});
  });

  it('отсутствующее поле равносильно пустому', () => {
    expect(limitsFrom({})).toEqual({});
  });

  it('ноль и отрицательное значение — тоже «без предела»', () => {
    expect(limitsFrom({ maxSteps: '0', maxOutputTokens: '0', maxInputTokens: '0' })).toEqual({});
    expect(limitsFrom({ maxSteps: '-5', maxInputTokens: '-100' })).toEqual({});
  });

  it('нечисловой ввод не превращается в NaN в настройках', () => {
    expect(limitsFrom({ maxSteps: 'много', maxOutputTokens: 'не знаю' })).toEqual({});
  });

  it('заданные пределы доходят числами', () => {
    expect(
      limitsFrom({ maxSteps: '40', maxOutputTokens: '8192', maxInputTokens: '400000' })
    ).toEqual({ maxSteps: 40, maxOutputTokens: 8192, maxInputTokens: 400000 });
  });

  it('поля независимы: одно задано, другие нет', () => {
    expect(limitsFrom({ maxSteps: '12' })).toEqual({ maxSteps: 12 });
    expect(limitsFrom({ maxInputTokens: '250000' })).toEqual({ maxInputTokens: 250000 });
  });

  it('пробелы вокруг числа не мешают', () => {
    expect(limitsFrom({ maxSteps: ' 24 ', maxOutputTokens: ' 2048 ' })).toEqual({
      maxSteps: 24,
      maxOutputTokens: 2048,
    });
  });
});
