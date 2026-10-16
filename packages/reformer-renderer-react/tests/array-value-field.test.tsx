/**
 * Поле, привязанное к массиву целиком: мультивыбор, теги, список файлов.
 *
 * Узел-массив дерева `model.$` — ручка значения, но не `instanceof Signal`. Рендерер отличал поле
 * от контейнера именно этой проверкой, поэтому узел `{ model: model.$.tags, component }` уходил в
 * ветку контейнера: компонент рисовался без `value`/`onChange`. Здесь закреплено, что такой узел —
 * поле, и что массив в тексте и в пропсах читается значением.
 *
 * Рендер проверяется через `renderToStaticMarkup` — как в соседних тестах пакета.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FC } from 'react';
import { compileSchema, createForm, createModel } from '@reformer/core';
import { FormRenderer } from '../src/core/form-renderer';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface F {
  name: string;
  tags: string[];
  profile: { langs: string[] };
}

const INITIAL: F = { name: '', tags: ['ru', 'by'], profile: { langs: ['en'] } };

/** Контрол мультивыбора в объёме теста: показывает, что значение до него доехало. */
const Multi: FC<{ value?: string[] | null; onChange?: unknown; label?: string }> = ({
  value,
  onChange,
  label,
}) => (
  <i data-label={label} data-bound={typeof onChange === 'function'}>
    {(value ?? []).join('|')}
  </i>
);
const Chips: FC<{ items?: string[] }> = ({ items }) => <b>{(items ?? []).join('+')}</b>;

describe('узел схемы с массивом в value', () => {
  it('распознаётся как поле, а не как контейнер', () => {
    const model = createModel<F>({ ...INITIAL });
    const kindOf = (node: unknown): string => compileSchema(node as any, model).root.kind;
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(kindOf({ model: model.$.tags, component: Multi })).toBe('field');
    expect(kindOf({ model: model.$.name, component: Multi })).toBe('field');
    // Группа полем не бывает: её узел без `part` — контейнер.
    expect(kindOf({ model: model.$.profile, component: Multi })).toBe('container');
    vi.restoreAllMocks();
  });

  it('компонент получает значение массива и onChange — в корне и во вложенной группе', () => {
    const bundle = createForm<F>({
      initial: { ...INITIAL },
      schema: (model) =>
        ({
          component: 'div',
          children: [
            { model: model.$.tags, component: Multi, componentProps: { label: 'Теги' } },
            { model: model.$.profile.langs, component: Multi },
          ],
        }) as never,
    });

    const html = renderToStaticMarkup(<FormRenderer form={bundle} />);

    expect(html).toContain('data-label="Теги"');
    expect(html).toContain('data-bound="true"');
    expect(html).toContain('>ru|by</i>');
    expect(html).toContain('>en</i>');

    // Запись через ноду формы видна следующему рендеру — значение одно на модель и форму.
    bundle.form.tags.setValue(['kz']);
    expect(renderToStaticMarkup(<FormRenderer form={bundle} />)).toContain('>kz</i>');
  });
});

describe('массив как значение вне поля', () => {
  it('в componentProps разворачивается в массив, а не доезжает узлом дерева сигналов', () => {
    const model = createModel<F>({ ...INITIAL });
    const node = { component: Chips, componentProps: { items: model.$.tags } } as any;

    expect(renderToStaticMarkup(<FormRenderer render={() => node} />)).toBe('<b>ru+by</b>');
  });

  it('в тексте читается значением', () => {
    const model = createModel<F>({ ...INITIAL });
    const node = { component: 'p', children: ['Теги: ', model.$.tags] } as any;

    expect(renderToStaticMarkup(<FormRenderer render={() => node} />)).toBe('<p>Теги: ru,by</p>');
  });
});
