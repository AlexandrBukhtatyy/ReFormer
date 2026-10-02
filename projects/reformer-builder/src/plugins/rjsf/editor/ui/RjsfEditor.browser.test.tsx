/**
 * Тело вкладки и панель свойств формы RJSF — рядом, как в оболочке: структура или форма
 * во вкладке, свойства выбранного поля в панели.
 *
 * Проверяется шов между ними. Связывает их только выделение ручки модели: щелчок по строке
 * ставит его в теле, панель читает его у активного документа, а операции (новое поле,
 * переименование) переносят сами. Порвись этот шов — на экране всё на месте, а панель пуста
 * или показывает не то поле.
 *
 * Ряд кнопок полосы вкладок здесь не рисуется: он принадлежит оболочке, а плагин её не видит.
 * Кнопки проверяет сквозной тест композиции (`shell/boot/integration/rjsf-view.browser.test`),
 * а вид здесь переключает стор — тот же, что читают кнопки.
 *
 * @module plugins/rjsf/editor/ui/RjsfEditor.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { sampleForm } from '@/plugins/rjsf/core';
import { renderReact } from '@/testing/render';
import { RJSF_EDITOR_MESSAGES } from '../messages';
import {
  createFakeLive,
  createFakeRjsfHandle,
  createFakeRjsfWorkspace,
  createFakeViewSettings,
  type FakeLive,
} from '../testing';
import { createRjsfViewStore, RJSF_VIEW_SETTING, type RjsfView } from '../view';
import type { Translate } from './hooks';
import { RjsfEditor } from './RjsfEditor';
import { RjsfInspector } from './RjsfInspector';

const RU = RJSF_EDITOR_MESSAGES.ru ?? {};

/** Русский словарь плагина с подстановкой — подписи кнопок обязаны различаться именем поля. */
const t: Translate = (key, params) =>
  (RU[key] ?? key).replace(/\{(\w+)\}/g, (_match, name: string) => String(params?.[name] ?? ''));
const useT = (): Translate => t;

