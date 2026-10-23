/**
 * Плагин шаблонов форм: хранилища проекта и браузера, панель, команды дерева и создание формы
 * по заказу.
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
 * **Формат формы — у стека.** Документ формы среди файлов шаблона, вид для шаблона на движке, токены
 * имён модуля, пустая форма и место модуля — вопросы к `TemplateStackPoint`; встроенные шаблоны —
 * хранилище, которое вносит стек. До раскола стек ReFormer активируется здесь же (`./stack`).
 *
 * @module plugins/reformer/templates/plugin
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
} from '@reformer/builder-plugin-api';
import { TemplateStorePoint, type TemplateStore } from './contract';
import {
  createTemplateSnapshot,
  templatesContextMenuItems,
  templatesMenuCommands,
} from './commands/context-menu';
import type { TemplatesHost } from './host';
import { TEMPLATES_MESSAGES } from './messages';
import { createTemplatesRefresh, type TemplatesRefresh } from './content/refresh';
import { activateTemplateStack } from './stack/activate';
import type { ModulePrinter } from './stack/builtin';
import { FormCreatorCapability, templatesWorkspace, type TemplatesGaps } from './workspace';
import { createFormFor, templateSummaries } from './content/create-for';
import { createLocalStore } from './stores/local';
import { createProjectStore } from './stores/project';
import { TemplatesActions } from './ui/TemplatesActions';
import { TemplatesPanel } from './ui/TemplatesPanel';

// Реэкспорт, а не объявление: идентификатор живёт в contract.ts, чтобы композиция могла
// взять его, не втягивая плагин в стартовый граф.
import { TEMPLATES_PLUGIN_ID } from './contract';
export { TEMPLATES_PLUGIN_ID };

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
  slot: SlotId,
  refresh: TemplatesRefresh
): PanelContribution {
  return {
    id: TEMPLATES_PANEL_ID,
    slot,
    titleKey: 'panel.title',
    icon: TemplatesIcon,
    when: panelVisible,
    order: 30,
    Body: () => createElement(TemplatesPanel, { host, stores, refresh }),
    // «Обновить» стоит в шапке дока, а не первой строкой списка: постоянное действие над
    // содержимым — свойство панели, а не её содержимого, и в теле оно уезжало бы вместе
    // со списком при прокрутке.
    Actions: () => createElement(TemplatesActions, { host, refresh }),
  };
}

export interface TemplatesPluginOptions {
  /**
   * Рабочая область ЦЕЛИКОМ — только для теста, зовущего плагин без реестра служб.
   *
   * В приложении её собирает сам плагин из возможностей контекста (`./workspace`).
   */
  readonly host?: TemplatesHost;
  /** То, чему в возможностях места пока нет: сохранение. Подставляет композиция. */
  readonly gaps?: TemplatesGaps;
  /**
   * Печатник модуля формы для встроенных шаблонов стека — только для теста и только до раскола.
   *
   * В приложении стек берёт его возможностью `reformer.codegen.printer` у генерации кода, в
   * момент печати: плагины друг друга не импортируют, а оба ленивые, и порядок активации незначим.
   */
  readonly print?: ModulePrinter;
  /** Слот панели; по умолчанию {@link DEFAULT_TEMPLATES_SLOT}. */
  readonly slot?: SlotId;
}

/**
 * Собирает плагин.
 *
 * Хранилища вносятся вкладами наравне с чужими — это и делает правило «хранилище одно, бэкендов
 * сколько угодно» проверяемым: наши не имеют никаких привилегий, кроме порядка.
 */
export function createTemplatesPlugin(options: TemplatesPluginOptions = {}): Plugin {
  const slot = options.slot ?? DEFAULT_TEMPLATES_SLOT;

  return definePlugin({
    id: TEMPLATES_PLUGIN_ID,
    activate(ctx) {
      // Рабочая область собирается ЗДЕСЬ: службы живут в контексте активации, и раньше него
      // их нет. Композиция подставляет только названные дыры.
      const host = options.host ?? templatesWorkspace(ctx, options.gaps);
      for (const [locale, messages] of Object.entries(TEMPLATES_MESSAGES)) {
        ctx.i18n.contribute(locale, messages);
      }

      // Стек ReFormer — до раскола здесь же: сам стек и встроенные шаблоны (порядок 10).
      activateTemplateStack(ctx, options.print === undefined ? {} : { print: options.print });

      const project = createProjectStore(host);
      const local = createLocalStore(host.local);

      ctx.subscriptions.push(
        ctx.extensions.contribute(TemplateStorePoint, project, {
          id: 'templates.store.project',
          order: 20,
        }),
        ctx.extensions.contribute(TemplateStorePoint, local, {
          id: 'templates.store.local',
          order: 30,
        })
      );

      // Список читается ЛЕНИВО: хранилища вносят и снимают, и захваченный массив показывал бы
      // состав на момент активации.
      const stores = (): readonly TemplateStore[] =>
        ctx.extensions.get(TemplateStorePoint).map((contribution) => contribution.value);

      // Создание формы по заказу — наружу возможностью: её берёт ассистент. Путь тот же, что у
      // окна «Создать форму», поэтому и модуль ложится так же.
      ctx.subscriptions.push(
        ctx.services.register(FormCreatorCapability, {
          templates: () => templateSummaries(stores()),
          create: (request) =>
            createFormFor(
              { host, stores, translate: (key, params) => ctx.i18n.t(key, params) },
              request
            ),
        })
      );

      // Пункт контекстного меню дерева и команда за ним: «сделать шаблон вот из этого
      // каталога». Плагин по-прежнему не видит ни дерева, ни выделения — адрес каталога
      // приносит цель щелчка.
      const menuDeps = {
        host,
        stores,
        prompt: ctx.services.get(PromptServiceToken) ?? null,
        notifications: ctx.services.get(NotificationsServiceToken) ?? null,
      };
      // Список шаблонов для подменю держится готовым: сборка меню синхронна, а хранилища
      // отвечают обещанием. Перечитывается тем же событием, что и панель, — смена кита меняет
      // ВЫВОД встроенных шаблонов, потому что стек печатает их под активный кит.
      const snapshot = createTemplateSnapshot(stores);
      snapshot.refresh();
      ctx.subscriptions.push(
        host.onDidChangeKit(() => {
          snapshot.refresh();
        })
      );

      for (const command of templatesMenuCommands(menuDeps, snapshot)) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }
      for (const item of templatesContextMenuItems(snapshot)) {
        ctx.subscriptions.push(ctx.extensions.contribute(MenuPoint, item.value, { id: item.id }));
      }

      // Один повод перечитать на плагин: его объявляет кнопка в шапке дока, а слушает
      // тело панели — они живут в разных поддеревьях и общего состояния не имеют.
      const refresh = createTemplatesRefresh();
      const panel = templatesPanel(host, stores, slot, refresh);
      ctx.subscriptions.push(ctx.extensions.contribute(PanelPoint, panel, { id: panel.id }));
    },
  });
}
