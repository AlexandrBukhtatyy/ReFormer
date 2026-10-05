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
import { sampleForm, type RjsfFieldUi } from '../../../core';
import { renderReact } from '../../../../.shared/render';
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
        // Включено китом по умолчанию — и единственный флаг с описанием.
        clearable: {
          type: 'boolean',
          default: true,
          description: 'Крестик сброса значения.',
          'x-doc': { group: 'State', type: 'boolean' },
        },
      },
    },
  },
] as unknown as CatalogJson['components'];

/** Список флагов группы — его триггер; пункты появляются, когда список раскрыт. */
const flags = (group = 'State') => page.getByTestId(`rjsf-flags-${group}`);

/** Раскрывает список флагов группы и отдаёт его пункт по ключу свойства. */
async function openFlags(group = 'State') {
  await userEvent.click(flags(group));
  await expect.element(flags(group)).toHaveAttribute('aria-expanded', 'true');
  return (key: string) => page.getByTestId(`rjsf-flags-${group}-${key}`);
}

describe('свойства контрола — из каталога кита', () => {
  const option = (key: string): Element | null =>
    document.querySelector(`[data-testid="rjsf-option-${key}"]`);
  /**
   * Панель строками «группа: строки» — в том порядке, в каком они стоят на экране. Булевы
   * свойства группы — одна строка `flags`: её пункты живут в раскрытом списке, а не в панели.
   */
  const layout = (): string[] =>
    [...document.querySelectorAll('[data-testid^="rjsf-group-"]')].map((group) => {
      const rows = [
        ...group.querySelectorAll(
          '[data-testid^="rjsf-field-"], [data-testid^="rjsf-option-"], [data-testid^="rjsf-flags-"]'
        ),
      ]
        .map((row) =>
          row
            .getAttribute('data-testid')!
            .replace(/^rjsf-(field|option)-/, '')
            .replace(/^rjsf-flags-.*$/, 'flags')
        )
        .join(' ');
      return `${group.querySelector(':scope > span')?.textContent}: ${rows}`;
    });
  const nameUi = (form: ReturnType<typeof sampleForm>) => form.uiSchema?.name;

  it('у каждого виджета свои свойства: набор приходит из записи каталога', async () => {
    mount({ kits: createFakeKits(KIT_RECORDS).kits });
    await userEvent.click(page.getByRole('button', { name: /^name/ }));

    // Виджет не выбран — строку рисует Input кита, и выбор виджета его называет. Подпись ведёт
    // схема: второго поля для неё среди свойств контрола нет.
    await expect.element(page.getByTestId('rjsf-option-tooltip')).toBeVisible();
    await expect
      .element(page.getByTestId('rjsf-field-widget').getByRole('option', { selected: true }))
      .toHaveTextContent('по умолчанию — Input');
    expect(option('label')).toBeNull();
    expect(option('mask')).toBeNull();

    await userEvent.selectOptions(page.getByTestId('rjsf-field-widget'), 'InputMask');

    await expect.element(page.getByTestId('rjsf-option-mask')).toBeVisible();
    // Булев проп нового контрола встал пунктом в список флагов — выключенным.
    const flag = await openFlags();
    await expect.element(flag('readOnly')).toHaveAttribute('aria-selected', 'false');
  });

  it('один список в общих группах: свойства схемы и контрола рядом, от важного к второстепенному', async () => {
    mount({ kits: createFakeKits(KIT_RECORDS).kits });
    await userEvent.click(page.getByRole('button', { name: /^name/ }));
    await userEvent.selectOptions(page.getByTestId('rjsf-field-widget'), 'InputMask');
    await expect.element(page.getByTestId('rjsf-option-mask')).toBeVisible();

    expect(layout()).toEqual([
      'Основные: name widget',
      'Текст: title tooltip placeholder mask',
      'Значения: type enum',
      'Состояние: flags',
    ]);
    // Отдельного блока «свойства компонента» в панели нет.
    expect(document.querySelector('[data-testid="rjsf-inspector"]')?.textContent).not.toContain(
      'Свойства компонента'
    );
  });

  it('правка свойства пишет ui:options поля; стёртое свойство из документа уходит', async () => {
    const { first } = mount({ kits: createFakeKits(KIT_RECORDS).kits });
    await userEvent.click(page.getByRole('button', { name: /^name/ }));
    await userEvent.selectOptions(page.getByTestId('rjsf-field-widget'), 'InputMask');

    await userEvent.fill(page.getByTestId('rjsf-option-mask'), '+7 999');
    const flag = await openFlags();
    await userEvent.click(flag('readOnly'));

    expect(nameUi(first.model())).toEqual({
      'ui:placeholder': 'Как к вам обращаться',
      'ui:widget': 'InputMask',
      'ui:options': { mask: '+7 999', readOnly: true },
    });
    await expect.element(page.getByTestId('rjsf-option-mask')).toHaveValue('+7 999');

    await userEvent.click(flag('readOnly'));
    await userEvent.clear(page.getByTestId('rjsf-option-mask'));

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

  it('кита нет — в группах одни свойства схемы; каталог доехал — свойства контрола встали в них', async () => {
    const fake = createFakeKits([]);
    mount({ kits: fake.kits });
    await userEvent.click(page.getByRole('button', { name: /^name/ }));
    await expect.element(page.getByTestId('rjsf-field-widget')).toBeVisible();
    expect(layout()).toEqual([
      'Основные: name widget',
      'Текст: title placeholder',
      'Значения: type enum',
      'Состояние: flags',
    ]);

    fake.load(KIT_RECORDS);

    await expect.element(page.getByTestId('rjsf-option-tooltip')).toBeVisible();
    expect(layout()[1]).toBe('Текст: title tooltip placeholder');
  });
});

describe('булевы свойства — списком с мультивыбором', () => {
  /** Выбирает поле `name` и ставит ему виджет кита с булевыми пропсами. */
  async function mountMask() {
    const mounted = mount({ kits: createFakeKits(KIT_RECORDS).kits });
    await userEvent.click(page.getByRole('button', { name: /^name/ }));
    await userEvent.selectOptions(page.getByTestId('rjsf-field-widget'), 'InputMask');
    await expect.element(page.getByTestId('rjsf-option-mask')).toBeVisible();
    return mounted;
  }
  /** Подсказки поля `name`: виджет и свойства контрола в `ui:options`. */
  const nameUi = (form: ReturnType<typeof sampleForm>) =>
    form.uiSchema?.name as RjsfFieldUi | undefined;
  const maskOptions = (form: ReturnType<typeof sampleForm>) => nameUi(form)?.['ui:options'];

  it('флажков и радиокнопок в панели нет: «обязательное» и булевы пропсы — один список', async () => {
    await mountMask();
    const panel = document.querySelector('[data-testid="rjsf-inspector"]')!;

    expect(panel.querySelector('[role="checkbox"], input[type="checkbox"]')).toBeNull();
    expect(panel.querySelector('[role="radio"], input[type="radio"]')).toBeNull();
    // Отдельных строк у булевых свойств нет — они пункты списка, оба слоя вместе.
    expect(document.querySelector('[data-testid="rjsf-field-required"]')).toBeNull();
    expect(document.querySelector('[data-testid="rjsf-option-readOnly"]')).toBeNull();
    const flag = await openFlags();
    await expect.element(flag('required')).toHaveTextContent('Обязательное');
    await expect.element(flag('readOnly')).toHaveTextContent('Read Only');
    await expect.element(flag('clearable')).toHaveTextContent('Clearable');
  });

  it('«Обязательное» — пункт списка: щелчок пишет required схемы, а не ui:options', async () => {
    const { first } = await mountMask();
    // Поле `name` в образце обязательное — и в списке оно стоит выбранным.
    await expect.element(flags()).toHaveTextContent('Обязательное');
    const flag = await openFlags();
    await expect.element(flag('required')).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(flag('required'));

    expect(first.model().schema.required ?? []).not.toContain('name');
    expect(maskOptions(first.model())).toBeUndefined();
    await expect.element(flag('required')).toHaveAttribute('aria-selected', 'false');

    await userEvent.click(flag('required'));

    expect(first.model().schema.required).toEqual(['name']);
  });

  it('пункт пишет одно свойство и одной записью в истории: отмена снимает только его', async () => {
    const { first } = await mountMask();
    const flag = await openFlags();

    await userEvent.click(flag('readOnly'));

    expect(maskOptions(first.model())).toEqual({ readOnly: true });
    // Соседние флаги той же группы не тронуты: обязательность на месте, умолчание не записано.
    expect(first.model().schema.required).toEqual(['name']);

    first.handle.undo();

    expect(maskOptions(first.model())).toBeUndefined();
    expect(nameUi(first.model())?.['ui:widget']).toBe('InputMask');
  });

  it('проп, включённый китом по умолчанию, показан включённым и выключается явно', async () => {
    const { first } = await mountMask();
    // В документе свойства нет, а действует оно — и в списке стоит выбранным.
    expect(maskOptions(first.model())).toBeUndefined();
    await expect.element(flags()).toHaveTextContent('Clearable');
    const flag = await openFlags();
    await expect.element(flag('clearable')).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(flag('clearable'));

    // Убрать свойство мало — вернулось бы умолчание. Выключенное пишется как `false`.
    expect(maskOptions(first.model())).toEqual({ clearable: false });

    await userEvent.click(flag('clearable'));

    expect(maskOptions(first.model())).toBeUndefined();
  });

  it('ничего не включено — список так и говорит', async () => {
    mount();
    await userEvent.click(page.getByRole('button', { name: /^age/ }));

    // Кита нет: в списке один пункт — обязательность, и поле `age` необязательное.
    await expect.element(flags()).toHaveTextContent('ничего не включено');
  });

  it('описания флагов собраны в подсказку списка', async () => {
    await mountMask();

    // У пункта списка своей подсказки нет; флаг без описания в подсказку не попадает.
    await expect
      .element(flags())
      .toHaveAccessibleDescription('Clearable — Крестик сброса значения');
    await expect.element(page.getByRole('button', { name: 'Подсказка: Включено' })).toBeVisible();
  });

  it('группа без описаний значка подсказки не получает', async () => {
    mount();
    await userEvent.click(page.getByRole('button', { name: /^age/ }));
    await expect.element(flags()).toBeVisible();

    expect(page.getByRole('button', { name: 'Подсказка: Включено' }).elements()).toHaveLength(0);
    expect(flags().element().hasAttribute('aria-describedby')).toBe(false);
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
