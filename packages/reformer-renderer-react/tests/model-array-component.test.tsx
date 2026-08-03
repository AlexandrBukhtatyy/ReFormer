/**
 * Массив, рендеримый зарегистрированным компонентом (узел `{ array, item, component }`) +
 * разворачивание signal-пропсов (`useSignalProps`).
 *
 * Рендер — через `renderToStaticMarkup` (DOM-окружения в пакете нет). Проверяем: (1) элементы
 * рендерятся переданным компонентом-обёрткой, без встроенного add-хрома; (2) `$model(...)` в
 * componentProps элемента доходит до компонента значением, а не сырым Signal; (3) без `component`
 * работает прежняя встроенная секция (backward compat).
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { signal } from '@reformer/core/signals';
import { FormRenderer } from '../src/core/form-renderer';
import { useModelArrayItems } from '../src/core/render-node';
import type { RenderNode, RenderModelArrayControl } from '../src/core/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

const render = (node: RenderNode<any>): string =>
  renderToStaticMarkup(<FormRenderer render={() => node} />);

/** Минимальный контрол массива для рендера (read-часть: length/at/map). */
function fakeArray(items: any[]): RenderModelArrayControl {
  return {
    __path: 'alerts',
    length: items.length,
    at: (i: number) => items[i],
    map: (fn: any) => items.map(fn),
    push: () => {},
    removeAt: () => {},
    move: () => {},
  } as any;
}

// Компонент-обёртка списка (аналог ui-kit List, на useModelArrayItems) и display-элемент.
const ListWrap = ({ array, item, fieldWrapper, className }: any) => {
  const items = useModelArrayItems(array, item, fieldWrapper);
  return <ul className={className}>{items.map((it) => it.element)}</ul>;
};
const Alert = ({ message, type }: any) => <li className={`alert-${type}`}>{message}</li>;

describe('array node с $component', () => {
  it('рендерит элементы компонентом-обёрткой, без встроенного add-хрома', () => {
    const el0 = { m: signal('Alpha'), t: signal('info') };
    const el1 = { m: signal('Beta'), t: signal('error') };
    const node: any = {
      array: fakeArray([el0, el1]),
      component: ListWrap,
      componentProps: { className: 'space-y-2' },
      initialValue: () => ({}),
      item: (im: any) => ({ component: Alert, componentProps: { message: im.m, type: im.t } }),
    };
    const html = render(node);
    expect(html).toContain('<ul class="space-y-2">');
    expect(html).toContain('Alpha');
    expect(html).toContain('Beta');
    expect(html).toContain('alert-info');
    expect(html).toContain('alert-error');
    expect(html).not.toContain('array-add'); // нет встроенной кнопки «Добавить»
  });

  it('useSignalProps: $model в componentProps элемента разворачивается в значение', () => {
    // message — сигнал; без unwrap Alert получил бы объект Signal вместо строки.
    const el = { m: signal('Warning!'), t: signal('warning') };
    const node: any = {
      array: fakeArray([el]),
      component: ListWrap,
      initialValue: () => ({}),
      item: (im: any) => ({ component: Alert, componentProps: { message: im.m, type: im.t } }),
    };
    expect(render(node)).toContain('Warning!');
  });

  it('без component — прежняя встроенная секция с кнопкой «Добавить» (backward compat)', () => {
    const node: any = {
      array: fakeArray([{ m: signal('x'), t: signal('info') }]),
      initialValue: () => ({}),
      item: (im: any) => ({ component: Alert, componentProps: { message: im.m, type: im.t } }),
    };
    expect(render(node)).toContain('array-add');
  });
});
