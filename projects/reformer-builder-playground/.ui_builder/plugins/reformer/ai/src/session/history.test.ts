/**
 * Уроки 7 и 8 живых прогонов — теперь под тестом, а не под комментарием.
 *
 * В v1 обе функции лежали приватными внутри `agent/run.ts`, то есть внутри моста, и не
 * проверялись ничем: их поведение подтверждалось только наблюдением за живой моделью. Именно
 * поэтому при переносе они теряются первыми — выглядят частностью моста, а являются условием
 * его работоспособности.
 *
 * @module plugins/reformer/ai/session/history.test
 */

import { describe, expect, it } from 'vitest';
import { assistantContent, historyFor, HISTORY_BUDGET, userContent } from './history';
import type { ChatEntry } from './session';

function entry(patch: Partial<ChatEntry> & Pick<ChatEntry, 'role'>): ChatEntry {
  return { id: 'x', text: '', reasoning: '', tools: [], ...patch };
}

describe('урок 7 — молчаливый ход не пустой', () => {
  it('ход без слов отдаёт в историю список сделанного, а не пустоту', () => {
    const content = assistantContent({
      text: '   ',
      tools: [
        { name: 'insert_node', ok: true, summary: 'Добавлено поле Email' },
        { name: 'set_node_prop', ok: true, summary: 'Email → обязательное' },
      ],
    });
    expect(content).toContain('Добавлено поле Email');
    expect(content).toContain('Email → обязательное');
  });

  it('без сводки инструмент называется хотя бы именем — иначе строка пуста', () => {
    expect(assistantContent({ text: '', tools: [{ name: 'validate_form', ok: true }] })).toContain(
      'validate_form'
    );
  });

  it('длинный журнал сворачивается в счёт, а не уезжает в контекст целиком', () => {
    const tools = Array.from({ length: 20 }, (_, i) => ({
      name: `tool_${String(i)}`,
      ok: true,
    }));
    const content = assistantContent({ text: '', tools });
    expect(content).toContain('and 8 more');
    expect(content).not.toContain('tool_19');
  });

  it('ход, в котором модель ответила, отдаётся текстом — сводка его не подменяет', () => {
    const content = assistantContent({
      text: 'Готово, добавил два поля.',
      tools: [{ name: 'insert_node', ok: true, summary: 'Добавлено поле Email' }],
    });
    expect(content).toBe('Готово, добавил два поля.');
  });
});

describe('урок 8 — бюджет истории считается в символах', () => {
  it('реплики набираются с конца: свежее нужнее старого', () => {
    const entries: ChatEntry[] = [
      entry({ id: '1', role: 'user', text: 'a'.repeat(50) }),
      entry({ id: '2', role: 'assistant', text: 'b'.repeat(50) }),
      entry({ id: '3', role: 'user', text: 'c'.repeat(50) }),
    ];
    const kept = historyFor(entries, 120);
    expect(kept.map((m) => m.content[0])).toEqual(['b', 'c']);
  });

  it('обрезка идёт по объёму, а не по числу реплик', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      entry({ id: String(i), role: 'user', text: 'x' })
    );
    const one = [entry({ id: 'big', role: 'user', text: 'x'.repeat(500) })];
    // Сорок коротких реплик дешевле одной длинной — счёт реплик этого не различает.
    expect(historyFor(many, 100)).toHaveLength(40);
    expect(historyFor(one, 100)).toHaveLength(1);
  });

  it('последняя реплика проходит всегда — это вопрос, на который агент и отвечает', () => {
    const entries = [entry({ id: '1', role: 'user', text: 'q'.repeat(HISTORY_BUDGET * 2) })];
    expect(historyFor(entries)).toHaveLength(1);
  });

  it('пустые реплики в контекст не уходят: заготовка ассистента ещё ничего не значит', () => {
    const entries: ChatEntry[] = [
      entry({ id: '1', role: 'user', text: 'сделай форму' }),
      entry({ id: '2', role: 'assistant', text: '' }),
    ];
    expect(historyFor(entries)).toEqual([{ role: 'user', content: 'сделай форму' }]);
  });

  it('рассуждение в модель не возвращается — только текст ответа', () => {
    const entries: ChatEntry[] = [
      entry({ id: '1', role: 'assistant', text: 'готово', reasoning: 'тайные мысли' }),
    ];
    expect(historyFor(entries)[0].content).toBe('готово');
  });
});

