/**
 * Встроенная справка на MCP: бюджет ответа, приписка об источнике и находки проверки кода.
 *
 * Главное свойство уже однажды нарушалось незаметно: ответ ВМЕСТЕ с припиской укладывается в
 * бюджет. Приписка добавлялась после нарезки, поэтому ответ у верхней границы переваливал за неё,
 * и `clamp` в реестре срезал хвост — то есть саму приписку. Замер на настоящем корпусе показывал
 * превышение в пяти случаях из шести: источник терялся ровно там, где он и нужен, — когда знания
 * взяты из проекта пользователя, а не вшиты в сборку.
 *
 * Корпус подставляется загрузчиком, каскад и проверка кода MCP — подменены: тест проверяет
 * справку, а не корпус знаний, которого в CI нет.
 *
 * @module plugins/reformer/ai/knowledge/mcp-reference.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeLoader, KnowledgeSource } from './index';

/** Длина ответа каскада, о которой просят: так видно, что бюджет уменьшен на приписку. */
let requestedMaxChars = 0;

vi.mock('@reformer/mcp/dist/core/facade.js', () => ({
  askReformer: (_knowledge: unknown, _question: string, options: { maxChars: number }) => {
    requestedMaxChars = options.maxChars;
    // Худший случай: каскад отдаёт ровно столько, сколько разрешили.
    return Promise.resolve({ text: 'x'.repeat(options.maxChars) });
  },
}));

vi.mock('@reformer/mcp/dist/core/validate/code.js', () => ({
  validateCode: () =>
    Promise.resolve({
      diagnostics: [
        {
          code: 'RF002',
          severity: 'error',
          message: 'inventedOperator is not exported by @reformer/core',
          line: 3,
          suggestion: 'use required',
          fix: { tool: 'get_symbol_docs', arguments: { symbol: 'required' } },
        },
        { code: 'RF010', severity: 'warning', message: 'deprecated' },
      ],
      limitations: [],
    }),
}));

const { createMcpReference } = await import('./mcp-reference');

const knowledge = {} as KnowledgeSource['knowledge'];
const loader =
  (source: KnowledgeSource | null): KnowledgeLoader =>
  () =>
    Promise.resolve(source);

const BUDGET = 1500;

describe('встроенная справка — ответ на вопрос', () => {
  beforeEach(() => {
    requestedMaxChars = 0;
  });

  it('ответ с припиской об источнике укладывается в бюджет', async () => {
    const reference = createMcpReference(
      undefined,
      loader({
        knowledge,
        origin: 'project',
        versions: { '@reformer/core': '6.0.0', '@reformer/ui-kit': '11.0.0' },
      })
    );

    const answer = await reference.ask('как объявить вычисляемое поле', { maxChars: BUDGET });
    expect(answer!.text.length).toBeLessThanOrEqual(BUDGET);
    // Приписка на месте: именно её срезал бы clamp.
    expect(answer!.text).toContain('node_modules проекта');
    expect(answer!.text).toContain('core@6.0.0');
    // У каскада просили меньше полного бюджета — ровно на длину приписки.
    expect(requestedMaxChars).toBeLessThan(BUDGET);
  });

  it('вшитый корпус не тратит бюджет на приписку', async () => {
    const reference = createMcpReference(
      undefined,
      loader({ knowledge, origin: 'bundle', versions: {} })
    );

    const answer = await reference.ask('что угодно', { maxChars: BUDGET });
    expect(requestedMaxChars).toBe(BUDGET);
    expect(answer!.text).not.toContain('node_modules');
  });

  it('без корпуса — `null`: стек сам скажет модели, что справки нет', async () => {
    expect(
      await createMcpReference(undefined, loader(null)).ask('что угодно', { maxChars: BUDGET })
    ).toBeNull();
  });
});

describe('встроенная справка — проверка кода', () => {
  it('диагностики MCP — находки контракта, без полей, которых в контракте нет', async () => {
    const reference = createMcpReference(
      undefined,
      loader({ knowledge, origin: 'bundle', versions: {} })
    );

    expect(await reference.checkCode('inventedOperator();', {})).toEqual({
      findings: [
        {
          code: 'RF002',
          severity: 'error',
          message: 'inventedOperator is not exported by @reformer/core',
          line: 3,
          suggestion: 'use required',
        },
        { code: 'RF010', severity: 'warning', message: 'deprecated' },
      ],
    });
  });

  it('без корпуса — `null`: проверить нечем', async () => {
    expect(await createMcpReference(undefined, loader(null)).checkCode('x();', {})).toBeNull();
  });
});
