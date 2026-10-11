/**
 * Панель экспорта: смена кита и раскладка поля — та же, что у панели свойств.
 *
 * Подпись «Кит: …» говорит, чем напечатается модуль. Кит, внесённый плагином, появляется и
 * исчезает вместе с плагином, и панель обязана следовать ему сама: до подписки она показывала
 * прежний кит, пока её не перерисовывало что-то чужое, — а печатала уже новым.
 *
 * Раскладка проверяется геометрией: панель стоит в одном доке со «Свойствами», и поле в ней
 * обязано быть такой же строкой того же размера — иначе две соседние вкладки дока выглядят
 * двумя разными приложениями.
 *
 * @module plugins/reformer/codegen/ui/ExportPanel.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { toDescriptor, type Disposable, type KitDescriptor } from '@reformer/builder-plugin-api';
import { renderReact } from '../../../../.shared/render';
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

describe('поле панели — строкой, в размере панели свойств', () => {
  /** Ширина правого дока по умолчанию. */
  const DOCK_WIDTH = 320;

  async function mountInDock(): Promise<HTMLElement> {
    const documentId = 'fake:form/form.schema.json';
    const host: CodegenHost = {
      ...createFakeHost({ document: createFakeDocument(documentId, '{}') }),
      useTranslate: () => (key) => key,
      useActiveDocument: () => documentId,
    };
    const { container } = renderReact(
      <div style={{ width: DOCK_WIDTH, height: 600 }}>
        <ExportPanel host={host} sessions={createCodegenSessions()} targets={() => []} />
      </div>
    );
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="input-formName"]')).not.toBeNull();
    });
    return container;
  }

  const boxOf = (element: Element | null): DOMRect => {
    if (element === null) throw new Error('элемента панели нет');
    return element.getBoundingClientRect();
  };
  const inputOf = (container: HTMLElement): HTMLInputElement | null =>
    container.querySelector('[data-testid="input-formName"]');
  const labelOf = (container: HTMLElement): HTMLLabelElement | null =>
    container.querySelector(`label[for="${inputOf(container)?.id ?? ''}"]`);

  it('подпись стоит слева от поля, в той же строке', async () => {
    const container = await mountInDock();

    const text = boxOf(labelOf(container));
    const field = boxOf(inputOf(container));
    expect(text.right).toBeLessThanOrEqual(field.left);
    const middle = (box: DOMRect): number => box.top + box.height / 2;
    expect(Math.abs(middle(text) - middle(field))).toBeLessThanOrEqual(1);
  });

  it('поле и кнопка — высотой с поле панели свойств', async () => {
    const container = await mountInDock();

    expect(boxOf(inputOf(container)).height).toBe(28);
    expect(boxOf(container.querySelector('[data-testid="button-generate"]')).height).toBe(28);
    // И текст того же кегля: у кита по умолчанию он на два пункта крупнее.
    expect(getComputedStyle(inputOf(container) as HTMLElement).fontSize).toBe('12px');
  });

  it('подсказка — значком у подписи, а не строкой под полем', async () => {
    const container = await mountInDock();

    const label = labelOf(container);
    const hint = label?.parentElement?.querySelector('[data-slot="info-hint"]') ?? null;
    expect(hint).not.toBeNull();
    // Значок вне подписи: внутри неё щелчок по нему уводил бы фокус в поле.
    expect(label?.contains(hint)).toBe(false);
    // Текст подсказки поле получает ссылкой: читалке экрана значок не нужен.
    const described = inputOf(container)?.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(described)?.textContent).toBe('form.name.hint');
    // Видимой строки с подсказкой под полем нет: под ним сразу следующая строка панели.
    const visible = [...container.querySelectorAll('span')].filter(
      (span) =>
        span.textContent === 'form.name.hint' &&
        span.id !== described &&
        span.getBoundingClientRect().height > 0
    );
    expect(visible).toHaveLength(0);
  });

  it('строка не вылезает за панель', async () => {
    const container = await mountInDock();

    const edge = boxOf(container.firstElementChild).right;
    expect(boxOf(inputOf(container)).right).toBeLessThanOrEqual(edge);
    expect(
      boxOf(container.querySelector('[data-testid="button-generate"]')).right
    ).toBeLessThanOrEqual(edge);
  });
});

