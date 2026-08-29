/**
 * Системный промпт: побайтовая стабильность, бюджет и происхождение имён.
 *
 * @module plugins/ai/core/prompt.test
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { builtinEntries } from '@/lib/catalog/__fixtures__/builtin-catalog';
import { commonProps, listComponents } from './catalog-digest';
import { systemPrompt } from './prompt';
import { PROMPT_BUDGET } from './types';

const catalog = builtinEntries();

describe('системный промпт', () => {
  it('побайтово одинаков от вызова к вызову', () => {
    // Не микрооптимизация: провайдеры кэшируют НЕИЗМЕННЫЙ префикс запроса. Промпт, отличающийся
    // хоть символом между шагами, обнуляет кэш на каждом шаге — там, где он и должен окупаться.
    // Поэтому в промпте не должно появиться ни времени, ни случайных id, ни порядка из Set.
    expect(systemPrompt(catalog)).toBe(systemPrompt(catalog));
  });

  it('укладывается в бюджет', () => {
    expect(systemPrompt(catalog).length).toBeLessThanOrEqual(PROMPT_BUDGET);
  });

  it('называет поля этого кита — чтобы первый list_components стал необязательным', () => {
    const text = systemPrompt(catalog);
    const fields = listComponents(catalog, { role: 'field' }).map((c) => c.name);
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.filter((name) => !text.includes(name))).toEqual([]);
  });

  it('называет свойства, общие для всех полей кита', () => {
    const text = systemPrompt(catalog);
    const shared = commonProps(catalog, 'field');
    // Пересечение пустым быть не должно: иначе обещание «эти свойства есть у каждого поля»
    // выродится в пустую строку, и правило потеряет смысл вместе с экономией шага.
    expect(shared.length).toBeGreaterThan(0);
    expect(shared.filter((key) => !text.includes(key))).toEqual([]);
  });

  it('не содержит имён компонентов в исходнике — они приходят из каталога', () => {
    // Промпт с зашитым именем работает ровно до первого чужого кита, и ломается молча: модель
    // называет компонент, которого в каталоге нет, и получает отказ вместо формы.
    const source = readFileSync(new URL('./prompt.ts', import.meta.url), 'utf8');
    const names = listComponents(catalog).map((c) => c.name);
    const hardcoded = names.filter((name) => new RegExp(`\\b${name}\\b`).test(source));
    expect(hardcoded).toEqual([]);
  });
});
