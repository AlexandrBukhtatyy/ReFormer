/**
 * Поверхность демо-стека в настоящем браузере: нативные поля, ввод, пересборка по схеме.
 *
 * @module plugins/plain/surface.browser.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyPlainOp, sampleForm, type PlainForm } from '@reformer/builder-stack-plain';
import type {
  Disposable,
  DocumentRef,
  PreviewContext,
  PreviewValues,
} from '@reformer/builder-plugin-api';
import { PLAIN_PROVIDER_ID } from './contract';
import { createNativeSurface } from './surface';

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
  id: 'mem:contact.plain.json',
  ref: {
    id: 'mem:contact.plain.json',
    sourceId: 'mem',
    path: 'contact.plain.json',
    name: 'contact.plain.json',
    kind: 'file',
    mediaType: 'application/json',
  },
  kind: 'model',
  providerId: PLAIN_PROVIDER_ID,
};

/** Контекст-двойник: модель меняется снаружи, значения хранятся по-настоящему. */
function fakeContext(initial: unknown) {
  let schema = initial;
  let values: PreviewValues | undefined;
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
    report: () => undefined,
  };
  return {
    ctx,
    kept: () => values,
    setSchema(next: unknown): void {
      schema = next;
      for (const cb of listeners) cb();
    },
  };
}

const surface = createNativeSurface((key) => key);

async function mount(ctx: PreviewContext): Promise<HTMLElement> {
  const element = host();
  const subscription = surface.mount(element, ctx);
  cleanup.push(() => {
    subscription.dispose();
  });
  // Обёртка появляется сразу, а корень React рисует асинхронно: ждём ТЕКСТ, а не элемент.
  await vi.waitFor(() => {
    expect(element.textContent?.trim()).not.toBe('');
  });
  return element;
}

function input(element: HTMLElement, name: string): HTMLInputElement {
  const found = element.querySelector(`[data-testid="plain-input-${name}"]`);
  if (found === null) throw new Error(`поля ${name} нет`);
  return found as HTMLInputElement;
}

/** Ввод, который видит React: значение через нативный сеттер и событие `input`. */
function type(field: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('поверхность «plain.native»', () => {
  it('берётся только за документ своего провайдера', () => {
    expect(surface.applies(DOC)).toBe(true);
    expect(surface.applies({ ...DOC, providerId: 'form.schema' })).toBe(false);
  });

  it('рисует каждое поле нативным элементом своего вида', async () => {
    const element = await mount(fakeContext(sampleForm()).ctx);

    expect(input(element, 'name').type).toBe('text');
    expect(input(element, 'age').type).toBe('number');
    expect(input(element, 'agree').type).toBe('checkbox');
    expect(element.querySelector('select')?.options.length).toBe(2);
  });

  it('ввод уходит на хранение и переживает пересборку по новой схеме', async () => {
    const fake = fakeContext(sampleForm());
    const element = await mount(fake.ctx);

    type(input(element, 'name'), 'Аня');
    await vi.waitFor(() => {
      expect(fake.kept()?.name).toBe('Аня');
    });

    const next = applyPlainOp(sampleForm(), {
      type: 'add-field',
      params: { field: { name: 'email', label: 'Email', type: 'text' } },
    }).model;
    fake.setSchema(next);

    await vi.waitFor(() => {
      expect(element.querySelector('[data-testid="plain-input-email"]')).not.toBeNull();
    });
    expect(input(element, 'name').value).toBe('Аня');
  });

  it('модель не той формы объясняется словами', async () => {
    const element = await mount(fakeContext({ root: {} } as unknown as PlainForm).ctx);
    expect(element.textContent).toContain('surface.invalid');
  });

  it('снять и сразу смонтировать в тот же элемент — без второго корня React', async () => {
    // Так монтирует StrictMode: эффект снимается и ставится заново в одном такте, а снятие
    // поверхности отложено. Общий корень на элемент дал бы «createRoot() on a container that
    // has already been passed to createRoot()».
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const element = host();
      const ctx = fakeContext(sampleForm()).ctx;
      surface.mount(element, ctx).dispose();
      const second = surface.mount(element, ctx);
      cleanup.push(() => {
        second.dispose();
      });
      await vi.waitFor(() => {
        expect(element.querySelectorAll('[data-testid="plain-form"]')).toHaveLength(1);
      });
      expect(errors).not.toHaveBeenCalled();
    } finally {
      errors.mockRestore();
    }
  });

  it('снятие убирает поддерево', async () => {
    const element = host();
    const subscription = surface.mount(element, fakeContext(sampleForm()).ctx);
    await vi.waitFor(() => {
      expect(element.childElementCount).toBeGreaterThan(0);
    });
    subscription.dispose();
    await vi.waitFor(() => {
      expect(element.childElementCount).toBe(0);
    });
  });
});
