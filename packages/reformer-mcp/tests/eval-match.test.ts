/**
 * Защита измерительного прибора (eval/lib/match.mjs).
 *
 * Зачем отдельный тест: первый снятый baseline оказался НЕВЕРНЫМ, и не из-за сервера.
 * Тупиковый ответ `find_recipe` («No recipe found…») печатает список доступных рецептов и
 * алиасов — в нём есть и слово `cross`, и строка `renderer-json/registry`. Ожидания корпуса
 * вида `["cross"]` совпадали с этим списком, задача засчитывалась как решённая, first-pass
 * был завышен, а последующее устранение тупика читалось как «регресс».
 *
 * Урок: корпус и матчер — такой же измерительный прибор, как сервер, и ломаются так же тихо.
 * Здесь он зафиксирован на реальных строках, которые сервер печатает.
 */

import { describe, it, expect } from 'vitest';
// @ts-expect-error — харнесс намеренно на .mjs (запускается без сборки, как остальные scripts/)
import { matched, isEmptyAnswer, assertStrongExpectations } from '../eval/lib/match.mjs';

/** Реальный хвост тупикового ответа find_recipe (сокращённый). */
const DEAD_END =
  'No recipe found for "password confirmation must match".\n\n' +
  'Available recipes (61):\n  - core/validation\n  - renderer-json/registry\n\n' +
  'Known topic aliases: conditional-validation, copy, cross, cross-field, cycle, reset, sync.\n\n' +
  'Or pass a public symbol name. Sample symbols: apply, array, ...';

describe('eval matcher — защита от ложных попаданий', () => {
  it('тупиковый ответ не считается попаданием, даже если слово в нём есть', () => {
    expect(DEAD_END).toContain('cross');
    expect(DEAD_END).toContain('registry');
    expect(matched(DEAD_END, ['cross'])).toEqual([]);
    expect(matched(DEAD_END, ['registry'])).toEqual([]);
  });

  it('распознаёт все маркеры «ничего не найдено»', () => {
    for (const s of [
      'No recipe found for "x".',
      'No curated recipe is registered for "x", but full-text search found related sections:',
      'No documentation sections matched "x".',
      'No public symbols found in @reformer/core.',
      'Symbol "nope" not found in any @reformer/* package.',
      'Section "nope" not found in @reformer/core documentation.',
    ]) {
      expect(isEmptyAnswer(s), `не распознан маркер: ${s.slice(0, 40)}`).toBe(true);
    }
  });

  it('содержательный ответ считается попаданием', () => {
    const real = '# Recipe section: cross\n\ncross(model, (snap) => { ... })';
    expect(isEmptyAnswer(real)).toBe(false);
    expect(matched(real, ['cross('])).toEqual(['cross(']);
  });

  it('корпус со слабыми ожиданиями отвергается до прогона', () => {
    expect(() =>
      assertStrongExpectations([{ id: 'x/weak', expectAny: ['cross', 'registry'] }])
    ).toThrow(/общие слова/);
  });

  it('ожидание со скобкой/точкой/$ считается сильным', () => {
    // Раньше сторож срезал `(` перед проверкой и объявлял слабым как раз то,
    // что делает ожидание точным.
    expect(() =>
      assertStrongExpectations([
        { id: 'a', expectAny: ['cross('] },
        { id: 'b', expectAny: ['form.status'] },
        { id: 'c', expectAny: ['$dataSource'] },
        { id: 'd', expectAny: ['Cycle detected'] },
        { id: 'e', expectAny: ['defineRegistry', 'registry'] },
      ])
    ).not.toThrow();
  });
});
