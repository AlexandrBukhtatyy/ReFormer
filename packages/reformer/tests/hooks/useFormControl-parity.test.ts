/**
 * Regression (defects 39 + 43): паритет реактивных полей снапшота useFormControl.
 *
 * - Поле (FieldNode) должно отдавать реактивный `dirty` (раньше отсутствовал в FieldControlState).
 * - Массив (ArrayNode) должен отдавать реактивный `disabled` (раньше отсутствовал в
 *   ArrayControlState) — иначе CDK FormArray не может наблюдать отключённый массив.
 *
 * React-хуки замоканы (как в useFormControl-rules-of-hooks.test.ts): useSyncExternalStore
 * просто возвращает getSnapshot(), поэтому каждый вызов useFormControl(node) даёт свежий
 * снапшот из текущих значений сигналов — без DOM/рендера. Заодно это упражняет
 * рефакторинг useSignalSubscription (ref-стабильные subscribe/getSnapshot).
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('react', () => ({
  useCallback: (fn: unknown) => fn,
  useRef: (init: unknown) => ({ current: init }),
}));

vi.mock('use-sync-external-store/shim', () => ({
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}));

// Импортируем ПОСЛЕ vi.mock (hoisted).
import { useFormControl } from '../../src/hooks/useFormControl';
import { createModel } from '../../src/core/model';
import { createForm } from '../../src/core/utils/create-form';

interface Form {
  email: string;
  items: { x: string }[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function build(): any {
  const model = createModel<Form>({ email: '', items: [] });
  return createForm<Form>({
    model,
    schema: {
      children: [
        { value: model.$.email },
        { array: model.items, item: (it: any) => ({ children: [{ value: it.$.x }] }) },
      ],
    },
  }) as any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

describe('useFormControl — field dirty parity (defect 39)', () => {
  it('снапшот поля содержит реактивный dirty', () => {
    const form = build();

    let state = useFormControl(form.email);
    expect(state).toHaveProperty('dirty');
    // sanity: это field-ветка (есть shouldShowError)
    expect(state).toHaveProperty('shouldShowError');
    expect(state.dirty).toBe(false);

    form.email.setValue('a@b.com');

    state = useFormControl(form.email);
    expect(state.dirty).toBe(true);
    expect(state.value).toBe('a@b.com');
  });
});

describe('useFormControl — array disabled parity (defect 43)', () => {
  it('снапшот массива содержит реактивный disabled и отражает disable()/enable()', () => {
    const form = build();

    let state = useFormControl(form.items);
    expect(state).toHaveProperty('disabled');
    // sanity: это array-ветка (есть length)
    expect(state).toHaveProperty('length');
    expect(state.disabled).toBe(false);

    form.items.disable();

    state = useFormControl(form.items);
    expect(state.disabled).toBe(true);

    form.items.enable();

    state = useFormControl(form.items);
    expect(state.disabled).toBe(false);
  });

  it('пустой контрол (undefined) отдаёт disabled=false', () => {
    const state = useFormControl(undefined);
    expect(state).toHaveProperty('disabled');
    expect(state.disabled).toBe(false);
  });
});
