/**
 * Компоненты за подпутём кита в превью — на НАСТОЯЩЕМ ките, в настоящем браузере.
 *
 * Подпуть записи каталога значит одно: откуда импортируется её символ. Рисовать ли компонент
 * вживую, решает факт — есть ли символ в пространстве имён кита. Каталог встроенного кита
 * объявляет подпуть комбобоксу и выбору даты (в главный вход они не входят), а пространство имён
 * встроенного кита собрано из главного входа и полей с подпутей. Здесь оно собрано так же, и
 * проверяется то, что видит человек:
 *
 * - комбобокс, мультикомбобокс и выбор даты — живые контролы, а не заглушка «предпросмотр
 *   ограничен», и выбор опции доезжает до модели в своём типе (строка, массив строк);
 * - карусель, чей подпуть в пространство имён не загружен, — подписанная заглушка, и подпись
 *   называет этот подпуть.
 *
 * Node-тест политики (`./policy.test`) проверяет решение на подставных значениях; сюда вынесено
 * то, до чего он не достаёт, — что настоящие контролы кита под обёрткой превью рисуются и пишут.
 *
 * @module plugins/reformer/render/runtime/subpath-fields.browser.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import * as uiKit from '@reformer/ui-kit';
import * as combobox from '@reformer/ui-kit/combobox';
import * as datePicker from '@reformer/ui-kit/date-picker';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { builtinCatalog } from '../../../core/testing';
import type { KitNamespace } from '@reformer/builder-plugin-api';
import type {
  Disposable,
  DocumentRef,
  NodeId,
  PreviewContext,
  PreviewMock,
  PreviewValues,
} from '@reformer/builder-plugin-api';
import { builtinSurfaces } from '../plugin';
import { createFakeHost, fakeRef } from '../testing';
import { RUNTIME_SURFACE_ID } from './surface';

const NOOP: Disposable = Object.freeze({ dispose: () => undefined });
const NO_SELECTION: readonly NodeId[] = Object.freeze([]);

/**
 * Пространство имён так, как его собирает встроенный кит (`plugins/forms/kits/builtin`): главный
 * вход и поля с подпутей; подпуть карусели — нет, форме он не нужен.
 */
const NAMESPACE = { ...combobox, ...datePicker, ...uiKit } as unknown as KitNamespace;

/** Поля шаблона «Простая форма», ради которых подпуть перестал означать заглушку. */
const SCHEMA: JsonFormSchema = {
  format: 2,
  root: {
    component: '$component(Box)',
    children: [
      {
        model: '$model(position)',
        component: '$component(Combobox)',
        componentProps: {
          label: 'Должность',
          placeholder: 'Выберите должность',
          options: '$dataSource(POSITIONS)',
          clearable: true,
          testId: 'position',
        },
      },
      {
        model: '$model(skills)',
        component: '$component(ComboboxMulti)',
        componentProps: {
          label: 'Навыки',
          placeholder: 'Выберите навыки',
          options: '$dataSource(SKILLS)',
          maxItems: 3,
          testId: 'skills',
        },
      },
      {
        model: '$model(birthDate)',
        component: '$component(DatePicker)',
        componentProps: { label: 'Дата рождения', placeholder: 'ДД.ММ.ГГГГ', testId: 'birthDate' },
      },
      { component: '$component(Carousel)', children: [] },
    ],
  },
} as JsonFormSchema;

const MOCK: PreviewMock = {
  model: { position: '', skills: null, birthDate: null },
  dataSources: {
    POSITIONS: [
      { value: 'developer', label: 'Разработчик' },
      { value: 'analyst', label: 'Аналитик' },
    ],
    SKILLS: [
      { value: 'react', label: 'React' },
      { value: 'sql', label: 'SQL' },
    ],
  },
};

const cleanup: (() => void)[] = [];

afterEach(() => {
  while (cleanup.length > 0) cleanup.pop()?.();
});

interface KeepingContext extends PreviewContext {
  kept(): PreviewValues | undefined;
}

/** Контекст, который по-настоящему хранит отданные значения. */
function keepingContext(): KeepingContext {
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
    schema: () => SCHEMA,
    onDidChangeSchema: () => NOOP,
    selection: () => NO_SELECTION,
    onDidChangeSelection: () => NOOP,
    select: () => undefined,
    mock: () => MOCK,
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
    namespace: NAMESPACE,
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
    expect(element.querySelector('[role="combobox"]')).not.toBeNull();
  });
  return { element, dispose };
}

/** Пункт списка в поповере (он рисуется порталом в `body`) по видимому тексту. */
async function option(label: string): Promise<HTMLElement> {
  let found: HTMLElement | undefined;
  await vi.waitFor(() => {
    found = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].find(
      (item) => item.textContent?.trim() === label
    );
    expect(found, `пункт «${label}»`).toBeDefined();
  });
  return found as HTMLElement;
}

describe('компоненты за подпутём кита на встроенном ките', () => {
  it('каталог объявляет им подпуть — и это не делает их заглушкой', async () => {
    const { subpaths } = builtinCatalog().descriptor;
    expect(subpaths.get('Combobox')).toBe('combobox');
    expect(subpaths.get('ComboboxMulti')).toBe('combobox');
    expect(subpaths.get('DatePicker')).toBe('date-picker');

    const { element } = await mounted(keepingContext());

    // Живые контролы: у комбобоксов — кнопка-триггер с ролью, у выбора даты — своя кнопка.
    const triggers = [...element.querySelectorAll<HTMLElement>('[role="combobox"]')];
    expect(triggers.map((item) => item.textContent?.trim())).toEqual([
      'Выберите должность',
      'Выберите навыки',
    ]);
    const date = element.querySelector<HTMLElement>('[data-slot="date-picker-trigger"]');
    expect(date?.textContent).toContain('ДД.ММ.ГГГГ');
    // Заглушка осталась одна — у карусели: её подпуть в пространство имён не загружен.
    const text = element.textContent ?? '';
    expect(text.match(/предпросмотр ограничен/g)).toHaveLength(1);
    // Имя и пояснение — соседние элементы заглушки, пробела между ними в тексте узла нет.
    expect(text).toContain(
      'Carousel— предпросмотр ограничен (лежит в @reformer/ui-kit/carousel — этот подпуть в превью не загружен)'
    );
    expect(text).not.toContain('subpath-only');
  });

  it('выбор в комбобоксе и мультикомбобоксе доезжает до модели в своём типе', async () => {
    const ctx = keepingContext();
    const { element, dispose } = await mounted(ctx);
    const [position, skills] = [...element.querySelectorAll<HTMLElement>('[role="combobox"]')];

    await userEvent.click(position);
    await userEvent.click(await option('Аналитик'));
    await vi.waitFor(() => {
      expect(position.textContent).toContain('Аналитик');
    });

    await userEvent.click(skills);
    await userEvent.click(await option('React'));
    await userEvent.click(await option('SQL'));
    await userEvent.keyboard('{Escape}');

    // Значения отдаёт очистка корня при снятии — микрозадачей (`../surface/mount`).
    dispose();
    await vi.waitFor(() => {
      expect(ctx.kept()).toBeDefined();
    });
    const kept = ctx.kept() as Record<string, unknown>;
    // Строка — `value` опции, а не её подпись и не DOM-событие.
    expect(kept.position).toBe('analyst');
    // Массив `value` выбранных опций: диалект мультивыбора пережил обёртку превью.
    expect(kept.skills).toEqual(['react', 'sql']);
    expect(kept.birthDate).toBeNull();
  });
});
