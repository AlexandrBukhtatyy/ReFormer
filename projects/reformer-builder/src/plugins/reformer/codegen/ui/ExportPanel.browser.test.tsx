/**
 * Панель экспорта и смена кита.
 *
 * Подпись «Кит: …» говорит, чем напечатается модуль. Кит, внесённый плагином, появляется и
 * исчезает вместе с плагином, и панель обязана следовать ему сама: до подписки она показывала
 * прежний кит, пока её не перерисовывало что-то чужое, — а печатала уже новым.
 *
 * @module plugins/reformer/codegen/ui/ExportPanel.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { toDescriptor, type Disposable, type KitDescriptor } from '@reformer/builder-plugin-api';
import { renderReact } from '@/testing/render';
import { createCodegenSessions } from '../pipeline/state';
import { createFakeDocument, createFakeHost } from '../testing';
import type { CodegenHost } from '../host';
import { ExportPanel } from './ExportPanel';

function kit(id: string, label: string): KitDescriptor {
  return toDescriptor({
    version: '2.1',
    kit: { id, label, package: `@vendor/${id}` },
    components: [],
  });
}

describe('панель экспорта', () => {
  it('подпись кита следует смене активного кита без чужой перерисовки', async () => {
    let current = kit('a', 'Кит А');
    const listeners = new Set<() => void>();
    const documentId = 'fake:form/form.schema.json';
    const host: CodegenHost = {
      ...createFakeHost({ document: createFakeDocument(documentId, '{}') }),
      // Перевод с параметрами: по нему видно, какой кит назван в подписи.
      useTranslate: () => (key, params) =>
        params === undefined ? key : `${key}:${String(params.label)}`,
      useActiveDocument: () => documentId,
      kit: () => current,
      onDidChangeKit: (cb: () => void): Disposable => {
        listeners.add(cb);
        return {
          dispose: () => {
            listeners.delete(cb);
          },
        };
      },
    };

    const { container } = renderReact(
      <ExportPanel host={host} sessions={createCodegenSessions()} targets={() => []} />
    );
    await vi.waitFor(() => {
      expect(container.textContent).toContain('kit.active:Кит А');
    });

    current = kit('b', 'Кит Б');
    for (const listener of [...listeners]) listener();

    await vi.waitFor(() => {
      expect(container.textContent).toContain('kit.active:Кит Б');
    });
  });
});
