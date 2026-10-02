/**
 * Редактор домена RJSF: провайдер модели `rjsf-form/1`, валидатор, редактор формы, панель свойств
 * поля и команды.
 *
 * Раскладка та же, что у редактора схемы ReFormer: тело вкладки показывает структуру или
 * отрисованную форму (переключатель — кнопками в полосе вкладок, `./view`), а свойства
 * выбранного поля — панель правого дока. Панель вносится один раз при активации, а `when`
 * управляет только видимостью: на вкладке другого вида её нет.
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

import { createElement, type ReactElement } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { RJSF_PROVIDER_ID } from '@/plugins/rjsf/core';
import {
  definePlugin,
  DocumentModelPoint,
  DocumentModelsCapability,
  DocumentsServiceToken,
  EditorPoint,
  KitsCapability,
  MenuPoint,
  PanelPoint,
  PreviewLiveCapability,
  SettingsServiceToken,
  useTranslate,
  ValidatorPoint,
  WorkspaceFilesServiceToken,
  WorkspaceSaveCapability,
  type EditorContribution,
  type KitsService,
  type PanelContribution,
  type Plugin,
  type ResourceId,
  type WhenContext,
} from '@reformer/builder-plugin-api';
import { rjsfCommands, rjsfHandleOf, type RjsfServices } from './commands';
import {
  RJSF_EDITOR_ID,
  RJSF_EDITOR_PLUGIN_ID,
  RJSF_INSPECTOR_PANEL_ID,
  RJSF_NEW_COMMAND_ID,
  RJSF_VALIDATOR_ID,
} from './contract';
import { RJSF_EDITOR_MESSAGES } from './messages';
import { createRjsfModelProvider, isRjsfResource } from './provider';
import type { Translate } from './ui/hooks';
import { RjsfEditor } from './ui/RjsfEditor';
import { RjsfInspector } from './ui/RjsfInspector';
import { createRjsfValidator } from './validator';
import {
  createRjsfViewStore,
  rjsfViewCommands,
  rjsfViewMenuItems,
  type RjsfViewDeps,
} from './view';

export { RJSF_EDITOR_PLUGIN_ID };

/**
 * Приоритет редактора: выше Monaco (10) — форма открывается своим редактором, а текст остаётся
 * доступен «открыть с помощью».
 */
export const RJSF_EDITOR_PRIORITY = 100;

/** Значок панели в рейле. Обёртка ради размера: контракт объявляет значок без пропсов. */
const InspectorIcon = (): ReactElement => createElement(SlidersHorizontal, { className: 'size-4' });

/**
 * Видима ли панель свойств при таком контексте. Чистая и дешёвая — её зовут на каждый кадр.
 *
 * `activeResourceKind` — это `providerId` модельного документа, а модельным его делает разбор
 * ровно провайдера домена: на чужом JSON и на markdown панели нет.
 */
export function rjsfPanelVisible(ctx: WhenContext): boolean {
  return ctx.activeResourceKind === RJSF_PROVIDER_ID;
}

export interface RjsfInspectorPanelDeps {
  readonly services: RjsfServices;
  readonly kits: () => KitsService | undefined;
  readonly useTranslate: () => Translate;
}

/** Панель свойств выбранного поля — в правом доке. Отдельно от плагина, чтобы тест звал её сам. */
export function rjsfInspectorPanel(deps: RjsfInspectorPanelDeps): PanelContribution {
  return {
    id: RJSF_INSPECTOR_PANEL_ID,
    slot: 'panel.right',
    titleKey: 'panel.inspector',
    icon: InspectorIcon,
    when: rjsfPanelVisible,
    order: 10,
    Body: () => createElement(RjsfInspector, deps),
  };
}

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
      const live = () => ctx.services.get(PreviewLiveCapability);

      function useRjsfTranslate() {
        return useTranslate(ctx.i18n);
      }

      // Чем показана вкладка — структурой или формой. Настройки берутся из реестра служб:
      // способ смотреть принадлежит человеку. Без службы вид работает, но не переживает
      // перезагрузку.
      const hasLive = (): boolean => live()?.available() === true;
      const view = createRjsfViewStore({
        settings: ctx.services.get(SettingsServiceToken) ?? null,
        hasLive,
      });
      ctx.subscriptions.push({
        dispose: () => {
          view.dispose();
        },
      });
      const viewDeps: RjsfViewDeps = {
        view,
        hasLive,
        // Спрашивается у ручки платформы: она заведена раньше, чем вкладка появилась на экране.
        activeIsRjsf: () => {
          const id = services.documents()?.activeResource() ?? null;
          return id !== null && rjsfHandleOf(services, id) !== null;
        },
      };

      const editor: EditorContribution = {
        id: RJSF_EDITOR_ID,
        titleKey: 'editor.label',
        canOpen: (ref, probe) => (isRjsfResource(ref, probe) ? RJSF_EDITOR_PRIORITY : false),
        Body: ({ documentId }: { documentId: ResourceId }) =>
          createElement(RjsfEditor, {
            documentId,
            services,
            live,
            view,
            useTranslate: useRjsfTranslate,
          }),
      };
      const inspector = rjsfInspectorPanel({ services, kits, useTranslate: useRjsfTranslate });

      ctx.subscriptions.push(
        ctx.extensions.contribute(DocumentModelPoint, createRjsfModelProvider(), {
          id: RJSF_PROVIDER_ID,
        }),
        ctx.extensions.contribute(ValidatorPoint, createRjsfValidator(kits), {
          id: RJSF_VALIDATOR_ID,
        }),
        ctx.extensions.contribute(EditorPoint, editor, { id: RJSF_EDITOR_ID }),
        ctx.extensions.contribute(PanelPoint, inspector, { id: inspector.id }),
        ctx.extensions.contribute(
          MenuPoint,
          { kind: 'item', menu: 'file', command: RJSF_NEW_COMMAND_ID, group: '1_new' },
          { id: 'rjsf.menu.new' }
        )
      );
      for (const item of rjsfViewMenuItems(viewDeps)) {
        ctx.subscriptions.push(ctx.extensions.contribute(MenuPoint, item.value, { id: item.id }));
      }
      for (const command of [...rjsfCommands(services), ...rjsfViewCommands(viewDeps)]) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }
    },
  });
}
