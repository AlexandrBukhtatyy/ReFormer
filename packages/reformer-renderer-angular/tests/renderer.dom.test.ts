/**
 * То, чего не видит общий контрактный набор: устройство рендерера на Angular.
 *
 * Узел схемы в разметке — комментарий-якорь, а не элемент. Переставляя представление с таким
 * корнем, Angular заново расставляет все вложенные представления рядом с их якорями. Поэтому дети,
 * которые стоят внутри тега или компонента, и контрол внутри оболочки поля живут отдельными
 * представлениями. Тесты закрепляют следствия: при перестановке строки массива никто не покидает
 * своего родителя, а отдельные представления снимаются вместе с узлом.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  type OnDestroy,
} from '@angular/core';
import { arrayOf, createForm, createModel } from '@reformer/core';
import type { FormBundle, FormControl, FormModel, FormSchemaNode } from '@reformer/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormRenderer, ReformerArrayItem, type ArrayItemSlot } from '../src/public-api';
import { all, get, mount, unmountAll } from './mount';

afterEach(() => {
  unmountAll();
  vi.restoreAllMocks();
  destroyed.length = 0;
});

// ---------------------------------------------------------------------------
// Компоненты
// ---------------------------------------------------------------------------

/** Подписи снятых контролов — по порядку снятия. */
const destroyed: string[] = [];

/** Текстовый контрол диалекта `[(value)]`; хост — сам `<input>`. */
@Component({
  selector: 'input[testInput]',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[value]': 'text()',
    '[disabled]': 'disabled()',
    '[attr.data-caption]': 'caption()',
    '(input)': 'emit($event)',
  },
})
class TestInput implements OnDestroy {
  readonly value = input<unknown>();
  readonly disabled = input(false);
  readonly caption = input<string>();
  readonly valueChange = output<string>();
  protected readonly text = computed(() => String(this.value() ?? ''));

  protected emit(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }

  ngOnDestroy(): void {
    destroyed.push(this.caption() ?? '');
  }
}

/** Контейнер: дети — содержимым. */
@Component({
  selector: 'section[testSection]',
  template: '<ng-content />',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-title]': 'title()' },
})
class TestSection {
  readonly title = input<string>();
}

