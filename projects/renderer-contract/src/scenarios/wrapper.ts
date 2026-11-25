/**
 * Обёртка поля: откуда она берётся, что получает и какие пропсы узла до контрола не доходят.
 *
 * @module renderer-contract/scenarios/wrapper
 */

import { describe, expect, it } from 'vitest';
import type { FormModel, FormSchemaNode } from '@reformer/core';
import type { ScenarioContext } from '../context';
import { get, getByTestId } from '../dom';
import { createShape, type Shape } from '../fixture';

export function wrapperScenarios({ form, kit, mount }: ScenarioContext): void {
  describe('обёртка поля', () => {
    it('подпись, описание и `required` контролу не уходят; контрол с inline-подписью получает подпись и `required`', async () => {
      const wrapperProps = { label: 'Подпись', description: 'Описание', required: true };
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({
          children: [
            {
              model: model.$.kind,
              component: kit.Input,
              componentProps: { ...wrapperProps, placeholder: 'p' },
            },
            {
              model: model.$.registration.city,
              component: kit.InlineInput,
              componentProps: wrapperProps,
            },
          ],
        }),
      });

      const { root } = await mount(bundle);
      const plain = getByTestId(root, 'input-kind');
      const inline = getByTestId(root, 'input-registration-city');

      expect(plain.hasAttribute('data-label')).toBe(false);
      expect(plain.hasAttribute('data-description')).toBe(false);
      expect(plain.hasAttribute('data-required')).toBe(false);
      expect(plain.getAttribute('placeholder')).toBe('p');

      expect(inline.getAttribute('data-label')).toBe('Подпись');
      expect(inline.getAttribute('data-required')).toBe('true');
      expect(inline.hasAttribute('data-description')).toBe(false);
    });

    it('обёртка из настроек получает ноду поля, `testId` и класс узла', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({
          children: [
            { model: model.$.kind, component: kit.Input, componentProps: { className: 'wide' } },
          ],
        }),
      });

      const { root, settle } = await mount(bundle, { fieldWrapper: kit.FieldWrapper });
      const field = (): HTMLElement => getByTestId(root, 'field-kind');

      expect(field().getAttribute('data-wrap')).toBe('field');
      expect(field().classList.contains('wide')).toBe(true);
      expect(field().querySelector('[data-testid="input-kind"]')).not.toBeNull();
      expect(field().getAttribute('data-issues')).toBe('0');

      bundle.form.kind.setIssues([{ code: 'server' }]);
      await settle();
      expect(field().getAttribute('data-issues')).toBe('1');
    });

    it('обёртка из настроек главнее той, что положил в сборку реестр', async () => {
      const model = createShape();
      const bundle = form<Shape>({
        model,
        schema: { format: 2 },
        registry: {
          resolveSchema: () => ({
            tree: { model: model.$.kind, component: kit.Input },
            fieldWrapper: kit.PlainWrapper,
          }),
        },
      });

      const fromBundle = await mount(bundle);
      expect(fromBundle.root.querySelector('[data-wrap="plain"] [data-testid]')).not.toBeNull();

      const fromSettings = await mount(bundle, { fieldWrapper: kit.FieldWrapper });
      expect(fromSettings.root.querySelector('[data-wrap="field"] [data-testid]')).not.toBeNull();
      expect(fromSettings.root.querySelector('[data-wrap="plain"]')).toBeNull();
    });

    it('обёртка в пропсах поля главнее обёртки из настроек', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({
          children: [
            { model: model.$.kind, component: kit.Input },
            {
              model: model.$.registration.city,
              component: kit.Input,
              componentProps: { fieldWrapper: kit.PlainWrapper },
            },
          ],
        }),
      });

      const { root } = await mount(bundle, { fieldWrapper: kit.FieldWrapper });

      expect(root.querySelector('[data-wrap="field"] [data-testid="input-kind"]')).not.toBeNull();
      expect(
        root.querySelector('[data-wrap="plain"] [data-testid="input-registration-city"]')
      ).not.toBeNull();
    });

    it('без обёртки поля контрол стоит в теге `wrapper` из пропсов поля', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({
          children: [
            {
              model: model.$.kind,
              component: kit.Input,
              componentProps: { wrapper: 'label', className: 'inline' },
            },
          ],
        }),
      });

      const { root } = await mount(bundle);

      expect(get(root, 'label.inline [data-testid="input-kind"]')).not.toBeNull();
      expect(root.querySelector('[data-wrap]')).toBeNull();
    });

    it('две сборки над одной моделью: каждая рисует свои ноды', async () => {
      const model = createShape();
      const schema = (shape: FormModel<Shape>): FormSchemaNode => ({
        model: shape.$.kind,
        component: kit.Input,
      });
      const first = form<Shape>({ model, schema });
      const second = form<Shape>({ model, schema });
      first.form.kind.setIssues([{ code: 'server' }]);

      const settings = { fieldWrapper: kit.FieldWrapper };
      const firstMounted = await mount(first, settings);
      const secondMounted = await mount(second, settings);

      expect(getByTestId(firstMounted.root, 'field-kind').getAttribute('data-issues')).toBe('1');
      expect(getByTestId(secondMounted.root, 'field-kind').getAttribute('data-issues')).toBe('0');
    });
  });
}
