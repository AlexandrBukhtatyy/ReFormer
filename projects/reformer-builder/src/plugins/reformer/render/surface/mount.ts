/**
 * Монтирование React-поддерева в чужой элемент DOM.
 *
 * Контракт поверхности — `mount(host, ctx): Disposable`, то есть императивный: точка расширения
 * открыта, и поверхность вправе не быть React-компонентом вовсе (внешнее превью — это iframe,
 * а каркас мог бы быть и canvas'ом). Три встроенные поверхности React'ом всё-таки являются,
 * поэтому переходник нужен ровно один и живёт здесь.
 *
 * Отдельный корень на поверхность, а не портал в дерево оболочки: у портала общий с оболочкой
 * контекст и общий обработчик ошибок, и падение компонента кита уронило бы приложение целиком.
 * Свой корень делает границу настоящей.
 *
 * @module plugins/reformer/render/surface/mount
 */

import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Disposable } from '@reformer/builder-plugin-api';

/**
 * Рисует узел в элементе и отдаёт освобождение.
 *
 * Поверхность снимают из очистки эффекта того, кто её показывает, а такая очистка бывает и
 * внутри коммита родительского корня (двойной запуск эффектов StrictMode, синхронный сброс при
 * размонтировании). Синхронный `unmount` там React запрещает — «Attempted to synchronously
 * unmount a root while React was already rendering».
 *
 * Поэтому снятие в два хода. Сразу — DOM: элемент поверхности отсоединяется, и следующая
 * поверхность встаёт в тот же `host` на чистое место (у каждого монтирования свой элемент, так
 * что живой корень новой не мешает). Микрозадачей — сам корень: его очистки (в том числе
 * сохранение значений формы) успевают раньше первой отрисовки новой поверхности, потому что
 * та идёт задачей планировщика React, а не микрозадачей. Тот же приём — у поверхности `plain`.
 */
export function mountReact(host: HTMLElement, node: ReactNode): Disposable {
  const element = document.createElement('div');
  element.style.display = 'contents';
  host.append(element);
  const root = createRoot(element);
  root.render(node);
  return {
    dispose(): void {
      element.remove();
      queueMicrotask(() => {
        root.unmount();
      });
    },
  };
}
