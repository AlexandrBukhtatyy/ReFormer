/**
 * Редактор домена RJSF: провайдер модели `rjsf-form/1`, валидатор, редактор формы и команды.
 *
 * Рисует форму не он — поверхность превью плагина `reformer.rjsf.render`, которую хост превью
 * выбирает по провайдеру модели. Между плагинами домена нет импортов: общее — ядро
 * `plugins/rjsf/core`, а живая форма приходит возможностью `reformer.preview.live`.
 *
 * Кит — необязательная возможность `reformer.kit.catalog`: его поля предлагаются виджетами и
 * известны валидатору. Без кита редактор работает на стандартных виджетах RJSF.
 *
 * @module plugins/rjsf/editor/plugin
 */

import { createElement } from 'react';
import { RJSF_PROVIDER_ID } from '@/plugins/rjsf/core';
import {
  definePlugin,
  DocumentModelPoint,
  DocumentModelsCapability,
  DocumentsServiceToken,
  EditorPoint,
  KitsCapability,
  MenuPoint,
  PreviewLiveCapability,
  useTranslate,
  ValidatorPoint,
  WorkspaceFilesServiceToken,
  WorkspaceSaveCapability,
  type EditorContribution,
  type Plugin,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import { rjsfCommands, type RjsfServices } from './commands';
import {
  RJSF_EDITOR_ID,
  RJSF_EDITOR_PLUGIN_ID,
  RJSF_NEW_COMMAND_ID,
  RJSF_VALIDATOR_ID,
} from './contract';
import { RJSF_EDITOR_MESSAGES } from './messages';
import { createRjsfModelProvider, isRjsfResource } from './provider';
import { RjsfEditor } from './ui/RjsfEditor';
import { createRjsfValidator } from './validator';

export { RJSF_EDITOR_PLUGIN_ID };

/**
 * Приоритет редактора: выше Monaco (10) — форма открывается своим редактором, а текст остаётся
 * доступен «открыть с помощью».
 */
export const RJSF_EDITOR_PRIORITY = 100;

export function createRjsfEditorPlugin(): Plugin {
  return definePlugin({
    id: RJSF_EDITOR_PLUGIN_ID,
    activate(ctx) {
      for (const [locale, messages] of Object.entries(RJSF_EDITOR_MESSAGES)) {
        ctx.i18n.contribute(locale, messages);
      }

      const services: RjsfServices = {
        documents: () => ctx.services.get(DocumentsServiceToken),
        files: () => ctx.services.get(WorkspaceFilesServiceToken),
        models: () => ctx.services.get(DocumentModelsCapability),
        save: () => ctx.services.get(WorkspaceSaveCapability),
      };
      // Кит и превью выключаемы на ходу — возможности спрашиваются в момент обращения.
      const kits = () => ctx.services.get(KitsCapability);

      function useRjsfTranslate() {
        return useTranslate(ctx.i18n);
      }

      const editor: EditorContribution = {
        id: RJSF_EDITOR_ID,
        titleKey: 'editor.label',
        canOpen: (ref, probe) => (isRjsfResource(ref, probe) ? RJSF_EDITOR_PRIORITY : false),
        Body: ({ documentId }: { documentId: ResourceId }) =>
          createElement(RjsfEditor, {
            documentId,
            services,
            live: () => ctx.services.get(PreviewLiveCapability),
            kits,
            useTranslate: useRjsfTranslate,
          }),
      };

      ctx.subscriptions.push(
        ctx.extensions.contribute(DocumentModelPoint, createRjsfModelProvider(), {
          id: RJSF_PROVIDER_ID,
        }),
        ctx.extensions.contribute(ValidatorPoint, createRjsfValidator(kits), {
          id: RJSF_VALIDATOR_ID,
        }),
        ctx.extensions.contribute(EditorPoint, editor, { id: RJSF_EDITOR_ID }),
        ctx.extensions.contribute(
          MenuPoint,
          { kind: 'item', menu: 'file', command: RJSF_NEW_COMMAND_ID, group: '1_new' },
          { id: 'rjsf.menu.new' }
        )
      );
      for (const command of rjsfCommands(services)) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }
    },
  });
}
