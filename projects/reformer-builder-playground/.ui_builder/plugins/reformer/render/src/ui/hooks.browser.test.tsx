/**
 * Значения источников данных превью — из констант модуля формы, в настоящем браузере: хук
 * перечитывает их, когда константы правят в рабочей копии.
 *
 * @module plugins/reformer/render/ui/hooks.browser.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ResourceId, ResourceRef } from '@reformer/builder-plugin-api';
import { renderReact } from '../../../../.shared/render';
import type { PreviewHost } from '../host';
import { useRuleDataSources } from './hooks';

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
});

const DOCUMENT = 'fs:forms/loan/schema/form.schema.json';
const CONSTANTS = 'fs:forms/loan/constants/loan.ts';

/** Рабочая копия модуля: адреса — `fs:` плюс путь от корня проекта. */
function workspace(initial: Record<string, string>) {
  const texts = new Map(Object.entries(initial));
  const listeners = new Set<(changed: readonly ResourceId[]) => void>();
  const host: Pick<
    PreviewHost,
    'readText' | 'resolveFromRoot' | 'list' | 'parentOf' | 'onDidChangeFiles'
  > = {
    readText: (id) => {
      const text = texts.get(id);
      return text === undefined ? Promise.reject(new Error(`нет ${id}`)) : Promise.resolve(text);
    },
    resolveFromRoot: (_anchor, path) => `fs:${path}`,
    parentOf: (id) => id.slice(0, id.lastIndexOf('/')),
    list: (dir) =>
      Promise.resolve(
        [...texts.keys()]
          .filter((id) => id.startsWith(`${dir}/`) && !id.slice(dir.length + 1).includes('/'))
          .map(
            (id): ResourceRef => ({
              id,
              sourceId: 'fs',
              path: id.slice('fs:'.length),
              name: id.slice(dir.length + 1),
              kind: 'file',
              mediaType: 'text/typescript',
            })
          )
      ),
    onDidChangeFiles: (cb) => {
      listeners.add(cb);
      return { dispose: () => listeners.delete(cb) };
    },
  };
  const change = (id: string, text: string) => {
    texts.set(id, text);
    for (const listener of listeners) listener([id]);
  };
  return { host, change };
}

function Sources(props: { readonly host: Parameters<typeof useRuleDataSources>[0] }) {
  const sources = useRuleDataSources(props.host, {
    id: DOCUMENT,
    ref: { path: 'forms/loan/schema/form.schema.json' },
  });
  return <pre data-testid="sources">{JSON.stringify(sources ?? null)}</pre>;
}

const shown = (container: HTMLElement) =>
  container.querySelector('[data-testid="sources"]')?.textContent ?? '';

describe('значения источников данных превью', () => {
  it('берутся из констант модуля и перечитываются при их правке', async () => {
    const { host, change } = workspace({
      [CONSTANTS]: "export const REGIONS = [{ value: 'msk', label: 'Москва' }];\n",
    });
    const mounted = renderReact(<Sources host={host} />);
    unmount = mounted.unmount;

    await vi.waitFor(() => expect(shown(mounted.container)).toContain('Москва'));

    change(CONSTANTS, "export const REGIONS = [{ value: 'spb', label: 'Петербург' }];\n");
    await vi.waitFor(() => expect(shown(mounted.container)).toContain('Петербург'));
  });

  it('констант нет — значений нет', async () => {
    const { host } = workspace({});
    const mounted = renderReact(<Sources host={host} />);
    unmount = mounted.unmount;

    await vi.waitFor(() => expect(shown(mounted.container)).toBe('null'));
  });
});
