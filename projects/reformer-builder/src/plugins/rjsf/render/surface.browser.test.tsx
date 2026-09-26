/**
 * Поверхность RJSF в настоящем браузере: стандартная тема без кита, ui-kit через мост темы,
 * ввод, пересборка по схеме и падение отрисовки.
 *
 * Мост проверяется на настоящих полях `@reformer/ui-kit`: у `Input` свой диалект (событие вместо
 * значения), у `Checkbox` — `checked`/`onCheckedChange`. В значения формы обязаны прийти строка
 * и boolean — ровно то, что сломалось бы, если бы тема передала контролу seam RJSF как есть.
 *
 * @module plugins/rjsf/render/surface.browser.test
 */

import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createKitTheme } from '@reformer/rjsf-kit-theme';
import { applyRjsfOp, RJSF_PROVIDER_ID, sampleForm, type RjsfForm } from '@/plugins/rjsf/core';
import type {
  CatalogJson,
  Disposable,
  DocumentRef,
  KitNamespace,
  KitsService,
  PreviewContext,
  PreviewProblem,
  PreviewValues,
} from '@reformer/builder-plugin-api';
import { RJSF_SURFACE_ID } from './contract';
import { createRjsfSurface } from './surface';

const NOOP: Disposable = { dispose: () => {} };
const cleanup: (() => void)[] = [];

afterEach(() => {
  while (cleanup.length > 0) cleanup.pop()?.();
});

function host(): HTMLElement {
  const element = document.createElement('div');
  document.body.append(element);
  cleanup.push(() => {
    element.remove();
  });
  return element;
}

const DOC: DocumentRef = {
  id: 'mem:contact.rjsf.json',
  ref: {
    id: 'mem:contact.rjsf.json',
    sourceId: 'mem',
    path: 'contact.rjsf.json',
    name: 'contact.rjsf.json',
    kind: 'file',
    mediaType: 'application/json',
  },
  kind: 'model',
  providerId: RJSF_PROVIDER_ID,
};

/** Контекст-двойник: модель меняется снаружи, значения и находки хранятся по-настоящему. */
function fakeContext(initial: unknown) {
  let schema = initial;
  let values: PreviewValues | undefined;
  const reports: (readonly PreviewProblem[])[] = [];
  const listeners = new Set<() => void>();
  const ctx: PreviewContext = {
    doc: DOC,
    schema: () => schema,
    onDidChangeSchema: (cb) => {
      listeners.add(cb);
      return { dispose: () => listeners.delete(cb) };
    },
    selection: () => [],
    onDidChangeSelection: () => NOOP,
    select: () => undefined,
    mock: () => null,
    values: () => values,
    keepValues: (next) => {
      values = next;
    },
    report: (source, problems) => {
      if (source === RJSF_SURFACE_ID) reports.push(problems);
    },
  };
  return {
    ctx,
    kept: () => values,
    lastReport: () => reports[reports.length - 1],
    setSchema(next: unknown): void {
      schema = next;
      for (const cb of listeners) cb();
    },
  };
}

/** Рамка кита-двойника: метка, по которой видно, что форма нарисована внутри неё. */
function Frame({ children }: { children?: ReactNode }) {
  return <div data-kit-frame="">{children}</div>;
}

/** Служба китов в объёме поверхности: каталог, компоненты и рамка встроенного ui-kit. */
async function uiKit(): Promise<KitsService> {
  const catalog = (await import('@reformer/ui-kit/catalog')).default as unknown as CatalogJson;
  const namespace = (await import('@reformer/ui-kit')) as unknown as KitNamespace;
  return {
    catalogJson: () => catalog,
    namespace: () => namespace,
    onDidChange: () => NOOP,
    onDidLoadNamespace: () => NOOP,
    Frame,
  } as unknown as KitsService;
}

async function mount(ctx: PreviewContext, kits?: KitsService): Promise<HTMLElement> {
  const element = host();
  const surface = createRjsfSurface({ t: (key) => key, kits: () => kits });
  const subscription = surface.mount(element, ctx);
  cleanup.push(() => {
    subscription.dispose();
  });
  // RJSF едет ленивым чанком: ждём саму форму, а не заглушку загрузки.
  await vi.waitFor(
    () => {
      expect(element.querySelector('form')).not.toBeNull();
    },
    { timeout: 15_000 }
  );
  return element;
}

function field(element: HTMLElement, selector: string): HTMLElement {
  const found = element.querySelector<HTMLElement>(selector);
  if (found === null) throw new Error(`нет ${selector}`);
  return found;
}

