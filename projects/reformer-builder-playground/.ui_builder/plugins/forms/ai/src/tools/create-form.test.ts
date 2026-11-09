import { describe, expect, it, vi } from 'vitest';
import type { FormToolContext, FormTurnScope } from '@reformer/builder-plugin-api';
import { createFormTool, listTemplatesTool } from './create-form';

/** Контекст вызова с областью хода — ровно то, что читают оба инструмента. */
function contextWith(turn?: Partial<FormTurnScope>): FormToolContext {
  return turn === undefined ? {} : { turn: turn as FormTurnScope };
}

describe('list_templates', () => {
  it('строка на шаблон: идентификатор, имя и укороченное описание', async () => {
    const templates = vi.fn().mockResolvedValue([
      { id: 'simple', name: 'Простая форма', description: 'а'.repeat(400) },
      { id: 'credit', name: 'Кредит' },
    ]);
    const outcome = await listTemplatesTool.run({} as never, contextWith({ templates }));
    const [first, second] = outcome.text.split('\n');
    expect(first.startsWith('- "simple" Простая форма: ааа')).toBe(true);
    expect(first.length).toBeLessThan(200);
    expect(second).toBe('- "credit" Кредит');
  });

  it('без шаблонов — подсказка про пустую форму; без области хода — недоступно', async () => {
    const empty = await listTemplatesTool.run(
      {} as never,
      contextWith({ templates: () => Promise.resolve([]) })
    );
    expect(empty.text).toContain('empty form');
    expect((await listTemplatesTool.run({} as never, contextWith())).error?.code).toBe(
      'UNAVAILABLE'
    );
  });
});

describe('create_form', () => {
  it('имя модуля — латиница в kebab-case, иначе отказ до создания', async () => {
    const createForm = vi.fn();
    const outcome = await createFormTool.run(
      { name: 'Анкета на кредит' },
      contextWith({ createForm })
    );
    expect(outcome.error?.code).toBe('INVALID_PARAMS');
    expect(createForm).not.toHaveBeenCalled();
  });

  it('путь вместо имени — берётся последний сегмент, модель узнаёт об этом', async () => {
    // Замер ReFormer-9a9c: qwen3.5:4b прислала путь по образцу открытой формы, на отказ не
    // исправила имя и достроила открытую форму — 47 запросов вместо трёх.
    const createForm = vi.fn().mockResolvedValue({
      ok: true,
      path: 'forms/restaurant-review/schema/form.schema.json',
      template: null,
    });
    const outcome = await createFormTool.run(
      { name: 'forms/eval/schema/restaurant-review' },
      contextWith({ createForm })
    );
    expect(createForm).toHaveBeenCalledWith({ name: 'restaurant-review' });
    expect(outcome.text).toContain('Name taken from the path: restaurant-review.');
  });

  it('путь, чей последний сегмент не годится, — отказ', async () => {
    const createForm = vi.fn();
    const outcome = await createFormTool.run(
      { name: 'forms/eval/schema/form.schema.json' },
      contextWith({ createForm })
    );
    expect(outcome.error?.code).toBe('INVALID_PARAMS');
    expect(outcome.text).toContain('the folder name only');
    expect(createForm).not.toHaveBeenCalled();
  });

  it('создала — модель узнаёт путь и что ход продолжится на новой форме', async () => {
    const createForm = vi.fn().mockResolvedValue({
      ok: true,
      path: 'forms/credit/schema/form.schema.json',
      template: null,
    });
    const outcome = await createFormTool.run(
      { name: 'credit', folder: 'forms' },
      contextWith({ createForm })
    );
    expect(createForm).toHaveBeenCalledWith({ name: 'credit', folder: 'forms' });
    expect(outcome.ok).toBe(true);
    expect(outcome.text).toContain('forms/credit/schema/form.schema.json (empty)');
    expect(outcome.text).toContain('continues');
  });

  it('отказ моста уходит модели кодом и подсказками', async () => {
    const createForm = vi.fn().mockResolvedValue({
      ok: false,
      code: 'INVALID_PARAMS',
      message: 'No template "x".',
      suggestions: ['simple', 'wizard'],
    });
    const outcome = await createFormTool.run(
      { name: 'credit', template: 'x' },
      contextWith({ createForm })
    );
    expect(outcome.error).toEqual({
      code: 'INVALID_PARAMS',
      message: 'No template "x".',
      suggestions: ['simple', 'wizard'],
    });
  });

  it('без области хода — недоступно', async () => {
    expect((await createFormTool.run({ name: 'credit' }, contextWith())).error?.code).toBe(
      'UNAVAILABLE'
    );
  });
});
