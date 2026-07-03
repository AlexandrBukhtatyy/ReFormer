/**
 * Regression: useFormControl должен вызывать ОДИНАКОВУЮ последовательность хуков для
 * control === undefined / FieldNode / ArrayNode, иначе переключение control undefined↔node
 * меняет число хуков и React крашит («Rendered more hooks than during the previous render»).
 *
 * Баг (до фикса): ветка `undefined` делала ранний `return` БЕЗ вызова хуков (0), тогда как
 * field/array вызывали N. Здесь React-хуки замоканы счётчиком, поэтому инвариант «одинаковое
 * число хуков во всех ветках» проверяется без DOM/рендера.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

let hookCalls = 0;

vi.mock('react', () => ({
  useCallback: (fn: unknown) => {
    hookCalls++;
    return fn;
  },
  useRef: (init: unknown) => {
    hookCalls++;
    return { current: init };
  },
}));

vi.mock('use-sync-external-store/shim', () => ({
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => {
    hookCalls++;
    return getSnapshot();
  },
}));

// Импортируем ПОСЛЕ vi.mock (hoisted): хук и фабрики формы (последние react не используют).
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

describe('useFormControl — Rules of Hooks (стабильное число хуков)', () => {
  beforeEach(() => {
    hookCalls = 0;
  });

  it('undefined / field / array вызывают одинаковое (и ненулевое) число хуков', () => {
    const form = build();

    hookCalls = 0;
    useFormControl(undefined);
    const undef = hookCalls;

    hookCalls = 0;
    useFormControl(form.email);
    const field = hookCalls;

    hookCalls = 0;
    useFormControl(form.items);
    const array = hookCalls;

    // Regression: ветка undefined раньше вызывала 0 хуков.
    expect(undef).toBeGreaterThan(0);
    expect(undef).toBe(field);
    expect(field).toBe(array);
  });
});
