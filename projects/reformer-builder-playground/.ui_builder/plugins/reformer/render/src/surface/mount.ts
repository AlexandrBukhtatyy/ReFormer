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
import { PLUGIN_SCOPE_ATTRIBUTE, type Disposable } from '@reformer/builder-plugin-api';
import { PREVIEW_RUNTIME_PLUGIN_ID } from '../contract';

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
 *
 * Элемент поверхности помечен скоупом ЭТОГО плагина. Поверхность показывает чужая панель —
 * оболочка пометила её скоупом своего владельца, и таблица стилей превью (заглушки, уведомления,
 * классы каталога тегов) под таким контейнером не совпала бы ни с чем.
 */
export function mountReact(host: HTMLElement, node: ReactNode): Disposable {
  const element = document.createElement('div');
  element.style.display = 'contents';
  element.setAttribute(PLUGIN_SCOPE_ATTRIBUTE, PREVIEW_RUNTIME_PLUGIN_ID);
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
