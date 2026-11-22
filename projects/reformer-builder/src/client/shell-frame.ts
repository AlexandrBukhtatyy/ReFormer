/**
 * Рамка, в которой открыт билдер, — одна на страницу приложения.
 *
 * ## Билдер — отдельный документ
 *
 * В рамке работает тот же билдер, что открывается своей вкладкой: его отдаёт dev-сервер
 * приложения под своим адресом (`./addresses`). Документ у него свой, поэтому стили билдера
 * и приложения друг друга не видят, а React у каждого собственный.
 *
 * ## Рамка создаётся руками и не снимается
 *
 * Состояние билдера — открытый проект, вкладки, несохранённые правки — живёт в его документе,
 * и снять рамку значит всё это потерять. Поэтому она стоит вне дерева React приложения:
 * создаётся на `body` при первом открытии, а закрытие её только прячет. Перемонтирование
 * компонента приложения — «горячая» замена модуля, смена маршрута — рамку не трогает.
 *
 * По той же причине она одна на страницу и лежит на глобальном объекте, а не в переменной
 * модуля: dev-сервер перезагружает модуль при правке, и новая копия завела бы вторую рамку.
 *
 * ## Фокус ведут сюда
 *
 * Кнопка билдера стоит в документе приложения, и после щелчка по ней фокус остаётся там же.
 * Билдер в рамке при этом не слышит клавиш (Ctrl+S достался бы браузеру) и не узнаёт, что
 * человек вернулся из другой программы, — а по этому возврату он перечитывает файлы,
 * изменённые снаружи. Поэтому открытая рамка получает фокус сразу и каждый раз, когда его
 * получает окно приложения.
 *
 * @module client/shell-frame
 */

import { BUILDER_URL, SHELL_FRAME_NAME } from './addresses';

export interface ShellFrame {
  /** Показывает рамку; первым вызовом создаёт её и начинает грузить билдер. */
  show(): void;
  /** Прячет рамку. Билдер в ней продолжает жить. */
  hide(): void;
  /** Загрузился ли документ билдера. */
  loaded(): boolean;
  subscribe(listener: () => void): () => void;
}

export interface ShellFrameOptions {
  /** Документ приложения. Параметр ради тестов. */
  readonly document?: Document;
  /** Адрес билдера. Параметр ради тестов: настоящего билдера в них нет. */
  readonly url?: string;
}

/** Подпись рамки для вспомогательных технологий. */
const FRAME_TITLE = 'ReFormer Builder';

// Рамка — поверх всего, что рисует приложение, и на шаг ниже кнопки билдера: диалоги и меню
// самого билдера живут внутри рамки и в порядке наложения страницы не участвуют.
const FRAME_STYLE: Readonly<Record<string, string>> = {
  position: 'fixed',
  inset: '0',
  width: '100%',
  height: '100%',
  border: '0',
  zIndex: '2147483645',
  background: '#fafafa',
  // Прячется видимостью, а не снятием из раскладки: у рамки нулевого размера панели и редактор
  // билдера пересчитались бы от нуля и обратно на каждое открытие.
  visibility: 'hidden',
};

export function createShellFrame(options: ShellFrameOptions = {}): ShellFrame {
  const doc = options.document ?? document;
  const view = doc.defaultView;
  const url = options.url ?? BUILDER_URL;
  const listeners = new Set<() => void>();
  let element: HTMLIFrameElement | null = null;
  let isLoaded = false;
  let shown = false;
  /** Прокрутка страницы до открытия: под рамкой она не нужна, а её полоса торчала бы сбоку. */
  let pageOverflow: string | null = null;

  const focusFrame = (): void => {
    if (shown) element?.contentWindow?.focus();
  };

  const ensure = (): HTMLIFrameElement => {
    if (element !== null) return element;
    const frame = doc.createElement('iframe');
    frame.name = SHELL_FRAME_NAME;
    frame.title = FRAME_TITLE;
    frame.setAttribute('data-reformer-builder', 'overlay');
    Object.assign(frame.style, FRAME_STYLE);
    frame.addEventListener('load', () => {
      isLoaded = true;
      for (const listener of [...listeners]) listener();
      focusFrame();
    });
    frame.src = url;
    doc.body.append(frame);
    view?.addEventListener('focus', focusFrame);
    element = frame;
    return frame;
  };

  return {
    show() {
      const frame = ensure();
      if (shown) return;
      shown = true;
      frame.style.visibility = 'visible';
      pageOverflow = doc.documentElement.style.overflow;
      doc.documentElement.style.overflow = 'hidden';
      focusFrame();
    },

    hide() {
      if (!shown) return;
      shown = false;
      if (element !== null) element.style.visibility = 'hidden';
      doc.documentElement.style.overflow = pageOverflow ?? '';
      pageOverflow = null;
      // Фокус возвращается приложению: спрятанная рамка клавиш принимать не должна.
      view?.focus();
    },

    loaded: () => isLoaded,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const FRAME_KEY = Symbol.for('reformer.builder.shell-frame');

/** Рамка билдера этой страницы — см. «одна на страницу» в описании модуля. */
export function pageShellFrame(): ShellFrame {
  const registry = globalThis as { [FRAME_KEY]?: ShellFrame };
  registry[FRAME_KEY] ??= createShellFrame();
  return registry[FRAME_KEY];
}
