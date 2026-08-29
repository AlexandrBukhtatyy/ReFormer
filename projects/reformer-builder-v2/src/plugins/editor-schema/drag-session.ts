/**
 * Что сейчас тащат — общее знание палитры и канваса на время одного перетаскивания.
 *
 * ## Зачем отдельное место, если есть `dataTransfer`
 *
 * Затем, что во время `dragover` содержимое `dataTransfer` **не читается**: спецификация
 * держит его в защищённом режиме, и `getData` отдаёт пустую строку всем, кроме обработчика
 * `drop`. Доступен только список ТИПОВ. А решение «можно ли сюда бросить и куда именно»
 * канвас обязан принимать именно на `dragover` — иначе подсветки не будет вовсе, и человек
 * узнает результат только отпустив кнопку.
 *
 * Поэтому типов ровно два, и у них разные роли:
 *
 * - {@link DRAG_MIME} едет в `dataTransfer` и служит **признаком** «это наш груз» — по нему
 *   канвас отличает перетаскивание из палитры от файла, брошенного из проводника;
 * - сам груз лежит здесь, в памяти сеанса, и читается синхронно.
 *
 * ## Почему реестр, а не проп
 *
 * Строение оболочки: тело редактора получает `documentId`, панели — только `panelId`. Палитра
 * и канвас не могут передать друг другу ничего напрямую; общий адрес у них ровно один — плагин,
 * который их внёс. То же рассуждение, что и у реестра сеансов ({@link './sessions'}).
 *
 * ## Почему без подписки
 *
 * Груз читают ОБРАБОТЧИКИ событий (`dragover`, `drop`), а они и так вызываются браузером на
 * каждое движение. Перерисовывать по нему панели незачем: то, что меняется на экране во время
 * перетаскивания, — подсветка строки, и она живёт в состоянии канваса.
 *
 * @module plugins/editor-schema/drag-session
 */

import type { DragPayload } from './drag';

/**
 * Тип груза в `dataTransfer`.
 *
 * Своё имя, а не `text/plain`: по `text/plain` канвас принимал бы выделенный текст из любого
 * окна, а `application/json` пришёл бы вместе с файлом схемы из проводника. Признак обязан
 * означать «этот груз собрали мы», иначе он не признак.
 */
export const DRAG_MIME = 'application/x-reformer-schema-node';

/** Держатель груза на время одного перетаскивания. */
export interface DragSession {
  begin(payload: DragPayload): void;
  /** Груз текущего перетаскивания или `null`, если тащат не наше (или уже ничего). */
  payload(): DragPayload | null;
  end(): void;
}

export function createDragSession(): DragSession {
  let current: DragPayload | null = null;
  return {
    begin(payload) {
      current = payload;
    },
    payload: () => current,
    end() {
      current = null;
    },
  };
}

/** Несёт ли событие наш груз. Читается на `dragover`, где доступны только типы. */
export function carriesSchemaNode(types: readonly string[] | DOMStringList | undefined): boolean {
  if (types === undefined) return false;
  const list = Array.isArray(types) ? types : Array.from(types as ArrayLike<string>);
  return list.includes(DRAG_MIME);
}
