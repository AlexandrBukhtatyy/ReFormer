import { describe, expect, it } from 'vitest';
import type { ModelMessage } from 'ai';
import { dropReasoning, pruneSupersededReads } from './context';

const READS = new Set(['get_form_outline', 'describe_component']);
const isReadOnly = (name: string) => READS.has(name);

/** Шаг «модель позвала инструмент» и «инструмент ответил» — как их складывает SDK. */
function step(callId: string, tool: string, input: unknown, output: string): ModelMessage[] {
  return [
    {
      role: 'assistant',
      content: [{ type: 'tool-call', toolCallId: callId, toolName: tool, input }],
    },
    {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: callId,
          toolName: tool,
          output: { type: 'text', value: output },
        },
      ],
    },
  ];
}

/** Все результаты инструментов подряд — по ним проверяется, что пары не порвались. */
function results(messages: readonly ModelMessage[]) {
  return messages
    .filter((m) => m.role === 'tool')
    .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
    .filter((p) => p.type === 'tool-result');
}

describe('dropReasoning', () => {
  it('выбрасывает рассуждение, сохраняя вызовы инструментов', () => {
    // Самая крупная статья расхода: в живом захвате reasoning занимал 28 КБ из 51 КБ запроса.
    const out = dropReasoning([
      { role: 'user', content: 'добавь поле' },
      {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'Долго думаю, какое поле выбрать…' },
          { type: 'tool-call', toolCallId: 'c1', toolName: 'insert_node', input: {} },
        ],
      },
    ]);

    const assistant = out[1];
    expect(Array.isArray(assistant.content) && assistant.content).toHaveLength(1);
    expect(JSON.stringify(out)).not.toContain('Долго думаю');
    expect(JSON.stringify(out)).toContain('insert_node');
  });

  it('реплика из одного рассуждения исчезает целиком, а не превращается в пустую', () => {
    // Ассистентское сообщение без частей ломает схему запроса — это отказ API, а не мелочь.
    const out = dropReasoning([
      { role: 'user', content: 'привет' },
      { role: 'assistant', content: [{ type: 'reasoning', text: 'размышляю' }] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].role).toBe('user');
  });

  it('текстовые реплики не трогает', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'привет' },
      { role: 'assistant', content: 'готово' },
    ];
    expect(dropReasoning(messages)).toEqual(messages);
  });
});

describe('pruneSupersededReads', () => {
  it('оставляет последнее чтение, прежние схлопывает', () => {
    // Восемь одинаковых get_form_outline за ход — реальный случай, и все восемь ответов лежали в
    // контексте до конца хода.
    const messages = [
      ...step('c1', 'get_form_outline', {}, 'КАРТА ПЕРВАЯ'),
      ...step('c2', 'get_form_outline', {}, 'КАРТА ВТОРАЯ'),
      ...step('c3', 'get_form_outline', {}, 'КАРТА ТРЕТЬЯ'),
    ];
    const text = JSON.stringify(pruneSupersededReads(messages, isReadOnly));

    expect(text).not.toContain('КАРТА ПЕРВАЯ');
    expect(text).not.toContain('КАРТА ВТОРАЯ');
    expect(text).toContain('КАРТА ТРЕТЬЯ');
  });

  it('пары «вызов → результат» не рвутся: каждый вызов сохраняет свой ответ', () => {
    // И Anthropic, и OpenAI требуют результат на КАЖДЫЙ вызов. Удалить сообщение вместо того,
    // чтобы ужать его содержимое, — прямой отказ API.
    const messages = [
      ...step('c1', 'get_form_outline', {}, 'первая'),
      ...step('c2', 'get_form_outline', {}, 'вторая'),
    ];
    const out = pruneSupersededReads(messages, isReadOnly);

    expect(out).toHaveLength(messages.length);
    expect(results(out).map((p) => p.toolCallId)).toEqual(['c1', 'c2']);
  });

  it('разные аргументы одного инструмента друг друга не вытесняют', () => {
    // describe_component('Input') и describe_component('Select') — разные вопросы.
    const messages = [
      ...step('c1', 'describe_component', { name: 'Input' }, 'СВОЙСТВА ПОЛЯ'),
      ...step('c2', 'describe_component', { name: 'Select' }, 'СВОЙСТВА СПИСКА'),
    ];
    const text = JSON.stringify(pruneSupersededReads(messages, isReadOnly));

    expect(text).toContain('СВОЙСТВА ПОЛЯ');
    expect(text).toContain('СВОЙСТВА СПИСКА');
  });

  it('ответы пишущих инструментов не трогает — устаревших среди них не бывает', () => {
    // Каждый несёт адрес СВОЕЙ правки: второй insert_node ничего не говорит о первом.
    const messages = [
      ...step('c1', 'insert_node', { parent: '/root' }, 'Done: Имя → /root/children/0'),
      ...step('c2', 'insert_node', { parent: '/root' }, 'Done: Email → /root/children/1'),
    ];
    expect(pruneSupersededReads(messages, isReadOnly)).toEqual(messages);
  });

  it('повторный прогон ничего не меняет', () => {
    // `prepareStep` переносит правку вперёд, поэтому функция применяется к уже прополотому списку.
    const messages = [
      ...step('c1', 'get_form_outline', {}, 'первая'),
      ...step('c2', 'get_form_outline', {}, 'вторая'),
    ];
    const once = pruneSupersededReads(messages, isReadOnly);
    expect(pruneSupersededReads(once, isReadOnly)).toEqual(once);
  });
});
