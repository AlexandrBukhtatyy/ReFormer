/**
 * Видимость узлов и области схемы: правило действует в своей области и следует за сигналами.
 *
 * @module renderer-contract/scenarios/scopes-visibility
 */

import { describe, expect, it } from 'vitest';
import { apply, applyEach, defineFormBehavior, hideWhen } from '@reformer/core/behaviors';
import type { ScenarioContext } from '../context';
import { all } from '../dom';
import { createShape, type Address, type Row, type Shape } from '../fixture';

export function scopesVisibilityScenarios({ fixture, form, mount }: ScenarioContext): void {
  describe('видимость и области схемы', () => {
    it('`hideWhen` корневого поведения скрывает узел и следует за условием', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: fixture.shapeSchema,
        behavior: defineFormBehavior<Shape>(({ model, schema }) => {
          hideWhen(schema.node('residence'), () => model.kind === 'a');
        }),
      });

      const { root, settle } = await mount(bundle);
      expect(root.querySelector('[data-title="проживание"]')).toBeNull();
      expect(root.querySelector('[data-title="регистрация"]')).not.toBeNull();

      bundle.form.kind.setValue('b');
      await settle();
      expect(root.querySelector('[data-title="проживание"]')).not.toBeNull();

      bundle.form.kind.setValue('a');
      await settle();
      expect(root.querySelector('[data-title="проживание"]')).toBeNull();
    });

    it('области изолированы: правило подформы действует только в своей группе', async () => {
      const addressBehavior = defineFormBehavior<Address>(({ model, schema }) => {
        hideWhen(schema.node('street'), () => model.city === 'Москва');
      });
      const bundle = form<Shape>({
        model: createShape(),
        schema: fixture.shapeSchema,
        behavior: defineFormBehavior<Shape>(({ model }) => {
          apply([model.$.registration, model.$.residence], addressBehavior);
        }),
      });

      const { root, settle } = await mount(bundle);

      // Улица скрыта у адреса проживания (Москва) и видна у адреса регистрации (Казань).
      expect(all(root, '[data-title="улица"]')).toHaveLength(1);
      expect(root.querySelector('[data-title="регистрация"] [data-title="улица"]')).not.toBeNull();
      expect(all(root, '[data-caption="Город"]')).toHaveLength(2);

      bundle.form.residence.city.setValue('Тверь');
      await settle();
      expect(all(root, '[data-title="улица"]')).toHaveLength(2);
    });

    it('правило строки массива действует в своей строке', async () => {
      const rowBehavior = defineFormBehavior<Row>(({ model, schema }) => {
        hideWhen(schema.node('note'), () => model.name === 'первый');
      });
      const bundle = form<Shape>({
        model: createShape(),
        schema: fixture.shapeSchema,
        behavior: defineFormBehavior<Shape>(({ model }) => {
          applyEach(model.$.rows, rowBehavior);
        }),
      });

      const { root, settle } = await mount(bundle);
      expect(root.querySelector('li[data-index="0"] [data-title="заметка"]')).toBeNull();
      expect(root.querySelector('li[data-index="1"] [data-title="заметка"]')).not.toBeNull();

      bundle.form.rows.at(1)!.name.setValue('первый');
      await settle();
      expect(all(root, '[data-title="заметка"]')).toHaveLength(0);
    });

    it('`setHidden` главнее условия, `resetHidden` возвращает условие', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: fixture.shapeSchema,
        behavior: defineFormBehavior<Shape>(({ model, schema }) => {
          hideWhen(schema.node('residence'), () => model.kind === 'a');
        }),
      });
      const scope = bundle.render.controller.scopeOf(bundle.model);

      const { root, settle } = await mount(bundle);
      const shown = (title: string): boolean =>
        root.querySelector(`[data-title="${title}"]`) !== null;
      expect(shown('проживание')).toBe(false);

      scope.node('residence').setHidden(false);
      scope.node('registration').setHidden(true);
      await settle();
      expect(shown('проживание')).toBe(true);
      expect(shown('регистрация')).toBe(false);

      scope.node('residence').resetHidden();
      scope.node('registration').resetHidden();
      await settle();
      expect(shown('проживание')).toBe(false);
      expect(shown('регистрация')).toBe(true);
    });
  });
}
