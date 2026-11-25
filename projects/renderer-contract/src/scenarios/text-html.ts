/**
 * HTML-узлы и текст: `component` строкой-тегом, текстовые части в `children`, в том числе
 * реактивные.
 *
 * @module renderer-contract/scenarios/text-html
 */

import { describe, expect, it } from 'vitest';
import type { FormSchemaNode } from '@reformer/core';
import { signal } from '@reformer/core/signals';
import type { ScenarioContext } from '../context';
import { cleanHtml, get, textOf } from '../dom';
import { createShape, type Shape } from '../fixture';

export function textHtmlScenarios({ form, kit, mount }: ScenarioContext): void {
  /** Смонтировать дерево без привязки к модели. */
  const mountTree = (tree: FormSchemaNode) =>
    mount(form<Shape>({ model: createShape(), schema: () => tree }));

  describe('HTML-узлы и текст', () => {
    it('тег рисуется с атрибутами: `className` — классом', async () => {
      const { root } = await mountTree({
        component: 'div',
        componentProps: {
          className: 'p-4 bg-blue-50',
          id: 'notice',
          'data-role': 'note',
          'aria-label': 'Подсказка',
        },
      });

      const notice = get(root, 'div#notice');
      expect(notice.className).toBe('p-4 bg-blue-50');
      expect(notice.getAttribute('data-role')).toBe('note');
      expect(notice.getAttribute('aria-label')).toBe('Подсказка');
    });

    it('соседние текстовые части склеиваются без разделителя', async () => {
      const { root } = await mountTree({ component: 'p', children: ['Платёж: ', 30000, ' ₽'] });

      expect(cleanHtml(get(root, 'p'))).toBe('<p>Платёж: 30000 ₽</p>');
    });

    it('сигнал в тексте читается значением и следует за ним; `null` — пустой текст', async () => {
      const payment = signal<number | null>(42500);
      const { root, settle } = await mountTree({
        component: 'p',
        children: ['Платёж: ', payment, ' ₽'],
      });
      expect(textOf(get(root, 'p'))).toBe('Платёж: 42500 ₽');

      payment.value = 100;
      await settle();
      expect(textOf(get(root, 'p'))).toBe('Платёж: 100 ₽');

      payment.value = null;
      await settle();
      expect(textOf(get(root, 'p'))).toBe('Платёж:  ₽');
    });

    it('сигнал модели в тексте: лист и массив целиком', async () => {
      const bundle = form<Shape>({
        model: createShape(),
        schema: (model) => ({
          component: 'p',
          children: ['Вид: ', model.$.kind, '; теги: ', model.$.tags],
        }),
      });

      const { root, settle } = await mount(bundle);
      expect(textOf(get(root, 'p'))).toBe('Вид: a; теги: ru,by');

      bundle.form.kind.setValue('b');
      await settle();
      expect(textOf(get(root, 'p'))).toBe('Вид: b; теги: ru,by');
    });

    it('текст и узлы идут в порядке `children`', async () => {
      const { root } = await mountTree({
        component: 'p',
        children: [
          'Внимание! ',
          { component: 'b', children: ['платёж высокий'] },
          ' и далее текст',
        ],
      });

      expect(cleanHtml(get(root, 'p'))).toBe(
        '<p>Внимание! <b>платёж высокий</b> и далее текст</p>'
      );
    });

    it('тег без содержимого рисуется без детей', async () => {
      const { root } = await mountTree({
        component: 'div',
        children: [{ component: 'hr', componentProps: { className: 'my-4' } }],
      });

      expect(cleanHtml(get(root, 'div'))).toBe('<div><hr class="my-4"></div>');
    });

    it('`selector` узла в атрибуты тега не уходит', async () => {
      const { root } = await mountTree({ component: 'div', selector: 'notice', children: ['x'] });

      expect(cleanHtml(get(root, 'div'))).toBe('<div>x</div>');
    });

    it('пустая строка компонентом не считается: рисуются только дети', async () => {
      const { root } = await mountTree({ component: '', children: ['текст'] });

      expect(textOf(root)).toBe('текст');
      expect(root.children).toHaveLength(0);
    });

    it('теги и компоненты вкладываются друг в друга', async () => {
      const { root } = await mountTree({
        component: 'div',
        children: [
          {
            component: kit.Section,
            componentProps: { title: 'карточка' },
            children: [{ component: 'h4', children: ['Заголовок'] }],
          },
        ],
      });

      expect(textOf(get(root, 'div section[data-title="карточка"] h4'))).toBe('Заголовок');
    });
  });
}
