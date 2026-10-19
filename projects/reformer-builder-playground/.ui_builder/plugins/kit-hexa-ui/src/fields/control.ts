/**
 * Собственная идентичность поля кита и статики, которые читает форма.
 *
 * ## Почему статика висит не на самих компонентах HexaUI
 *
 * `Textbox`, `Select`, `Textbox.Password` — объекты ЧУЖОГО модуля. Повесить на них
 * `reformerAdapter` — значит мутировать `@kaspersky/hexa-ui` для всего приложения: каждый, кто
 * импортирует тот же `Textbox` вне формы, получит скрытую статику, а два кита с разными адаптерами
 * к одному компоненту перетирали бы друг друга (побеждает последний импорт). `resolveFieldAdapter`
 * рендерера эту мутацию не заменяет: путь `<FormField control>` из cdk читает ТОЛЬКО статику.
 *
 * Поэтому каждое поле — собственная функция кита: либо {@link fieldControl} (рисует компонент
 * HexaUI с теми же пропсами, без логики), либо обёртка со своей логикой (`./choice`, `./date`, …).
 * Статики вешаются на неё.
 *
 * ## Тип пропсов поля — точный
 *
 * Генератор каталога берёт пропсы записи из ТИПА экспорта: первый параметр сигнатуры вызова.
 * Поэтому {@link FieldControl} — функция с одним параметром `P`, а не `ComponentType<P>`
 * (объединение класса и функции), и у каждой обёртки свой именованный тип пропсов.
 *
 * @module reformer/kit-hexa-ui/fields/control
 */

import {
  createElement,
  useState,
  type ComponentType,
  type FocusEventHandler,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { FieldAdapter } from '@reformer/core/react';

/** Раскладка в `FormField` кита: `inline-label` — контрол сам рисует подпись рядом с собой. */
export type FieldControlLayout = 'inline-label';

/** Статики поля, которые читают обёртка поля (`reformerAdapter`) и `FormField` кита (`reformerLayout`). */
export interface FieldControlStatics {
  reformerAdapter?: FieldAdapter;
  reformerLayout?: FieldControlLayout;
}

/** Поле кита: функция одного параметра — пропсов — со статиками формы. */
export type FieldControl<P> = {
  (props: P): ReactElement;
  displayName?: string;
} & FieldControlStatics;

/**
 * Собственная идентичность кита для компонента HexaUI: рендерит его с теми же пропсами (без
 * логики) и несёт статики формы. Нужна ровно затем, чтобы не мутировать чужой модуль (см. шапку).
 */
export function fieldControl<P extends object>(
  component: ComponentType<P>,
  displayName: string,
  statics: FieldControlStatics
): FieldControl<P> {
  const Control = (props: P): ReactElement => createElement(component, props);
  Control.displayName = displayName;
  return Object.assign(Control, statics);
}

/**
 * Уход фокуса из контрола, у которого нет своего `onBlur` (группы кнопок, загрузка файлов,
 * расписание, пара полей времени). Без него поле не становится `touched`, и ошибка появилась бы
 * только после отправки. Обёртка — `display: contents`: в раскладке её нет, а `focusout` от
 * вложенных кнопок и полей до неё всплывает.
 */
export function BlurScope({
  onBlur,
  children,
}: {
  onBlur: FocusEventHandler | undefined;
  children?: ReactNode;
}): ReactElement {
  return createElement('div', { style: { display: 'contents' }, onBlur }, children);
}

/**
 * Черновик значения, которое контрол собирает по частям (период дат, интервал времени).
 *
 * Модель видит только полное значение: неполный период — `null` (так `required()` его и ловит).
 * Но верни обёртка контролу `null` в ответ на первую выбранную дату — контрол бы её забыл, и
 * выбрать период стало бы нельзя. Поэтому контрол показывает черновик, а модель получает
 * свёрнутое значение.
 *
 * Черновик сбрасывается, когда значение поля меняется СНАРУЖИ (сброс формы, загрузка, запись
 * поведения): значение сравнивается с последним, которое отдала сама обёртка, — по `same`, а не по
 * ссылке. Модель возвращает не то же самое: адаптер копирует кортеж, а поле-кортеж хранит `null`
 * как `[]`. Поэтому `update` обязан получать ровно то, что уйдёт в `onChange`.
 */
export function useDraft<V, D>(
  value: V,
  toDraft: (value: V) => D,
  same: (a: V, b: V) => boolean
): [draft: D, update: (draft: D, emitted: V) => void] {
  const [state, setState] = useState(() => ({ source: value, draft: toDraft(value) }));
  let current = state;
  if (!same(state.source, value)) {
    // Значение пришло снаружи: черновик — из него. Обновление состояния во время отрисовки —
    // штатный приём React для производного состояния; условие не даёт ему зациклиться.
    current = { source: value, draft: toDraft(value) };
    setState(current);
  }
  const update = (draft: D, emitted: V): void => setState({ source: emitted, draft });
  return [current.draft, update];
}

/**
 * Ключ пересоздания неуправляемого контрола (расписание, редакторы): HexaUI читает начальное
 * значение один раз, и показать значение, пришедшее СНАРУЖИ (сброс формы, загрузка данных), можно
 * только новым экземпляром.
 *
 * Своя правка пересоздания не вызывает: обёртка отмечает отданное значение (`emitted`), а отклик
 * модели сравнивается с ним по `same` — по содержимому, потому что адаптер отдаёт модели копию.
 */
export function useRemountKey<V>(
  value: V,
  same: (a: V, b: V) => boolean
): [key: number, emitted: (value: V) => void] {
  const [state, setState] = useState({ source: value, key: 0 });
  let current = state;
  if (!same(state.source, value)) {
    current = { source: value, key: state.key + 1 };
    setState(current);
  }
  const emitted = (next: V): void => setState((prev) => ({ source: next, key: prev.key }));
  return [current.key, emitted];
}
