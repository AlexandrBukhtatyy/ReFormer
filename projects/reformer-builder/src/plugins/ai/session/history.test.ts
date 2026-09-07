/**
 * Уроки 7 и 8 живых прогонов — теперь под тестом, а не под комментарием.
 *
 * В v1 обе функции лежали приватными внутри `agent/run.ts`, то есть внутри моста, и не
 * проверялись ничем: их поведение подтверждалось только наблюдением за живой моделью. Именно
 * поэтому при переносе они теряются первыми — выглядят частностью моста, а являются условием
 * его работоспособности.
 *
 * @module plugins/ai/session/history.test
 */

import { describe, expect, it } from 'vitest';
import { assistantContent, historyFor, HISTORY_BUDGET } from './history';
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
