/**
 * Переключение вида схемы: команда и пара кнопок в полосе вкладок.
 *
 * ## Пара вкладов — одна кнопка на экране
 *
 * У пункта меню значок статичен по контракту, а предикат — нет, поэтому «кнопка, меняющая
 * значок» выражается двумя пунктами с взаимоисключающими условиями: в конструкторе видна
 * половина «показать исходник», в исходнике — «показать конструктор». Тот же приём, что
 * у markdown, и он же объясняет, почему у половин РАЗНЫЕ подписи при одной команде:
 * подсказка обязана говорить, что будет после нажатия, а команда — одна, «переключить».
 *
 * @module plugins/editor-schema/view-actions
 */

import { createElement, type ReactElement } from 'react';
import { Braces, LayoutTemplate } from 'lucide-react';
import {
  argsOfEditor,
  EDITOR_TITLE_MENU,
  whenEditor,
  type CommandContribution,
  type MenuContribution,
  type ResourceId,
} from '@/sdk';
import type { SchemaEditorHost } from './host';
import type { SchemaView, SchemaViewStore } from './view-mode';

/** Переключить конструктор и исходник. */
export const TOGGLE_SCHEMA_VIEW_COMMAND_ID = 'schema.toggleView';

/** Значки половин. Обёртки ради размера: контракт объявляет значок компонентом без пропсов. */
const CodeIcon = (): ReactElement => createElement(Braces, { className: 'size-4' });
const DesignIcon = (): ReactElement => createElement(LayoutTemplate, { className: 'size-4' });

/** Адрес документа из аргументов команды; проверяется, а не приводится типом. */
export function documentIdOf(args: unknown): ResourceId | null {
  if (typeof args !== 'object' || args === null) return null;
  const value = (args as { documentId?: unknown }).documentId;
  return typeof value === 'string' ? value : null;
}

export interface SchemaViewCommandDeps {
  readonly host: SchemaEditorHost;
  readonly views: SchemaViewStore;
  /** Схема ли открытый документ: команда не должна трогать чужие вкладки. */
  readonly isSchema: (id: ResourceId) => boolean;
}

/** Команда переключения. Заголовок разрешается словарём ПЛАГИНА — он её владелец. */
export function schemaViewCommands(deps: SchemaViewCommandDeps): readonly CommandContribution[] {
  const { host, views, isSchema } = deps;

  const target = (args: unknown): ResourceId | null =>
    documentIdOf(args) ?? host.activeDocument?.() ?? null;

  return [
    {
      id: TOGGLE_SCHEMA_VIEW_COMMAND_ID,
      titleKey: 'command.toggleView',
      // Без редактора кода переключать не на что, и команда честно объявляет себя
      // недоступной, а не показывает пустоту вместо схемы.
      enabled: () => {
        if (host.TextEditor === undefined) return false;
        const id = host.activeDocument?.() ?? null;
        return id !== null && isSchema(id);
      },
      run: (args) => {
        const id = target(args);
        if (id === null) return false;
        views.set(id, views.get(id) === 'code' ? 'design' : 'code');
        return true;
      },
    },
  ];
}

export interface SchemaViewMenuDeps {
  readonly views: SchemaViewStore;
  readonly hasTextEditor: () => boolean;
  /** Схема ли документ, над которым открыт ряд действий. */
  readonly isSchema: (id: ResourceId) => boolean;
}

/** Пара кнопок в полосе вкладок. */
export function schemaViewMenuItems(
  deps: SchemaViewMenuDeps
): readonly { readonly id: string; readonly value: MenuContribution }[] {
  const { views, hasTextEditor, isSchema } = deps;

  const viewOf = (target: unknown): SchemaView | null => {
    const documentId = (target as { documentId?: unknown } | null)?.documentId;
    return typeof documentId === 'string' ? views.get(documentId) : null;
  };

  const onSchema = whenEditor((target) => hasTextEditor() && isSchema(target.documentId));
  const args = argsOfEditor((target) => ({ documentId: target.documentId }));
  const signal = (cb: () => void) => views.subscribe(cb);

  return [
    {
      id: 'schema.title.toCode',
      value: {
        kind: 'item',
        menu: EDITOR_TITLE_MENU,
        command: TOGGLE_SCHEMA_VIEW_COMMAND_ID,
        group: '1_view',
        titleKey: 'command.showCode',
        icon: CodeIcon,
        when: (ctx, target) => onSchema(ctx, target) && viewOf(target) === 'design',
        argsOf: args,
        onDidChange: signal,
      },
    },
    {
      id: 'schema.title.toDesign',
      value: {
        kind: 'item',
        menu: EDITOR_TITLE_MENU,
        command: TOGGLE_SCHEMA_VIEW_COMMAND_ID,
        group: '1_view',
        titleKey: 'command.showDesign',
        icon: DesignIcon,
        when: (ctx, target) => onSchema(ctx, target) && viewOf(target) === 'code',
        argsOf: args,
        onDidChange: signal,
      },
    },
  ];
}
