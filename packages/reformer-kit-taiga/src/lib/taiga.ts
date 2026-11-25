/**
 * Taiga UI для формы: провайдеры приложения. Подключаются один раз:
 * `bootstrapApplication(App, { providers: [provideZonelessChangeDetection(), provideKitTaiga()] })`.
 * Форма должна лежать внутри `<tui-root>` — в нём контейнер всплывающих панелей списка. Стили —
 * `@taiga-ui/styles/taiga-ui-theme.css` и `@reformer/kit-taiga/styles.css` в `styles` сборки.
 *
 * Иконки, которые нужны виджетам кита, встроены строками: Taiga по умолчанию берёт их файлами
 * `assets/taiga-ui/icons/*.svg`, а для этого сборке нужна запись `assets` с путём до `node_modules`.
 */
import type { EnvironmentProviders, Provider } from '@angular/core';
import { TUI_ANIMATIONS_SPEED, tuiIconsProvider } from '@taiga-ui/core/tokens';
import { provideTaiga } from '@taiga-ui/core/utils/miscellaneous';

const svg = (paths: string): string =>
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ' +
  'fill="none" stroke="currentColor" stroke-width="calc((100vw - 100vh) / 10)" ' +
  `stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const path = (d: string): string => `<path vector-effect="non-scaling-stroke" d="${d}" />`;

/**
 * Флажок и пройденный шаг визарда (`check`, `minus`), стрелка списка (`chevron-down`), кнопка
 * очистки поля (`x`).
 */
const KIT_ICONS = tuiIconsProvider({
  '@tui.check': svg(path('M20 6 9 17l-5-5')),
  '@tui.chevron-down': svg(path('m6 9 6 6 6-6')),
  '@tui.minus': svg(path('M5 12h14')),
  '@tui.x': svg(path('M18 6 6 18') + path('m6 6 12 12')),
});

export interface KitTaigaOptions {
  /**
   * Анимации Taiga UI. `false` — длительность 0 мс: панель списка и текст ошибки появляются и уходят
   * в той же перерисовке. Нужно тестам и автоматизации.
   */
  animations?: boolean;
}

export function provideKitTaiga(
  options: KitTaigaOptions = {}
): Array<Provider | EnvironmentProviders> {
  return [
    // Масштаб шрифта Taiga UI следит за настройкой системы через скрытый iframe — форме он не нужен.
    provideTaiga({ fontScaling: false }),
    KIT_ICONS,
    ...(options.animations === false ? [{ provide: TUI_ANIMATIONS_SPEED, useValue: 0 }] : []),
  ];
}
