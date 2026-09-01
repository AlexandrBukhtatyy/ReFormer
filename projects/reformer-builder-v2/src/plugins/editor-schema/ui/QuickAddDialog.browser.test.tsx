/**
 * Диалог быстрого добавления в настоящем браузере.
 *
 * Модель выдачи и арифметика курсора проверены без DOM ([quick-add.test.ts](../quick-add.test.ts)).
 * Здесь остаётся то, чего в `node` не существует:
 *
 * - **сетка.** Число колонок диалог ИЗМЕРЯЕТ по раскладке, и проверить это можно только там,
 *   где раскладка есть: в jsdom `getBoundingClientRect` отдаёт нули, и все карточки оказались бы
 *   в одной строке;
 * - **фокус и клавиатура.** Поле получает фокус при открытии, а стрелки при этом принадлежат
 *   сетке, а не каретке в поле;
 * - **сама вставка**: от нажатия Enter до узла в документе.
 *
 * @module plugins/editor-schema/ui/QuickAddDialog.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { useMemo, type ReactElement } from 'react';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { DEFAULT_COL_CLASS } from '@/lib/form-model/mutate';
import { getAt } from '@/lib/form-model/paths';
import type { CatalogEntry } from '@/lib/catalog/types';
import { renderReact } from '@/testing/render';
import { createSessionRegistry, type SessionRegistry } from '../session/sessions';
import { createFakeSchemaHost } from '../testing';
import { QuickAddDialog } from './QuickAddDialog';
import { useActiveSession, useSessionState } from './useSession';

const DOCUMENT = 'fake:form.json';

function entry(name: string, category: string): CatalogEntry {
  return {
    name,
    role: 'field',
    category,
    propsSchema: { type: 'object', properties: {} },
    makeNode: () => ({ value: `$model(${name.toLowerCase()})`, component: `$component(${name})` }),
  } as CatalogEntry;
}

/** Каталог из десяти записей: на такой ширине сетка гарантированно многоколоночная. */
const CATALOG: readonly CatalogEntry[] = [
  entry('Input', 'Поля ввода'),
  entry('Textarea', 'Поля ввода'),
  entry('InputPassword', 'Поля ввода'),
  entry('Select', 'Выбор'),
  entry('Checkbox', 'Выбор'),
  entry('Switch', 'Выбор'),
  entry('Slider', 'Выбор'),
  entry('DatePicker', 'Дата'),
  entry('Calendar', 'Дата'),
  entry('Badge', 'Отображение'),
];

function schema(): JsonFormSchema {
  return {
    version: '1.0',
    root: {
      component: '$html(div)',
      componentProps: { className: DEFAULT_COL_CLASS },
      children: [{ value: '$model(first)', component: '$component(Input)' }],
    },
  } as unknown as JsonFormSchema;
}

function Harness({
  registry,
  items,
}: {
  registry: SessionRegistry;
  items: readonly CatalogEntry[];
}): ReactElement {
  const session = useActiveSession(registry);
  const state = useSessionState(registry, session);
  const catalog = useMemo(() => items, [items]);
  if (session === null || state === null) return <div>сеанса нет</div>;
  return (
    <QuickAddDialog
      open
      onClose={() => undefined}
      session={session}
      state={state}
      t={(key) => key}
      catalog={catalog}
    />
  );
}

async function mount(options: { catalog?: readonly CatalogEntry[] } = {}) {
  const catalog = options.catalog ?? CATALOG;
  const host = createFakeSchemaHost({
    documentId: DOCUMENT,
    text: JSON.stringify(schema()),
    catalog,
  });
  const registry = createSessionRegistry({ host });
  const session = registry.open(DOCUMENT);
  if (session === null) throw new Error('сеанс не открылся');

  const mounted = renderReact(<Harness registry={registry} items={catalog} />);
  await vi.waitFor(() => {
    if (document.querySelector('[data-quick-index]') === null) {
      throw new Error('сетка ещё не отрисована');
    }
  });

  return {
    model: (): JsonFormSchema => session.get().model,
    unmount: mounted.unmount,
  };
}

/** Карточки сетки в порядке отрисовки. */
function cards(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-quick-index]')];
}

function activeIndex(): number {
  const active = document.querySelector<HTMLElement>('[data-active="true"]');
  return active === null ? -1 : Number(active.dataset.quickIndex);
}

function children(model: JsonFormSchema): unknown[] {
  const list = getAt(model, ['root', 'children']);
  return Array.isArray(list) ? list : [];
}

