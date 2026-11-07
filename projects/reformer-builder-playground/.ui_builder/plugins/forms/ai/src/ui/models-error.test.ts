import { describe, expect, it } from 'vitest';
import { modelsErrorText } from './models-error';
import type { Translate } from '../host';

/** Перевод, который показывает ключ и параметры: проверяется выбор подсказки, а не её текст. */
const t: Translate = (key, params) => `${key} ${JSON.stringify(params ?? {})}`;

const PAGE = 'https://alexandrbukhtatyy.github.io';

describe('modelsErrorText', () => {
  it('локальный канал: отказ по 403 — подсказка с адресом страницы', () => {
    const text = modelsErrorText(new Error('403 Forbidden'), 'openai-compatible', PAGE, t);
    expect(text).toBe(
      `settings.localUnreachable ${JSON.stringify({ origin: PAGE, error: '403 Forbidden' })}`
    );
  });

  it('локальный канал: ответа нет (CORS, сервер не запущен) — та же подсказка', () => {
    const text = modelsErrorText(new TypeError('Failed to fetch'), 'openai-compatible', PAGE, t);
    expect(text).toContain('settings.localUnreachable');
    expect(text).toContain('Failed to fetch');
  });

  it('локальный канал: прочие ответы сервера — как есть', () => {
    expect(
      modelsErrorText(new Error('500 Internal Server Error'), 'openai-compatible', PAGE, t)
    ).toBe('500 Internal Server Error');
  });

  it('облачный канал: без подсказки, даже на 403 и сетевой сбой', () => {
    expect(modelsErrorText(new Error('403 Forbidden'), 'openai', PAGE, t)).toBe('403 Forbidden');
    expect(modelsErrorText(new TypeError('Failed to fetch'), 'anthropic', PAGE, t)).toBe(
      'Failed to fetch'
    );
  });

  it('не-Error приводится к строке', () => {
    expect(modelsErrorText('boom', 'openai', PAGE, t)).toBe('boom');
  });
});
