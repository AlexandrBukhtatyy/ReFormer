import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';

import type { CatalogJson, KitFieldFrameProps, KitNamespace } from '@reformer/builder-plugin-api';
import type { FieldFrameProps } from '@reformer/ui-kit/field';
import { createKitsService, type ContributedKit } from './service';

/** Провайдер кита: помечает поддерево, чтобы было видно, что форма внутри него. */
function ThemeProvider({ children }: { children?: ReactNode }): ReactNode {
  return <section data-theme="hexa">{children}</section>;
}

function catalog(id: string, provider?: string): CatalogJson {
  return {
    version: '2.1',
    kit: {
      id,
      label: id,
      package: `@vendor/${id}`,
      ...(provider === undefined ? {} : { adapters: { provider: { symbol: provider } } }),
    },
    components: [{ name: 'Input', role: 'field', propsSchema: {} }],
  };
}

/** Кит плагина с пространством имён, которое доезжает сразу. */
function pluginKit(namespace: KitNamespace): ContributedKit {
  return {
    source: {
      catalog: catalog('hexa', 'ThemeProvider'),
      namespace: () => Promise.resolve(namespace),
    },
    pluginId: 'kit-hexa-ui',
  };
}

const valid = () => Promise.resolve(() => ({ valid: true, errors: [] as string[] }));

describe('рамка кита', () => {
  it('встроенный кит без провайдера DOM не меняет: форма — прямой потомок контейнера', () => {
    const kits = createKitsService({ sources: [{ catalog: catalog('builtin') }] });

    const html = renderToStaticMarkup(
      <kits.Frame>
        <form />
      </kits.Frame>
    );

    expect(html).toBe('<form></form>');
  });

  it('кит плагина — в скоупе стилей владельца, с провайдером из своего пространства имён', async () => {
    const kits = createKitsService({
      sources: [{ catalog: catalog('builtin') }],
      validator: valid,
    });
    kits.syncContributed([pluginKit({ ThemeProvider })]);
    await kits.activate('hexa');
    await kits.whenReady();
    kits.namespace();
    await vi.waitFor(() => {
      expect(kits.namespace()).not.toBeNull();
    });

    const html = renderToStaticMarkup(
      <kits.Frame>
        <form />
      </kits.Frame>
    );

    expect(html).toBe(
      '<div data-rb-plugin="kit-hexa-ui" data-rb-kit="hexa" style="display:contents">' +
        '<section data-theme="hexa"><form></form></section></div>'
    );
  });

  it('пока пространство имён в пути — скоуп есть, провайдера ещё нет', async () => {
    const kits = createKitsService({
      sources: [{ catalog: catalog('builtin') }],
      validator: valid,
    });
    kits.syncContributed([pluginKit({ ThemeProvider })]);
    await kits.activate('hexa');

    const html = renderToStaticMarkup(
      <kits.Frame>
        <form />
      </kits.Frame>
    );

    expect(html).toBe(
      '<div data-rb-plugin="kit-hexa-ui" data-rb-kit="hexa" style="display:contents"><form></form></div>'
    );
  });

  it('провайдер, которого нет в пространстве имён, пропускается, а не роняет форму', async () => {
    const kits = createKitsService({
      sources: [{ catalog: catalog('builtin') }],
      validator: valid,
    });
    kits.syncContributed([pluginKit({})]);
    await kits.activate('hexa');
    await kits.whenReady();
    kits.namespace();
    await vi.waitFor(() => {
      expect(kits.namespace()).not.toBeNull();
    });

    const html = renderToStaticMarkup(
      <kits.Frame>
        <form />
      </kits.Frame>
    );

    expect(html).toContain('<form></form>');
    expect(html).not.toContain('data-theme');
  });

  it('рамка — один компонент на службу: смена кита не пересоздаёт его', async () => {
    const kits = createKitsService({
      sources: [{ catalog: catalog('a') }, { catalog: catalog('b') }],
    });
    const before = kits.Frame;

    await kits.activate('b');

    expect(kits.Frame).toBe(before);
  });
});

describe('рамка поля встроенного кита', () => {
  it('пропсы FieldFrame ui-kit совпадают с контрактом SDK в обе стороны', () => {
    // Кит не зависит от билдера и повторяет форму контракта сам; разойдись они — тема RJSF
    // передала бы рамке пропсы, которых та не знает. Проверяет компилятор: присваивание
    // в обе стороны — тот же тип.
    const fromContract = (props: KitFieldFrameProps): FieldFrameProps => props;
    const toContract = (props: FieldFrameProps): KitFieldFrameProps => props;

    expect(toContract(fromContract({ label: 'Имя', errors: ['нет'] }))).toEqual({
      label: 'Имя',
      errors: ['нет'],
    });
  });
});
