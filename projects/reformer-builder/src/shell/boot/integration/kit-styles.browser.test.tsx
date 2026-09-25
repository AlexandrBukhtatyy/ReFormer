/**
 * Стиль кита, внесённого плагином, действует только внутри превью.
 *
 * Сквозная проверка трёх частей, каждая из которых проверена у себя: оболочка ставит стили плагина
 * с изоляцией `scoped` под `[data-rb-plugin="<плагин>"]` (`shell/platform/plugin/styles`), служба
 * китов даёт рамку с этим атрибутом (`plugins/kits/registry/frame`), поверхность превью кладёт
 * форму в рамку (`plugins/reformer/render`). Разойдись литерал атрибута или порядок обёрток —
 * каждая часть осталась бы зелёной у себя, а тема кита плагина либо не доехала бы до формы, либо
 * перекрасила бы билдер.
 *
 * @module shell/boot/integration/kit-styles.browser.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type {
  CatalogJson,
  Disposable,
  DocumentRef,
  KitNamespace,
  NodeId,
  PreviewContext,
  PreviewValues,
} from '@reformer/builder-plugin-api';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { installPluginStyles } from '@/shell/platform/plugin/styles';
import { createKitsService } from '@/plugins/kits/registry';
import { projectCatalog } from '@/plugins/reformer/core/catalog';
import { builtinSurfaces } from '@/plugins/reformer/render/plugin';
import { RUNTIME_SURFACE_ID } from '@/plugins/reformer/render/runtime/surface';
import { createFakeHost, fakeRef } from '@/plugins/reformer/render/testing';

const OWNER = 'kit-probe-plugin';
const PROBE_COLOR = 'rgb(1, 2, 3)';
const NOOP: Disposable = Object.freeze({ dispose: () => undefined });
const NO_SELECTION: readonly NodeId[] = Object.freeze([]);

const cleanup: (() => void)[] = [];
afterEach(() => {
  while (cleanup.length > 0) cleanup.pop()?.();
});

function catalog(id: string): CatalogJson {
  return {
    version: '2.1',
    kit: { id, label: id, package: `@vendor/${id}` },
    components: [{ name: 'Probe', role: 'container', propsSchema: {} }],
  };
}

/** Компонент кита: помечает себя классом, который перекрашивают стили плагина. */
function Probe({ className, children }: { className?: string; children?: ReactNode }): ReactNode {
  return <div className={['kit-probe', className].filter(Boolean).join(' ')}>проба{children}</div>;
}

const schema = {
  version: '1.0',
  root: { component: '$component(Probe)', componentProps: {} },
} as unknown as JsonFormSchema;

function context(): PreviewContext {
  const doc: DocumentRef = {
    id: 'fake:form/form.json',
    ref: fakeRef('fake:form/form.json'),
    kind: 'model',
    providerId: 'form.schema',
  };
  let values: PreviewValues | undefined;
  return {
    doc,
    schema: () => schema,
    onDidChangeSchema: () => NOOP,
    selection: () => NO_SELECTION,
    onDidChangeSelection: () => NOOP,
    select: () => undefined,
    mock: () => null,
    values: () => values,
    keepValues: (next) => {
      values = next;
    },
    report: () => undefined,
  };
}

describe('стиль кита плагина', () => {
  it('действует на компоненты кита в превью и не трогает такой же класс в оболочке', async () => {
    const styles = installPluginStyles(`.kit-probe { color: ${PROBE_COLOR}; }`, OWNER);
    if (!styles.ok) throw new Error(styles.problem.message);
    cleanup.push(() => {
      styles.subscription.dispose();
    });

    const namespace: KitNamespace = { Probe };
    const kits = createKitsService({
      sources: [{ catalog: catalog('builtin') }],
      validator: () => Promise.resolve(() => ({ valid: true, errors: [] as string[] })),
    });
    cleanup.push(() => {
      kits.dispose();
    });
    kits.syncContributed([
      {
        source: { catalog: catalog('probe'), namespace: () => Promise.resolve(namespace) },
        pluginId: OWNER,
      },
    ]);
    await kits.activate('probe');
    await kits.whenReady();
    kits.namespace();
    await vi.waitFor(() => {
      expect(kits.namespace()).not.toBeNull();
    });

    const projection = projectCatalog(kits.catalogJson());
    const host = createFakeHost({
      catalog: projection.entries,
      descriptor: projection.descriptor,
      namespace: kits.namespace(),
      origin: kits.activeOrigin(),
      frame: kits.Frame,
    });
    const runtime = builtinSurfaces(host, (key) => key).find(
      (surface) => surface.id === RUNTIME_SURFACE_ID
    );
    if (runtime === undefined) throw new Error('рантайм-поверхность не зарегистрирована');

    const preview = document.createElement('div');
    document.body.append(preview);
    cleanup.push(() => {
      preview.remove();
    });
    const mounted = runtime.mount(preview, context());
    cleanup.push(() => {
      mounted.dispose();
    });

    // Тот же класс в оболочке — вне скоупа владельца.
    const chrome = document.createElement('div');
    chrome.className = 'kit-probe';
    document.body.append(chrome);
    cleanup.push(() => {
      chrome.remove();
    });

    const probe = await vi.waitFor(() => {
      const found = preview.querySelector<HTMLElement>('.kit-probe');
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });

    expect(probe.closest(`[data-rb-plugin="${OWNER}"]`)).not.toBeNull();
    expect(getComputedStyle(probe).color).toBe(PROBE_COLOR);
    expect(getComputedStyle(chrome).color).not.toBe(PROBE_COLOR);
  });
});