/** Ввод, который видит React: значение через нативный сеттер и событие `input`. */
function type(input: HTMLElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('поверхность «rjsf.preview»', () => {
  it('берётся только за документ своего провайдера', () => {
    const surface = createRjsfSurface({ t: (key) => key, kits: () => undefined });

    expect(surface.applies(DOC)).toBe(true);
    expect(surface.applies({ ...DOC, providerId: 'form.schema' })).toBe(false);
  });

  it('без кита — стандартная тема RJSF', async () => {
    const fake = fakeContext(sampleForm());
    const element = await mount(fake.ctx);

    expect(element.querySelector('[data-kit-frame]')).toBeNull();
    type(field(element, '#root_name'), 'Аня');
    field(element, '#root_agree').click();

    await vi.waitFor(() => {
      expect(fake.kept()).toMatchObject({ name: 'Аня', agree: true });
    });
  });

  it('ui-kit через мост: поля кита в рамке кита, в значения — строка и boolean', async () => {
    const fake = fakeContext(sampleForm());
    const element = await mount(fake.ctx, await uiKit());

    const name = field(element, '[data-testid="input-name"]');
    const agree = field(element, '[data-testid="input-agree"]');
    expect(element.querySelector('[data-kit-frame] form')).not.toBeNull();
    expect(name.tagName).toBe('INPUT');
    // Флажок ui-kit — Radix: кнопка с ролью, а не нативный checkbox RJSF.
    expect(agree.getAttribute('role')).toBe('checkbox');
    // Подпись рисует рамка поля кита.
    expect(field(element, '[data-slot="field-label"]').textContent).toContain('Имя');

    type(name, 'Аня');
    agree.click();

    await vi.waitFor(() => {
      expect(fake.kept()?.name).toBe('Аня');
      expect(fake.kept()?.agree).toBe(true);
    });
  });

  it('тема ui-kit: роли и шаблоны — компоненты кита, кроме полей за подпутём', async () => {
    const kits = await uiKit();
    const catalog = kits.catalogJson();
    const { problems } = createKitTheme({
      namespace: kits.namespace() ?? {},
      components: catalog.components,
      ...(catalog.kit?.infra !== undefined ? { slots: catalog.kit.infra } : {}),
    });

    // Поля за подпутём (`DatePicker`, `Combobox`…) в главный вход ui-kit не входят, а каталог
    // этого не говорит (ReFormer-9r8q): дату рисует стандартный виджет RJSF. Остальные роли и
    // все шаблоны — из кита.
    expect(
      problems.filter((problem) => problem.code === 'widget-default').map((p) => p.widget)
    ).toEqual(['DateWidget']);
    expect(problems.filter((problem) => problem.code === 'template-default')).toEqual([]);
  });

  it('ввод переживает пересборку по новой схеме, значение удалённого поля отпадает', async () => {
    const fake = fakeContext(sampleForm());
    const element = await mount(fake.ctx);

    type(field(element, '#root_name'), 'Аня');
    await vi.waitFor(() => {
      expect(fake.kept()?.name).toBe('Аня');
    });
    let next: RjsfForm = applyRjsfOp(sampleForm(), {
      type: 'add-field',
      params: { name: 'email', field: { type: 'string', title: 'Почта' } },
    }).model;
    next = applyRjsfOp(next, { type: 'remove-field', params: { name: 'age' } }).model;
    fake.setSchema(next);

    await vi.waitFor(() => {
      expect(element.querySelector('#root_email')).not.toBeNull();
    });
    expect((field(element, '#root_name') as HTMLInputElement).value).toBe('Аня');
    expect(element.querySelector('#root_age')).toBeNull();
  });

  it('падение отрисовки — находка сборки; исправленная схема её снимает', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const broken: RjsfForm = { ...sampleForm(), uiSchema: { name: { 'ui:widget': 'Knob' } } };
      const fake = fakeContext(broken);
      const element = host();
      const surface = createRjsfSurface({ t: (key) => key, kits: () => undefined });
      const subscription = surface.mount(element, fake.ctx);
      cleanup.push(() => {
        subscription.dispose();
      });

      await vi.waitFor(
        () => {
          expect(fake.lastReport()?.[0]).toMatchObject({ phase: 'render' });
        },
        { timeout: 15_000 }
      );
      expect(element.textContent).toContain('surface.failed');

      fake.setSchema(sampleForm());
      await vi.waitFor(() => {
        expect(fake.lastReport()).toEqual([]);
        expect(element.querySelector('#root_name')).not.toBeNull();
      });
    } finally {
      errors.mockRestore();
    }
  });

  it('модель не той формы объясняется словами', async () => {
    const element = host();
    const surface = createRjsfSurface({ t: (key) => key, kits: () => undefined });
    const subscription = surface.mount(element, fakeContext({ root: {} }).ctx);
    cleanup.push(() => {
      subscription.dispose();
    });

    await vi.waitFor(
      () => {
        expect(element.textContent).toContain('surface.invalid');
      },
      { timeout: 15_000 }
    );
  });

  it('снятие убирает поддерево сразу', async () => {
    const element = host();
    const surface = createRjsfSurface({ t: (key) => key, kits: () => undefined });
    const subscription = surface.mount(element, fakeContext(sampleForm()).ctx);

    expect(element.childElementCount).toBe(1);
    subscription.dispose();
    expect(element.childElementCount).toBe(0);
  });
});
