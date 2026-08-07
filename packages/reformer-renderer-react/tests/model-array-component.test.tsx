/**
 * Массив, рендеримый зарегистрированным компонентом (узел `{ array, item, component }`) +
 * разворачивание signal-пропсов (`useSignalProps`).
 *
 * Рендер — через `renderToStaticMarkup` (DOM-окружения в пакете нет). Проверяем: (1) компонент
 * получает ГОТОВЫЕ элементы пропом `items` и не обязан звать хуки рендерера; (2) `$model(...)` в
 * componentProps элемента доходит до компонента значением, а не сырым Signal; (3) колбэки
 * `onAdd`/`onRemove`/`onMove` доходят и дёргают контрол массива; (4) без `component` работает
 * безхромный fallback — элементы есть, UI управления нет.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { signal } from '@reformer/core/signals';
import { FormRenderer } from '../src/core/form-renderer';
import type { RenderNode, RenderModelArrayControl, ArrayComponentProps } from '../src/core/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

const render = (node: RenderNode<any>): string =>
  renderToStaticMarkup(<FormRenderer render={() => node} />);

/** Минимальный контрол массива для рендера (read-часть: length/at/map). */
function fakeArray(items: any[], mutations?: Partial<RenderModelArrayControl>) {
  return {
    __path: 'alerts',
    length: items.length,
    at: (i: number) => items[i],
    map: (fn: any) => items.map(fn),
    push: () => {},
    removeAt: () => {},
    move: () => {},
    ...mutations,
  } as any as RenderModelArrayControl;
}

// Компонент-обёртка списка (аналог ui-kit List): получает готовые items — ни хуков рендерера,
// ни сигналов, ни RenderNode. Ровно то, ради чего инвертирована инъекция.
const ListWrap = ({ items = [], className }: ArrayComponentProps & { className?: string }) => (
  <ul className={className}>
    {items.map((it) => (
      <li key={it.key} data-index={it.index}>
        {it.children}
      </li>
    ))}
  </ul>
);
const Alert = ({ message, type }: any) => <span className={`alert-${type}`}>{message}</span>;

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
    expect(html).toContain('data-index="0"');
    expect(html).toContain('data-index="1"');
    expect(html).not.toContain('array-add'); // хром — забота компонента, не рендерера
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

  it('onAdd/onRemove/onMove приходят пропами и дёргают контрол массива', () => {
    const push = vi.fn();
    const removeAt = vi.fn();
    const move = vi.fn();
    const captured: ArrayComponentProps[] = [];
    const Capture = (props: ArrayComponentProps) => {
      captured.push(props);
      return null;
    };
    const node: any = {
      array: fakeArray([{ m: signal('x'), t: signal('info') }], { push, removeAt, move }),
      component: Capture,
      // фабрика: рендерер обязан её вызвать, а не передать функцию в push как значение
      initialValue: () => ({ fresh: true }),
      item: (im: any) => ({ component: Alert, componentProps: { message: im.m, type: im.t } }),
    };
    render(node);

    const props = captured[0];
    expect(props.items).toHaveLength(1);
    props.onAdd();
    props.onRemove(0);
    props.onMove(0, 1);
    expect(push).toHaveBeenCalledWith({ fresh: true });
    expect(removeAt).toHaveBeenCalledWith(0);
    expect(move).toHaveBeenCalledWith(0, 1);
  });

  it('без component — безхромный fallback: элементы есть, UI управления нет', () => {
    const node: any = {
      array: fakeArray([{ m: signal('x'), t: signal('info') }]),
      initialValue: () => ({}),
      item: (im: any) => ({ component: Alert, componentProps: { message: im.m, type: im.t } }),
    };
    const html = render(node);
    expect(html).toContain('alert-info');
    expect(html).toContain('x');
    expect(html).not.toContain('array-add');
    expect(html).not.toContain('<section');
  });
});
