/**
 * Тело вкладки и панель свойств формы RJSF — рядом, как в оболочке: структура или форма
 * во вкладке, свойства выбранного поля или формы целиком в панели.
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
import type { CatalogJson, KitsService } from '@reformer/builder-plugin-api';
import { RJSF_EDITOR_MESSAGES } from '../messages';
import {
  createFakeKits,
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

function mount(options: { live?: FakeLive; remembered?: RjsfView; kits?: KitsService } = {}) {
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
        <RjsfInspector
          services={workspace.services}
          kits={() => options.kits}
          useTranslate={useT}
        />
      </aside>
    </div>
  );

  return { first, second, live, workspace, view, mounted };
}

const structure = (): Element | null => document.querySelector('[data-testid="rjsf-structure"]');
const surface = (): Element | null => document.querySelector('[data-testid="fake-surface"]');

describe('вид вкладки: структура или форма', () => {
  it('по умолчанию — структура: форма не смонтирована, в панели свойства формы', async () => {
    const { live } = mount();

    await expect.element(page.getByTestId('rjsf-structure')).toBeVisible();
    await expect.element(page.getByTestId('rjsf-row-name')).toBeVisible();
    // Поле не выбрано — выбрана форма: пустой панель не бывает.
    await expect.element(page.getByTestId('rjsf-form-inspector')).toBeVisible();
    expect(document.querySelector('[data-testid="rjsf-inspector"]')).toBeNull();
    expect(live.mounts()).toBe(0);
  });

  it('во вкладке только структура: заголовок и экспорт — в панели, новое поле — под списком', async () => {
    mount();
    await expect.element(page.getByTestId('rjsf-structure')).toBeVisible();

    const body = structure()!;
    const panel = document.querySelector('[data-testid="rjsf-form-inspector"]')!;
    expect(body.querySelector('[data-testid="rjsf-title"]')).toBeNull();
    expect(body.querySelector('[data-testid="rjsf-export"]')).toBeNull();
    expect(panel.querySelector('[data-testid="rjsf-title"]')).not.toBeNull();
    expect(panel.querySelector('[data-testid="rjsf-export"]')).not.toBeNull();

    // Кнопка — последней в структуре; и она, и строка формы — во всю ширину вкладки без полей.
    const add = body.querySelector<HTMLElement>('[data-testid="rjsf-add-field"]')!;
    const row = body.querySelector<HTMLElement>('[data-testid="rjsf-row-form"]')!;
    const style = getComputedStyle(body);
    const inner = body.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    expect(body.lastElementChild).toBe(add);
    expect(add.getBoundingClientRect().width).toBeCloseTo(inner, 0);
    expect(row.getBoundingClientRect().width).toBeCloseTo(inner, 0);
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
    await expect.element(page.getByTestId('rjsf-form-inspector')).toBeVisible();

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
    await expect.element(page.getByTestId('rjsf-form-inspector')).toBeVisible();

    second.handle.setSelection(['channel']);
    await expect.element(page.getByTestId('rjsf-field-name')).toHaveValue('channel');

    // Вкладок нет вовсе — показывать нечего.
    workspace.setActive(null);
    await expect.element(page.getByTestId('rjsf-inspector-empty')).toBeVisible();

    workspace.setActive(first.id);
    await expect.element(page.getByTestId('rjsf-field-name')).toHaveValue('age');
  });
});

/** Записи кита в форме настоящего каталога: свойства контрола — в `propsSchema`. */
const KIT_RECORDS = [
  {
    name: 'Input',
    role: 'field',
    propsSchema: {
      properties: {
        label: { type: 'string', 'x-doc': { group: 'Textfield', type: 'string' } },
        tooltip: { type: 'string', 'x-doc': { group: 'Textfield', type: 'string' } },
      },
    },
  },
  {
    name: 'InputMask',
    role: 'field',
    propsSchema: {
      properties: {
        mask: {
          type: 'string',
          description: 'Шаблон маски: 9 — цифра.',
          'x-doc': { group: 'Textfield', type: 'string' },
        },
        tooltip: { type: 'string', 'x-doc': { group: 'Textfield', type: 'string' } },
        readOnly: { type: 'boolean', 'x-doc': { group: 'State', type: 'boolean' } },
      },
    },
  },
] as unknown as CatalogJson['components'];

