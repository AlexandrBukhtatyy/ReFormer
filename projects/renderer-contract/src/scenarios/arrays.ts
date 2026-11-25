/**
 * Массив под-форм: строки, кнопки компонента массива, шаблон нового элемента и ключи строк.
 *
 * @module renderer-contract/scenarios/arrays
 */

import { describe, expect, it, vi } from 'vitest';
import { arrayOf } from '@reformer/core';
import type { FormModel } from '@reformer/core';
import type { ScenarioContext } from '../context';
import { all, click, get, getByTestId, typeInto } from '../dom';
import { blankRow, createShape, type Row, type Shape } from '../fixture';

export function arraysScenarios({ fixture, form, kit, mount }: ScenarioContext): void {
  /** Форма из одного массива строк на компоненте массива кита. */
  const rowsForm = (model: FormModel<Shape> = createShape()) =>
    form<Shape>({
      model,
      schema: (shape) => ({ model: shape.$.rows, component: kit.List, item: fixture.row }),
    });

  /** Имена строк, как они стоят на экране. */
  const shownNames = (root: HTMLElement): string[] =>
    all<HTMLInputElement>(root, '[data-caption="Имя"]').map((input) => input.value);

  /** Индексы строк, которые получил компонент массива. */
  const shownIndexes = (root: HTMLElement): Array<string | null> =>
    all(root, 'li[data-index]').map((item) => item.getAttribute('data-index'));

  describe('массив под-форм', () => {
    it('компонент массива получает готовые строки с индексами модели', async () => {
      const { root } = await mount(rowsForm());

      expect(shownIndexes(root)).toEqual(['0', '1']);
      expect(shownNames(root)).toEqual(['первый', 'второй']);
    });

    it('кнопки компонента добавляют по шаблону модели, удаляют и переставляют', async () => {
      const bundle = rowsForm();
      const { root, settle } = await mount(bundle);
      const names = (): string[] => bundle.model.get().rows.map((row) => row.name);

      click(get(root, '[data-action="add"]'));
      await settle();
      expect(bundle.model.get().rows[2]).toEqual({ name: '', note: '' });
      expect(shownNames(root)).toEqual(['первый', 'второй', '']);

      click(get(root, 'li[data-index="0"] [data-action="remove"]'));
      await settle();
      expect(names()).toEqual(['второй', '']);
      expect(shownNames(root)).toEqual(['второй', '']);

      click(get(root, 'li[data-index="0"] [data-action="down"]'));
      await settle();
      expect(names()).toEqual(['', 'второй']);
      expect(shownNames(root)).toEqual(['', 'второй']);
      expect(shownIndexes(root)).toEqual(['0', '1']);
    });

    it('`initialValue` узла — запасной шаблон для модели без `arrayOf`', async () => {
      const model = createShape({ rows: [] });
      const bundle = form<Shape>({
        model,
        schema: (shape) => ({
          model: shape.$.rows,
          component: kit.List,
          item: fixture.row,
          initialValue: { name: 'из схемы', note: '' },
        }),
      });

      const { root, settle } = await mount(bundle);
      click(get(root, '[data-action="add"]'));
      await settle();

      expect(model.get().rows).toEqual([{ name: 'из схемы', note: '' }]);
      expect(shownNames(root)).toEqual(['из схемы']);
    });

    it('кнопки компонента — запись через форму: массив становится dirty, сброс его снимает', async () => {
      const bundle = rowsForm();
      const { root, settle } = await mount(bundle);

      click(get(root, 'li[data-index="0"] [data-action="down"]'));
      await settle();
      expect(bundle.form.rows.dirty.value).toBe(true);

      bundle.form.reset();
      await settle();
      expect(bundle.form.rows.dirty.value).toBe(false);
      expect(shownNames(root)).toEqual(['первый', 'второй']);

      click(get(root, 'li[data-index="0"] [data-action="remove"]'));
      await settle();
      expect(bundle.form.rows.dirty.value).toBe(true);
      expect(shownNames(root)).toEqual(['второй']);
    });

    it('элемент `null` строкой не рисуется, индексы остальных — индексы модели', async () => {
      const model = createShape({
        rows: arrayOf(blankRow, [
          null as unknown as Row,
          { name: 'первый', note: '' },
          { name: 'второй', note: '' },
        ]),
      });
      const { root, settle } = await mount(rowsForm(model));
      const names = (): Array<string | undefined> => model.get().rows.map((row) => row?.name);
      expect(shownIndexes(root)).toEqual(['1', '2']);

      click(get(root, 'li[data-index="2"] [data-action="up"]'));
      await settle();
      expect(names()).toEqual([undefined, 'второй', 'первый']);

      click(get(root, 'li[data-index="2"] [data-action="remove"]'));
      await settle();
      expect(names()).toEqual([undefined, 'второй']);
      expect(shownNames(root)).toEqual(['второй']);
    });

    it('ключ строки стабилен: перестановка двигает элементы строки, а не пересоздаёт их', async () => {
      const { root, settle } = await mount(rowsForm());
      const first = getByTestId(root, 'input-rows-0-name');

      click(get(root, 'li[data-index="0"] [data-action="down"]'));
      await settle();

      // Тот же элемент — и стоит он уже во второй строке: строка переехала целиком.
      const moved = getByTestId<HTMLInputElement>(root, 'input-rows-1-name');
      expect(moved.value).toBe('первый');
      expect(moved === first).toBe(true);
      expect(moved.closest('li')?.getAttribute('data-index')).toBe('1');
      expect(shownNames(root)).toEqual(['второй', 'первый']);
    });

    it('сигнал строки в пропсах шаблона — значением и следует за вводом', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: (shape) => ({
          model: shape.$.rows,
          component: kit.List,
          item: (row: FormModel<Row>) => ({
            component: kit.Section,
            componentProps: { title: row.$.name },
            children: [{ model: row.$.name, component: kit.Input }],
          }),
        }),
      });

      const { root, settle } = await mount(bundle);
      const titles = (): Array<string | null> =>
        all(root, 'section[data-title]').map((section) => section.getAttribute('data-title'));
      expect(titles()).toEqual(['первый', 'второй']);

      typeInto(getByTestId<HTMLInputElement>(root, 'input-rows-0-name'), 'иной');
      await settle();

      expect(titles()).toEqual(['иной', 'второй']);
    });

    it('массив без компонента: только строки — и предупреждение', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const bundle = form<Shape>({
        model: createShape(),
        schema: (shape) => ({
          component: kit.Section,
          children: [{ model: shape.$.rows, item: fixture.row }],
        }),
      });

      const { root } = await mount(bundle);

      expect(shownNames(root)).toEqual(['первый', 'второй']);
      expect(root.querySelector('[data-list]')).toBeNull();
      expect(root.querySelector('[data-action]')).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('has no `component`'));
    });
  });
}
