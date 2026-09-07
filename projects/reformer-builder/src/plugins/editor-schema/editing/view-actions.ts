/**
 * Переключение вида схемы: команда «конструктор ⇄ исходник».
 *
 * ## Кнопок здесь нет — они у переключателя положений
 *
 * Пара взаимоисключающих пунктов («показать исходник» в конструкторе, «показать конструктор»
 * в исходнике) рисовала на экране ОДНУ кнопку, меняющую значок. Она ушла: полоса вкладок
 * показывает переключатель из трёх положений — дерево, схема, исходник
 * ({@link '../canvas/canvas-actions'}), — и вторая кнопка про то же самое означала бы два ответа
 * на вопрос «как показан документ».
 *
 * Команда осталась: «переключить» — это то, что зовут из палитры и повесят на клавишу,
 * и от неё же работает третье положение переключателя, когда возвращаются в конструктор.
 *
 * @module plugins/editor-schema/editing/view-actions
 */

import type { CommandContribution, ResourceId } from '@/sdk';
import type { SchemaEditorHost } from '../host';
import type { SchemaViewStore } from '../session/view-mode';

/** Переключить конструктор и исходник. */
export const TOGGLE_SCHEMA_VIEW_COMMAND_ID = 'schema.toggleView';

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
