/**
 * Визард в превью на НАСТОЯЩЕМ ките: шаги — дети узла, рисует их визард кита.
 *
 * Пока шаги лежали в `componentProps.steps`, рантайм-поверхность показывала на месте визарда
 * подписанный стаб: синтетические `Wizard` и `Step` кит под этими именами не экспортирует, а
 * стаб рисует только `children`. Здесь закреплено то, ради чего шаги переехали: превью показывает
 * первый шаг, «Далее» ведёт ко второму, а значения обоих шагов живут в одной модели.
 *
 * @module plugins/reformer/render/runtime/wizard.browser.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import * as uiKit from '@reformer/ui-kit';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { builtinCatalog } from '../../../core/testing';
import type { KitNamespace } from '@reformer/builder-plugin-api';
import type {
  Disposable,
  DocumentRef,
  NodeId,
  PreviewContext,
  PreviewValues,
} from '@reformer/builder-plugin-api';
import { builtinSurfaces } from '../plugin';
import { createFakeHost, fakeRef } from '../testing';
import { RUNTIME_SURFACE_ID } from './surface';

const NOOP: Disposable = Object.freeze({ dispose: () => undefined });
const NO_SELECTION: readonly NodeId[] = Object.freeze([]);

/** Визард под синтетическим каталожным именем: два шага, в каждом по полю. */
const SCHEMA = {
  format: 2,
  root: {
    $nodeId: 'boxnode1',
    component: '$component(Box)',
    children: [
      {
        $nodeId: 'wizardn1',
        component: '$component(Wizard)',
        children: [
          {
            $nodeId: 'stepone1',
            component: '$component(Step)',
            componentProps: { title: 'Данные' },
            children: [
              {
                $nodeId: 'namenod1',
                model: '$model(name)',
                component: '$component(Input)',
                componentProps: { label: 'Имя', testId: 'name' },
              },
            ],
          },
          {
            $nodeId: 'steptwo1',
            component: '$component(Step)',
            componentProps: { title: 'Контакты' },
            children: [
              {
                $nodeId: 'mailnod1',
                model: '$model(email)',
                component: '$component(Input)',
                componentProps: { label: 'Почта', testId: 'email' },
              },
            ],
          },
        ],
      },
    ],
  },
} as unknown as JsonFormSchema;

const cleanup: (() => void)[] = [];

afterEach(() => {
  while (cleanup.length > 0) cleanup.pop()?.();
});

interface KeepingContext extends PreviewContext {
  kept(): PreviewValues | undefined;
}

function keepingContext(schema: JsonFormSchema): KeepingContext {
  const doc: DocumentRef = {
    id: 'fake:form/form.json',
    ref: fakeRef('fake:form/form.json'),
    kind: 'model',
    providerId: 'form.schema',
  };
  let values: PreviewValues | undefined;
  return {
    kept: () => values,
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

async function mounted(ctx: PreviewContext): Promise<{ element: HTMLElement; dispose(): void }> {
  const built = builtinCatalog();
  const host = createFakeHost({
    catalog: built.entries,
    descriptor: built.descriptor,
    namespace: uiKit as unknown as KitNamespace,
  });
  const surface = builtinSurfaces(host, (key) => key).find(
    (candidate) => candidate.id === RUNTIME_SURFACE_ID
  );
  if (surface === undefined) throw new Error('рантайм-поверхность не зарегистрирована');

  const element = document.createElement('div');
  document.body.append(element);
  const subscription = surface.mount(element, ctx);
  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    subscription.dispose();
  };
  cleanup.push(() => {
    dispose();
    element.remove();
  });
  await vi.waitFor(() => {
    expect(element.querySelector('[data-testid="input-name"]')).not.toBeNull();
  });
  return { element, dispose };
}

/** Кнопка перехода вперёд — по подписи: своего `data-testid` визард кита ей не даёт. */
function nextButton(element: HTMLElement): HTMLButtonElement {
  const button = [...element.querySelectorAll('button')].find((candidate) =>
    /Далее|Next/i.test(candidate.textContent ?? '')
  );
  if (button === undefined) throw new Error('кнопка «Далее» не найдена');
  return button;
}

describe('визард превью на встроенном ките', () => {
  it('рисует первый шаг, а не заглушку: заголовки шагов на месте, второй шаг скрыт', async () => {
    const { element } = await mounted(keepingContext(SCHEMA));

    expect(element.textContent).toContain('Данные');
    expect(element.textContent).toContain('Контакты');
    expect(element.textContent).not.toContain('предпросмотр ограничен');
    expect(element.querySelector('[data-testid="input-email"]')).toBeNull();
  });

  it('«Далее» ведёт ко второму шагу, значения обоих шагов живут в одной модели', async () => {
    const ctx = keepingContext(SCHEMA);
    const { element, dispose } = await mounted(ctx);

    await userEvent.fill(
      element.querySelector<HTMLInputElement>('[data-testid="input-name"]')!,
      'Аня'
    );
    await userEvent.click(nextButton(element));
    await vi.waitFor(() => {
      expect(element.querySelector('[data-testid="input-email"]')).not.toBeNull();
    });
    await userEvent.fill(
      element.querySelector<HTMLInputElement>('[data-testid="input-email"]')!,
      'anya@example.com'
    );

    // Значения отдаёт очистка корня при снятии — микрозадачей (`../surface/mount`).
    dispose();
    await vi.waitFor(() => {
      expect(ctx.kept()).toBeDefined();
    });
    expect(ctx.kept()).toMatchObject({ name: 'Аня', email: 'anya@example.com' });
  });
});