describe('отчёт не раздвигает панель', () => {
  it('длинная строка кода прокручивается у себя, а поле и кнопка остаются в доке', async () => {
    // Док прокручивает панель областью-таблицей, а таблица растёт по самому широкому
    // содержимому. Блок кода с длинной строкой раздвигал её на сотни пикселей — и вместе
    // с ней уезжали за край дока поле имени и кнопка, которые к отчёту отношения не имеют.
    const documentId = 'fake:form/form.schema.json';
    const host: CodegenHost = {
      ...createFakeHost({ document: createFakeDocument(documentId, '{}') }),
      useTranslate: () => (key) => key,
      useActiveDocument: () => documentId,
    };
    const sessions = createCodegenSessions();
    sessions.storeFor(documentId).patch({
      files: [
        {
          path: 'form.validation.ts',
          cls: 'derived',
          targetId: 'validation',
          origin: 'builtin',
        },
      ],
      snippet: `export const registry = { ${'contact: () => import("./forms/contact"), '.repeat(20)} };`,
    });

    const { container } = renderReact(
      // Та же раскладка, что у области прокрутки дока: блок-таблица шириной не меньше дока.
      <div style={{ width: 320, overflow: 'hidden' }} data-testid="dock">
        <div style={{ display: 'table', minWidth: '100%' }}>
          <ExportPanel host={host} sessions={sessions} targets={() => []} />
        </div>
      </div>
    );
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="codegen-report"]')).not.toBeNull();
    });

    const edge = (
      container.querySelector('[data-testid="dock"]') as HTMLElement
    ).getBoundingClientRect().right;
    const right = (selector: string): number => {
      const element = container.querySelector(selector);
      if (element === null) throw new Error(`нет элемента ${selector}`);
      return element.getBoundingClientRect().right;
    };
    expect(right('[data-testid="input-formName"]')).toBeLessThanOrEqual(edge);
    expect(right('[data-testid="button-generate"]')).toBeLessThanOrEqual(edge);
    expect(right('[data-testid="codegen-report"]')).toBeLessThanOrEqual(edge);
    // Сама строка никуда не делась: она шире блока кода и прокручивается в нём.
    const code = container.querySelector('pre') as HTMLElement;
    expect(code.scrollWidth).toBeGreaterThan(code.clientWidth);
  });
});

describe('отчёт о раскладке на диске', () => {
  it('называет прежнее имя документа, файлы шагов без шага и файлы прежней раскладки', async () => {
    // Все три случая — про файлы, которых в составе модуля НЕТ: строки в списке файлов модуля
    // для них не нашлось бы, поэтому у каждого своя секция.
    const documentId = 'fake:forms/loan/schema/form.schema.json';
    const opened: string[] = [];
    const host: CodegenHost = {
      ...createFakeHost({ document: createFakeDocument(documentId, '{}') }),
      useTranslate: () => (key, params) =>
        params === undefined ? key : `${key}:${JSON.stringify(params)}`,
      useActiveDocument: () => documentId,
      openResource: (id) => {
        opened.push(id);
      },
    };
    const sessions = createCodegenSessions();
    sessions.storeFor(documentId).patch({
      files: [
        {
          path: 'behavior/index.ts',
          cls: 'user',
          targetId: 'codegen.form-behavior',
          origin: 'builtin',
        },
      ],
      delivery: {
        dir: 'fake:forms/loan',
        written: ['behavior/index.ts'],
        skipped: [],
        failed: [],
        saved: null,
        orphans: ['schema/steps/old', 'validation/old.ts'],
        legacy: [
          {
            path: 'schema/renderer.schema.json',
            replacedBy: 'schema/form.schema.json',
            carried: false,
          },
        ],
        flat: ['index.tsx', 'form.render.ts', 'steps/old/form.validation.ts'],
      },
    });

    const { container } = renderReact(
      <ExportPanel host={host} sessions={sessions} targets={() => []} />
    );
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="codegen-flat"]')).not.toBeNull();
    });

    const linesOf = (testId: string): string[] =>
      [...container.querySelectorAll(`[data-testid="${testId}"] span.font-mono`)].map(
        (line) => line.textContent ?? ''
      );
    // Файлы прежней плоской раскладки — код прежнего контракта: названы поимённо.
    expect(linesOf('codegen-flat')).toEqual([
      'index.tsx',
      'form.render.ts',
      'steps/old/form.validation.ts',
    ]);
    expect(container.querySelector('[data-testid="codegen-flat"]')?.textContent).toContain(
      'flat.detail'
    );
    // Сироты — и папка схемы шага, и файл его правил: путь печатается как есть.
    expect(linesOf('codegen-orphans')).toEqual(['schema/steps/old', 'validation/old.ts']);

    // У прежнего имени ДОКУМЕНТА есть действие: открыть документ там, где он теперь лежит.
    const open = container.querySelector('[data-testid="codegen-legacy"] button');
    expect(open).not.toBeNull();
    (open as HTMLButtonElement).click();
    expect(opened).toEqual(['fake:forms/loan/schema/form.schema.json']);
  });
});
