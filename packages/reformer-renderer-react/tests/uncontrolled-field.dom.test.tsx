// @vitest-environment happy-dom
/**
 * Поле рендерера с неуправляемым адаптером (`FieldAdapter.uncontrolled` из `@reformer/core/react`):
 * значение идёт в DOM-элемент, ввод не перерисовывает поле, запись в поле извне доходит до элемента,
 * ручка поля по пути получает элемент. Без флага привязка прежняя — управляемая.
 */
import { Profiler, type ChangeEvent, type InputHTMLAttributes, type Ref } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createForm } from '@reformer/core';
import type { FieldAdapter, FieldHandle } from '@reformer/core/react';
import { FormRenderer } from '../src/core/form-renderer';

afterEach(cleanup);

const textAdapter = (uncontrolled: boolean): FieldAdapter => ({
  uncontrolled,
  fromEmit: (event) => (event as ChangeEvent<HTMLInputElement>).target.value,
  toValue: (value) => value ?? '',
});

/** Нативный input с диалектом `adapter`; рендеры считает `rendered`. */
function nativeInput(adapter: FieldAdapter, rendered: () => void) {
  function NativeInput(
    props: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }
  ) {
    rendered();
    return <input {...props} />;
  }
  return Object.assign(NativeInput, { reformerAdapter: adapter });
}

function renderName(uncontrolled: boolean) {
  const rendered = vi.fn();
  const Input = nativeInput(textAdapter(uncontrolled), rendered);
  const bundle = createForm<{ name: string }>({
    initial: { name: 'Анна' },
    schema: (model) => ({ children: [{ model: model.$.name, component: Input }] }),
  });
  const ref = bundle.render.controller.scopeOf(bundle.model).node('name').getRef();
  const commits = { count: 0 };
  render(
    <Profiler id="form" onRender={() => commits.count++}>
      <FormRenderer form={bundle} />
    </Profiler>
  );
  const input = screen.getByTestId('input-name') as HTMLInputElement;
  return { bundle, rendered, commits, input, ref };
}

describe('рендерер — неуправляемая привязка', () => {
  it('ввод пишет в поле без рендера; запись извне — в DOM', () => {
    const { bundle, rendered, commits, input } = renderName(true);
    expect(input.value).toBe('Анна');
    const before = { renders: rendered.mock.calls.length, commits: commits.count };

    fireEvent.change(input, { target: { value: 'Анна Ивановна' } });
    expect(bundle.form.name.value.value).toBe('Анна Ивановна');
    act(() => bundle.form.name.setValue('Пётр'));
    expect(input.value).toBe('Пётр');
    act(() => bundle.form.name.reset());
    expect(input.value).toBe('Анна');

    expect(rendered.mock.calls.length).toBe(before.renders);
    expect(commits.count).toBe(before.commits);
  });

  it('доступность перерисовывает поле; ручка по пути получает элемент', () => {
    const { bundle, rendered, input, ref } = renderName(true);
    const before = rendered.mock.calls.length;

    act(() => bundle.form.name.disable());

    expect(input.disabled).toBe(true);
    expect(rendered.mock.calls.length).toBe(before + 1);
    expect((ref.current as FieldHandle | null)?.getElement()).toBe(input);
  });

  it('без флага — управляемая привязка: ввод перерисовывает поле', () => {
    const { bundle, rendered, input } = renderName(false);
    const before = rendered.mock.calls.length;

    fireEvent.change(input, { target: { value: 'Анна Ивановна' } });

    expect(bundle.form.name.value.value).toBe('Анна Ивановна');
    expect(input.value).toBe('Анна Ивановна');
    expect(rendered.mock.calls.length).toBe(before + 1);
  });
});
