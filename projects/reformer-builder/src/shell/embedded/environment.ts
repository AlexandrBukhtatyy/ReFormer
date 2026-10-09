/**
 * Окружения билдера, открытого рядом с приложением.
 *
 * ## Свой документ, общий источник
 *
 * Билдер отдаёт dev-сервер приложения, и открыт он в СВОЁМ документе — в рамке поверх страницы
 * либо вкладкой с того же адреса. Поэтому с документом он хозяин, как во вкладке
 * (`shell/boot/environment`): заголовок, класс темы и перезагрузка — его собственные, и ни одно
 * из них приложению не мешает. Вместе с перезагрузкой остаётся и выбор профиля состава.
 *
 * Отличий от вкладки два:
 *
 * - **очистки хранилища нет.** Источник общий с приложением, и «очистить кэш билдера» стёрло бы
 *   данные приложения;
 * - **есть возможность «превью приложением»** — адреса, по которым приложение показывает себя
 *   и одну форму.
 *
 * @module shell/embedded/environment
 */

import {
  AppPreviewCapability,
  type AppPreviewService,
} from '@reformer/builder-plugin-api/internal';
import { createBrowserTabEnvironment, type ShellEnvironment } from '@/shell/boot/environment';

export interface EmbeddedEnvironmentOptions {
  readonly appPreview: AppPreviewService;
}

export function createEmbeddedEnvironment(options: EmbeddedEnvironmentOptions): ShellEnvironment {
  const tab = createBrowserTabEnvironment();
  return {
    applyTitle: (title) => tab.applyTitle?.(title),
    themeRoot: tab.themeRoot,
    reload: tab.reload,
    registerCapabilities(services) {
      services.register(AppPreviewCapability, options.appPreview);
    },
  };
}
