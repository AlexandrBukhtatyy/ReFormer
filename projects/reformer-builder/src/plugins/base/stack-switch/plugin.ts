/**
 * Плагин «переключатель сочетаний»: ячейка строки состояния и пункты палитры, которыми человек
 * меняет движок и кит.
 *
 * **Почему это плагин, а не ячейка оболочки.** Строка состояния держит у себя только то, что
 * принадлежит платформе: состояние рабочей области и локаль. Всё, что знает предметную область,
 * приходит вкладом (шапка `StatusBar`), а «на каком ките и движке я работаю» — знание именно
 * предметное. Отсюда же и возможность его убрать: организация, собравшая конструктор без выбора,
 * выключает плагин поправкой состава.
 *
 * **Почему не часть плагина китов.** Киты — платформа для всех стеков, а переключатель знает
 * ещё и про состав приложения. Живи он в китах, плагин китов узнал бы о профилях, а состав без
 * китов (`builder.base`) остался бы без переключателя движка.
 *
 * **Обе оси необязательны.** Служба профилей — обычная служба: приложение на той же оболочке
 * вправе её не давать. Киты — необязательная возможность (`requires.optional`). Плагин работает
 * с тем, что есть, и ничего не показывает, только когда нет обеих.
 *
 * ```text
 * extensions.contribute(PanelPoint)        ячейка «движок · кит» в слоте statusbar
 * extensions.contribute(PaletteItemsPoint) те же сочетания пунктами палитры
 * ```
 *
 * @module plugins/base/stack-switch/plugin
 */

import { createElement } from 'react';
import {
  ApplicationProfilesServiceToken,
  definePlugin,
  KitsCapability,
  NotificationsServiceToken,
  PaletteItemsPoint,
  PanelPoint,
  pluginMessageKey,
  PromptServiceToken,
  type PaletteItem,
  type PaletteItemProvider,
  type Plugin,
  type PluginContext,
  type Translate,
} from '@reformer/builder-plugin-api';
import type { Combination, SwitchState } from './combinations';
import {
  STACK_SWITCH_CELL_ID,
  STACK_SWITCH_PALETTE_PROVIDER_ID,
  STACK_SWITCH_PLUGIN_ID,
} from './contract';
import { STACK_SWITCH_MESSAGES } from './messages';
import { createSwitchStore } from './store';
import { applyCombination, resetToLaunch, type SwitchDeps } from './switching';
import { StatusCell } from './ui/StatusCell';

export { STACK_SWITCH_PLUGIN_ID };

/**
 * Пункты палитры «Сочетание: …» — по одному на сочетание.
 *
 * Заголовок собирается здесь, а не ключом: имена движка и кита приходят из конфига и из
 * дескриптора кита и переводу не подлежат, поэтому строка приходит готовой.
 *
 * Действующее сочетание из списка не убирается — список, из которого исчезает выбранное,
 * не отвечает на вопрос «а что сейчас включено». Но единственное сочетание не показывается
 * вовсе: пункт, который ничего не делает, в палитре лишний.
 *
 * Последним идёт возврат к конфигу запуска — тот же пункт, что закрывает меню ячейки.
 */
export function createCombinationPaletteProvider(
  state: () => SwitchState,
  select: (combination: Combination) => unknown,
  reset: () => unknown,
  t: Translate
): PaletteItemProvider {
  return {
    id: STACK_SWITCH_PALETTE_PROVIDER_ID,
    provide(): PaletteItem[] {
      const { combinations, resetRestarts } = state();
      if (combinations.length < 2) return [];
      const items = combinations.map((combination): PaletteItem => {
        const detail = combination.active
          ? t('palette.active')
          : combination.restarts
            ? t('palette.restarts')
            : undefined;
        return {
          id: `stack-switch.use.${combination.id}`,
          title: t('palette.switch', { label: combination.label }),
          ...(detail !== undefined ? { detail } : {}),
          run: () => select(combination),
        };
      });
      // Последним: отказ от собственного выбора — не ещё одно сочетание, и стоять среди них
      // ему незачем.
      items.push({
        id: 'stack-switch.reset',
        title: t('palette.reset'),
        ...(resetRestarts ? { detail: t('palette.restarts') } : {}),
        run: reset,
      });
      return items;
    },
  };
}

/**
 * Отказ переключения — уведомлением, словарём плагина. Уведомлений нет (короткий состав, тест)
 * — в консоль: отказ не должен пропасть молча.
 */
function reportFailure(ctx: Pick<PluginContext, 'id' | 'services'>, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  const notifications = ctx.services.get(NotificationsServiceToken);
  if (notifications === undefined) {
    console.error('[stack-switch] сочетание не сменилось', error);
    return;
  }
  notifications.error(pluginMessageKey(ctx.id, 'switch.failed'), { params: { detail } });
}

export function createStackSwitchPlugin(): Plugin {
  return definePlugin({
    id: STACK_SWITCH_PLUGIN_ID,
    activate(ctx) {
      for (const [locale, messages] of Object.entries(STACK_SWITCH_MESSAGES)) {
        ctx.i18n.contribute(locale, messages);
      }

      // Службы спрашиваются в момент обращения: кит и запросы выключаемы на ходу, а служба
      // профилей может отсутствовать вовсе.
      const profiles = () => ctx.services.get(ApplicationProfilesServiceToken);
      const store = createSwitchStore({ profiles, capabilities: ctx.capabilities });
      ctx.subscriptions.push(store);

      const deps: SwitchDeps = {
        pluginId: ctx.id,
        profiles,
        kits: () => ctx.services.get(KitsCapability),
        prompt: () => ctx.services.get(PromptServiceToken),
        report: (error) => {
          reportFailure(ctx, error);
        },
      };
      const select = (combination: Combination): Promise<void> =>
        applyCombination(deps, combination);
      const reset = (): Promise<void> => resetToLaunch(deps);

      ctx.subscriptions.push(
        ctx.extensions.contribute(
          PanelPoint,
          {
            id: STACK_SWITCH_CELL_ID,
            slot: 'statusbar',
            titleKey: 'cell.title',
            Body: () =>
              createElement(StatusCell, {
                store,
                i18n: ctx.i18n,
                onSelect: (combination) => {
                  void select(combination);
                },
                onReset: () => {
                  void reset();
                },
              }),
          },
          { id: STACK_SWITCH_CELL_ID }
        ),
        ctx.extensions.contribute(
          PaletteItemsPoint,
          createCombinationPaletteProvider(
            () => store.get(),
            select,
            reset,
            (key, params) => ctx.i18n.t(key, params)
          ),
          { id: STACK_SWITCH_PALETTE_PROVIDER_ID }
        )
      );
    },
  });
}
