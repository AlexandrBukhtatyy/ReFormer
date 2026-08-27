/**
 * Исходники каталога формы — то, что будет исполнено живым превью.
 *
 * **Один путь чтения — рабочая копия вкладки** (`app/workdir-actions`). Раньше их было два, с
 * правилом приоритета «несохранённая вкладка Monaco важнее диска», и работало это только для формы,
 * открытой из проекта: у формы, собранной в билдере, файлов не существовало вовсе, и живое превью
 * ей было недоступно. Теперь буфер и есть файл: редактор пишет в рабочую копию, превью её читает.
 *
 * Копия содержит МОДУЛЬ ЦЕЛИКОМ, а не три правимые схемы. Это не запас: `renderer.behavior.ts`
 * импортирует значения из `./validation` и `./api`, и на неполном наборе `require('./api')` бросил
 * бы — то есть поведение UI не подключилось бы никогда.
 *
 * @module reformer-builder/preview-runtime/live/sibling-sources
 */

import { syncWorkdir } from '../../app/workdir-actions';
import { splitPath } from '../../io/fs-ops';
import type { TabState } from '../../store/types';

/** Исходники каталога формы: имя файла → текст. */
export interface FormSources {
  /** Каталог формы относительно корня проекта (пустой у формы без проекта). */
  dir: string;
  /** Прямые дети каталога: имя файла (с расширением) → исходник. */
  files: Record<string, string>;
  /** Файлы, правленные пользователем, — показываем это в панели «Сборка». */
  fromEditor: string[];
}

/** Исполняем только TS/TSX и не трогаем страницу-обёртку и тесты. */
function isExecutable(name: string): boolean {
  if (!/\.tsx?$/.test(name)) return false;
  if (name === 'index.ts' || name === 'index.tsx') return false;
  return !/\.(test|spec)\.tsx?$/.test(name);
}

/**
 * Прочитать исходники формы из её рабочей копии.
 *
 * Недоступная копия (OPFS выключен, приватный режим) — не ошибка: пустой набор, вызывающий
 * покажет это как «схемы не подключены».
 */
export async function readFormSources(tab: TabState): Promise<FormSources> {
  const dir = tab.source.path ? splitPath(tab.source.path).dirPath : '';
  const all = await syncWorkdir(tab);
  if (!all) return { dir, files: {}, fromEditor: [] };

  const files: Record<string, string> = {};
  for (const [name, text] of Object.entries(all)) {
    if (isExecutable(name)) files[name] = text;
  }
  // Что именно правил человек, знает маркер: файл без него либо с разошедшимся хэшем — рукописный.
  const { originOf } = await import('../../codegen/regenerate');
  const fromEditor = Object.keys(files).filter((n) => originOf(files[n]) !== 'generated');
  return { dir, files, fromEditor };
}
