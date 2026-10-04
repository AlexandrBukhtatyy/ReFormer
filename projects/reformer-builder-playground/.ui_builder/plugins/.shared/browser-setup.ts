/**
 * Подготовка браузерного прогона пакета плагина.
 *
 * Стили — оболочки: плагин рисуется внутри билдера и своих правил для классов Tailwind не несёт.
 * Поэтому тест подключает ту же таблицу, что и приложение, — вход CSS билдера.
 *
 * @module plugins/.shared/browser-setup
 */

import { afterEach } from 'vitest';
import '../../../../reformer-builder/src/index.css';
import { cleanupRendered } from './render';

afterEach(() => {
  cleanupRendered();
  // Тема — глобальное состояние документа: тест, включивший тёмную, обязан вернуть светлую,
  // иначе следующий получит её в наследство и «пройдёт» по чужой причине.
  document.documentElement.classList.remove('dark');
});