describe('быстрое добавление', () => {
  it('показывает сетку в несколько колонок и разделы каталога', async () => {
    const fixture = await mount();
    const all = cards();
    expect(all).toHaveLength(CATALOG.length);

    // Многоколоночность — не оформление, а условие работы стрелок: считаем, сколько карточек
    // стоит на одной строке с первой.
    const top = all[0].getBoundingClientRect().top;
    const firstRow = all.filter((card) => Math.abs(card.getBoundingClientRect().top - top) < 2);
    expect(firstRow.length).toBeGreaterThan(1);

    // Разделы подписаны — по ним человек находит нужное, не читая всё подряд.
    expect(document.body.textContent).toContain('Поля ввода');
    expect(document.body.textContent).toContain('Выбор');
    fixture.unmount();
  });

  it('поле поиска получает фокус и сужает выдачу', async () => {
    const fixture = await mount();
    const search = document.querySelector<HTMLInputElement>('[data-quick-search]');
    if (search === null) throw new Error('поля поиска нет');
    expect(document.activeElement).toBe(search);

    await userEvent.type(search, 'sel');
    await expect.poll(() => cards().length).toBe(1);
    expect(cards()[0].textContent).toContain('Select');
    fixture.unmount();
  });

  it('стрелки водят курсор по сетке, а не по каретке в поле', async () => {
    const fixture = await mount();
    expect(activeIndex()).toBe(0);

    await userEvent.keyboard('{ArrowRight}');
    await expect.poll(activeIndex).toBe(1);

    // Вниз — через целую строку, поэтому индекс прыгает больше чем на единицу.
    await userEvent.keyboard('{ArrowDown}');
    await expect.poll(activeIndex).toBeGreaterThan(1);

    await userEvent.keyboard('{ArrowUp}');
    await expect.poll(activeIndex).toBe(1);
    fixture.unmount();
  });

  it('Enter добавляет выбранный компонент в документ', async () => {
    const fixture = await mount();
    const search = document.querySelector<HTMLInputElement>('[data-quick-search]');
    if (search === null) throw new Error('поля поиска нет');

    await userEvent.type(search, 'textarea');
    await expect.poll(() => cards().length).toBe(1);
    await userEvent.keyboard('{Enter}');

    await expect.poll(() => children(fixture.model()).length).toBe(2);
    const added = children(fixture.model())[1] as { component?: string };
    expect(added.component).toBe('$component(Textarea)');
    fixture.unmount();
  });

  it('щелчок по карточке добавляет её же', async () => {
    const fixture = await mount();
    const card = cards().find((node) => node.textContent?.includes('Checkbox'));
    if (card === undefined) throw new Error('карточки Checkbox нет');

    await userEvent.click(card);

    await expect.poll(() => children(fixture.model()).length).toBe(2);
    const added = children(fixture.model())[1] as { component?: string };
    expect(added.component).toBe('$component(Checkbox)');
    fixture.unmount();
  });

  it('ничего не нашлось — говорит об этом, а не показывает пустую сетку', async () => {
    const fixture = await mount();
    const search = document.querySelector<HTMLInputElement>('[data-quick-search]');
    if (search === null) throw new Error('поля поиска нет');

    await userEvent.type(search, 'такого-нет');
    await expect.poll(() => cards().length).toBe(0);
    expect(document.body.textContent).toContain('quick-add.empty');
    fixture.unmount();
  });
});

/** Каталог на восемь разделов по девять записей — столько же порядка, сколько в настоящем ките. */
const BIG_CATALOG: readonly CatalogEntry[] = [
  'Поля ввода',
  'Выбор',
  'Дата',
  'Контейнеры',
  'Отображение',
  'Навигация',
  'Оверлеи',
  'Типографика',
].flatMap((category, group) =>
  Array.from({ length: 9 }, (_, index) =>
    entry(`Component${String(group)}${String(index)}`, category)
  )
);

/** Окно прокрутки области кита — то, что реально скроллится. */
function viewport(): HTMLElement {
  const node = document.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]');
  if (node === null) throw new Error('окна прокрутки нет');
  return node;
}

describe('область прокрутки', () => {
  it('на большом каталоге сетка прокручивается, а не вылезает из диалога', async () => {
    const fixture = await mount({ catalog: BIG_CATALOG });

    // Содержимого больше, чем видно, — значит предел высоты сработал и прокрутка включилась.
    // Без определённой высоты окно кита растёт под содержимое, и оба числа совпадают.
    await expect.poll(() => viewport().scrollHeight > viewport().clientHeight).toBe(true);

    viewport().scrollTop = 200;
    expect(viewport().scrollTop).toBeGreaterThan(0);

    // Подсказка снизу остаётся внутри окна диалога, а не оказывается под уехавшей сеткой.
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (dialog === null) throw new Error('диалога нет');
    const hint = [...dialog.querySelectorAll<HTMLElement>('p')].at(-1);
    if (hint === undefined) throw new Error('подсказки нет');
    expect(hint.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      dialog.getBoundingClientRect().bottom + 1
    );
    fixture.unmount();
  });

  it('на коротком каталоге диалог не растягивается пустотой', async () => {
    const fixture = await mount();
    // Высота по содержимому: прокручивать нечего, и лишнего места под сеткой нет.
    await expect
      .poll(() => viewport().scrollHeight - viewport().clientHeight)
      .toBeLessThanOrEqual(1);
    fixture.unmount();
  });

  it('набранный запрос не меняет размер окна', async () => {
    const fixture = await mount();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (dialog === null) throw new Error('диалога нет');
    const search = document.querySelector<HTMLInputElement>('[data-quick-search]');
    if (search === null) throw new Error('поля поиска нет');

    // Дожидаемся измерения: до него высота — предел, и сравнивать было бы не с чем.
    await expect
      .poll(() => viewport().scrollHeight - viewport().clientHeight)
      .toBeLessThanOrEqual(1);
    // `offsetHeight`, а не `getBoundingClientRect`: окно появляется с анимацией масштаба
    // (`zoom-in-95` кита), и прямоугольник в её середине меньше настоящего на пару процентов —
    // сравнение двух таких замеров ловило бы анимацию, а не вёрстку.
    const before = dialog.offsetHeight;

    await userEvent.type(search, 'Input');
    await expect.poll(() => cards().length).toBeLessThan(CATALOG.length);
    expect(dialog.offsetHeight).toBe(before);

    // И на пустой выдаче тоже: «ничего не нашлось» окно не схлопывает.
    await userEvent.type(search, 'такого-нет');
    await expect.poll(() => cards().length).toBe(0);
    expect(dialog.offsetHeight).toBe(before);
    fixture.unmount();
  });
});
