/**
 * Подраздел «RJSF» подменю «Сгенерировать» контекстного меню дерева.
 *
 * Новая форма — файл, порождённый стеком, а не действие над проектом: в «Файле» открывают
 * и сохраняют, и пункту стека там не место. Подменю «Сгенерировать» общее — его заголовок вносит
 * плагин файлов, — а домен кладёт в него свой подраздел, так же как кодоген ReFormer кладёт свой.
 * Поэтому подраздел есть и в составе, где стека ReFormer нет.
 *
 * Каталог называет щелчок: форма ложится туда, по чему щёлкнули (у файла — рядом с ним, у пустого
 * места панели — в корень показа). В палитре команда остаётся под полным именем и кладёт форму
 * рядом с активной вкладкой.
 *
 * @module plugins/rjsf/editor/context-menu
 */

import {
  RESOURCE_GENERATE_MENU,
  argsOfResource,
  type MenuContribution,
} from '@reformer/builder-plugin-api';
import { RJSF_NEW_COMMAND_ID } from './contract';

/**
 * Адрес подраздела «RJSF» в подменю «Сгенерировать».
 *
 * Путь, а не структура: он и есть точка расширения. Плагин, у которого появилась своя заготовка
 * или своя печать формы RJSF, вносит пункт сюда — и оказывается в одном списке с нашими.
 */
export const RJSF_GENERATE_SUBMENU = `${RESOURCE_GENERATE_MENU}/rjsf`;

/** Вклады подраздела: заголовок и пункт новой формы. */
export function rjsfGenerateMenuItems(): readonly {
  readonly id: string;
  readonly value: MenuContribution;
}[] {
  return [
    {
      id: 'rjsf.context.submenu',
      value: {
        kind: 'submenu',
        menu: RESOURCE_GENERATE_MENU,
        submenu: RJSF_GENERATE_SUBMENU,
        titleKey: 'menu.generate.rjsf',
        // После «ReFormer» (10) — числом, а не порядком активации плагинов: иначе подразделы
        // менялись бы местами от состава.
        order: 20,
      },
    },
    {
      id: 'rjsf.context.new',
      value: {
        kind: 'item',
        menu: RJSF_GENERATE_SUBMENU,
        command: RJSF_NEW_COMMAND_ID,
        // Своя подпись: под заголовком «RJSF» имя команды «Новая форма RJSF» назвало бы стек
        // второй раз.
        titleKey: 'menu.generate.new',
        argsOf: argsOfResource((target) => ({ dir: target.dir })),
      },
    },
  ];
}
