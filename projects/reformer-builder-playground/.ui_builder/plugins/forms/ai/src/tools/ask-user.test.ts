/**
 * `ask_user`: схема вопросов, пересказ ответов модели и честный отказ, когда спрашивать некого.
 *
 * Ожидание ответа здесь не проверяется — его держит мост (`session/bridge.test`).
 *
 * @module plugins/forms/ai/tools/ask-user.test
 */

import { describe, expect, it, vi } from 'vitest';
import type {
  FormAskOutcome as AskOutcome,
  FormAskQuestion as AskQuestion,
  FormToolContext,
  FormToolOutcome,
  FormTurnScope,
} from '@reformer/builder-plugin-api';
import { createToolRegistry } from '@reformer/builder-toolkit/registry';
import { askUserTool, describeAnswers } from './ask-user';

const registry = createToolRegistry<FormToolContext, FormToolOutcome>([askUserTool]);

/** Контекст вызова; `ask` — как мост спросит человека. Инструмент читает только ход. */
function ctxOf(ask?: (questions: readonly AskQuestion[]) => Promise<AskOutcome>): FormToolContext {
  return ask
    ? { turn: { signal: new AbortController().signal, ask } as unknown as FormTurnScope }
    : {};
}

const QUESTION = {
  question: 'Поле обязательное?',
  header: 'Обязательность',
  options: [{ label: 'Да' }, { label: 'Нет', description: 'Можно пропустить' }],
};

describe('ask_user', () => {
  it('вопросы уходят мосту, ответы — модели строкой на вопрос', async () => {
    const ask = vi.fn(() => Promise.resolve<AskOutcome>([{ selected: ['Да'] }]));
    const outcome = await registry.invoke('ask_user', { questions: [QUESTION] }, ctxOf(ask));

    expect(outcome.ok).toBe(true);
    expect(outcome.text).toBe('The user answered:\n1) "Поле обязательное?" → "Да"');
    expect(ask).toHaveBeenCalledWith([
      {
        question: 'Поле обязательное?',
        header: 'Обязательность',
        options: [{ label: 'Да' }, { label: 'Нет', description: 'Можно пропустить' }],
        multiSelect: false,
      },
    ]);
  });

  it('свой ответ и мультивыбор пересказываются словами человека', () => {
    const questions: AskQuestion[] = [
      { question: 'Какие поля?', options: [{ label: 'A' }, { label: 'B' }], multiSelect: true },
      { question: 'Подпись?', options: [{ label: 'X' }, { label: 'Y' }], multiSelect: false },
      { question: 'Ещё?', options: [{ label: 'P' }, { label: 'Q' }], multiSelect: false },
    ];
    expect(
      describeAnswers(questions, [
        { selected: ['A', 'B'] },
        { selected: [], text: 'Телефон для связи' },
        { selected: ['P'], text: 'и подсказку' },
      ])
    ).toBe(
      'The user answered:\n' +
        '1) "Какие поля?" → "A", "B"\n' +
        '2) "Подпись?" → own words: "Телефон для связи"\n' +
        '3) "Ещё?" → "P"; adds: "и подсказку"'
    );
  });

  it('спрашивать некого — отказ «продолжай на допущениях», а не ожидание', async () => {
    const outcome = await registry.invoke('ask_user', { questions: [QUESTION] }, ctxOf());
    expect(outcome.ok).toBe(false);
    expect(outcome.error?.code).toBe('UNAVAILABLE');
    expect(outcome.text).toContain('state your assumptions');
  });

  it('предел вопросов хода — отказ, ход продолжается', async () => {
    const outcome = await registry.invoke(
      'ask_user',
      { questions: [QUESTION] },
      ctxOf(() => Promise.resolve<AskOutcome>('limit'))
    );
    expect(outcome.error?.code).toBe('REFUSED');
  });

  it('один вариант или пять вопросов — не по схеме, карточки нет', async () => {
    const ask = vi.fn(() => Promise.resolve<AskOutcome>([]));
    const single = await registry.invoke(
      'ask_user',
      { questions: [{ question: 'Да?', options: [{ label: 'Да' }] }] },
      ctxOf(ask)
    );
    const many = await registry.invoke(
      'ask_user',
      {
        questions: Array.from({ length: 5 }, (_, i) => ({
          ...QUESTION,
          question: `Q${String(i)}`,
        })),
      },
      ctxOf(ask)
    );
    expect(single.error?.code).toBe('INVALID_PARAMS');
    expect(many.error?.code).toBe('INVALID_PARAMS');
    expect(ask).not.toHaveBeenCalled();
  });

  it('одинаковые варианты или вопросы — отказ: человек их не различит', async () => {
    const ask = vi.fn(() => Promise.resolve<AskOutcome>([]));
    const twins = await registry.invoke(
      'ask_user',
      { questions: [{ question: 'Да?', options: [{ label: 'Да' }, { label: 'Да ' }] }] },
      ctxOf(ask)
    );
    const repeated = await registry.invoke(
      'ask_user',
      { questions: [QUESTION, QUESTION] },
      ctxOf(ask)
    );
    expect(twins.error?.code).toBe('INVALID_PARAMS');
    expect(repeated.error?.code).toBe('INVALID_PARAMS');
    expect(ask).not.toHaveBeenCalled();
  });

  it('слишком длинный вопрос укорачивается, а не отвергается', async () => {
    const ask = vi.fn(() => Promise.resolve<AskOutcome>([{ selected: ['Да'] }]));
    await registry.invoke(
      'ask_user',
      { questions: [{ ...QUESTION, question: 'В'.repeat(500) }] },
      ctxOf(ask)
    );
    const [questions] = ask.mock.calls[0] as unknown as [readonly AskQuestion[]];
    expect(questions[0].question.length).toBe(300);
    expect(questions[0].question.endsWith('…')).toBe(true);
  });
});
