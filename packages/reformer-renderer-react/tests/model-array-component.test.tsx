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
import { arrayOf, createModel, type FormModel } from '@reformer/core';
import { FormRenderer } from '../src/core/form-renderer';
import type { RenderNode, ArrayComponentProps } from '../src/core/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

const render = (node: RenderNode<any>): string =>
  renderToStaticMarkup(<FormRenderer render={() => node} />);

interface AlertRow {
  m: string;
  t: string;
}
interface Alerts {
  alerts: AlertRow[];
}

/** Модель со списком уведомлений: массив под-форм бывает только массивом модели. */
const alertsModel = (alerts: AlertRow[]) => createModel<Alerts>({ alerts });

/** Строка списка: пропсы уведомления — сигналы строки, рендерер развернёт их в значения. */
const alertRow = (row: FormModel<AlertRow>) => ({
  component: Alert,
  componentProps: { message: row.$.m, type: row.$.t },
});

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
    const model = alertsModel([
      { m: 'Alpha', t: 'info' },
      { m: 'Beta', t: 'error' },
    ]);
    const node: any = {
      model: model.$.alerts,
      component: ListWrap,
      componentProps: { className: 'space-y-2' },
      item: alertRow,
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
    const model = alertsModel([{ m: 'Warning!', t: 'warning' }]);
    const node: any = { model: model.$.alerts, component: ListWrap, item: alertRow };
    expect(render(node)).toContain('Warning!');
  });

  it('onAdd/onRemove/onMove приходят пропами и меняют массив модели', () => {
    const model = createModel<Alerts>({
      alerts: arrayOf<AlertRow>(
        () => ({ m: 'новое', t: 'info' }),
        [
          { m: 'x', t: 'info' },
          { m: 'y', t: 'error' },
        ]
      ),
    });
    const captured: ArrayComponentProps[] = [];
    const Capture = (props: ArrayComponentProps) => {
      captured.push(props);
      return null;
    };
    render({ model: model.$.alerts, component: Capture, item: alertRow } as any);

    const props = captured[0];
    expect(props.items).toHaveLength(2);
    // Шаблон нового элемента — дело массива модели (`arrayOf(blank)`; `initialValue` узла сборка
    // регистрирует запасным): рендерер зовёт push() без значения.
    props.onAdd();
    expect(model.alerts.map((row) => row.m)).toEqual(['x', 'y', 'новое']);
    props.onRemove(0);
    expect(model.alerts.map((row) => row.m)).toEqual(['y', 'новое']);
    props.onMove(0, 1);
    expect(model.alerts.map((row) => row.m)).toEqual(['новое', 'y']);
  });

  it('без component — безхромный fallback: элементы есть, UI управления нет', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = alertsModel([{ m: 'x', t: 'info' }]);
    const html = render({ model: model.$.alerts, item: alertRow } as any);
    expect(html).toContain('alert-info');
    expect(html).toContain('x');
    expect(html).not.toContain('array-add');
    expect(html).not.toContain('<section');
    vi.restoreAllMocks();
  });
});
