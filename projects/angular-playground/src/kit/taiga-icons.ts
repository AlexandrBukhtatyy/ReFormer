/**
 * Иконки Taiga UI, которые нужны виджетам страницы.
 *
 * По умолчанию Taiga берёт иконку файлом по пути `assets/taiga-ui/icons/<имя>.svg`, а файлы в сборку
 * кладёт запись `assets` с путём до `node_modules`. Здесь иконки приходят текстом из пакета и
 * встраиваются в бандл: пути до `node_modules` в конфигурации нет, и в сборку попадают только
 * названные иконки, а не весь набор.
 */
import { tuiIconsProvider } from '@taiga-ui/core/tokens';
import check from '@taiga-ui/icons/src/check.svg';
import chevronDown from '@taiga-ui/icons/src/chevron-down.svg';
import minus from '@taiga-ui/icons/src/minus.svg';
import x from '@taiga-ui/icons/src/x.svg';

/**
 * Флажок (`check`, `minus`), пройденный шаг визарда (`check`), стрелка списка (`chevron-down`),
 * кнопка очистки поля (`x`).
 */
export const TAIGA_ICONS = tuiIconsProvider({
  '@tui.check': check,
  '@tui.chevron-down': chevronDown,
  '@tui.minus': minus,
  '@tui.x': x,
});
