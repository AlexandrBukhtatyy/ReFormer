/**
 * Плагин «киты»: реестр китов, служба активного кита и её переключатель — ячейка строки
 * состояния и пункты палитры команд.
 *
 * **Почему это плагин, а не часть Host.** Дизайн-система — предметное знание: какие у неё
 * компоненты, какие нельзя рисовать вживую, чем их окружить. В платформе оно означало бы, что
 * второй кит вносится правкой ядра. Граница проверяется линтером: `src/plugins/**` не видит
 * `@/shell/*` — только `@reformer/builder-plugin-api` и библиотеки.
 *
 * **Реестр нейтрален.** Он не знает ни одного стека: отдаёт кит так, как его поставил кит, а что
 * из каталога следует для ReFormer или RJSF, выводит сам стек. Поэтому зависит он только от SDK.
 *
 * **Что регистрируется.** Порядок здесь не значит ничего (рантайм плагинов не строит графа
 * зависимостей), но состав значит:
 *
 * ```text
 * services.register(KitsCapability)     один ответ на «какой кит активен» для всех
 * settings.registerDefault(...)         умолчание объявляет тот, кто вносит настройку
 * extensions.observe(KitSourcePoint)    киты, которые вносят плагины, — в список
 * extensions.contribute(PanelPoint)     ячейка «кит» в слоте statusbar
 * extensions.contribute(PaletteItems)   те же киты пунктами палитры
 * ```
 *
 * **Переключатель — здесь же.** Раньше кит выбирался в общем «переключателе сочетаний» вместе
 * с профилем приложения. Профиль остался встроенному плагину оболочки, а кит вернулся к своей
 * службе: выбор кита — действие над ней, и вместе с плагином китов он и приходит, и уходит.
 *
 * Всё снимается вместе с плагином: `subscriptions` освобождает рантайм, и после выключения
 * ни службы, ни умолчания, ни пунктов палитры не остаётся.
 *
 * @module plugins/forms/kits/plugin
 */

import { createElement } from 'react';
import manifest from './manifest.json';
import {
  definePlugin,
  KitsCapability,
  KitSourcePoint,
  NotificationsServiceToken,
  PaletteItemsPoint,
  PanelPoint,
  pluginMessageKey,
  SettingsServiceToken,
  type KitSource,
  type KitsService,
  type PaletteItem,
  type PaletteItemProvider,
  type Plugin,
  type PluginContext,
} from '@reformer/builder-plugin-api';
import { BUILTIN_KIT } from './builtin';
import { createKitCellStore, KITS_CELL_ID } from './cell';
import { KITS_MESSAGES } from './messages';
import type { KitsSettings, Translate } from './host';
import { createKitsService, KIT_SETTINGS_KEY, type KitProblem } from './service';
import { KitCell } from './ui/KitCell';

export { KITS_CELL_ID };

/** Идентификатор плагина: пространство имён во всех реестрах и в словаре. */
export const KITS_PLUGIN_ID = manifest.id;

/** Идентификатор поставщика пунктов палитры. Он же — адрес вклада в точке расширения. */
export const KITS_PALETTE_PROVIDER_ID = 'kits.switch';

export interface KitsPluginOptions {
  /**
   * Где живёт выбор. Необязательна и ЗАПАСНАЯ: по умолчанию плагин берёт настройки из реестра
   * служб, как это обязан делать любой плагин из каталога. Параметр — только для тестов, где
   * реестра нет.
   */
  readonly settings?: KitsSettings;
  /** Встроенные киты. По умолчанию — один, `@reformer/ui-kit`. */
  readonly sources?: readonly KitSource[];
}

/**
 * Пункты палитры «сменить кит» — по одному на установленный кит.
 *
 * Заголовок собирается ЗДЕСЬ, а не ключом: название кита живёт в его дескрипторе и переводу
 * не подлежит, поэтому строка приходит готовой.
 *
 * Активный кит из списка не убирается: список, из которого исчезает выбранное, не отвечает
 * на вопрос «а что сейчас включено» — а это первое, зачем сюда заглядывают. Вместо этого
 * он подписан.
 *
 * Последним идёт возврат к конфигу запуска — тот же пункт, что закрывает меню ячейки. Он есть
 * и при единственном ките: выбор, записанный когда-то, снять больше нечем.
 */
export function createKitPaletteProvider(
  kits: Pick<KitsService, 'available'>,
  t: Translate,
  actions: KitActions
): PaletteItemProvider {
  return {
    id: KITS_PALETTE_PROVIDER_ID,
    provide(): PaletteItem[] {
      const items = kits.available().map(
        (kit): PaletteItem => ({
          id: `kits.use.${kit.id}`,
          title: t('palette.switch', { label: kit.label }),
          detail: kit.active
            ? t('palette.active')
            : t('palette.detail', { package: kit.package, version: kit.version }),
          run: () => actions.select(kit.id),
        })
      );
      // Последним: отказ от собственного выбора — не ещё один кит, и стоять среди них ему незачем.
      items.push({ id: 'kits.reset', title: t('palette.reset'), run: actions.reset });
      return items;
    },
  };
}

/** Действия переключателя: одни и те же у ячейки и у палитры. Не отвергаются. */
export interface KitActions {
  readonly select: (kitId: string) => Promise<void>;
  readonly reset: () => Promise<void>;
}

/**
 * Действия над службой, отказ которых доходит до человека словами.
 *
 * Отказать служба может: кит исчез между показом списка и щелчком (плагин выключили), выбор
 * не сохранился (хранилище недоступно). Щелчок, после которого ничего не произошло, неотличим
 * от неработающей кнопки, поэтому отказ уходит в `report`, а не в консоль.
 */
