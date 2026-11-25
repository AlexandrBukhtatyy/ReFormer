/**
 * Taiga UI для страниц playground: провайдеры приложения.
 *
 * Страница целиком лежит в `<tui-root>` — в нём же контейнер всплывающих панелей списка.
 */
import type { EnvironmentProviders, Provider } from '@angular/core';
import { TUI_ANIMATIONS_SPEED } from '@taiga-ui/core/tokens';
import { provideTaiga } from '@taiga-ui/core/utils/miscellaneous';
import { TAIGA_ICONS } from './taiga-icons';

export const TAIGA_PROVIDERS: Array<Provider | EnvironmentProviders> = [
  // Масштаб шрифта Taiga UI следит за настройкой системы через скрытый iframe — странице проверки
  // он не нужен.
  provideTaiga({ fontScaling: false }),
  // Скорость 0 — длительность анимаций 0 мс: панель списка и текст ошибки появляются и уходят
  // сразу, сценарию нечего ждать.
  { provide: TUI_ANIMATIONS_SPEED, useValue: 0 },
  TAIGA_ICONS,
];
