/**
 * Адаптер рендерера для контрактного набора: чем рендерер рисует сборку и из каких компонентов.
 *
 * Сценарии набора о фреймворке не знают. Они собирают форму `createForm`, просят адаптер её
 * смонтировать и смотрят в DOM. Всё, что у React, Vue и Angular разное, — в адаптере: монтирование
 * и кит компонентов-зондов.
 *
 * @module renderer-contract/adapter
 */

import type { FormBundle } from '@reformer/core';
import type { FormLocale } from '@reformer/core/i18n';

/**
 * Ссылка на компонент кита: то, что рендерер умеет нарисовать. Сценарии кладут её в `component`
 * узла схемы и не интерпретируют.
 */
export type KitComponent = object;

/**
 * Кит компонентов-зондов. Разметка у трёх стеков одна: сценарии находят элементы по атрибутам и
 * читают из них пропсы, которые компонент получил от рендерера.
 *
 * Общие правила разметки:
 *
 * - атрибут `data-*` ставится, только когда компонент получил соответствующий проп: по
 *   отсутствию атрибута сценарий видит, что проп до компонента не дошёл;
 * - `data-testid`, который рендерер передал контролу, стоит на нативном элементе контрола;
 * - кнопки — `<button type="button">` с атрибутом `data-action`.
 */
export interface ContractKit {
  /**
   * Текстовый контрол в диалекте стека по умолчанию (React — `value` / `onChange`, Vue —
   * `modelValue` / `update:modelValue`), статики `reformerAdapter` у него нет.
   *
   * `<input>`: значение — `String(value ?? '')`, свойство `disabled`; атрибуты `data-caption`
   * (проп `caption`), `placeholder`, `data-options` (длина массива `options`), `data-label`,
   * `data-description`, `data-required` (пропсы `label`, `description`, `required`). Ввод пишет
   * строку в поле, потеря фокуса сообщает о ней.
   */
  Input: KitComponent;
  /** Тот же контрол со статикой `reformerLayout = 'inline-label'`: подпись рисует сам. */
  InlineInput: KitComponent;
  /**
   * Переключатель со статикой `reformerAdapter = { valueProp: 'checked', changeProp: 'onToggle' }`.
   *
   * `<button>`: атрибуты `data-checked` (`"true"` / `"false"`) и `data-caption`, свойство
   * `disabled`. Клик сообщает обратное значение.
   */
  Toggle: KitComponent;
  /**
   * Контрол со статикой `reformerAdapter = { passControl: true }`: значение — `value` /
   * `onChange`, нода поля — проп `control`.
   *
   * `<input>`: значение как у {@link ContractKit.Input}, атрибут `data-path` — путь ноды
   * (`control.path`).
   */
  ControlInput: KitComponent;
  /**
   * Контейнер с детьми.
   *
   * `<section>`: атрибуты `data-title` (проп `title`), `data-tone` (`tone`), `data-items` (массив
   * `items` через `+`), `data-selector` (`selector`), класс из `className`. Получив `onSubmit`,
   * рисует первой кнопку `data-action="submit"`: клик вызывает `onSubmit('payload')`. Дальше —
   * дети.
   */
  Section: KitComponent;
  /**
   * Компонент массива: получает `items`, `onAdd`, `onRemove`, `onMove` и пропсы узла.
   *
   * `<div data-list>` с атрибутами `data-title` и `data-add-label` (пропсы `title`, `addLabel`).
   * Внутри — `<ul>`, строка — `<li data-index="индекс элемента">`: поддерево строки и кнопки
   * `data-action="remove"`, `"up"` (`onMove(index, index - 1)`) и `"down"`
   * (`onMove(index, index + 1)`). После списка — кнопка `data-action="add"`.
   */
  List: KitComponent;
  /**
   * Компонент, который ведёт детей сам: статика `__selfManagedChildren = true`, пропсы `children`
   * (узлы скомпилированной схемы) и `renderNode`.
   *
   * `<ol data-count="число узлов">`, на узел — `<li>` с атрибутами `data-step` (селектор узла),
   * `data-kind` (вид узла) и `data-title` (`props.title` узла); внутри — `renderNode(узел)`.
   */
  Steps: KitComponent;
  /**
   * Обёртка поля: получает ноду поля (`control`), `testId` и класс.
   *
   * `<div data-wrap="field">` с атрибутами `data-testid="field-{testId}"` и `data-issues` — числом
   * замечаний ноды; число следует за нодой. Класс — из пропа класса. Внутри — контрол.
   */
  FieldWrapper: KitComponent;
  /** Вторая обёртка поля, чтобы отличить одну от другой: `<div data-wrap="plain">`. */
  PlainWrapper: KitComponent;
  /**
   * Компонент узла, который читает сборку из контекста рендерера.
   *
   * `<b data-testid="bundle-probe">` с текстом `форма:{значение поля kind}`; вне сборки —
   * `нет сборки`.
   */
  BundleProbe: KitComponent;
}

/** Настройки одного монтирования. */
export interface MountOptions {
  /** Обёртка поля в настройках рендерера (`settings.fieldWrapper`). */
  fieldWrapper?: KitComponent;
  /** Локаль поддерева: по ней раскрываются описатели `msg()` в пропсах узлов. */
  locale?: FormLocale;
}

/** Смонтированная форма. */
export interface Mounted {
  /** Элемент, внутри которого отрисована форма. Стоит в документе. */
  root: HTMLElement;
  /** Дождаться перерисовки после записи в сигнал или события. */
  settle(): Promise<void>;
  /** Снять форму и убрать `root` из документа. Хуки снятия к возврату исполнены. */
  unmount(): void | Promise<void>;
}

/**
 * Адаптер рендерера.
 *
 * @example
 * ```ts
 * import { describeRendererContract } from 'renderer-contract';
 *
 * describeRendererContract({
 *   name: 'renderer-vue',
 *   kit,
 *   mount(bundle, options) {
 *     // смонтировать `FormRenderer` со сборкой и вернуть { root, settle, unmount }
 *   },
 * });
 * ```
 */
export interface ContractAdapter {
  /** Имя рендерера — для заголовка набора. */
  name: string;
  kit: ContractKit;
  /**
   * Смонтировать сборку рендерером стека. К возврату первая отрисовка завершена и хуки
   * монтирования исполнены. Ошибка рендера — исключением (или отказом промиса).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mount(bundle: FormBundle<any>, options?: MountOptions): Mounted | Promise<Mounted>;
}
