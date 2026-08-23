/**
 * Бюджет выдачи и потолки инструментов.
 *
 * Зачем это вообще появилось. У ответов ИНСТРУМЕНТОВ не было потолка вообще, и замеры это
 * показали: `list_symbols({})` отдавал 82 364 символа ≈ 20 591 токен — дороже, чем всё
 * подключение к серверу, — а крупный рецепт (`cookbook`) 17 130 символов. В отличие от
 * явного `resources/read`, это то, что агент получает не глядя: одна неудачная формулировка
 * стоила больше остального диалога.
 *
 * Главный инвариант не «влезло в лимит», а «выпало наименее важное и об этом СКАЗАНО».
 * Молча усечённый пример хуже отсутствующего: агент допишет его сам и получит несуществующий
 * вызов.
 */

import { describe, it, expect } from 'vitest';
import { assemble, estimateTokens } from '../src/core/context/budget.js';
import { PROFILES, resolveProfile } from '../src/core/context/profiles.js';
import { listSymbolsTool } from '../src/core/tools/list-symbols';
import { findRecipeTool } from '../src/core/tools/find-recipe';
import { listAvailablePackages } from '../src/utils/docs-parser';
import { cliKnowledge } from '../src/platform/cli/knowledge.js';

/** Знание процесса: тесты гоняются в Node, поэтому источники — те же, что у сервера. */
const k = cliKnowledge();

const hasDocs = listAvailablePackages().length > 0;

describe('context/budget', () => {
  it('без лимита отдаёт всё в порядке приоритета', () => {
    const r = assemble([
      { priority: 2, text: 'третий' },
      { priority: 0, text: 'первый' },
      { priority: 1, text: 'второй' },
    ]);
    expect(r.text).toBe('первый\n\nвторой\n\nтретий');
    expect(r.dropped).toBe(0);
    expect(r.truncated).toBe(false);
  });

  it('при нехватке бюджета выпадает наименее важное, а не начало', () => {
    const big = 'x'.repeat(4000); // ~1000 токенов
    const r = assemble(
      [
        { priority: 0, text: 'КРИТИЧНО' },
        { priority: 9, text: big },
      ],
      50
    );
    expect(r.text).toContain('КРИТИЧНО');
    expect(r.text).not.toContain(big);
    expect(r.dropped).toBe(1);
  });

  it('обрезаемый кусок помечается, а не молча укорачивается', () => {
    const r = assemble([{ priority: 0, text: 'a\n'.repeat(2000), truncatable: true }], 100);
    expect(r.truncated).toBe(true);
    expect(r.text).toMatch(/обрезано/);
  });

  it('не закрытый после обрезки код-фенс закрывается', () => {
    const code = ['```ts', ...Array.from({ length: 500 }, (_, i) => `line ${i}`)].join('\n');
    const r = assemble([{ priority: 0, text: code, truncatable: true }], 100);
    const fences = (r.text.match(/^```/gm) ?? []).length;
    expect(fences % 2, 'разметка ответа поедет у клиента').toBe(0);
  });

  it('оценка токенов совпадает с формулой eval (chars/4)', () => {
    expect(estimateTokens('x'.repeat(400))).toBe(100);
  });

  it('профиль по умолчанию — implementation, неизвестное имя не падает', () => {
    expect(resolveProfile(undefined)).toBe('implementation');
    expect(resolveProfile('нет такого')).toBe('implementation');
    expect(resolveProfile('debug')).toBe('debug');
    expect(PROFILES.full.maxTokens).toBeNull();
  });

  it('в debug-профиле анти-паттерны идут раньше примера', () => {
    // Сломанный код у агента уже есть — ему нужен диагноз, а не эталон.
    expect(PROFILES.debug.priority.antiPatterns!).toBeLessThan(PROFILES.debug.priority.example!);
    // В implementation — наоборот: там пишут с нуля.
    expect(PROFILES.implementation.priority.example!).toBeLessThan(
      PROFILES.implementation.priority.antiPatterns!
    );
  });
});

describe('потолки выдачи инструментов', () => {
  it.runIf(hasDocs)('list_symbols без фильтра не отдаёт всю поверхность', async () => {
    const { content } = await listSymbolsTool({}, k);
    const text = content[0].text;
    // Было 82 364 символа. Порог с запасом: важно, что порядок величины другой.
    expect(text.length).toBeLessThan(20000);
    expect(text, 'обрезка обязана быть видимой').toMatch(/Показано \d+ из \d+/);
    expect(text, 'должно быть сказано, чем сузить').toMatch(/nameContains/);
  });

  it.runIf(hasDocs)('узкий запрос list_symbols не режется', async () => {
    const { content } = await listSymbolsTool({ nameContains: 'validateWhen' }, k);
    expect(content[0].text).not.toMatch(/Показано \d+ из \d+/);
    expect(content[0].text).toContain('validateWhen');
  });

  it.runIf(hasDocs)('крупный рецепт обрезается с указанием, где дочитать', async () => {
    const { content } = await findRecipeTool({ topic: 'cookbook' }, k);
    const text = content[0].text;
    expect(text.length).toBeLessThan(12000);
    if (text.includes('обрезан')) {
      expect(text, 'обрезка обязана вести к полному тексту').toMatch(/reformer:\/\/docs\//);
    }
  });

  it.runIf(hasDocs)('короткий рецепт не трогаем', async () => {
    const { content } = await findRecipeTool({ topic: 'multi-step' }, k);
    expect(content[0].text).not.toMatch(/Рецепт обрезан/);
  });
});
