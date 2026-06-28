/**
 * Тесты рендерера единой схемы (M1, Ф6) через SSR renderToStaticMarkup (без jsdom).
 *
 * Проверяет: рендер field/container из дерева узлов, разворот сигнала в value,
 * onChange → запись в модель (через ноду из реестра и напрямую в сигнал).
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createModel, createForm, getNodeForSignal } from '@reformer/core';
import { RenderModelNode, RenderModelArray } from '../src/core/render-model';

/* eslint-disable @typescript-eslint/no-explicit-any */
const Input = ({ value }: any) => <input value={String(value ?? '')} readOnly />;
const Box = ({ children }: any) => <div className="box">{children}</div>;

describe('RenderModelNode (SSR)', () => {
  it('рендерит field/container, значение из сигнала модели', () => {
    const model = createModel<{ email: string; profile: { name: string } }>({
      email: 'a@b.c',
      profile: { name: 'Иван' },
    });
    const schema = {
      component: Box,
      children: [
        { value: model.$.email, component: Input },
        { component: Box, children: [{ value: model.$.profile.name, component: Input }] },
      ],
    };
    createForm<{ email: string; profile: { name: string } }>({ model, schema });
    const html = renderToStaticMarkup(<RenderModelNode node={schema as any} />);
    expect(html).toContain('a@b.c');
    expect(html).toContain('Иван');
    expect(html).toContain('class="box"');
  });

  it('onChange через ноду из реестра пишет в модель', () => {
    let captured: any = null;
    const Capture = (props: any) => {
      captured = props;
      return null;
    };
    const model = createModel<{ x: string }>({ x: '' });
    const schema = { component: Box, children: [{ value: model.$.x, component: Capture }] };
    createForm<{ x: string }>({ model, schema });
    renderToStaticMarkup(<RenderModelNode node={schema as any} />);
    expect(captured).not.toBeNull();
    expect(captured.value).toBe('');
    captured.onChange('typed');
    expect(model.x).toBe('typed');
  });

  it('RenderModelArray рендерит элементы и пишет в модель', () => {
    const captured: any[] = [];
    const Capture = (props: any) => {
      captured.push(props);
      return null;
    };
    const model = createModel<{ items: { name: string }[] }>({ items: [] });
    model.items.push({ name: 'A' });
    model.items.push({ name: 'B' });
    const itemComponent = (item: any) => ({ value: item.$.name, component: Capture });
    const html = renderToStaticMarkup(
      <RenderModelArray control={model.items as any} itemComponent={itemComponent} />
    );
    expect(html).toContain('<div'); // wrapper
    expect(captured.length).toBe(2);
    expect(captured[0].value).toBe('A');
    // per-item state: для поля элемента создана нода (валидация/состояние доступны)
    expect(getNodeForSignal(model.items.at(0)!.$.name)).toBeDefined();
    expect(getNodeForSignal(model.items.at(1)!.$.name)).toBeDefined();
    captured[1].onChange('B2'); // через ноду (fieldNode.setValue) → модель
    expect(model.get().items[1].name).toBe('B2');
  });

  it('без формы (direct) — onChange пишет напрямую в сигнал', () => {
    let captured: any = null;
    const Capture = (props: any) => {
      captured = props;
      return null;
    };
    const model = createModel<{ y: string }>({ y: 'init' });
    const schema = { value: model.$.y, component: Capture };
    renderToStaticMarkup(<RenderModelNode node={schema as any} />);
    expect(captured.value).toBe('init');
    captured.onChange('z');
    expect(model.y).toBe('z');
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
