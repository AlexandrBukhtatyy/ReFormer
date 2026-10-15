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
 * - **очистка хранилища — только своего пространства имён.** Источник общий с приложением,
 *   и «очистить кэш билдера» целиком стёрло бы данные приложения. Поэтому сносится лишь то, что
 *   под пространством имён билдера (`workspace/storage/namespace`): каталог `reformer-builder/`
 *   в OPFS, базы и ключи с префиксом `reformer-builder.`. Чужое — в том числе хранилища форм
 *   приложения — не трогается;
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
import {
  builderDirectory,
  builderStorageScope,
} from '@/shell/platform/workspace/storage/namespace';
import {
  browserPurgeEnvironment,
  purgeOriginStorage,
} from '@/shell/platform/workspace/storage/purge';

export interface EmbeddedEnvironmentOptions {
  readonly appPreview: AppPreviewService;
}

export function createEmbeddedEnvironment(options: EmbeddedEnvironmentOptions): ShellEnvironment {
  const tab = createBrowserTabEnvironment();
  return {
    applyTitle: (title) => tab.applyTitle?.(title),
    themeRoot: tab.themeRoot,
    reload: tab.reload,
    purgeStorage: async (known) => {
      // Перенос старой раскладки обязан завершиться ДО очистки: иначе старое в корне источника
      // пережило бы «Очистить кэш», а копия, идущая в этот момент, упёрлась бы в снесённый
      // каталог. Отказ корня (нет OPFS) — не отказ очистки: ей и сносить тогда нечего.
      await builderDirectory().catch(() => undefined);
      return purgeOriginStorage(
        browserPurgeEnvironment({ knownDatabases: known.databases }),
        builderStorageScope
      );
    },
    registerCapabilities(services) {
      services.register(AppPreviewCapability, options.appPreview);
    },
  };
}
