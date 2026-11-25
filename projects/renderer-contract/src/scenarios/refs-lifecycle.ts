/**
 * Ref узла и жизненный цикл: `getRef()`, хуки `onMount` / `onUnmount` и эффекты отрисовки.
 *
 * @module renderer-contract/scenarios/refs-lifecycle
 */

import { describe, expect, it } from 'vitest';
import { defineFormBehavior, onMount, onUnmount, renderEffect } from '@reformer/core/behaviors';
import type { ScenarioContext } from '../context';
import { get } from '../dom';
import { createShape, type Shape } from '../fixture';

export function refsLifecycleScenarios({ fixture, form, kit, mount }: ScenarioContext): void {
  describe('ref узла и жизненный цикл', () => {
    it('`onMount` исполняется на монтировании, его уборка и `onUnmount` — на снятии', async () => {
      const log: string[] = [];
      const bundle = form<Shape>({
        model: createShape(),
        schema: () => ({ selector: 'probe', component: kit.Section }),
        behavior: defineFormBehavior<Shape>(({ schema }) => {
          onMount(schema.node('probe'), () => {
            log.push('mount');
            return () => {
              log.push('cleanup');
            };
          });
          onUnmount(schema.node('probe'), () => {
            log.push('unmount');
          });
        }),
      });
      expect(log).toEqual([]);

      const mounted = await mount(bundle);
      expect(log).toEqual(['mount']);

      await mounted.unmount();
      expect(log).toEqual(['mount', 'cleanup', 'unmount']);
    });

    it('ref контейнера по селектору: пуст до монтирования, занят на экране, пуст после снятия', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: () => ({ selector: 'probe', component: kit.Section }),
      });
      // Ref запрашивается до отрисовки: узел подхватывает его при монтировании.
      const ref = bundle.render.controller.scopeOf(bundle.model).node('probe').getRef();
      expect(ref.current).toBeNull();

      const mounted = await mount(bundle);
      expect(ref.current).not.toBeNull();

      await mounted.unmount();
      expect(ref.current).toBeNull();
    });

    it('ref HTML-узла — сам элемент', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: () => ({
          selector: 'notice',
          component: 'div',
          componentProps: { id: 'notice' },
          children: ['x'],
        }),
      });
      const ref = bundle.render.controller.scopeOf(bundle.model).node('notice').getRef();

      const { root } = await mount(bundle);

      expect(ref.current === get(root, 'div#notice')).toBe(true);
    });

    it('ref поля — и по селектору, и по пути модели', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({
          children: [
            { selector: 'kind', model: model.$.kind, component: kit.Input },
            { model: model.$.registration.city, component: kit.Input },
          ],
        }),
      });
      const scope = bundle.render.controller.scopeOf(bundle.model);
      const bySelector = scope.node('kind').getRef();
      const byPath = scope.node('registration.city').getRef();

      const mounted = await mount(bundle);
      expect(bySelector.current).not.toBeNull();
      expect(byPath.current).not.toBeNull();

      await mounted.unmount();
      expect(bySelector.current).toBeNull();
      expect(byPath.current).toBeNull();
    });

    it('ref поля строки массива ищется по живому пути: после удаления соседки — у новой первой', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({
          children: [{ model: model.$.rows, component: kit.List, item: fixture.row }],
        }),
      });
      const ref = bundle.render.controller.scopeOf(bundle.model).node('rows.0.name').getRef();

      const { settle } = await mount(bundle);
      expect(ref.current).not.toBeNull();

      bundle.model.rows.removeAt(0);
      await settle();

      expect(ref.current).not.toBeNull();
    });

    it('эффект отрисовки: стартует после монтирования, перезапускается по сигналу, гаснет на снятии', async () => {
      const log: string[] = [];
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({ children: [{ model: model.$.kind, component: kit.Input }] }),
        behavior: defineFormBehavior<Shape>(({ model, schema }) => {
          renderEffect(schema, () => {
            const kind = model.$.kind.value;
            log.push(`run:${kind}`);
            return () => {
              log.push(`stop:${kind}`);
            };
          });
        }),
      });
      expect(log).toEqual([]);

      const mounted = await mount(bundle);
      expect(log).toEqual(['run:a']);

      bundle.form.kind.setValue('b');
      await mounted.settle();
      expect(log).toEqual(['run:a', 'stop:a', 'run:b']);

      await mounted.unmount();
      expect(log).toEqual(['run:a', 'stop:a', 'run:b', 'stop:b']);
    });
  });
}
