/**
 * Привязка поля к контролу: значение в обе стороны, `disabled`, `touched`, диалект контрола,
 * нода поля и `data-testid`.
 *
 * @module renderer-contract/scenarios/field-binding
 */

import { describe, expect, it } from 'vitest';
import type { ScenarioContext } from '../context';
import { blur, byTestId, click, getByTestId, testIds, typeInto } from '../dom';
import { createShape, type Shape } from '../fixture';

export function fieldBindingScenarios({ fixture, form, kit, mount }: ScenarioContext): void {
  describe('привязка поля', () => {
    it('значение идёт в обе стороны, `disabled` — из ноды поля', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({ children: [{ model: model.$.kind, component: kit.Input }] }),
      });

      const { root, settle } = await mount(bundle);
      const input = (): HTMLInputElement => getByTestId<HTMLInputElement>(root, 'input-kind');
      expect(input().value).toBe('a');
      expect(input().disabled).toBe(false);

      typeInto(input(), 'ввод');
      await settle();
      expect(bundle.form.kind.value.value).toBe('ввод');
      expect(input().value).toBe('ввод');

      bundle.form.kind.setValue('извне');
      await settle();
      expect(input().value).toBe('извне');

      bundle.form.kind.disable();
      await settle();
      expect(input().disabled).toBe(true);

      bundle.form.kind.enable();
      await settle();
      expect(input().disabled).toBe(false);
    });

    it('потеря фокуса помечает поле тронутым', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({ children: [{ model: model.$.kind, component: kit.Input }] }),
      });

      const { root, settle } = await mount(bundle);
      expect(bundle.form.kind.touched.value).toBe(false);

      blur(getByTestId(root, 'input-kind'));
      await settle();

      expect(bundle.form.kind.touched.value).toBe(true);
    });

    it('контрол со статикой `reformerAdapter` получает значение и событие в своём диалекте', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({ children: [{ model: model.$.agree, component: kit.Toggle }] }),
      });

      const { root, settle } = await mount(bundle);
      const checked = (): string | null =>
        getByTestId(root, 'input-agree').getAttribute('data-checked');
      expect(checked()).toBe('false');

      click(getByTestId(root, 'input-agree'));
      await settle();
      expect(bundle.form.agree.value.value).toBe(true);
      expect(checked()).toBe('true');

      bundle.form.agree.setValue(false);
      await settle();
      expect(checked()).toBe('false');
    });

    it('ноду поля получает только контрол с `passControl`', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({
          children: [
            { model: model.$.kind, component: kit.ControlInput },
            { model: model.$.registration.city, component: kit.Input },
          ],
        }),
      });

      const { root, settle } = await mount(bundle);
      const withControl = (): HTMLInputElement => getByTestId<HTMLInputElement>(root, 'input-kind');

      expect(withControl().getAttribute('data-path')).toBe('kind');
      expect(withControl().value).toBe('a');
      expect(getByTestId(root, 'input-registration-city').hasAttribute('data-path')).toBe(false);

      typeInto(withControl(), 'ввод');
      await settle();
      expect(bundle.form.kind.value.value).toBe('ввод');
    });

    it('узел, привязанный к массиву целиком, — поле: контрол получает массив значением', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({ children: [{ model: model.$.tags, component: kit.Input }] }),
      });

      const { root, settle } = await mount(bundle);
      expect(getByTestId<HTMLInputElement>(root, 'input-tags').value).toBe('ru,by');

      bundle.form.tags.setValue(['kz']);
      await settle();
      expect(getByTestId<HTMLInputElement>(root, 'input-tags').value).toBe('kz');
    });

    it('`data-testid` контрола — из пути поля; явный `testId` главнее', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({
          children: [
            { model: model.$.kind, component: kit.Input },
            { model: model.$.registration.city, component: kit.Input },
            {
              model: model.$.residence.city,
              component: kit.Input,
              componentProps: { testId: 'custom' },
            },
            { model: model.$.rows, component: kit.List, item: fixture.row },
          ],
        }),
      });

      const { root } = await mount(bundle);

      expect(testIds(root)).toEqual([
        'input-kind',
        'input-registration-city',
        'input-custom',
        'input-rows-0-name',
        'input-rows-0-note',
        'input-rows-1-name',
        'input-rows-1-note',
      ]);
      expect(getByTestId<HTMLInputElement>(root, 'input-custom').value).toBe('Москва');
    });

    it('путь поля строки живой: после удаления соседки `data-testid` — с новым индексом', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({
          children: [{ model: model.$.rows, component: kit.List, item: fixture.row }],
        }),
      });

      const { root, settle } = await mount(bundle);
      const second = bundle.form.rows.at(1)!.name;
      expect(second.path.value).toBe('rows.1.name');
      expect(getByTestId<HTMLInputElement>(root, 'input-rows-1-name').value).toBe('второй');

      bundle.model.rows.removeAt(0);
      await settle();

      expect(second.path.value).toBe('rows.0.name');
      expect(byTestId(root, 'input-rows-1-name')).toBeNull();
      expect(getByTestId<HTMLInputElement>(root, 'input-rows-0-name').value).toBe('второй');
    });
  });
}