describe('вложения в истории — ссылками, без содержимого', () => {
  it('реплика без вложений — как есть', () => {
    expect(userContent({ text: 'привет' })).toBe('привет');
  });

  it('прикреплённое называется именем и адресом', () => {
    expect(
      userContent({
        text: 'посмотри бриф',
        attachments: [
          { uri: 'source:notes/brief.md', name: 'brief.md' },
          { uri: 'source:spec.md', name: 'spec.md', error: 'No spec.md.' },
        ],
      })
    ).toBe('посмотри бриф\n(attached: brief.md <source:notes/brief.md>, spec.md <source:spec.md>)');
  });
});

describe('форма хода в истории', () => {
  const user = (id: string, text: string, path?: string): ChatEntry =>
    entry({
      id,
      role: 'user',
      text,
      ...(path === undefined
        ? {}
        : {
            snapshot: {
              resource: path,
              path,
              text: '',
              loaded: {
                stack: 'test',
                resource: path,
                path,
                text: '',
                state: null,
                companions: [],
              },
            },
          }),
    });

  it('форма названа у первой реплики и там, где пользователь переключился', () => {
    const contents = historyFor([
      user('m1', 'раз', 'forms/a.json'),
      entry({ role: 'assistant', text: 'ок' }),
      user('m3', 'два', 'forms/a.json'),
      entry({ role: 'assistant', text: 'ок' }),
      user('m5', 'три', 'forms/b.json'),
    ]).map((message) => message.content);

    expect(contents[0]).toBe('раз\n(form: forms/a.json)');
    expect(contents[2]).toBe('два');
    expect(contents[4]).toBe('три\n(form: forms/b.json)');
  });

  it('реплика без формы пометки не получает и смену не сбрасывает', () => {
    const contents = historyFor([
      user('m1', 'раз', 'forms/a.json'),
      user('m2', 'без формы'),
      user('m3', 'снова', 'forms/a.json'),
    ]).map((message) => message.content);

    expect(contents).toEqual(['раз\n(form: forms/a.json)', 'без формы', 'снова']);
  });
});

describe('вопросы модели в истории', () => {
  it('вопрос и ответ — строкой на вопрос в реплике ассистента', () => {
    const content = assistantContent({
      text: 'Сделал.',
      tools: [],
      asks: [
        {
          id: 'ask1',
          questions: [
            {
              question: 'Обязательное?',
              options: [{ label: 'Да' }, { label: 'Нет' }],
              multiSelect: false,
            },
            {
              question: 'Подсказка?',
              options: [{ label: 'X' }, { label: 'Y' }],
              multiSelect: false,
            },
          ],
          answers: [{ selected: ['Да'] }, { selected: [], text: 'своя' }],
        },
      ],
    });
    expect(content).toBe(
      'Сделал.\n' +
        '(asked the user: "Обязательное?" — answer: "Да")\n' +
        '(asked the user: "Подсказка?" — answer: own words: "своя")'
    );
  });

  it('ход, остановленный на вопросе, — в истории без ответа, но не теряется', () => {
    const contents = historyFor([
      entry({ role: 'user', text: 'добавь поле' }),
      entry({
        role: 'assistant',
        asks: [
          {
            id: 'ask1',
            questions: [
              { question: 'Какое?', options: [{ label: 'A' }, { label: 'B' }], multiSelect: false },
            ],
            cancelled: true,
          },
        ],
      }),
    ]).map((message) => message.content);
    expect(contents).toEqual([
      'добавь поле',
      '(asked the user: "Какое?" — no answer, turn stopped)',
    ]);
  });
});