/** Контейнер, в шаблоне которого содержимому нет места. */
@Component({
  selector: 'aside[testSealed]',
  template: '<b>закрыто</b>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestSealed {}

/** Обёртка поля: контрол — содержимым. */
@Component({
  selector: 'label[testWrapper]',
  template: '<ng-content />',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-field]': 'testId()' },
})
class TestWrapper {
  readonly control = input.required<FormControl<unknown>>();
  readonly testId = input<string>();
}

/** Обёртка поля, в шаблоне которой контролу нет места. */
@Component({
  selector: 'label[testSealedWrapper]',
  template: '<i>подпись</i>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestSealedWrapper {
  readonly control = input.required<FormControl<unknown>>();
}

/** Компонент массива без элемента вокруг строки: строки стоят прямо в его хосте. */
@Component({
  selector: 'div[testBareList]',
  imports: [ReformerArrayItem],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (item of items(); track item.key) {
      <ng-container [reformerArrayItem]="item" />
    }
  `,
})
class TestBareList {
  readonly items = input<readonly ArrayItemSlot[]>([]);
}

// ---------------------------------------------------------------------------
// Форма-образец
// ---------------------------------------------------------------------------

interface Row {
  name: string;
  note: string;
}

interface Shape {
  rows: Row[];
}

const blankRow = (): Row => ({ name: '', note: '' });

/** Сборки теста: снимаются после него. */
const created: Array<FormBundle<Shape>> = [];
afterEach(() => {
  for (const bundle of created.splice(0)) bundle.dispose();
});

/** Форма из массива двух строк: «первый» с заметкой «а» и «второй» с заметкой «б». */
function rowsForm(schema: (model: FormModel<Shape>) => FormSchemaNode): FormBundle<Shape> {
  const model = createModel<Shape>({
    rows: arrayOf(blankRow, [
      { name: 'первый', note: 'а' },
      { name: 'второй', note: 'б' },
    ]),
  });
  const bundle = createForm<Shape>({ model, schema });
  created.push(bundle);
  return bundle;
}

/** Строка-секция: имя, абзац с текстом заметки и вложенная секция с полем заметки. */
const sectionRow = (model: FormModel<Row>): FormSchemaNode => ({
  component: TestSection,
  componentProps: { title: 'строка' },
  children: [
    { model: model.$.name, component: TestInput, componentProps: { caption: 'Имя' } },
    { component: 'p', children: ['заметка: ', model.$.note] },
    {
      component: TestSection,
      componentProps: { title: 'вложенная' },
      children: [
        { model: model.$.note, component: TestInput, componentProps: { caption: 'Заметка' } },
      ],
    },
  ],
});

/** Строка без корневого элемента: поле и абзац стоят прямо на месте строки. */
const bareRow = (model: FormModel<Row>): FormSchemaNode => ({
  children: [
    { model: model.$.name, component: TestInput, componentProps: { caption: 'Имя' } },
    { component: 'p', children: ['заметка: ', model.$.note] },
  ],
});

/**
 * Разметка элемента без комментариев-якорей: теги с вложенностью, у абзаца — его текст. По ней
 * видно, кто в ком стоит.
 */
function outline(element: Element): string {
  const tag = element.tagName.toLowerCase();
  if (tag === 'p') return `p(${element.textContent})`;
  const children = [...element.children].map(outline);
  return children.length > 0 ? `${tag}[${children.join(' ')}]` : tag;
}

/** Разметка детей элемента. */
const outlines = (element: Element): string[] => [...element.children].map(outline);

/** Разметка строки-секции с заметкой `note`; `shell` — тег оболочки поля. */
const sectionOutline = (note: string, shell = 'div'): string =>
  `section[${shell}[input] p(заметка: ${note}) section[${shell}[input]]]`;

/** Имена строк, как они стоят на экране. */
const shownNames = (root: ParentNode): string[] =>
  all<HTMLInputElement>(root, '[data-caption="Имя"]').map((element) => element.value);

/** Ввести текст в поле. */
function typeInto(element: HTMLInputElement, text: string): void {
  element.value = text;
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

// ---------------------------------------------------------------------------
// Сценарии
// ---------------------------------------------------------------------------

describe('перестановка строк без элемента-обёртки', () => {
  it('массив без компонента: строка-секция переезжает целиком, дети остаются в ней', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bundle = rowsForm((shape) => ({ model: shape.$.rows, item: sectionRow }));
    const { root, settle } = await mount(FormRenderer, [], { form: bundle });

    const first = get<HTMLInputElement>(root, '[data-testid="input-rows-0-name"]');
    const section = first.closest('section');
    expect(outlines(root)).toEqual([sectionOutline('а'), sectionOutline('б')]);

    bundle.form.rows.move(0, 1);
    await settle();

    expect(outlines(root)).toEqual([sectionOutline('б'), sectionOutline('а')]);
    expect(shownNames(root)).toEqual(['второй', 'первый']);
    // Тот же элемент в той же секции: строку не пересоздали, а передвинули.
    const moved = get<HTMLInputElement>(root, '[data-testid="input-rows-1-name"]');
    expect(moved).toBe(first);
    expect(moved.closest('section')).toBe(section);
  });

  it('массив без компонента: у строки без корня поле остаётся в оболочке, текст — в абзаце', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bundle = rowsForm((shape) => ({ model: shape.$.rows, item: bareRow }));
    const { root, settle } = await mount(FormRenderer, [], { form: bundle });

    const first = get<HTMLInputElement>(root, '[data-testid="input-rows-0-name"]');
    const shell = first.parentElement;
    expect(outlines(root)).toEqual(['div[input]', 'p(заметка: а)', 'div[input]', 'p(заметка: б)']);

    bundle.form.rows.move(0, 1);
    await settle();

    expect(outlines(root)).toEqual(['div[input]', 'p(заметка: б)', 'div[input]', 'p(заметка: а)']);
    expect(shownNames(root)).toEqual(['второй', 'первый']);
    const moved = get<HTMLInputElement>(root, '[data-testid="input-rows-1-name"]');
    expect(moved).toBe(first);
    expect(moved.parentElement).toBe(shell);
  });

  it('компонент массива без элемента вокруг строки: контрол остаётся в обёртке поля', async () => {
    const bundle = rowsForm((shape) => ({
      model: shape.$.rows,
      component: TestBareList,
      item: sectionRow,
    }));
    const { root, settle } = await mount(FormRenderer, [], {
      form: bundle,
      settings: { fieldWrapper: TestWrapper },
    });
    const list = get(root, 'div[testBareList]');

    const first = get<HTMLInputElement>(root, '[data-testid="input-rows-0-name"]');
    const wrapper = first.parentElement;
    expect(wrapper?.getAttribute('data-field')).toBe('rows-0-name');
    expect(outlines(list)).toEqual([sectionOutline('а', 'label'), sectionOutline('б', 'label')]);

    bundle.form.rows.move(0, 1);
    await settle();

    expect(outlines(list)).toEqual([sectionOutline('б', 'label'), sectionOutline('а', 'label')]);
    const moved = get<HTMLInputElement>(root, '[data-testid="input-rows-1-name"]');
    expect(moved).toBe(first);
    expect(moved.parentElement).toBe(wrapper);
    // Обёртка получила новый путь поля: строка сменила индекс.
    expect(wrapper?.getAttribute('data-field')).toBe('rows-1-name');
  });

  it('после перестановки строка жива: ввод доходит до модели, текст следует за значением', async () => {
    const bundle = rowsForm((shape) => ({
      model: shape.$.rows,
      component: TestBareList,
      item: sectionRow,
    }));
    const { root, settle } = await mount(FormRenderer, [], { form: bundle });

    bundle.form.rows.move(0, 1);
    await settle();

    typeInto(get<HTMLInputElement>(root, '[data-testid="input-rows-1-note"]'), 'новая');
    await settle();

    expect(bundle.model.get().rows).toEqual([
      { name: 'второй', note: 'б' },
      { name: 'первый', note: 'новая' },
    ]);
    const list = get(root, 'div[testBareList]');
    expect(outlines(list)).toEqual([sectionOutline('б'), sectionOutline('новая')]);
  });
});

describe('отдельные представления детей и контрола', () => {
  it('удаление строки снимает её контролы, снятие формы — остальные', async () => {
    const bundle = rowsForm((shape) => ({
      model: shape.$.rows,
      component: TestBareList,
      item: sectionRow,
    }));
    const { root, settle, unmount } = await mount(FormRenderer, [], { form: bundle });

    bundle.form.rows.removeAt(0);
    await settle();

    expect([...destroyed].sort()).toEqual(['Заметка', 'Имя']);
    expect(shownNames(root)).toEqual(['второй']);
    expect(all(root, 'input')).toHaveLength(2);

    unmount();
    expect([...destroyed].sort()).toEqual(['Заметка', 'Заметка', 'Имя', 'Имя']);
  });

  it('скрытие узла снимает контролы внутри него, показ рисует их заново', async () => {
    const bundle = rowsForm((shape) => ({
      selector: 'box',
      component: TestSection,
      children: [{ model: shape.$.rows, component: TestBareList, item: sectionRow }],
    }));
    const { root, settle } = await mount(FormRenderer, [], { form: bundle });
    const scope = bundle.render.controller.scopeOf(bundle.model);
    expect(all(root, 'input')).toHaveLength(4);

    scope.node('box').setHidden(true);
    await settle();
    expect(all(root, 'input')).toHaveLength(0);
    expect(destroyed).toHaveLength(4);

    scope.node('box').setHidden(false);
    await settle();
    expect(shownNames(root)).toEqual(['первый', 'второй']);
  });
});

describe('компонент без места для содержимого', () => {
  interface Single {
    name: string;
  }

  it('контейнер без `<ng-content />`: дети не рисуются, предупреждение одно на компонент', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bundle = createForm<Single>({
      initial: { name: 'Анна' },
      schema: (model) => ({
        children: [
          {
            component: TestSealed,
            children: [{ model: model.$.name, component: TestInput }],
          },
          { component: TestSealed, children: ['текст'] },
        ],
      }),
    });
    const { root, unmount } = await mount(FormRenderer, [], { form: bundle });

    expect(outlines(root)).toEqual(['aside[b]', 'aside[b]']);
    expect(all(document.body, 'input')).toHaveLength(0);
    const messages = warn.mock.calls.map((call) => String(call[0]));
    expect(messages.filter((text) => /TestSealed.*не вывел содержимое/.test(text))).toHaveLength(1);

    unmount();
    bundle.dispose();
  });

  it('обёртка поля без `<ng-content />`: контрол не рисуется, форма предупреждает', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bundle = createForm<Single>({
      initial: { name: 'Анна' },
      schema: (model) => ({ children: [{ model: model.$.name, component: TestInput }] }),
    });
    const { root, settle, unmount } = await mount(FormRenderer, [], {
      form: bundle,
      settings: { fieldWrapper: TestSealedWrapper },
    });

    expect(outlines(root)).toEqual(['label[i]']);
    expect(all(document.body, 'input')).toHaveLength(0);
    expect(warn.mock.calls.map((call) => String(call[0]))).toEqual([
      expect.stringMatching(/TestSealedWrapper.*не вывела содержимое/),
    ]);

    // Поле без места в разметке остаётся привязанным к ноде: смена значения ничего не ломает.
    bundle.form.name.setValue('Вера');
    await settle();

    unmount();
    expect(destroyed).toEqual(['']);
    bundle.dispose();
  });
});

describe('входы `FormRenderer`', () => {
  interface Single {
    name: string;
  }

  const single = (name: string): FormBundle<Single> =>
    createForm<Single>({
      initial: { name },
      schema: (model) => ({
        component: TestSection,
        children: [
          { model: model.$.name, component: TestInput, componentProps: { caption: name } },
        ],
      }),
    });

  it('смена сборки рисует форму заново и снимает прежнюю', async () => {
    const before = single('Анна');
    const after = single('Борис');
    const { root, ref, settle } = await mount(FormRenderer, [], { form: before });
    expect(get<HTMLInputElement>(root, 'input').value).toBe('Анна');

    ref.setInput('form', after);
    await settle();

    expect(outlines(root)).toEqual(['section[div[input]]']);
    expect(get<HTMLInputElement>(root, 'input').value).toBe('Борис');
    expect(destroyed).toEqual(['Анна']);

    // Прежняя сборка с экраном больше не связана.
    before.form.name.setValue('Вера');
    await settle();
    expect(get<HTMLInputElement>(root, 'input').value).toBe('Борис');

    before.dispose();
    after.dispose();
  });

  it('смена настроек меняет обёртку поля, значение поля остаётся', async () => {
    const bundle = single('Анна');
    const { root, ref, settle } = await mount(FormRenderer, [], { form: bundle });
    expect(outlines(root)).toEqual(['section[div[input]]']);

    typeInto(get<HTMLInputElement>(root, 'input'), 'Вера');
    ref.setInput('settings', { fieldWrapper: TestWrapper });
    await settle();

    expect(outlines(root)).toEqual(['section[label[input]]']);
    expect(get<HTMLInputElement>(root, 'input').value).toBe('Вера');
    expect(get(root, 'label').getAttribute('data-field')).toBe('name');

    bundle.dispose();
  });
});
