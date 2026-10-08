/**
 * Окружение «страница чужого приложения» — билдер здесь гость.
 *
 * Отличается от вкладки браузера (`shell/boot/environment`) тем, чего в нём НЕТ:
 *
 * - заголовка — он принадлежит странице приложения;
 * - перезапуска — перезагрузить чужую страницу билдер не вправе, а с ним уходит и выбор
 *   профиля состава;
 * - очистки хранилища — источник общий с приложением, и «очистить кэш билдера» стёрло бы
 *   данные приложения.
 *
 * А есть в нём одно своё: возможность «превью приложением» — адреса, по которым приложение
 * показывает себя и одну форму. Корень темы приходит от того, кто управляет присутствием
 * билдера в документе (`./document-presence`): класс темы стоит на странице, только пока
 * открыт оверлей.
 *
 * @module shell/embedded/environment
 */

import {
  AppPreviewCapability,
  type AppPreviewService,
} from '@reformer/builder-plugin-api/internal';
import type { ShellEnvironment } from '@/shell/boot/environment';
import type { ThemeRoot } from '@/shell/platform/services/theme';

export interface EmbeddedEnvironmentOptions {
  readonly themeRoot: ThemeRoot;
  readonly appPreview: AppPreviewService;
}

export function createEmbeddedEnvironment(options: EmbeddedEnvironmentOptions): ShellEnvironment {
  return {
    themeRoot: options.themeRoot,
    registerCapabilities(services) {
      services.register(AppPreviewCapability, options.appPreview);
    },
  };
}