describe('свойства контрола — из каталога кита', () => {
  const options = (): Element | null => document.querySelector('[data-testid="rjsf-widget-props"]');
  const nameUi = (form: ReturnType<typeof sampleForm>) => form.uiSchema?.name;

  it('у каждого виджета свои свойства: набор приходит из записи каталога', async () => {
    mount({ kits: createFakeKits(KIT_RECORDS).kits });
    await userEvent.click(page.getByRole('button', { name: /^name/ }));

    // Виджет не выбран — строку рисует Input кита; подпись ведёт схема, её среди свойств нет.
    await expect
      .element(page.getByTestId('rjsf-widget-props'))
      .toHaveTextContent('Свойства компонента Input');
    await expect.element(page.getByTestId('rjsf-option-tooltip')).toBeVisible();
    expect(options()?.querySelector('[data-testid="rjsf-option-label"]')).toBeNull();
    expect(options()?.querySelector('[data-testid="rjsf-option-mask"]')).toBeNull();

    await userEvent.selectOptions(page.getByTestId('rjsf-field-widget'), 'InputMask');

    await expect
      .element(page.getByTestId('rjsf-widget-props'))
      .toHaveTextContent('Свойства компонента InputMask');
    await expect.element(page.getByTestId('rjsf-option-mask')).toBeVisible();
    await expect.element(page.getByTestId('rjsf-option-readOnly')).not.toBeChecked();
  });

  it('правка свойства пишет ui:options поля; стёртое свойство из документа уходит', async () => {
    const { first } = mount({ kits: createFakeKits(KIT_RECORDS).kits });
    await userEvent.click(page.getByRole('button', { name: /^name/ }));
    await userEvent.selectOptions(page.getByTestId('rjsf-field-widget'), 'InputMask');

    await userEvent.fill(page.getByTestId('rjsf-option-mask'), '+7 999');
    await userEvent.click(page.getByTestId('rjsf-option-readOnly'));

    expect(nameUi(first.model())).toEqual({
      'ui:placeholder': 'Как к вам обращаться',
      'ui:widget': 'InputMask',
      'ui:options': { mask: '+7 999', readOnly: true },
    });
    await expect.element(page.getByTestId('rjsf-option-mask')).toHaveValue('+7 999');

    await userEvent.clear(page.getByTestId('rjsf-option-mask'));
    await userEvent.click(page.getByTestId('rjsf-option-readOnly'));

    expect(nameUi(first.model())).toEqual({
      'ui:placeholder': 'Как к вам обращаться',
      'ui:widget': 'InputMask',
    });
  });

  it('смена виджета уносит свойства прежнего контрола, общие с новым — остаются', async () => {
    const { first } = mount({ kits: createFakeKits(KIT_RECORDS).kits });
    await userEvent.click(page.getByRole('button', { name: /^name/ }));
    await userEvent.selectOptions(page.getByTestId('rjsf-field-widget'), 'InputMask');
    await userEvent.fill(page.getByTestId('rjsf-option-mask'), '+7 999');
    await userEvent.fill(page.getByTestId('rjsf-option-tooltip'), 'Телефон');

    await userEvent.selectOptions(page.getByTestId('rjsf-field-widget'), 'Input');

    expect(nameUi(first.model())).toEqual({
      'ui:placeholder': 'Как к вам обращаться',
      'ui:widget': 'Input',
      'ui:options': { tooltip: 'Телефон' },
    });
    await expect.element(page.getByTestId('rjsf-option-tooltip')).toHaveValue('Телефон');
  });

  it('подсказка свойства — значком у подписи: текст в тултипе и в описании контрола', async () => {
    mount({ kits: createFakeKits(KIT_RECORDS).kits });
    await userEvent.click(page.getByRole('button', { name: /^name/ }));
    await userEvent.selectOptions(page.getByTestId('rjsf-field-widget'), 'InputMask');

    const hint = page.getByRole('button', { name: 'Подсказка: Mask' });
    await expect.element(hint).toBeVisible();
    // Строкой под полем описания нет — оно раздвигало бы панель: в разметке только скрытый дубль
    // для описания контрола. У свойства без описания нет и значка.
    await expect.element(page.getByText('Шаблон маски: 9 — цифра.')).not.toBeVisible();
    expect(page.getByRole('button', { name: 'Подсказка: Tooltip' }).elements()).toHaveLength(0);
    await expect
      .element(page.getByTestId('rjsf-option-mask'))
      .toHaveAccessibleDescription('Шаблон маски: 9 — цифра.');

    await userEvent.hover(hint);

    await expect.element(page.getByRole('tooltip')).toHaveTextContent('Шаблон маски: 9 — цифра.');
    // Значок — не часть подписи: щелчок по нему поле не активирует.
    await userEvent.click(hint);
    expect(document.activeElement).not.toBe(page.getByTestId('rjsf-option-mask').element());
  });

  it('подсказка вариантов выбора — тем же значком', async () => {
    mount();
    await userEvent.click(page.getByRole('button', { name: /^channel/ }));

    await expect
      .element(page.getByRole('button', { name: 'Подсказка: Варианты выбора' }))
      .toBeVisible();
    await expect
      .element(page.getByTestId('rjsf-field-enum'))
      .toHaveAccessibleDescription('По одному в строке; пусто — без выбора.');
  });

  it('кита нет — секции нет; каталог доехал — секция появилась без перевыбора поля', async () => {
    const fake = createFakeKits([]);
    mount({ kits: fake.kits });
    await userEvent.click(page.getByRole('button', { name: /^name/ }));
    await expect.element(page.getByTestId('rjsf-field-widget')).toBeVisible();
    expect(options()).toBeNull();

    fake.load(KIT_RECORDS);

    await expect.element(page.getByTestId('rjsf-option-tooltip')).toBeVisible();
  });
});

