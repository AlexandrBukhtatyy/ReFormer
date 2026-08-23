/**
 * Фасад: каскад извлечения одним вызовом.
 *
 * Два инварианта, и оба про честность ответа, а не про его наличие.
 *
 * **Маркеры тупика обязаны быть настоящими.** `isEmptyAnswer` отличает «ничего не нашлось» от
 * находки по началу текста — связь с формулировками ответов хрупкая по своей природе. Если
 * инструмент однажды поменяет фразу, фасад начнёт принимать тупик за результат и остановит
 * каскад на пустом ответе. Поэтому здесь маркеры проверяются не списком, а исполнением: у
 * инструментов спрашивают заведомую чепуху и убеждаются, что тупик распознан.
 *
 * **Ответ обязан укладываться в бюджет консумента, не ломая код.** У билдера потолок ответа
 * жёсткий (`TOOL_TEXT_BUDGET`), и обрезка на его стороне будет тупой — по символам, посреди
 * блока кода. Обрыв примера хуже его отсутствия: модель дописывает оборванный вызов сама и
 * получает несуществующий API.
 */

import { describe, it, expect } from 'vitest';
import { askReformer } from '../src/core/facade.js';
import { isEmptyAnswer } from '../src/core/tools/empty-answer.js';
import { findRecipeTool } from '../src/core/tools/find-recipe.js';
import { searchDocsTool } from '../src/core/tools/search-docs.js';
import { getSymbolDocsTool } from '../src/core/tools/get-symbol-docs.js';
import { cliKnowledge } from '../src/platform/cli/knowledge.js';

const k = cliKnowledge();
const textOf = (r: { content: Array<{ text: string }> }) => r.content.map((c) => c.text).join('\n');

/** Заведомая чепуха: ни одним разумным способом не должна находиться. */
const NONSENSE = 'zzqq wubble frotz глокая куздра';

describe('маркеры тупика соответствуют реальным ответам', () => {
  it('find_recipe при промахе распознаётся как тупик', async () => {
    const out = textOf(await findRecipeTool({ topic: NONSENSE }, k));
    // Ответ длинный (печатает список рецептов и алиасов) — по длине его от находки не отличить.
    expect(out.length).toBeGreaterThan(100);
    expect(isEmptyAnswer(out)).toBe(true);
  });

  it('search_docs при промахе распознаётся как тупик', async () => {
    const out = textOf(await searchDocsTool({ query: NONSENSE }, k));
    expect(isEmptyAnswer(out)).toBe(true);
  });

  it('get_symbol_docs при промахе распознаётся как тупик', async () => {
    const out = textOf(await getSymbolDocsTool({ symbol: 'НесуществующийСимвол' }, k));
    expect(isEmptyAnswer(out)).toBe(true);
  });

  it('содержательный ответ тупиком не считается', async () => {
    const out = textOf(await findRecipeTool({ topic: 'copy-from' }, k));
    expect(isEmptyAnswer(out)).toBe(false);
  });
});

describe('askReformer', () => {
  it('сработавшее правило ведёт выдачу, ссылки идут следом', async () => {
    const answer = await askReformer(k, 'значение поля выводится из двух других');
    expect(answer.found).toBe(true);
    expect(answer.text).toMatch(/computeFrom|compute/);

    // Решение по API попадает в ответ первым — при нехватке места `assemble` уронит ссылки,
    // а не сигнатуру. Курируемый рецепт не запрашивается вовсе: он длинный и, когда правило
    // сработало, точности не добавляет.
    const tools = answer.trace.map((s) => s.tool);
    expect(tools[0]).toBe('choose_api');
    expect(tools).not.toContain('find_recipe');
    expect(answer.trace[0].hit).toBe(true);
  });

  it('топик без правила доходит до рецепта или поиска', async () => {
    const answer = await askReformer(k, 'json schema registry');
    expect(answer.found).toBe(true);
    // Первым шагом всё равно идёт choose_api — он дешевле; важно, что каскад не остановился
    // на его пустом ответе.
    expect(answer.trace.length).toBeGreaterThan(1);
    expect(answer.trace.at(-1)?.hit).toBe(true);
  });

  it('чепуха даёт честный отказ, а не обрывок списка', async () => {
    const answer = await askReformer(k, NONSENSE);
    expect(answer.found).toBe(false);
    expect(answer.text).toContain('ничего не нашлось');
    // Все шаги каскада пройдены — иначе отказ был бы преждевременным.
    expect(answer.trace.map((s) => s.tool)).toEqual(['choose_api', 'find_recipe', 'search_docs']);
  });

  it('пустой вопрос не запускает каскад', async () => {
    const answer = await askReformer(k, '   ');
    expect(answer.found).toBe(false);
    expect(answer.trace).toHaveLength(0);
  });

  it('ответ укладывается в бюджет и не рвёт код-фенс', async () => {
    // Рецепты бывают многотысячными: у `wizard` замерено 9897 символов.
    const answer = await askReformer(k, 'form-wizard', { maxChars: 1500 });
    expect(answer.found).toBe(true);
    expect(answer.text.length).toBeLessThanOrEqual(1500);
    if (answer.truncated) {
      // Незакрытый ``` превращает остаток ответа в код в глазах модели.
      const fences = (answer.text.match(/```/g) ?? []).length;
      expect(fences % 2).toBe(0);
    }
  });

  it('без бюджета ответ не режется', async () => {
    const full = await askReformer(k, 'form-wizard');
    const capped = await askReformer(k, 'form-wizard', { maxChars: 1500 });
    expect(full.text.length).toBeGreaterThanOrEqual(capped.text.length);
    expect(full.truncated).toBe(false);
  });
});
