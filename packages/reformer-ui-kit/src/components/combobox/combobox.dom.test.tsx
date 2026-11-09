// @vitest-environment happy-dom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Combobox, ComboboxMulti, ComboboxTree, ComboboxTreeMulti } from './index';
import type { TreeNode } from '@/components/tree';

afterEach(cleanup);

// Первый рендер cmdk/поповера тянет тяжёлые модули — под нагрузкой дольше 5 с по умолчанию.
vi.setConfig({ testTimeout: 30_000 });

const OPTS = [
  { value: 'a', label: 'Первый' },
  { value: 'b', label: 'Второй' },
];
const NODES: TreeNode[] = [{ id: 'README.md', label: 'README.md' }];

type Case = [
  name: string,
  node: (onChange: (v: unknown) => void) => React.ReactElement,
  cleared: unknown,
];

const CASES: Case[] = [
  [
    'Combobox',
    (onChange) => <Combobox value="a" options={OPTS} clearable onChange={onChange} />,
    null,
  ],
  [
    'ComboboxMulti',
    (onChange) => <ComboboxMulti value={['a']} options={OPTS} clearable onChange={onChange} />,
    [],
  ],
  [
    'ComboboxTree',
    (onChange) => <ComboboxTree value="README.md" nodes={NODES} clearable onChange={onChange} />,
    null,
  ],
  [
    'ComboboxTreeMulti',
    (onChange) => (
      <ComboboxTreeMulti value={['README.md']} nodes={NODES} clearable onChange={onChange} />
    ),
    [],
  ],
];

describe.each(CASES)('%s (DOM): крестик очистки доступен с клавиатуры', (_name, node, cleared) => {
  it('крестик в порядке Tab, после очистки фокус — на триггере', () => {
    const onChange = vi.fn();
    render(node(onChange));
    const clear = screen.getByRole('button', { name: 'Clear selection' });
    expect(clear.getAttribute('tabindex')).toBeNull();

    clear.focus();
    fireEvent.click(clear);
    expect(onChange).toHaveBeenCalledWith(cleared);
    expect(document.activeElement).toBe(screen.getByRole('combobox'));
  });
});