describe('форма целиком — тоже выбор', () => {
  it('строка формы снимает выделение поля, и панель показывает свойства формы', async () => {
    const { first } = mount();
    const formRow = page.getByTestId('rjsf-row-form');
    // Пока поле не выбрано, выбранной показана сама форма.
    await expect.element(formRow).toHaveAttribute('aria-pressed', 'true');
    await expect.element(formRow).toHaveTextContent('Форма · Контакт');

    await userEvent.click(page.getByRole('button', { name: /^age/ }));
    await expect.element(formRow).toHaveAttribute('aria-pressed', 'false');
    await expect.element(page.getByTestId('rjsf-field-name')).toHaveValue('age');

    await userEvent.click(formRow);

    expect(first.selection()).toEqual([]);
    await expect.element(formRow).toHaveAttribute('aria-pressed', 'true');
    await expect.element(page.getByTestId('rjsf-title')).toHaveValue('Контакт');
    expect(document.querySelector('[data-testid="rjsf-inspector"]')).toBeNull();
  });

  it('заголовок правится в панели: модель, строка формы и одна запись в истории', async () => {
    const { first } = mount();

    await userEvent.fill(page.getByTestId('rjsf-title'), 'Анкета');

    expect(first.model().schema.title).toBe('Анкета');
    await expect.element(page.getByTestId('rjsf-row-form')).toHaveTextContent('Форма · Анкета');

    // Стёртый заголовок из схемы уходит, а строка формы остаётся строкой формы.
    await userEvent.clear(page.getByTestId('rjsf-title'));

    expect(first.model().schema.title).toBeUndefined();
    await expect.element(page.getByTestId('rjsf-row-form')).toHaveTextContent(/^Форма$/);
  });

  it('крошка «Форма» над свойствами поля возвращает к форме — и в виде «форма»', async () => {
    const { first, view } = mount();
    await userEvent.click(page.getByRole('button', { name: /^age/ }));

    // Структуры в этом виде нет: кроме крошки, выйти к свойствам формы нечем.
    view.setView('form');
    await expect.element(page.getByTestId('fake-surface')).toBeVisible();
    await expect.element(page.getByTestId('rjsf-field-name')).toHaveValue('age');

    await userEvent.click(page.getByTestId('rjsf-inspector-form'));

    expect(first.selection()).toEqual([]);
    await expect.element(page.getByTestId('rjsf-title')).toHaveValue('Контакт');
  });

  it('экспорт — кнопкой в свойствах формы: Form.tsx записан, исход назван', async () => {
    const { workspace } = mount();

    await userEvent.click(page.getByTestId('rjsf-export'));

    await expect
      .element(page.getByTestId('rjsf-status'))
      .toHaveTextContent('Form.tsx записан и сохранён.');
    expect(workspace.written.get('mem:Form.tsx')).toContain('ContactForm');
    expect(workspace.saved).toEqual([['mem:Form.tsx']]);
  });
});
