// @vitest-environment happy-dom
/**
 * Путь поля строки массива — живой: `data-testid`, выведенный рендерером из пути, следует за
 * индексом строки. Поле строки при удалении соседки не перерисовывалось, и путь, прочитанный
 * однажды при рендере, устаревал: оставшаяся строка сохраняла `rows-1-*` (ReFormer-zy8k). Ref по
 * пути (`schema.node('rows.0.name').getRef()`) теперь ищет само поле по живому пути — тест
 * закрепляет, что он по-прежнему переходит к сдвинутой строке.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { arrayOf, createForm, type FormModel } from '@reformer/core';
import type { FieldHandle } from '@reformer/core/react';
import { FormRenderer } from '../src/core/form-renderer';
import type { ArrayComponentProps } from '../src/core/types';

afterEach(cleanup);

interface Row {
  name: string;
}
interface Shape {
  rows: Row[];
}

const Input = forwardRef<
  HTMLInputElement,
  { value?: string; onChange?: (value: string) => void; 'data-testid'?: string }
>(function Input({ value, onChange, ...rest }, ref) {
  return (
    <input ref={ref} value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} {...rest} />
  );
});

const List = ({ items = [] }: ArrayComponentProps) => (
  <div>
    {items.map((item) => (
      <div key={item.key}>{item.children}</div>
    ))}
  </div>
);

const schema = (model: FormModel<Shape>) => ({
  children: [
    {
      model: model.$.rows,
      component: List,
      item: (row: FormModel<Row>) => ({ children: [{ model: row.$.name, component: Input }] }),
    },
  ],
});

function setup() {
  const bundle = createForm<Shape>({
    initial: {
      rows: arrayOf<Row>(() => ({ name: '' }), [{ name: 'первая' }, { name: 'вторая' }]),
    },
    schema,
  });
  render(<FormRenderer form={bundle} />);
  return bundle;
}

const testIds = (): string[] =>
  screen.getAllByRole('textbox').map((input) => input.getAttribute('data-testid') ?? '');

describe('строка массива — путь поля после удаления соседки', () => {
  it('testId оставшейся строки — с её новым индексом', () => {
    const bundle = setup();
    expect(testIds()).toEqual(['input-rows-0-name', 'input-rows-1-name']);

    act(() => bundle.model.rows.removeAt(0));

    expect(testIds()).toEqual(['input-rows-0-name']);
    expect(screen.getByTestId('input-rows-0-name')).toHaveProperty('value', 'вторая');
  });

  it('путь поля строки — сигнал: control.path следует за индексом', () => {
    const bundle = setup();
    const second = bundle.form.rows.at(1)!.name;
    expect(second.path.value).toBe('rows.1.name');

    act(() => bundle.model.rows.removeAt(0));

    expect(second.path.value).toBe('rows.0.name');
    expect(bundle.form.rows.path.value).toBe('rows');
  });

  it('ref по пути переходит к полю, сдвинутому на этот индекс', () => {
    const bundle = createForm<Shape>({
      initial: {
        rows: arrayOf<Row>(() => ({ name: '' }), [{ name: 'первая' }, { name: 'вторая' }]),
      },
      schema,
    });
    // Ref по пути запрашивают до рендера — так его находит поле при отрисовке.
    const ref = bundle.render.controller.scopeOf(bundle.model).node('rows.0.name').getRef();
    render(<FormRenderer form={bundle} />);
    const handle = () => (ref.current as FieldHandle | null)?.getElement() as HTMLInputElement;
    expect(handle().value).toBe('первая');

    act(() => bundle.model.rows.removeAt(0));

    expect(handle().value).toBe('вторая');
  });
});
