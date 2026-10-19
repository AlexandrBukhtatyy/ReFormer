/**
 * Контейнер всплывающих окон кита — внутри рамки кита, а не в `document.body`.
 *
 * Стили дизайн-системы в билдере изолированы (`scoped`): они действуют только под атрибутом
 * `[data-rb-plugin="kit-hexa-ui"]`, который вешает рамка кита. Выпадающий список или календарь,
 * отрисованные в `document.body`, оказались бы вне этой рамки — без стилей. Поэтому провайдер кита
 * ставит в конце своего поддерева пустой узел, а обёртки полей отдают его всплывающим окнам пропом
 * `getPopupContainer` ({@link useKitPopupContainer}): списки (`Select`), дерево (`TreeSelect`),
 * календари (`Calendar`, `RangePicker`). Явный `getPopupContainer` из схемы главнее.
 *
 * ## Почему не `PopupConfigProvider` HexaUI
 *
 * Его отдаёт только ГЛАВНЫЙ вход `@kaspersky/hexa-ui`, а главного входа в графе пространства имён
 * билдера быть не должно: esbuild тогда считает достижимыми из пространства имён и редакторы, и
 * календари, которые кит грузит лениво, и кладёт их в общий чанк, грузящийся сразу (подробно — в
 * `./palette`). Компоненты HexaUI, которые этот провайдер читают, по умолчанию и так открывают окна
 * в родителе поля — внутри рамки (`Select`, `Dropdown`, подписи `Field`/`Checkbox`/`Radio`); мимо
 * рамки уходят только подсказки самостоятельного `Tooltip`. Приложению провайдер доступен во входе
 * пакета (`PopupConfigProvider`).
 *
 * Вне провайдера кита хук отдаёт `undefined`, и окна живут там, где их кладёт HexaUI по умолчанию.
 *
 * @module reformer/kit-hexa-ui/popup-container
 */

import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react';

/** Где рисовать всплывающее окно: по узлу, который его открыл. */
export type PopupContainerGetter = (trigger: HTMLElement) => HTMLElement;

const PopupContainerContext = createContext<PopupContainerGetter | undefined>(undefined);

/** Контейнер всплывающих окон кита; `undefined` — вне провайдера кита. */
export function useKitPopupContainer(): PopupContainerGetter | undefined {
  return useContext(PopupContainerContext);
}

/**
 * Поддерево, всплывающие окна которого рисуются в его же конце. Функция-геттер стабильна: от неё
 * зависят пропсы всплывающих окон, и пересоздавать её на каждую отрисовку незачем — узел она
 * читает из ссылки в момент открытия окна.
 */
export function KitPopupScope({ children }: { children?: ReactNode }) {
  const root = useRef<HTMLDivElement | null>(null);
  const getPopupContainer = useCallback<PopupContainerGetter>(
    (trigger) => root.current ?? trigger.ownerDocument.body,
    []
  );
  return (
    <PopupContainerContext.Provider value={getPopupContainer}>
      {children}
      <div data-hexa-popup-root="" ref={root} />
    </PopupContainerContext.Provider>
  );
}