function mount(options: { live?: FakeLive; remembered?: RjsfView } = {}) {
  const first = createFakeRjsfHandle(sampleForm());
  const second = createFakeRjsfHandle(sampleForm(), 'order.rjsf.json');
  const live = options.live ?? createFakeLive();
  const workspace = createFakeRjsfWorkspace({ handles: [first.handle, second.handle] });
  const view = createRjsfViewStore({
    settings: createFakeViewSettings(
      options.remembered === undefined ? {} : { [RJSF_VIEW_SETTING]: options.remembered }
    ),
    hasLive: () => live.available(),
  });

  const mounted = renderReact(
    <div style={{ display: 'flex', height: 480 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <RjsfEditor
          documentId={first.id}
          services={workspace.services}
          live={() => live}
          view={view}
          useTranslate={useT}
        />
      </div>
      <aside style={{ width: 320 }}>
        <RjsfInspector services={workspace.services} kits={() => undefined} useTranslate={useT} />
      </aside>
    </div>
  );

  return { first, second, live, workspace, view, mounted };
}

const structure = (): Element | null => document.querySelector('[data-testid="rjsf-structure"]');
const surface = (): Element | null => document.querySelector('[data-testid="fake-surface"]');

describe('вид вкладки: структура или форма', () => {
  it('по умолчанию — структура: форма не смонтирована, свойства ждут выбора', async () => {
    const { live } = mount();

    await expect.element(page.getByTestId('rjsf-structure')).toBeVisible();
    await expect.element(page.getByTestId('rjsf-row-name')).toBeVisible();
    await expect.element(page.getByTestId('rjsf-inspector-empty')).toBeVisible();
    // Свойств поля во вкладке больше нет — они в панели, и до выбора она пуста.
    expect(document.querySelector('[data-testid="rjsf-inspector"]')).toBeNull();
    expect(live.mounts()).toBe(0);
  });

  it('переключение показывает форму на всю вкладку и возвращает структуру', async () => {
    const { live, view } = mount();
    await expect.element(page.getByTestId('rjsf-structure')).toBeVisible();

    view.setView('form');

    await expect.element(page.getByTestId('fake-surface')).toBeVisible();
    expect(structure()).toBeNull();
    expect(live.mounts()).toBe(1);

    view.setView('structure');

    await expect.element(page.getByTestId('rjsf-structure')).toBeVisible();
    expect(surface()).toBeNull();
  });

  it('запомненная «форма» без поверхности рисует структуру, а не пустую вкладку', async () => {
    mount({ live: createFakeLive({ empty: true }), remembered: 'form' });

    await expect.element(page.getByTestId('rjsf-structure')).toBeVisible();
    expect(document.querySelector('[data-testid="rjsf-live"]')).toBeNull();
  });

  it('поверхность выключили на ходу — открытая форма уступает структуре', async () => {
    const { live } = mount({ remembered: 'form' });
    await expect.element(page.getByTestId('fake-surface')).toBeVisible();

    live.setEmpty(true);

    // Кнопки вида при этом пропадают, и остаться в форме значило бы остаться без выхода.
    await expect.element(page.getByTestId('rjsf-structure')).toBeVisible();
  });

  it('правки и смена выделения не перемонтируют форму; выделение её и не перерисовывает', async () => {
    const { first, live } = mount({ remembered: 'form' });
    await expect.element(page.getByTestId('fake-surface')).toBeVisible();
    const redraws = vi.fn();
    live.ctx()?.onDidChangeSchema(redraws);

    first.handle.setSelection(['age']);
    expect(redraws).not.toHaveBeenCalled();

    for (let index = 0; index < 5; index += 1) {
      first.handle.apply({ type: 'set-title', params: { title: `Анкета ${index}` } });
    }

    expect(redraws).toHaveBeenCalledTimes(5);
    expect(live.mounts()).toBe(1);
  });
});

describe('свойства выбранного поля — в панели', () => {
  it('щелчок по строке ставит выделение в ручке, и панель показывает это поле', async () => {
    const { first } = mount();

    await userEvent.click(page.getByRole('button', { name: /^age/ }));

    expect(first.selection()).toEqual(['age']);
    await expect.element(page.getByTestId('rjsf-field-name')).toHaveValue('age');
    await expect.element(page.getByTestId('rjsf-field-title')).toHaveValue('Возраст');
  });

  it('правка в панели меняет модель — и отрисованную форму', async () => {
    const { first, view } = mount();
    await userEvent.click(page.getByRole('button', { name: /^age/ }));

    await userEvent.fill(page.getByTestId('rjsf-field-title'), 'Полных лет');

    expect(first.model().schema.properties.age?.title).toBe('Полных лет');

    // Выделение переживает смену вида: панель остаётся на том же поле.
    view.setView('form');
    await expect.element(page.getByTestId('fake-surface')).toBeVisible();
    expect(surface()?.querySelector('[data-field="age"]')?.textContent).toBe('Полных лет');
    await expect.element(page.getByTestId('rjsf-field-name')).toHaveValue('age');
  });

  it('переименование оставляет панель на поле: выделение переносит сама операция', async () => {
    const { first } = mount();
    await userEvent.click(page.getByRole('button', { name: /^age/ }));

    await userEvent.fill(page.getByTestId('rjsf-field-name'), 'years');
    await userEvent.keyboard('{Enter}');

    await expect.poll(() => first.selection()).toEqual(['years']);
    expect(Object.keys(first.model().schema.properties)).toEqual([
      'name',
      'years',
      'channel',
      'agree',
    ]);
    await expect.element(page.getByTestId('rjsf-field-name')).toHaveValue('years');
    await expect.element(page.getByTestId('rjsf-row-years')).toBeVisible();
  });

  it('занятое имя не применяется, а панель говорит почему', async () => {
    const { first } = mount();
    await userEvent.click(page.getByRole('button', { name: /^age/ }));

    await userEvent.fill(page.getByTestId('rjsf-field-name'), 'name');
    await userEvent.keyboard('{Enter}');

    await expect.element(page.getByRole('alert')).toHaveTextContent('Поле «name» уже есть.');
    expect(first.selection()).toEqual(['age']);
    expect(first.model().schema.properties.age).toBeDefined();
  });

  it('новое поле сразу выбрано', async () => {
    const { first } = mount();

    await userEvent.click(page.getByTestId('rjsf-add-field'));

    expect(first.selection()).toEqual(['field1']);
    await expect.element(page.getByTestId('rjsf-field-name')).toHaveValue('field1');
  });

  it('удаление выбранного снимает выделение, отмена возвращает поле выбранным', async () => {
    const { first } = mount();
    await userEvent.click(page.getByRole('button', { name: /^age/ }));
    await expect.element(page.getByTestId('rjsf-field-name')).toHaveValue('age');

    await userEvent.click(page.getByRole('button', { name: 'Удалить поле age' }));

    expect(first.model().schema.properties.age).toBeUndefined();
    expect(first.selection()).toEqual([]);
    await expect.element(page.getByTestId('rjsf-inspector-empty')).toBeVisible();

    first.handle.undo();

    await expect.element(page.getByTestId('rjsf-field-name')).toHaveValue('age');
    expect(first.selection()).toEqual(['age']);
  });

  it('удаление соседнего поля выбор не трогает', async () => {
    const { first } = mount();
    await userEvent.click(page.getByRole('button', { name: /^age/ }));

    await userEvent.click(page.getByRole('button', { name: 'Удалить поле channel' }));

    expect(first.selection()).toEqual(['age']);
    await expect.element(page.getByTestId('rjsf-field-name')).toHaveValue('age');
  });

  it('панель следует за активной вкладкой: у каждого документа своё выделение', async () => {
    const { first, second, workspace } = mount();
    await userEvent.click(page.getByRole('button', { name: /^age/ }));
    await expect.element(page.getByTestId('rjsf-field-name')).toHaveValue('age');

    workspace.setActive(second.id);
    await expect.element(page.getByTestId('rjsf-inspector-empty')).toBeVisible();

    second.handle.setSelection(['channel']);
    await expect.element(page.getByTestId('rjsf-field-name')).toHaveValue('channel');

    // Вкладок нет вовсе — показывать нечего.
    workspace.setActive(null);
    await expect.element(page.getByTestId('rjsf-inspector-empty')).toBeVisible();

    workspace.setActive(first.id);
    await expect.element(page.getByTestId('rjsf-field-name')).toHaveValue('age');
  });
});
