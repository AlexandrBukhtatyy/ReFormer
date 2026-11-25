/**
 * Пропсы и события узлов: подмена пропсов поведением, обработчики событий компонента, сигналы и
 * описатели локали в пропсах.
 *
 * @module renderer-contract/scenarios/props-events
 */

import { describe, expect, it, vi } from 'vitest';
import type { FormModel } from '@reformer/core';
import { defineFormBehavior, onComponentEvent } from '@reformer/core/behaviors';
import { msg, type FormLocale } from '@reformer/core/i18n';
import { signal } from '@reformer/core/signals';
import type { ScenarioContext } from '../context';
import { all, click, get, getByTestId } from '../dom';
import { createShape, type Row, type Shape } from '../fixture';

export function propsEventsScenarios({ fixture, form, kit, mount }: ScenarioContext): void {
  describe('пропсы и события узлов', () => {
    it('контейнер: `patchProps` и обработчик события доходят до компонента', async () => {
      const submit = vi.fn();
      const bundle = form<Shape>({
        model: createShape(),
        schema: () => ({
          selector: 'probe',
          component: kit.Section,
          componentProps: { title: 'исходный', tone: 'тихий' },
        }),
        behavior: defineFormBehavior<Shape>(({ schema }) => {
          schema.node('probe').patchProps({ title: 'новый' });
          onComponentEvent(schema.node('probe'), 'onSubmit', submit);
        }),
      });

      const { root } = await mount(bundle);
      const section = get(root, 'section[data-title]');

      expect(section.getAttribute('data-title')).toBe('новый');
      expect(section.getAttribute('data-tone')).toBe('тихий');
      click(get(root, '[data-action="submit"]'));
      expect(submit).toHaveBeenCalledWith('payload');
    });

    it('контейнер: компонент получает `selector` своего узла, узел без селектора — ничего', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: () => ({
          selector: 'probe',
          component: kit.Section,
          children: [{ component: kit.Section }],
        }),
      });

      const { root } = await mount(bundle);
      const sections = all(root, 'section');

      expect(sections).toHaveLength(2);
      expect(sections[0]!.getAttribute('data-selector')).toBe('probe');
      expect(sections[1]!.hasAttribute('data-selector')).toBe(false);
    });

    it('контейнер: `patchProps` после монтирования перерисовывает узел', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: () => ({
          selector: 'probe',
          component: kit.Section,
          componentProps: { title: 'исходный' },
        }),
      });

      const { root, settle } = await mount(bundle);
      bundle.render.controller.scopeOf(bundle.model).node('probe').patchProps({ title: 'позже' });
      await settle();

      expect(get(root, 'section[data-title]').getAttribute('data-title')).toBe('позже');
    });

    it('контейнер: обработчик поведения главнее одноимённого пропа схемы', async () => {
      const fromSchema = vi.fn();
      const fromBehavior = vi.fn();
      const bundle = form<Shape>({
        model: createShape(),
        schema: () => ({
          selector: 'probe',
          component: kit.Section,
          componentProps: { onSubmit: fromSchema },
        }),
        behavior: defineFormBehavior<Shape>(({ schema }) => {
          onComponentEvent(schema.node('probe'), 'onSubmit', fromBehavior);
        }),
      });

      const { root } = await mount(bundle);
      click(get(root, '[data-action="submit"]'));

      expect(fromBehavior).toHaveBeenCalledTimes(1);
      expect(fromSchema).not.toHaveBeenCalled();
    });

    it('поле: `patchProps` доходит до контрола, а событие идёт поверх записи значения', async () => {
      const toggled = vi.fn();
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({
          selector: 'root',
          children: [
            {
              selector: 'agree',
              model: model.$.agree,
              component: kit.Toggle,
              componentProps: { caption: 'Согласие' },
            },
          ],
        }),
        behavior: defineFormBehavior<Shape>(({ schema }) => {
          schema.node('agree').patchProps({ caption: 'Новое согласие' });
          onComponentEvent(schema.node('agree'), 'onToggle', toggled);
        }),
      });

      const { root, settle } = await mount(bundle);
      expect(getByTestId(root, 'input-agree').getAttribute('data-caption')).toBe('Новое согласие');

      click(getByTestId(root, 'input-agree'));
      await settle();

      // Привязка не потеряна: значение записано в форму, и обработчик получил то же значение.
      expect(bundle.form.agree.value.value).toBe(true);
      expect(toggled).toHaveBeenCalledWith(true);
      expect(getByTestId(root, 'input-agree').getAttribute('data-checked')).toBe('true');
    });

    it('массив: `patchProps` доходит до компонента, событие кнопки идёт поверх добавления', async () => {
      const added = vi.fn();
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({
          selector: 'root',
          children: [
            {
              selector: 'rows',
              model: model.$.rows,
              component: kit.List,
              item: fixture.row,
              componentProps: { title: 'Строки' },
            },
          ],
        }),
        behavior: defineFormBehavior<Shape>(({ schema }) => {
          schema.node('rows').patchProps({ title: 'Новые строки' });
          onComponentEvent(schema.node('rows'), 'onAdd', added);
        }),
      });

      const { root, settle } = await mount(bundle);
      expect(get(root, '[data-list]').getAttribute('data-title')).toBe('Новые строки');

      click(get(root, '[data-action="add"]'));
      await settle();

      expect(bundle.model.get().rows).toHaveLength(3);
      expect(added).toHaveBeenCalledTimes(1);
      expect(all(root, 'li[data-index]')).toHaveLength(3);
    });

    it('подформа: правило `patchProps` — предупреждение, своего компонента у неё нет', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({
          selector: 'root',
          children: [
            { selector: 'registration-part', model: model.$.registration, part: fixture.address },
          ],
        }),
        behavior: defineFormBehavior<Shape>(({ schema }) => {
          schema.node('registration-part').patchProps({ title: 'никуда' });
        }),
      });

      await mount(bundle);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('"registration-part"'));
    });

    it('сигнал в пропсах контейнера приходит значением и следует за моделью', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({
          component: kit.Section,
          componentProps: { title: model.$.kind, items: model.$.tags },
          children: [{ model: model.$.kind, component: kit.Input }],
        }),
      });

      const { root, settle } = await mount(bundle);
      const section = (): HTMLElement => get(root, 'section[data-title]');
      expect(section().getAttribute('data-title')).toBe('a');
      expect(section().getAttribute('data-items')).toBe('ru+by');

      // Теги в схеме полем не привязаны — ноды формы у них нет, запись идёт в модель.
      bundle.form.kind.setValue('b');
      bundle.model.patch({ tags: ['kz'] });
      await settle();

      expect(section().getAttribute('data-title')).toBe('b');
      expect(section().getAttribute('data-items')).toBe('kz');
    });

    it('сигнал в пропсах поля — у всех строк массива, в том числе добавленных позже', async () => {
      const types = signal<string[]>([]);
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({
          children: [
            {
              model: model.$.rows,
              component: kit.List,
              item: (row: FormModel<Row>) => ({
                children: [
                  { model: row.$.name, component: kit.Input, componentProps: { options: types } },
                ],
              }),
            },
          ],
        }),
      });

      const { root, settle } = await mount(bundle);
      const counts = (): Array<string | null> =>
        all(root, '[data-testid^="input-rows-"]').map((input) =>
          input.getAttribute('data-options')
        );
      expect(counts()).toEqual(['0', '0']);

      types.value = ['дом', 'квартира'];
      await settle();
      bundle.model.rows.push();
      await settle();

      expect(counts()).toEqual(['2', '2', '2']);
    });

    it('описатели `msg()` в пропсах поля, контейнера и массива — строками по локали', async () => {
      const locale: FormLocale = {
        code: 'ru',
        messages: {
          'f.placeholder': 'Ваше имя',
          'f.section': 'Анкета',
          'f.add': 'Добавить строку',
        },
      };
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({
          component: kit.Section,
          componentProps: { title: msg('f.section') },
          children: [
            {
              model: model.$.kind,
              component: kit.Input,
              componentProps: { placeholder: msg('f.placeholder') },
            },
            {
              model: model.$.rows,
              component: kit.List,
              componentProps: { addLabel: msg('f.add') },
              item: fixture.row,
            },
          ],
        }),
      });

      const { root } = await mount(bundle, { locale });

      expect(get(root, 'section[data-title]').getAttribute('data-title')).toBe('Анкета');
      expect(getByTestId(root, 'input-kind').getAttribute('placeholder')).toBe('Ваше имя');
      expect(get(root, '[data-list]').getAttribute('data-add-label')).toBe('Добавить строку');
    });
  });
}
