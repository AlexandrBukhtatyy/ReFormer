/**
 * Присутствие билдера в чужом документе: стили и класс темы — только пока включён режим.
 *
 * ## Почему это вообще нужно
 *
 * Стили билдера глобальные: сброс браузерных умолчаний, токены на корне, правила для `body`.
 * В своей вкладке это его документ. В приложении — чужой: подключённые навсегда, они перекрасили
 * бы страницу приложения, стоило один раз открыть билдер. Поэтому стили живут в документе ровно
 * столько, сколько открыт оверлей: приложение под ним скрыто, а рамки превью — отдельные
 * документы, и туда стили билдера не попадают вовсе.
 *
 * С классом тёмной темы то же самое, плюс одно обстоятельство: приложение может пользоваться
 * тем же классом само. Поэтому при подключении запоминается, что стояло на корне ДО билдера,
 * и при отключении возвращается именно это, а не «светлая тема».
 *
 * ## Служба темы не знает, что её корень — не настоящий
 *
 * Она получает {@link DocumentPresence.themeRoot} и ставит класс как обычно. Корень копит
 * желаемое и применяет его к документу, только пока билдер подключён, — так смена темы
 * в настройках при закрытом оверлее не трогает страницу приложения, а при следующем открытии
 * действует.
 *
 * @module shell/embedded/document-presence
 */

import type { ThemeRoot } from '@/shell/platform/services/theme';

/** Признак элемента со стилями билдера — по нему же его находят тесты. */
export const STYLES_ATTRIBUTE = 'data-reformer-builder-styles';

export interface DocumentPresence {
  /** Корень темы для службы темы оболочки. */
  readonly themeRoot: ThemeRoot;
  /** Подключить стили и классы темы. Повторный вызов безвреден. */
  attach(): void;
  /** Снять стили и вернуть корню документа прежние классы. Повторный вызов безвреден. */
  detach(): void;
}

export interface DocumentPresenceOptions {
  /** Стили билдера одной строкой. */
  readonly styles: string;
  /** Документ приложения. Параметр ради тестов. */
  readonly document?: Document;
}

export function createDocumentPresence(options: DocumentPresenceOptions): DocumentPresence {
  const target = options.document ?? document;
  const root = target.documentElement;

  /** Чего хочет служба темы: класс → должен ли он стоять. */
  const wanted = new Map<string, boolean>();
  /** Что стояло на корне до билдера — по каждому классу, который билдер трогал. */
  const before = new Map<string, boolean>();
  let attached = false;
  let styleElement: HTMLStyleElement | null = null;

  const apply = (token: string, present: boolean): void => {
    if (!before.has(token)) before.set(token, root.classList.contains(token));
    root.classList.toggle(token, present);
  };

  const want = (token: string, present: boolean): void => {
    wanted.set(token, present);
    if (attached) apply(token, present);
  };

  return {
    themeRoot: {
      classList: {
        add: (token) => {
          want(token, true);
        },
        remove: (token) => {
          want(token, false);
        },
      },
    },

    attach() {
      if (attached) return;
      attached = true;
      styleElement = target.createElement('style');
      styleElement.setAttribute(STYLES_ATTRIBUTE, '');
      styleElement.textContent = options.styles;
      // В конец `head`: стили билдера обязаны перекрывать стили приложения, пока он открыт.
      target.head.append(styleElement);
      for (const [token, present] of wanted) apply(token, present);
    },

    detach() {
      if (!attached) return;
      attached = false;
      styleElement?.remove();
      styleElement = null;
      for (const [token, present] of before) root.classList.toggle(token, present);
      before.clear();
    },
  };
}
