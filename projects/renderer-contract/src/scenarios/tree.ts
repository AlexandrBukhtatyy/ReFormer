/**
 * Дерево узлов: поле, подформа, массив строк, контейнер без компонента.
 *
 * @module renderer-contract/scenarios/tree
 */

import { describe, expect, it, vi } from 'vitest';
import type { ScenarioContext } from '../context';
import { all, get, textOf } from '../dom';
import { createShape, type Shape } from '../fixture';

const valuesOf = (inputs: HTMLInputElement[]): string[] => inputs.map((input) => input.value);

export function treeScenarios({ fixture, form, kit, mount }: ScenarioContext): void {
  describe('дерево узлов', () => {
    it('рисует поле, подформу (дважды) и строки массива', async () => {
      const bundle = form<Shape>({ model: createShape(), schema: fixture.shapeSchema });

      const { root } = await mount(bundle);

      expect(get<HTMLInputElement>(root, '[data-caption="Вид"]').value).toBe('a');
      expect(valuesOf(all(root, '[data-caption="Город"]'))).toEqual(['Казань', 'Москва']);
      expect(all(root, 'li[data-index]')).toHaveLength(2);
      expect(valuesOf(all(root, '[data-caption="Имя"]'))).toEqual(['первый', 'второй']);
    });

    it('схему строки и схему подформы строит сборка — по разу на под-модель, а не рендер', async () => {
      const itemBuilder = vi.fn(fixture.row);
      const partBuilder = vi.fn(fixture.address);
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({
          component: kit.Section,
          children: [
            { model: model.$.registration, part: partBuilder },
            { model: model.$.rows, component: kit.List, item: itemBuilder },
          ],
        }),
      });

      await mount(bundle);
      await mount(bundle);

      expect(partBuilder).toHaveBeenCalledTimes(1);
      expect(itemBuilder).toHaveBeenCalledTimes(2); // две строки
    });

    it('контейнер без компонента рисует только детей; поле без обёртки стоит в div', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({
          children: [
            'Вид: ',
            model.$.kind,
            {
              children: [
                {
                  model: model.$.kind,
                  component: kit.Input,
                  componentProps: { caption: 'Вид', className: 'plain-field' },
                },
              ],
            },
          ],
        }),
      });

      const { root } = await mount(bundle);

      expect(textOf(root)).toBe('Вид: a');
      // Сами контейнеры элементов не добавили: в корне один `div` поля.
      expect(Array.from(root.children).map((child) => child.tagName)).toEqual(['DIV']);
      expect(get<HTMLInputElement>(root, 'div.plain-field [data-caption="Вид"]').value).toBe('a');
    });

    it('сборка без схемы — понятная ошибка', async () => {
      const bundle = form<Shape>({ model: createShape() });
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(mount(bundle)).rejects.toThrow(/нет дерева/);
    });
  });
}
