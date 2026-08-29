/**
 * Плагин шаблонов форм: точка расширения хранилищ, три встроенных хранилища и панель.
 *
 * **Почему это плагин, а не часть Host.** Шаблон формы — предметная сущность: он знает, что
 * у формы есть схема, что имена внутри файлов параметризуются, что среди файлов надо найти тот,
 * который стоит открыть. В платформе это означало бы, что Host знает слово «форма».
 *
 * **Почему хранилища — вклады.** Их три, и в v1 они были не тремя реализациями одного
 * интерфейса, а шестью свободными функциями с суффиксами в имени и четырьмя `if (source ===
 * 'project')` на стороне вызывающего. Здесь вид хранилища — это вклад, и четвёртый источник
 * (общий репозиторий команды, HTTP-каталог) добавляется, не трогая ни одной существующей строки.
 *
 * @module plugins/templates/plugin
 */

import { createElement, type ReactElement } from 'react';
import { LayoutTemplate } from 'lucide-react';
import {
  definePlugin,
  MenuPoint,
  NotificationsServiceToken,
  PanelPoint,
  PromptServiceToken,
  type PanelContribution,
  type Plugin,
  type SlotId,
  type WhenContext,
} from '@/sdk';
import { TemplateStorePoint, type ExtensionPointRef, type TemplateStore } from './contract';
import { templatesContextMenuItems, templatesMenuCommands } from './context-menu';
import type { MessageSink, TemplatesHost } from './host';
import { TEMPLATES_MESSAGES } from './messages';
import { createBuiltinStore, type ModulePrinter } from './stores/builtin';
import { createLocalStore } from './stores/local';
import { createProjectStore } from './stores/project';
import { TemplatesPanel } from './ui/TemplatesPanel';

/** Идентификатор плагина: пространство имён во всех реестрах и в словаре. */
export const TEMPLATES_PLUGIN_ID = 'templates';

/** Панель шаблонов. */
export const TEMPLATES_PANEL_ID = 'templates.panel';

/**
 * Слот по умолчанию — левый док.
 *
 * Шаблоны — это навигация («с чего начать форму»), а не свойство открытого документа, поэтому
 * им место рядом с деревом ресурсов, а не в инспекторе.
 */
export const DEFAULT_TEMPLATES_SLOT: SlotId = 'panel.left';

/** Значок панели. Обёртка ради размера: контракт объявляет значок компонентом без пропсов. */
const TemplatesIcon = (): ReactElement => createElement(LayoutTemplate, { className: 'size-4' });

/**
 * Панель видима всегда.
 *
 * Отличие от кодогена и превью, и оно осмысленное: шаблоны отвечают на вопрос «с чего начать»,
 * а его задают до того, как открыт хоть какой-нибудь документ. Предикат `activeResourceKind`
 * прятал бы список ровно в тот момент, когда он нужнее всего.
 */
export const panelVisible: (ctx: WhenContext) => boolean = () => true;

/** Вклад панели. Отдельно от плагина, чтобы тест звал его без реестров. */
export function templatesPanel(
  host: TemplatesHost,
  stores: () => readonly TemplateStore[],
  slot: SlotId
): PanelContribution {
  return {
    id: TEMPLATES_PANEL_ID,
    slot,
    titleKey: 'panel.title',
    icon: TemplatesIcon,
    when: panelVisible,
    order: 30,
    Body: () => createElement(TemplatesPanel, { host, stores }),
  };
}

export interface TemplatesPluginOptions {
  readonly host: TemplatesHost;
  /**
   * Печатник модуля формы для встроенных шаблонов.
   *
   * Параметром, потому что печатает его КОДОГЕН, а плагины друг друга не импортируют.
   * Композиция даёт трёхстрочный переходник поверх `generateModule(BUILTIN_TARGETS, …)`.
   * Без него встроенных шаблонов нет — и это лучше, чем 900 строк «рыб», повторяющих вывод
   * кодогена руками и расходящихся с ним молча.
   */
  readonly print?: ModulePrinter;
  /**
   * Точка расширения хранилищ. Параметром по той же причине, что точка целей у кодогена:
   * вклад обязан уходить в ТОТ объект, который дала композиция.
   */
  readonly storePoint?: ExtensionPointRef<TemplateStore>;
  /** Слот панели; по умолчанию {@link DEFAULT_TEMPLATES_SLOT}. */
  readonly slot?: SlotId;
  /** Приёмник словаря. Без него строки показываются маркерами промаха. */
  readonly i18n?: MessageSink;
}

/**
 * Собирает плагин.
 *
 * Три встроенных хранилища вносятся вкладами наравне с чужими — это и делает правило
 * «хранилище одно, бэкендов сколько угодно» проверяемым: наши не имеют никаких привилегий,
 * кроме порядка.
 */
export function createTemplatesPlugin(options: TemplatesPluginOptions): Plugin {
  const { host } = options;
  const point = options.storePoint ?? TemplateStorePoint;
  const slot = options.slot ?? DEFAULT_TEMPLATES_SLOT;

  return definePlugin({
    id: TEMPLATES_PLUGIN_ID,
    activate(ctx) {
      for (const [locale, messages] of Object.entries(TEMPLATES_MESSAGES)) {
        options.i18n?.contribute(locale, messages);
      }

      const builtin = createBuiltinStore({ print: options.print });
      const project = createProjectStore(host);
      const local = createLocalStore(host.local);

      ctx.subscriptions.push(
        ctx.extensions.contribute(point, builtin, { id: 'templates.store.builtin', order: 10 }),
        ctx.extensions.contribute(point, project, { id: 'templates.store.project', order: 20 }),
        ctx.extensions.contribute(point, local, { id: 'templates.store.local', order: 30 })
      );

      // Список читается ЛЕНИВО: хранилища вносят и снимают, и захваченный массив показывал бы
      // состав на момент активации.
      const stores = (): readonly TemplateStore[] =>
        ctx.extensions.get(point).map((contribution) => contribution.value);

      // Пункт контекстного меню дерева и команда за ним: «сделать шаблон вот из этого
      // каталога». Плагин по-прежнему не видит ни дерева, ни выделения — адрес каталога
      // приносит цель щелчка.
      const menuDeps = {
        host,
        stores,
        prompt: ctx.services.get(PromptServiceToken) ?? null,
        notifications: ctx.services.get(NotificationsServiceToken) ?? null,
      };
      for (const command of templatesMenuCommands(menuDeps)) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }
      for (const item of templatesContextMenuItems()) {
        ctx.subscriptions.push(ctx.extensions.contribute(MenuPoint, item.value, { id: item.id }));
      }

      const panel = templatesPanel(host, stores, slot);
      ctx.subscriptions.push(ctx.extensions.contribute(PanelPoint, panel, { id: panel.id }));
    },
  });
}
