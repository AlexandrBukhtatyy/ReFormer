/**
 * Поле-массив без узла в схеме [ReFormer-ee4].
 *
 * Тип группы обещает `form.items` (`FormArray` у массива объектов, `FormControl` у массива
 * значений), а сборка ноду не строит, пока схема не сказала, чем массив является: по пустому
 * массиву не отличить список под-форм от мультивыбора. Раньше обращение молча давало `undefined`,
 * и `form.items.push(…)` падал без объяснения. Теперь в dev — одно предупреждение с подсказкой.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createForm, createModel } from '../../../src';

interface Shape {
  name: string;
  items: { title: string }[];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('массив модели без узла в схеме', () => {
  it('ноды нет; обращение к полю предупреждает один раз и подсказывает привязку', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { form } = createForm<Shape>({
      model: createModel<Shape>({ name: '', items: [] }),
      schema: (m) => ({ children: [{ model: m.$.name, component: () => null }] }),
    });

    expect(form.items).toBeUndefined();
    expect(form.items).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('form.items');
    expect(warn.mock.calls[0][0]).toContain('{ model: model.$.items, item:');
  });

  it('привязанный массив предупреждения не даёт', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { form } = createForm<Shape>({
      model: createModel<Shape>({ name: '', items: [] }),
      schema: (m) => ({
        children: [
          {
            model: m.$.items,
            item: (row) => ({ children: [{ model: row.$.title, component: () => null }] }),
          },
        ],
      }),
    });

    expect(form.items).toBeDefined();
    expect(warn).not.toHaveBeenCalled();
  });
});
