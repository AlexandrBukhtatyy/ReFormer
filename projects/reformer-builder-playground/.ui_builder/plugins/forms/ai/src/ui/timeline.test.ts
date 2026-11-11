/**
 * Блоки реплики идут в порядке хода: итог — под журналом правок, пояснение — над вызовом.
 *
 * @module plugins/forms/ai/ui/timeline.test
 */

import { describe, expect, it } from 'vitest';
import type { FormAskQuestion } from '@reformer/builder-plugin-api';
import { createAiSession, type ChatEntry } from '../session/session';
import { timelineOf, type EntryBlock } from './timeline';

const question: FormAskQuestion = {
  question: 'Телефон обязателен?',
  options: [{ label: 'Да' }, { label: 'Нет' }],
  multiSelect: false,
};

/** Блоки коротко: текст — как есть, вызовы — именами, вопрос — идентификатором карточки. */
const shape = (blocks: readonly EntryBlock[]): readonly string[] =>
  blocks.map((block) => {
    if (block.kind === 'text') return block.text;
    if (block.kind === 'tools') return `[${block.tools.map((tool) => tool.name).join(', ')}]`;
    return `?${block.card.id}`;
  });

/** Реплика ассистента после ходов, записанных через настоящую сессию. */
function answerAfter(play: (session: ReturnType<typeof createAiSession>) => void): ChatEntry {
  const session = createAiSession();
  session.startTurn('сделай форму');
  play(session);
  const last = session.get().entries.at(-1);
  if (last === undefined) throw new Error('реплики нет');
  return last;
}

describe('порядок блоков реплики', () => {
  it('итог, написанный после вызовов, стоит под журналом', () => {
    const entry = answerAfter((session) => {
      session.logTool({ name: 'create_form', ok: true });
      session.logTool({ name: 'insert_node', ok: false });
      session.appendText('Форма создана.', true);
    });
    expect(shape(timelineOf(entry))).toEqual(['[create_form, insert_node]', 'Форма создана.']);
  });

  it('пояснение перед вызовом — над ним, ответ следующего шага — под ним', () => {
    const entry = answerAfter((session) => {
      session.appendText('Сначала добавлю поле.', true);
      session.logTool({ name: 'insert_node', ok: true });
      session.appendText('Готово.', true);
    });
    expect(entry.text).toBe('Сначала добавлю поле.\n\nГотово.');
    expect(shape(timelineOf(entry))).toEqual(['Сначала добавлю поле.', '[insert_node]', 'Готово.']);
  });

  it('вопрос стоит между вызовами, сделанными до и после ответа', () => {
    const entry = answerAfter((session) => {
      session.logTool({ name: 'read_form', ok: true });
      session.askQuestions({ id: 'ask1', questions: [question] });
      session.logTool({ name: 'insert_node', ok: true });
      session.appendText('Добавил.', true);
    });
    expect(shape(timelineOf(entry))).toEqual(['[read_form]', '?ask1', '[insert_node]', 'Добавил.']);
  });

  it('ответ на вопрос остаётся в карточке на её месте', () => {
    const session = createAiSession();
    session.startTurn('сделай форму');
    session.askQuestions({ id: 'ask1', questions: [question] });
    session.answerAsk('ask1', [{ selected: ['Да'] }]);
    const entry = session.get().entries.at(-1);
    const blocks = entry ? timelineOf(entry) : [];
    expect(blocks).toEqual([
      {
        kind: 'ask',
        card: { id: 'ask1', questions: [question], answers: [{ selected: ['Да'] }] },
      },
    ]);
  });

  it('пустая реплика в начале хода блоков не даёт', () => {
    expect(timelineOf(answerAfter(() => undefined))).toEqual([]);
  });

  it('реплика без меток — прежний порядок: вопросы, текст, журнал', () => {
    const entry: ChatEntry = {
      id: 'm2',
      role: 'assistant',
      text: 'Готово.',
      reasoning: '',
      tools: [{ name: 'insert_node', ok: true }],
      asks: [{ id: 'ask1', questions: [question] }],
    };
    expect(shape(timelineOf(entry))).toEqual(['?ask1', 'Готово.', '[insert_node]']);
  });
});
