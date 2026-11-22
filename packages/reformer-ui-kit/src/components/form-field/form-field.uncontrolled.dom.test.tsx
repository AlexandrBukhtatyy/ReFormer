// @vitest-environment happy-dom
/**
 * `Input`, `Textarea` и `NativeSelectWithOptions` кита привязаны неуправляемо
 * (`uncontrolledInputAdapter`): ввод не перерисовывает `FormField`, запись в поле из кода доходит до
 * DOM-элемента, доступность — перерисовывает. Тест идёт на React 19 — там пресет неуправляемый.
 */
import { Profiler, type ComponentType, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createFormFromModel, createModel, type FormControl } from '@reformer/core';
import { getFieldAdapter } from '@reformer/core/react';
import { uncontrolledInputAdapter } from '@/fields/adapters';
import { Input } from '@/components/input';
import { Textarea } from '@/components/textarea';
import { NativeSelectWithOptions } from '@/components/native-select';
import { FormField } from './form-field';

afterEach(cleanup);

function buildField(component: ComponentType<never>, initial: string, componentProps = {}) {
  const model = createModel<{ name: string | null }>({ name: initial });
  const form = createFormFromModel<{ name: string | null }>({
    model,
    schema: {
      children: [
        {
          model: model.$.name,
          component,
          componentProps: { label: 'Поле', testId: 'name', ...componentProps },
        },
      ],
    },
  });
  return (form as unknown as { name: FormControl<string | null> }).name;
}

function renderCounting(node: ReactNode) {
  const commits = { count: 0 };
  render(
    <Profiler id="field" onRender={() => commits.count++}>
      {node}
    </Profiler>
  );
  return commits;
}

describe('ui-kit — неуправляемые текстовые контролы', () => {
  it('пресет кита — неуправляемый (React 19)', () => {
    expect(uncontrolledInputAdapter.uncontrolled).toBe(true);
    expect(getFieldAdapter(Input)).toBe(uncontrolledInputAdapter);
    expect(getFieldAdapter(Textarea)).toBe(uncontrolledInputAdapter);
    expect(getFieldAdapter(NativeSelectWithOptions)).toBe(uncontrolledInputAdapter);
  });

  it.each([
    ['Input', Input],
    ['Textarea', Textarea],
  ] as const)('%s: ввод пишет в поле без рендера; запись из кода — в DOM', (_, component) => {
    const control = buildField(component as ComponentType<never>, 'Анна');
    const commits = renderCounting(<FormField control={control} />);
    const element = screen.getByTestId('input-name') as HTMLInputElement;
    expect(element.value).toBe('Анна');
    const before = commits.count;

    fireEvent.change(element, { target: { value: 'Анна Ивановна' } });
    expect(control.value.value).toBe('Анна Ивановна');
    fireEvent.change(element, { target: { value: '' } });
    expect(control.value.value).toBeNull();
    act(() => control.setValue('Пётр'));
    expect(element.value).toBe('Пётр');
    expect(commits.count).toBe(before);

    act(() => control.disable());
    expect(element.disabled).toBe(true);
    expect(commits.count).toBe(before + 1);
  });

  it('NativeSelectWithOptions: выбор пишет в поле, запись из кода выбирает вариант', () => {
    const control = buildField(NativeSelectWithOptions as ComponentType<never>, 'msk', {
      options: [
        { value: 'msk', label: 'Москва' },
        { value: 'spb', label: 'Петербург' },
      ],
    });
    const commits = renderCounting(<FormField control={control} />);
    const select = screen.getByTestId('input-name') as HTMLSelectElement;
    expect(select.value).toBe('msk');
    const before = commits.count;

    fireEvent.change(select, { target: { value: 'spb' } });
    expect(control.value.value).toBe('spb');
    act(() => control.reset());
    expect(select.value).toBe('msk');
    expect(commits.count).toBe(before);
  });
});
