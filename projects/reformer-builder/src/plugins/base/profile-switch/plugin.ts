/**
 * Плагин выбора профиля: ячейка строки состояния и пункты палитры.
 *
 * Профиль — состав встроенных плагинов приложения; какие профили есть и между какими человек
 * может переключиться, знает служба профилей (`ApplicationProfilesServiceToken`). Плагин — её
 * интерфейс: без него выбора нет вовсе, и приложение так и решает, предлагать ли профиль
 * (`application/builder-application`).
 *
 * О формах, движках и китах плагин не знает ничего. Раньше он был «переключателем сочетаний»
 * и вёл две оси разом; выбор кита уехал к плагину китов вместе с самими китами.
 *
 * Плагин не импортирует `@/shell/*` — только `@reformer/builder-plugin-api` и библиотеки.
 *
 * @module plugins/base/profile-switch/plugin
 */

import { createElement } from 'react';
import {
  ApplicationProfilesServiceToken,
  definePlugin,
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
import { describeSwitch, type ProfileChoice, type SwitchState } from './choices';
import {
  PROFILE_SWITCH_CELL_ID,
  PROFILE_SWITCH_PALETTE_PROVIDER_ID,
  PROFILE_SWITCH_PLUGIN_ID,
} from './contract';
import { PROFILE_SWITCH_MESSAGES } from './messages';
import { applyChoice, resetToLaunch, type SwitchDeps } from './switching';
import { StatusCell } from './ui/StatusCell';

export { PROFILE_SWITCH_PLUGIN_ID };

/**
 * Пункты палитры «Профиль: …» — тот же список, что в ячейке.
 *
 * Один профиль — не выбор: пунктов тогда нет, как нет и списка у ячейки.
 */
export function createProfilePaletteProvider(
  state: () => SwitchState,
  select: (choice: ProfileChoice) => unknown,
  reset: () => unknown,
  t: Translate
): PaletteItemProvider {
  return {
    id: PROFILE_SWITCH_PALETTE_PROVIDER_ID,
    provide(): PaletteItem[] {
      const { choices, resetRestarts } = state();
      if (choices.length < 2) return [];
      const items = choices.map((choice): PaletteItem => {
        const detail = choice.active
          ? t('palette.active')
          : choice.restarts
            ? t('palette.restarts')
            : undefined;
        return {
          id: `profile-switch.use.${choice.id}`,
          title: t('palette.switch', { label: choice.label }),
          ...(detail !== undefined ? { detail } : {}),
          run: () => select(choice),
        };
      });
      items.push({
        id: 'profile-switch.reset',
        title: t('palette.reset'),
        ...(resetRestarts ? { detail: t('palette.restarts') } : {}),
        run: reset,
      });
      return items;
    },
  };
}

function reportFailure(ctx: Pick<PluginContext, 'id' | 'services'>, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  const notifications = ctx.services.get(NotificationsServiceToken);
  if (notifications === undefined) {
    console.error('[profile-switch] профиль не сменился', error);
    return;
  }
  notifications.error(pluginMessageKey(ctx.id, 'switch.failed'), { params: { detail } });
}

export function createProfileSwitchPlugin(): Plugin {
  return definePlugin({
    id: PROFILE_SWITCH_PLUGIN_ID,
    activate(ctx) {
      for (const [locale, messages] of Object.entries(PROFILE_SWITCH_MESSAGES)) {
        ctx.i18n.contribute(locale, messages);
      }

      const profiles = () => ctx.services.get(ApplicationProfilesServiceToken);
      // Профиль фиксируется при сборке приложения и до перезагрузки не меняется, поэтому
      // состояние считается на каждый вопрос заново — подписываться не на что.
      const state = (): SwitchState => describeSwitch(profiles());

      const deps: SwitchDeps = {
        pluginId: ctx.id,
        profiles,
        prompt: () => ctx.services.get(PromptServiceToken),
        report: (error) => {
          reportFailure(ctx, error);
        },
      };
      const select = (choice: ProfileChoice): Promise<void> => applyChoice(deps, choice);
      const reset = (): Promise<void> => resetToLaunch(deps);

      ctx.subscriptions.push(
        ctx.extensions.contribute(
          PanelPoint,
          {
            id: PROFILE_SWITCH_CELL_ID,
            slot: 'statusbar',
            titleKey: 'cell.title',
            Body: () =>
              createElement(StatusCell, {
                state: state(),
                i18n: ctx.i18n,
                onSelect: (choice) => {
                  void select(choice);
                },
                onReset: () => {
                  void reset();
                },
              }),
          },
          { id: PROFILE_SWITCH_CELL_ID }
        ),
        ctx.extensions.contribute(
          PaletteItemsPoint,
          createProfilePaletteProvider(state, select, reset, (key, params) =>
            ctx.i18n.t(key, params)
          ),
          { id: PROFILE_SWITCH_PALETTE_PROVIDER_ID }
        )
      );
    },
  });
}
