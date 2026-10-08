/**
 * Тяжёлая часть встроенного билдера: сборка приложения и его интерфейс в оверлее.
 *
 * Приезжает отдельным чанком по первому включению режима (см. `./ReformerBuilderFrame`) и живёт
 * до конца страницы: сборка одна, а оверлей открывают и закрывают сколько угодно раз.
 *
 * ## Что переживает закрытие оверлея
 *
 * Всё, кроме самого дерева React: открытый проект, вкладки, рабочая копия, плагины — состояние
 * собранного приложения, а не компонентов. Закрытие снимает корень React и присутствие билдера
 * в документе (стили, класс темы); открытие рисует то же приложение заново.
 *
 * ## Состав приходит параметром
 *
 * Как и у оболочки «своя вкладка»: какие плагины образуют билдер, знает вход библиотеки,
 * а не оболочка.
 *
 * ## Запись на диск — событие для превью
 *
 * Превью рисует само приложение, и узнаёт оно о правке, только когда файл лёг на диск. Поэтому
 * оболочка следит за сохранениями рабочей области открытого проекта и сообщает о них панели
 * превью (`AppPreviewService.onDidWriteSource`): та перезагружает рамку.
 *
 * @module shell/embedded/runtime
 */

import { createRoot } from 'react-dom/client';
import type { Disposable } from '@reformer/builder-plugin-api/internal';
import { boot } from '@/shell/boot/boot';
import { BuilderRoot } from '@/shell/boot/BuilderRoot';
import type { ApplicationComposition } from '@/shell/boot/composition';
import { loadApplicationFiles } from '@/shell/platform/plugin/application/files';
import { createDocumentPresence } from './document-presence';
import { createEmbeddedEnvironment } from './environment';
import {
  createAppPreviewService,
  createSourceWriteSignal,
  type PageLocation,
} from './preview-address';
import type { EmbeddedRuntime } from './ReformerBuilderFrame';

export interface EmbeddedRuntimeOptions {
  /** Состав приложения — от входа библиотеки. */
  readonly application: ApplicationComposition;
  /** Стили билдера одной строкой: в документе они живут, только пока открыт оверлей. */
  readonly styles: string;
  /** Адрес каталога плагинов приложения. */
  readonly pluginsUrl: string;
  /** Адрес страницы приложения — в момент вопроса. */
  readonly location: () => PageLocation;
}

const withSlash = (url: string): string => (url.endsWith('/') ? url : `${url}/`);

export function startEmbeddedRuntime(options: EmbeddedRuntimeOptions): EmbeddedRuntime {
  const presence = createDocumentPresence({ styles: options.styles });
  const pluginsUrl = withSlash(options.pluginsUrl);
  const sourceWrites = createSourceWriteSignal();

  const app = boot({
    application: options.application,
    environment: createEmbeddedEnvironment({
      themeRoot: presence.themeRoot,
      appPreview: createAppPreviewService(options.location, sourceWrites),
    }),
    applicationPluginFiles: () => loadApplicationFiles({ baseUrl: pluginsUrl }),
  });

  // Сохранения открытого проекта. Подписка переезжает вместе с проектом: рабочая область
  // у каждого своя, а открыть и закрыть проект можно сколько угодно раз.
  let saves: Disposable | null = null;
  const followProject = (): void => {
    saves?.dispose();
    const session = app.project.get();
    saves =
      session === null
        ? null
        : session.workspace.onDidChange((event) => {
            if (event.changes.some((change) => change.type === 'saved')) sourceWrites.emit();
          });
  };
  app.project.subscribe(followProject);
  followProject();

  /** Последний проект поднимается один раз — после первой отрисовки, как в своей вкладке. */
  let restored = false;

  return {
    mount(container) {
      presence.attach();
      const root = createRoot(container);
      let active = true;

      // Отрисовка ждёт `ready` по той же причине, что в своей вкладке: раскладка панелей
      // и словарь читаются оболочкой один раз при монтировании.
      void app.ready.then(() => {
        if (!active) return;
        root.render(<BuilderRoot app={app} />);
        if (restored) return;
        restored = true;
        void app.restore();
      });

      return () => {
        active = false;
        presence.detach();
        // Снятие корня — в микрозадаче: «снять» зовёт эффект React приложения, а снимать
        // один корень, пока React занят другим, нельзя.
        queueMicrotask(() => {
          root.unmount();
        });
      };
    },
  };
}
