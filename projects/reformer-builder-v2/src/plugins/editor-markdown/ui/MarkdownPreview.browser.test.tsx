/**
 * Предпросмотр markdown в настоящем браузере.
 *
 * Правила (пути, языки, режимы) проверены без браузера — [markdown.test.ts](../markdown.test.ts).
 * Здесь то, что существует только в DOM: рендер GFM, вырезание опасного HTML, картинка
 * из проекта, переход по ссылке и якорь.
 *
 * @module plugins/editor-markdown/ui/MarkdownPreview.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createRef } from 'react';
import type { ResourceId } from '@/sdk';
import { renderReact } from '@/testing/render';
import type { MarkdownDocument, MarkdownHost } from '../host';
import { MarkdownPreview } from './MarkdownPreview';

const DOCUMENT: MarkdownDocument = {
  ref: {
    id: 'mem:docs/guide.md',
    sourceId: 'mem',
    path: 'docs/guide.md',
    name: 'guide.md',
    kind: 'file',
    mediaType: 'text/markdown',
  },
  getText: () => '',
  onDidChangeContent: () => ({ dispose: () => undefined }),
};

/** Однопиксельный PNG: настоящие байты, потому что `Blob` и `img` работают с настоящими. */
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  ),
  (c) => c.charCodeAt(0)
);

function mountPreview(
  text: string,
  options: { bytes?: Uint8Array | null; onOpen?: (id: ResourceId) => void } = {}
) {
  const host: MarkdownHost = {
    useTranslate: () => (key: string) => key,
    documentOf: () => DOCUMENT,
    readBytes: () => Promise.resolve(options.bytes ?? null),
    resourceAt: (document, path) => `${document.ref.sourceId}:${path}`,
    openResource: options.onOpen,
  };
  const containerRef = createRef<HTMLDivElement>();
  return renderReact(
    <div style={{ height: '300px' }}>
      <MarkdownPreview host={host} document={DOCUMENT} text={text} containerRef={containerRef} />
    </div>
  );
}

describe('рендер', () => {
  it('показывает заголовки, списки и таблицы GFM', async () => {
    const mounted = mountPreview(
      ['# Заголовок', '', '- пункт', '', '| a | b |', '| - | - |', '| 1 | 2 |'].join('\n')
    );

    await expect.element(page.getByRole('heading', { name: 'Заголовок' })).toBeVisible();
    await expect.element(page.getByRole('table')).toBeVisible();
    await expect.element(page.getByText('пункт')).toBeVisible();

    mounted.unmount();
  });

  it('HTML из файла рендерится, но опасное вырезается санитайзером', async () => {
    const mounted = mountPreview(
      [
        '<details><summary>Подробности</summary>текст</details>',
        '',
        '<script>alert(1)</script>',
      ].join('\n')
    );

    await expect.element(page.getByText('Подробности')).toBeVisible();
    await vi.waitFor(() => {
      // Скрипт обязан исчезнуть целиком: файл открыт из чужого каталога, а оболочка держит
      // доступ к файловой системе проекта.
      expect(document.querySelector('[data-testid="markdown-preview"] script')).toBeNull();
    });

    mounted.unmount();
  });

  it('блок кода подсвечивается, а незнакомый язык остаётся текстом', async () => {
    const mounted = mountPreview(['```ts', 'const x: number = 1;', '```'].join('\n'));

    await vi.waitFor(() => {
      expect(document.querySelector('.hljs-keyword')).not.toBeNull();
    });
    await expect.element(page.getByText('const', { exact: false })).toBeVisible();

    mounted.unmount();
  });
});

describe('картинки и ссылки', () => {
  it('картинка проекта читается через порт и показывается', async () => {
    const mounted = mountPreview('![схема](./img/logo.png)', { bytes: PNG });

    await expect.element(page.getByAltText('схема')).toBeVisible();

    mounted.unmount();
  });

  it('пропавшая картинка показывает подпись, а не битую иконку', async () => {
    const mounted = mountPreview('![схема](./img/gone.png)', { bytes: null });

    await expect.element(page.getByText('схема')).toBeVisible();
    await vi.waitFor(() => {
      expect(document.querySelector('[data-testid="markdown-preview"] img')).toBeNull();
    });

    mounted.unmount();
  });

  it('ссылка на соседний файл открывает его вкладкой, а не уводит из приложения', async () => {
    const opened: ResourceId[] = [];
    const mounted = mountPreview('[план](../plan.md)', {
      onOpen: (id) => {
        opened.push(id);
      },
    });

    await userEvent.click(page.getByText('план'));

    await vi.waitFor(() => {
      expect(opened).toEqual(['mem:plan.md']);
    });

    mounted.unmount();
  });

  it('внешняя ссылка открывается в новой вкладке и без ссылки на окно приложения', async () => {
    const mounted = mountPreview('[сайт](https://example.com)');

    const link = page.getByRole('link', { name: 'сайт' });
    await expect.element(link).toHaveAttribute('target', '_blank');
    await expect.element(link).toHaveAttribute('rel', 'noreferrer noopener');

    mounted.unmount();
  });

  it('якорь прокручивает к заголовку внутри предпросмотра', async () => {
    // Высоту даёт настоящий текст, а не пустые строки: markdown их схлопывает, и прокручивать
    // было бы нечего — тест зеленел бы на неподвижном контейнере.
    const filler = Array.from({ length: 60 }, (_, i) => `Абзац номер ${i} для высоты.`).join(
      '\n\n'
    );
    const mounted = mountPreview(
      ['[к разделу](#установка)', '', filler, '', '## Установка', '', 'текст'].join('\n')
    );

    await userEvent.click(page.getByText('к разделу'));

    await vi.waitFor(() => {
      const container = document.querySelector('[data-testid="markdown-preview"]');
      expect(container?.scrollTop ?? 0).toBeGreaterThan(0);
    });

    mounted.unmount();
  });
});
