/**
 * Справка по библиотеке: бюджет ответа и приписка об источнике.
 *
 * Проверяется одно свойство, которое уже однажды нарушалось незаметно: ответ ВМЕСТЕ с припиской
 * укладывается в `TOOL_TEXT_BUDGET`. Приписка добавлялась после нарезки, поэтому ответ у верхней
 * границы переваливал за неё, и `clamp` в реестре срезал хвост — то есть саму приписку. Замер на
 * настоящем корпусе показывал превышение в пяти случаях из шести: источник терялся ровно там, где
 * он и нужен, — когда знания взяты из проекта пользователя, а не вшиты в сборку.
 *
 * Корпус здесь ПОДСТАВЛЯЕТСЯ параметром, а не подменяется `vi.mock` модуля знаний, как в v1:
 * инструмент собирается фабрикой от загрузчика, и мокать стало нечего.
 *
 * @module plugins/ai/core/tools/reformer-docs.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeLoader, KnowledgeSource } from '../../knowledge';
import { TOOL_TEXT_BUDGET } from '../types';

/** Длина ответа фасада, о которой просят: так видно, что бюджет уменьшен на приписку. */
let requestedMaxChars = 0;

vi.mock('@reformer/mcp/dist/core/facade.js', () => ({
  askReformer: (_k: unknown, _q: string, opts: { maxChars: number }) => {
    requestedMaxChars = opts.maxChars;
    // Худший случай: фасад отдаёт ровно столько, сколько разрешили.
    return Promise.resolve({ text: 'x'.repeat(opts.maxChars) });
  },
}));

const { createReformerDocsTool } = await import('./reformer-docs');

const knowledge = {} as KnowledgeSource['knowledge'];
const loader =
  (source: KnowledgeSource | null): KnowledgeLoader =>
  () =>
    Promise.resolve(source);

describe('ask_reformer — бюджет ответа', () => {
  beforeEach(() => {
    requestedMaxChars = 0;
  });

  it('ответ с припиской об источнике укладывается в бюджет', async () => {
    const tool = createReformerDocsTool(
      loader({
        knowledge,
        origin: 'project',
        versions: { '@reformer/core': '6.0.0', '@reformer/ui-kit': '11.0.0' },
      })
    );

    const res = await tool.run({ question: 'как объявить вычисляемое поле' }, {} as never);
    expect(res.text!.length).toBeLessThanOrEqual(TOOL_TEXT_BUDGET);
    // Приписка на месте: именно её срезал бы clamp.
    expect(res.text).toContain('node_modules проекта');
    expect(res.text).toContain('core@6.0.0');
    // У фасада просили меньше полного бюджета — ровно на длину приписки.
    expect(requestedMaxChars).toBeLessThan(TOOL_TEXT_BUDGET);
  });

  it('вшитый корпус не тратит бюджет на приписку', async () => {
    const tool = createReformerDocsTool(loader({ knowledge, origin: 'bundle', versions: {} }));

    const res = await tool.run({ question: 'что угодно' }, {} as never);
    expect(requestedMaxChars).toBe(TOOL_TEXT_BUDGET);
    expect(res.text).not.toContain('node_modules');
  });

  it('без корпуса инструмент говорит об этом, а не молчит', async () => {
    // Молчание агент прочитал бы как «библиотека такого не умеет» и пошёл выдумывать API.
    const res = await createReformerDocsTool(loader(null)).run(
      { question: 'что угодно' },
      {} as never
    );
    expect(res.ok).toBe(true);
    expect(res.text).toContain('unavailable');
  });

  it('умолчание — корпуса нет: инструмент остаётся в наборе и не падает', async () => {
    // Состав набора не должен зависеть от того, собран ли корпус: иначе поверхность инструментов
    // менялась бы от состояния сборки, а храповик мерил бы разное в разных запусках.
    const res = await createReformerDocsTool().run({ question: 'что угодно' }, {} as never);
    expect(res.ok).toBe(true);
    expect(res.text).toContain('unavailable');
  });
});
