/**
 * Тема редактора следует за темой оболочки — через DOM, а не через порт.
 *
 * Служба тем ставит класс `dark` на корневой элемент документа и снимает его для светлой
 * (`host/services/theme.ts`); светлая палитра лежит в `:root`, парного класса нет. Это
 * наблюдаемое состояние DOM, а не платформенное API, поэтому плагин читает его сам:
 * тащить тему через порт значило бы просить композицию пересказать то, что и так написано
 * на корневом элементе.
 *
 * @module plugins/editor-monaco/theme
 */

import { useEffect, useState } from 'react';

/** Класс тёмной темы — тот же, что ставит служба тем. */
export const DARK_CLASS = 'dark';

/** Встроенные темы Monaco: своей мы не заводим, пока палитра оболочки не устоялась. */
export const MONACO_DARK_THEME = 'vs-dark';
export const MONACO_LIGHT_THEME = 'vs';

/** Имя темы Monaco по признаку тёмной оболочки. */
export function monacoThemeFor(dark: boolean): string {
  return dark ? MONACO_DARK_THEME : MONACO_LIGHT_THEME;
}

function readDark(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains(DARK_CLASS);
}

/**
 * Тёмная ли сейчас оболочка.
 *
 * Наблюдатель, а не подписка на службу: класс меняет служба тем, и другого источника
 * правды у неё нет. `attributeFilter` сужает наблюдение до одного атрибута — иначе
 * обработчик срабатывал бы на каждую правку стиля корневого элемента.
 */
export function useDarkTheme(): boolean {
  const [dark, setDark] = useState(readDark);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setDark(root.classList.contains(DARK_CLASS));
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    setDark(root.classList.contains(DARK_CLASS));
    return () => {
      observer.disconnect();
    };
  }, []);

  return dark;
}
