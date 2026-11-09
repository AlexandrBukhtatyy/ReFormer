import { describe, expect, it, vi } from 'vitest';
import type { FormToolContext, FormTurnScope } from '@reformer/builder-plugin-api';
import { createFormTool } from './create-form';

/** Контекст вызова с областью хода — ровно то, что читает инструмент. */
function contextWith(turn?: Partial<FormTurnScope>): FormToolContext {
  return turn === undefined ? {} : { turn: turn as FormTurnScope };
}

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
      code: 'REFUSED',
      message: 'A form named "credit" already exists.',
      suggestions: ['credit-2'],
    });
    const outcome = await createFormTool.run({ name: 'credit' }, contextWith({ createForm }));
    expect(outcome.error).toEqual({
      code: 'REFUSED',
      message: 'A form named "credit" already exists.',
      suggestions: ['credit-2'],
    });
  });

  it('шаблона у инструмента нет: форма ассистента всегда пустая', () => {
    // ReFormer-u7g0: модель брала шаблон-образец и для формы, описанной словами, а потом
    // перекраивала его — лишние поля, правила на удалённые поля.
    const schema = createFormTool.inputSchema as { properties: Record<string, unknown> };
    expect(Object.keys(schema.properties)).toEqual(['name', 'folder']);
    expect(createFormTool.description).not.toMatch(/template/i);
  });

  it('без области хода — недоступно', async () => {
    expect((await createFormTool.run({ name: 'credit' }, contextWith())).error?.code).toBe(
      'UNAVAILABLE'
    );
  });
});
