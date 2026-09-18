/**
 * Плагин демо-стека: другой формат схемы, другой рендер, свой экспорт — одним плагином.
 *
 * Вносит провайдер модели (`plain.form`), поверхность превью (`plain.native`), валидатор,
 * редактор и три команды. Портов у него нет ни одного: всё от оболочки — возможностями, как
 * у плагина из каталога проекта. В этом и смысл стека — доказать, что шов «стек» проходит
 * через SDK, а не через `boot`.
 *
 * @module plugins/plain/plugin
 */

import { createElement } from 'react';
import {
  definePlugin,
  DocumentModelPoint,
  DocumentModelsCapability,
  DocumentsServiceToken,
  EditorPoint,
  MenuPoint,
  PreviewLiveCapability,
  PreviewSurfacePoint,
  useTranslate,
  ValidatorPoint,
  WorkspaceFilesServiceToken,
  WorkspaceSaveCapability,
  type EditorContribution,
  type Plugin,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import { plainCommands, type PlainServices } from './commands';
import {
  PLAIN_EDITOR_ID,
  PLAIN_NEW_COMMAND_ID,
  PLAIN_PLUGIN_ID,
  PLAIN_PROVIDER_ID,
  PLAIN_VALIDATOR_ID,
} from './contract';
import { PLAIN_MESSAGES } from './messages';
import { createPlainModelProvider, isPlainResource } from './provider';
import { createNativeSurface } from './surface';
import { PlainEditor } from './ui/PlainEditor';
import { createPlainValidator } from './validator';

export { PLAIN_PLUGIN_ID };

/**
 * Приоритет редактора: выше Monaco (10) — форма стека открывается своим редактором, а текст
 * остаётся доступен «открыть с помощью».
 */
export const PLAIN_EDITOR_PRIORITY = 100;

export function createPlainPlugin(): Plugin {
  return definePlugin({
    id: PLAIN_PLUGIN_ID,
    activate(ctx) {
      for (const [locale, messages] of Object.entries(PLAIN_MESSAGES)) {
        ctx.i18n.contribute(locale, messages);
      }
      const t = (key: string, params?: Record<string, unknown>): string => ctx.i18n.t(key, params);

      const services: PlainServices = {
        documents: () => ctx.services.get(DocumentsServiceToken),
        files: () => ctx.services.get(WorkspaceFilesServiceToken),
        models: () => ctx.services.get(DocumentModelsCapability),
        save: () => ctx.services.get(WorkspaceSaveCapability),
      };

      function usePlainTranslate() {
        return useTranslate(ctx.i18n);
      }

      const editor: EditorContribution = {
        id: PLAIN_EDITOR_ID,
        titleKey: 'editor.label',
        canOpen: (ref, probe) => (isPlainResource(ref, probe) ? PLAIN_EDITOR_PRIORITY : false),
        Body: ({ documentId }: { documentId: ResourceId }) =>
          createElement(PlainEditor, {
            documentId,
            services,
            // Превью выключаемо на ходу — возможность спрашивается в момент отрисовки.
            live: () => ctx.services.get(PreviewLiveCapability),
            useTranslate: usePlainTranslate,
          }),
      };

      ctx.subscriptions.push(
        ctx.extensions.contribute(DocumentModelPoint, createPlainModelProvider(), {
          id: PLAIN_PROVIDER_ID,
        }),
        ctx.extensions.contribute(PreviewSurfacePoint, createNativeSurface(t), {
          id: 'plain.native',
        }),
        ctx.extensions.contribute(ValidatorPoint, createPlainValidator(), {
          id: PLAIN_VALIDATOR_ID,
        }),
        ctx.extensions.contribute(EditorPoint, editor, { id: PLAIN_EDITOR_ID }),
        ctx.extensions.contribute(
          MenuPoint,
          { kind: 'item', menu: 'file', command: PLAIN_NEW_COMMAND_ID, group: '1_new' },
          { id: 'plain.menu.new' }
        )
      );
      for (const command of plainCommands(services)) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }
    },
  });
}
