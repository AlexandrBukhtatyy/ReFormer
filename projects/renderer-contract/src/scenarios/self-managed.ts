/**
 * Компонент, который ведёт детей сам (`__selfManagedChildren`): вместо готовых детей получает
 * узлы скомпилированной схемы и `renderNode`.
 *
 * @module renderer-contract/scenarios/self-managed
 */

import { describe, expect, it, vi } from 'vitest';
import type { ScenarioContext } from '../context';
import { all, get, getByTestId, typeInto } from '../dom';
import { createShape, type Shape } from '../fixture';

export function selfManagedScenarios({ form, kit, mount }: ScenarioContext): void {
  describe('компонент, который ведёт детей сам', () => {
    it('получает узлы и `renderNode`: рисует каждый там, где решит', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({
          component: kit.Steps,
          children: [
            {
              selector: 'first',
              component: kit.Section,
              children: [
                { model: model.$.kind, component: kit.Input, componentProps: { caption: 'Вид' } },
              ],
            },
            { selector: 'second', component: kit.Section, componentProps: { title: 'пусто' } },
          ],
        }),
      });

      const { root, settle } = await mount(bundle);
      const first = get(root, 'li[data-step="first"]');

      expect(get(root, 'ol').getAttribute('data-count')).toBe('2');
      expect(first.querySelector('[data-caption="Вид"]')).not.toBeNull();
      expect(get(root, 'li[data-step="second"] section').getAttribute('data-title')).toBe('пусто');

      // Узел, нарисованный через `renderNode`, — обычный узел формы: привязка поля работает.
      typeInto(getByTestId<HTMLInputElement>(first, 'input-kind'), 'ввод');
      await settle();
      expect(bundle.form.kind.value.value).toBe('ввод');
    });

    it('узлы-дети — скомпилированные: вид и пропсы узла; текстовые части отброшены с предупреждением', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const bundle = form<Shape>({
        model: createShape(),
        schema: () => ({
          component: kit.Steps,
          children: [
            'текст',
            { selector: 'first', component: kit.Section, componentProps: { title: 'Шаг' } },
          ],
        }),
      });

      const { root } = await mount(bundle);
      const steps = all(root, 'li[data-step]');

      expect(get(root, 'ol').getAttribute('data-count')).toBe('1');
      expect(steps).toHaveLength(1);
      expect(steps[0]!.getAttribute('data-step')).toBe('first');
      expect(steps[0]!.getAttribute('data-kind')).toBe('container');
      expect(steps[0]!.getAttribute('data-title')).toBe('Шаг');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('текстовых частей'));
    });
  });
}
