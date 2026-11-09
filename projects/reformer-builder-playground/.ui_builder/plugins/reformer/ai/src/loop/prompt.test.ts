/**
 * Системный промпт: побайтовая стабильность, бюджет и происхождение имён.
 *
 * @module plugins/reformer/ai/loop/prompt.test
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { builtinEntries } from '../../../core/testing';
import { commonProps, listComponents } from '../model/catalog-digest';
import { systemPrompt } from './prompt';
import { CREATION_PROMPT_BUDGET, PROMPT_BUDGET } from '../model/types';
import { creationPrompt } from './creation-prompt';
import { createEditorToolRegistry } from '../tools/registry';

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

  it('новая форма о другом — create_form, а не достройка открытой (ReFormer-9a9c)', () => {
    expect(systemPrompt(catalog)).toContain(
      'A new form on another subject → create_form; never build it into a form with content.'
    );
  });

  it('называет поля этого кита — чтобы первый list_components стал необязательным', () => {
    const text = systemPrompt(catalog);
    const fields = listComponents(catalog, { role: 'field' }).map((c) => c.name);
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.filter((name) => !text.includes(name))).toEqual([]);
  });

  it('называет визард кита и его шаг — их не надо искать перед вставкой визарда', () => {
    // Живой прогон: без имён модель шла в list_components, а то и вставляла шаг без компонента.
    expect(systemPrompt(catalog)).toContain('A wizard (Wizard) holds steps (Step)');
  });

  it('визард — с шагами одним вызовом, поля шагов — следующим ответом', () => {
    // Замер gemma4 (ReFormer-qsm8.12): визард с шагами и полями одним вызовом — три уровня
    // children — модель записывала с лишней скобкой, и сервер выбрасывал вызов целиком. Правило —
    // набора без `build_form`; с ним визард тоже идёт шагами, а поля — в шаг (`build-form.test`).
    const text = systemPrompt(catalog, { buildForm: false });
    expect(text).toContain('Insert a wizard and its steps (no fields)');
    expect(text).toContain('fill all steps in the next answer, one insert_node per step');
    expect(text).not.toContain("each step's fields in that step's children");
  });

  it('подпись шага и секции — title, а не text', () => {
    // Замер gemma4: правило «видимое содержимое — text» уводило заголовки шагов в text.
    expect(systemPrompt(catalog)).toContain(`a step's or section's is "title"`);
  });

  it('кит без визарда — правило без имён', () => {
    const noWizard = catalog.filter((entry) => !['Wizard', 'Step'].includes(entry.name));
    expect(systemPrompt(noWizard)).toContain('A wizard holds steps, a step holds fields');
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

describe('промпт попытки создания формы', () => {
  it('короткий: у попытки одна задача — create_form', () => {
    expect(creationPrompt().length).toBeLessThanOrEqual(CREATION_PROMPT_BUDGET);
    expect(creationPrompt()).toContain('create_form');
    expect(creationPrompt()).toContain('ask_user');
  });

  it('не называет инструментов правки: у попытки их нет, и модель позвала бы их', () => {
    // Замер на живой модели: в попытке создания модель звала list_components и получала
    // AI_NoSuchToolError — его называл полный промпт структурного режима.
    const editing = createEditorToolRegistry()
      .list()
      .map((tool) => tool.name);
    expect(editing.length).toBeGreaterThan(5);
    expect(editing.filter((name) => creationPrompt().includes(name))).toEqual([]);
  });
});
