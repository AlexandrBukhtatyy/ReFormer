import { describe, expect, it, vi } from 'vitest';

import { createPromptService } from './prompt';

describe('запрос строки', () => {
  it('ответ оболочки доходит до спрашивающего', async () => {
    const prompt = createPromptService();

    const answer = prompt.input({ titleKey: 'rename', value: 'schema.json' });
    const pending = prompt.current();
    expect(pending?.kind).toBe('input');
    prompt.resolve(pending?.id ?? '', 'model.ts');

    await expect(answer).resolves.toBe('model.ts');
  });

  it('отмена — это null, а не ошибка: человек просто передумал', async () => {
    const prompt = createPromptService();

    const answer = prompt.input({ titleKey: 'rename' });
    prompt.resolve(prompt.current()?.id ?? '', null);

    await expect(answer).resolves.toBeNull();
  });

  it('пустой ключ заголовка — ошибка вызывающего, а не безымянный диалог', () => {
    const prompt = createPromptService();

    expect(() => prompt.input({ titleKey: '  ' })).toThrow();
  });
});

describe('подтверждение', () => {
  it('согласие возвращается как true', async () => {
    const prompt = createPromptService();

    const answer = prompt.confirm({ titleKey: 'delete', tone: 'danger' });
    prompt.resolve(prompt.current()?.id ?? '', true);

    await expect(answer).resolves.toBe(true);
  });

  it('отмена подтверждения — отказ: несделанное действие и есть «нет»', async () => {
    const prompt = createPromptService();

    const answer = prompt.confirm({ titleKey: 'delete' });
    prompt.resolve(prompt.current()?.id ?? '', null);

    await expect(answer).resolves.toBe(false);
  });
});

describe('очередь', () => {
  it('показывается первый запрос; ответ открывает следующий', async () => {
    const prompt = createPromptService();

    const first = prompt.input({ titleKey: 'first' });
    const second = prompt.input({ titleKey: 'second' });

    expect(prompt.current()?.titleKey).toBe('first');
    prompt.resolve(prompt.current()?.id ?? '', 'a');
    await expect(first).resolves.toBe('a');

    expect(prompt.current()?.titleKey).toBe('second');
    prompt.resolve(prompt.current()?.id ?? '', 'b');
    await expect(second).resolves.toBe('b');
    expect(prompt.current()).toBeNull();
  });

  it('ответ чужому идентификатору игнорируется: между отрисовкой и нажатием запрос мог смениться', () => {
    const prompt = createPromptService();

    void prompt.input({ titleKey: 'rename' });
    prompt.resolve('p-999', 'что-то');

    expect(prompt.current()?.titleKey).toBe('rename');
  });

  it('снятие всех запросов отвечает отменой каждому', async () => {
    const prompt = createPromptService();

    const input = prompt.input({ titleKey: 'rename' });
    const confirm = prompt.confirm({ titleKey: 'delete' });
    prompt.cancelAll();

    await expect(input).resolves.toBeNull();
    await expect(confirm).resolves.toBe(false);
    expect(prompt.current()).toBeNull();
  });

  it('переполнение очереди отвечает отменой, а не копит запросы молча', async () => {
    const prompt = createPromptService();
    const answers = Array.from({ length: 20 }, () => prompt.input({ titleKey: 'loop' }));

    // Ждать нечего только у лишних: первые шестнадцать остаются в очереди.
    await expect(answers[19]).resolves.toBeNull();
  });
});

describe('наблюдение', () => {
  it('появление и снятие запроса будят подписчика', () => {
    const prompt = createPromptService();
    const seen = vi.fn();
    prompt.observe(seen);

    void prompt.input({ titleKey: 'rename' });
    expect(seen).toHaveBeenCalledTimes(1);

    prompt.resolve(prompt.current()?.id ?? '', 'x');
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it('снимок текущего запроса стабилен между изменениями', () => {
    const prompt = createPromptService();
    void prompt.input({ titleKey: 'rename' });

    expect(prompt.current()).toBe(prompt.current());
  });
});