export function createKitActions(
  kits: Pick<KitsService, 'activate' | 'resetChoice'>,
  report: (error: unknown) => void
): KitActions {
  const guarded = async (action: () => Promise<void>): Promise<void> => {
    try {
      await action();
    } catch (error) {
      report(error);
    }
  };
  return {
    select: (kitId) => guarded(() => kits.activate(kitId)),
    reset: () => guarded(() => kits.resetChoice()),
  };
}

/**
 * Отказ принять кит — уведомлением, словарём плагина. Уведомлений нет (короткий состав,
 * тест) — в консоль: отказ не должен пропасть молча.
 */
function reportProblem(ctx: Pick<PluginContext, 'id' | 'services'>, problem: KitProblem): void {
  const notifications = ctx.services.get(NotificationsServiceToken);
  const params = {
    plugin: problem.pluginId ?? '',
    kit: problem.kitId ?? '',
    detail: problem.detail ?? '',
  };
  if (notifications === undefined) {
    console.warn(`[kits] кит плагина отвергнут: ${problem.code}`, params);
    return;
  }
  notifications.warning(pluginMessageKey(ctx.id, `problem.${problem.code}`), { params });
}

/**
 * Отказ переключения — уведомлением, словарём плагина. Уведомлений нет — в консоль.
 */
function reportSwitchFailure(ctx: Pick<PluginContext, 'id' | 'services'>, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  const notifications = ctx.services.get(NotificationsServiceToken);
  if (notifications === undefined) {
    console.error('[kits] кит не сменился', error);
    return;
  }
  notifications.error(pluginMessageKey(ctx.id, 'switch.failed'), { params: { detail } });
}

/**
 * Плагин китов.
 *
 * Служба создаётся при АКТИВАЦИИ: настройки и уведомления приходят из реестра служб, а реестр
 * есть только у контекста.
 */
export function createKitsPlugin(options: KitsPluginOptions): Plugin {
  return definePlugin({
    id: KITS_PLUGIN_ID,
    activate(ctx) {
      // Словарь — первым делом: им переводятся пункты палитры и уведомления об отказах китов.
      for (const [locale, messages] of Object.entries(KITS_MESSAGES)) {
        ctx.i18n.contribute(locale, messages);
      }

      // Настройки — из реестра, с запасным параметром для тестов. Отсутствие службы
      // не отказ: кит переключается, просто выбор не переживёт перезагрузку.
      const settings = options.settings ?? ctx.services.get(SettingsServiceToken);
      const service = createKitsService({
        sources: options.sources ?? [BUILTIN_KIT],
        settings,
        onProblem: (problem) => {
          reportProblem(ctx, problem);
        },
      });
      ctx.subscriptions.push(ctx.services.register(KitsCapability, service));
      // Умолчание объявляет тот, кто вносит настройку, и снимается оно вместе с ним: иначе
      // каждый потребитель дописывал бы свой `?? 'reformer-ui-kit'`, и они бы разъехались.
      if (settings !== undefined) {
        ctx.subscriptions.push(settings.registerDefault(KIT_SETTINGS_KEY, service.defaultId));
      }

      // Киты плагинов. Состав передаётся службе целиком на каждое изменение точки: вносит кит
      // плагин, поднявшийся раньше или позже этого, — порядок активации незначим.
      const syncContributed = (): void => {
        // Наблюдатель зовётся ВНУТРИ `contribute()` чужого плагина: исключение здесь уронило бы
        // его вклад, а не наш. Поэтому отказ ловится и пишется, но наружу не выходит.
        try {
          service.syncContributed(
            ctx.extensions.get(KitSourcePoint).map((contribution) => ({
              source: contribution.value,
              pluginId: contribution.pluginId,
            }))
          );
        } catch (error) {
          console.error('[kits] не удалось принять состав китов плагинов', error);
        }
      };
      syncContributed();
      ctx.subscriptions.push(ctx.extensions.observe(KitSourcePoint, syncContributed));

      const actions = createKitActions(service, (error) => {
        reportSwitchFailure(ctx, error);
      });
      const cell = createKitCellStore(service);
      ctx.subscriptions.push(
        cell,
        ctx.extensions.contribute(
          PanelPoint,
          {
            id: KITS_CELL_ID,
            slot: 'statusbar',
            titleKey: 'cell.title',
            Body: () =>
              createElement(KitCell, {
                store: cell,
                i18n: ctx.i18n,
                onSelect: (kitId) => {
                  void actions.select(kitId);
                },
                onReset: () => {
                  void actions.reset();
                },
              }),
          },
          { id: KITS_CELL_ID }
        ),
        ctx.extensions.contribute(
          PaletteItemsPoint,
          createKitPaletteProvider(service, (key, params) => ctx.i18n.t(key, params), actions),
          { id: KITS_PALETTE_PROVIDER_ID }
        )
      );
      // Подписки службы (настройки, пространства имён) — её собственные, и снять их обязан тот,
      // кто её завёл.
      ctx.subscriptions.push(service);
      // Каталог заказывается ЗДЕСЬ и НЕ ожидается. Ждать нельзя: `activate` только регистрирует,
      // а 864 кБ по сети задержали бы запуск всех остальных плагинов. Заказ на активации
      // означает, что каталог едет параллельно оболочке и успевает к выбору проекта — то есть
      // задолго до первого открытого файла формы.
      void service.whenReady();
    },
  });
}
