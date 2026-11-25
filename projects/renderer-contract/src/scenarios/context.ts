/**
 * Контекст сборки: компонент узла достаёт форму, не получая её пропом.
 *
 * @module renderer-contract/scenarios/context
 */

import { describe, expect, it } from 'vitest';
import type { ScenarioContext } from '../context';
import { getByTestId, textOf } from '../dom';
import { createShape, type Shape } from '../fixture';

export function contextScenarios({ form, kit, mount }: ScenarioContext): void {
  describe('контекст сборки', () => {
    it('компонент узла получает сборку из контекста рендерера', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: () => ({ component: kit.BundleProbe }),
      });

      const { root } = await mount(bundle);

      expect(textOf(getByTestId(root, 'bundle-probe'))).toBe('форма:a');
    });

    it('сборка доходит до компонента в глубине дерева: через контейнер и строку массива', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({
          component: kit.Section,
          children: [
            {
              model: model.$.rows,
              component: kit.List,
              item: () => ({ component: kit.BundleProbe }),
            },
          ],
        }),
      });

      const { root } = await mount(bundle);
      const probes = Array.from(root.querySelectorAll('[data-testid="bundle-probe"]'));

      expect(probes.map((probe) => textOf(probe))).toEqual(['форма:a', 'форма:a']);
    });
  });
}
