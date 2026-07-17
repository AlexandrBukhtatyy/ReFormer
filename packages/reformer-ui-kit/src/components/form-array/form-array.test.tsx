/**
 * Unit-тесты FormArraySection — ReFormer-специфичный carry-компонент (не shadcn),
 * стилизованная UI-обёртка поверх headless-compound `@reformer/cdk/form-array`.
 *
 * SSR-подход (renderToStaticMarkup + regex): проверяем разметку, метки, кнопки
 * (add/remove/reorder), пустое состояние, maxItems и guard-ветки (hasItems=false,
 * невалидный control). События не вызываются.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createModel, createForm, type FormModel, type FormProxy } from '@reformer/core';
import { FormArraySection } from './index';

type Item = { name: string };

/** Поднимает M1-форму с массивом `items` (schema-нода `{ array, item }`). */
function buildArray(initial: Item[]): any {
  const model = createModel<{ items: Item[] }>({ items: initial });
  const itemFn = (item: FormModel<Item>) => ({
    name: { value: item.$.name },
  });
  const schema = { items: { array: model.items, item: itemFn } } as any;
  const form = createForm<{ items: Item[] }>({ model, schema });
  return (form as any).items;
}

/** Тонкий item-компонент: маркер, чтобы отследить рендер каждого элемента. */
const ItemMarker = (_: { control: FormProxy<Item> }) => (
  <div data-slot="item-body">тело-элемента</div>
);

describe('FormArraySection (base carry)', () => {
  it('рендерит заголовок, кнопку добавления и карточки элементов', () => {
    const html = renderToStaticMarkup(
      <FormArraySection<Item>
        control={buildArray([{ name: 'a' }, { name: 'b' }])}
        itemComponent={ItemMarker}
        title="Имущество"
        itemLabel="Имущество"
        addButtonLabel="+ Добавить имущество"
      />
    );
    // data-slot корневой секции (добавлен при порте v7).
    expect(html).toContain('data-slot="form-array-section"');
    // Заголовок секции — h3.
    expect(html).toMatch(/<h3[^>]*>Имущество<\/h3>/);
    // Кнопка добавления с меткой.
    expect(html).toContain('data-testid="array-add"');
    expect(html).toContain('+ Добавить имущество');
    // Обе карточки-элемента.
    expect(html).toContain('data-testid="array-item-0"');
    expect(html).toContain('data-testid="array-item-1"');
    // Метки элементов «Имущество #N».
    expect(html).toContain('Имущество #1');
    expect(html).toContain('Имущество #2');
    // itemComponent отрендерен для каждого элемента.
    expect(html).toContain('data-slot="item-body"');
  });

  it('при length > 1 показывает кнопки «Удалить» на каждом элементе', () => {
    const html = renderToStaticMarkup(
      <FormArraySection<Item>
        control={buildArray([{ name: 'a' }, { name: 'b' }])}
        itemComponent={ItemMarker}
        title="Список"
        removeButtonLabel="Удалить"
      />
    );
    expect(html).toContain('data-testid="array-item-0-remove"');
    expect(html).toContain('data-testid="array-item-1-remove"');
    expect(html).toContain('Удалить');
  });

  it('единственный элемент по умолчанию без «Удалить» (showRemoveOnSingle=false)', () => {
    const html = renderToStaticMarkup(
      <FormArraySection<Item>
        control={buildArray([{ name: 'a' }])}
        itemComponent={ItemMarker}
        title="Список"
      />
    );
    expect(html).not.toContain('data-testid="array-item-0-remove"');
  });

  it('showRemoveOnSingle=true показывает «Удалить» даже для одного элемента', () => {
    const html = renderToStaticMarkup(
      <FormArraySection<Item>
        control={buildArray([{ name: 'a' }])}
        itemComponent={ItemMarker}
        title="Список"
        showRemoveOnSingle
      />
    );
    expect(html).toContain('data-testid="array-item-0-remove"');
  });

  it('reorderable рендерит кнопки перестановки ↑/↓ с aria-label', () => {
    const html = renderToStaticMarkup(
      <FormArraySection<Item>
        control={buildArray([{ name: 'a' }, { name: 'b' }])}
        itemComponent={ItemMarker}
        title="Список"
        reorderable
      />
    );
    expect(html).toContain('data-testid="array-item-0-move-up"');
    expect(html).toContain('data-testid="array-item-0-move-down"');
    expect(html).toContain('aria-label="Переместить вверх"');
    expect(html).toContain('aria-label="Переместить вниз"');
    // Первый элемент не может двигаться вверх — кнопка disabled.
    expect(html).toMatch(/array-item-0-move-up[^>]*disabled|disabled[^>]*array-item-0-move-up/);
  });

  it('пустой массив с emptyMessage рендерит сообщение и подсказку', () => {
    const html = renderToStaticMarkup(
      <FormArraySection<Item>
        control={buildArray([])}
        itemComponent={ItemMarker}
        emptyMessage="Нажмите «Добавить» для добавления информации"
        emptyMessageHint="Можно добавить несколько записей"
      />
    );
    expect(html).toContain('Нажмите «Добавить» для добавления информации');
    expect(html).toContain('Можно добавить несколько записей');
  });

  it('без title кнопка добавления рендерится как футер', () => {
    const html = renderToStaticMarkup(
      <FormArraySection<Item>
        control={buildArray([])}
        itemComponent={ItemMarker}
        addButtonLabel="+ Добавить"
      />
    );
    // Нет h3-заголовка, но есть add-кнопка (footer-вариант).
    expect(html).not.toContain('<h3');
    expect(html).toContain('data-testid="array-add"');
    expect(html).toContain('+ Добавить');
  });

  it('maxItems достигнут — кнопка добавления скрыта', () => {
    const html = renderToStaticMarkup(
      <FormArraySection<Item>
        control={buildArray([{ name: 'a' }, { name: 'b' }])}
        itemComponent={ItemMarker}
        title="Список"
        maxItems={2}
      />
    );
    expect(html).not.toContain('data-testid="array-add"');
  });

  it('hasItems=false скрывает секцию целиком (пустая строка)', () => {
    const html = renderToStaticMarkup(
      <FormArraySection<Item>
        control={buildArray([{ name: 'a' }])}
        itemComponent={ItemMarker}
        title="Имущество"
        hasItems={false}
      />
    );
    expect(html).toBe('');
  });

  it('невалидный control (не ArrayNode) → предупреждение и пустая строка', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = renderToStaticMarkup(
      <FormArraySection<Item> control={{} as any} itemComponent={ItemMarker} title="X" />
    );
    expect(html).toBe('');
    expect(warn).toHaveBeenCalledWith(
      '[FormArraySection] control is not an ArrayNode/FormArrayProxy.'
    );
    warn.mockRestore();
  });
});
