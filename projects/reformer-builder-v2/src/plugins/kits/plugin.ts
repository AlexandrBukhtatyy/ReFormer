/**
 * Плагин «киты»: сервис активного кита плюс переключение из палитры команд.
 *
 * **Почему это плагин, а не часть Host.** Дизайн-система — предметное знание: что такое
 * `InputField`, чем поле отличается от контейнера, какие компоненты нельзя рисовать вживую.
 * В платформе оно означало бы, что второй кит вносится правкой ядра. Граница проверяется
 * линтером: `src/plugins/**` не видит `@/shell/*` — только `@/sdk` и `@/lib`.
 *
 * **Что регистрируется и в каком порядке.** Порядок здесь не значит ничего (рантайм плагинов
 * не строит графа зависимостей), но состав значит:
 *
 * ```text
 * services.register(KitsServiceToken)   один ответ на «какой кит активен» для всех
 * settings.registerDefault(...)         умолчание объявляет тот, кто вносит настройку
 * extensions.contribute(PaletteItems)   переключение без перезагрузки — руками человека
 * ```
 *
 * Всё снимается вместе с плагином: `subscriptions` освобождает рантайм, и после выключения
 * ни сервиса, ни умолчания, ни пунктов палитры не остаётся.
 *
 * @module plugins/kits/plugin
 */

import {
  SettingsServiceToken,
  definePlugin,
  PaletteItemsPoint,
  type PaletteItem,
  type PaletteItemProvider,
  type Plugin,
} from '@/sdk';
import { BUILTIN_KIT } from './builtin';
import type { KitsSettings, Translate } from './host';
import {
  createKitsService,
  KIT_SETTINGS_KEY,
  KitsServiceToken,
  type KitSource,
  type KitsService,
} from './service';

/** Идентификатор плагина: пространство имён во всех реестрах и в словаре. */
export const KITS_PLUGIN_ID = 'kits';

/** Идентификатор поставщика пунктов палитры. Он же — адрес вклада в точке расширения. */
export const KITS_PALETTE_PROVIDER_ID = 'kits.switch';

export interface KitsPluginOptions {
  /**
   * Где живёт выбор. Необязательна и теперь ЗАПАСНАЯ: по умолчанию плагин берёт настройки
   * из реестра сервисов, как это обязан делать любой плагин из каталога.
   *
   * Параметр оставлен только для тестов, где реестра нет. В композицию он не передаётся:
   * встроенный плагин, получающий платформенные вещи параметром, оставлял бы путь внешнего
   * плагина непроверенным — а другого пути у внешнего нет, композиция о нём не знает
   * и передать ему ничего не может.
   */
  readonly settings?: KitsSettings;
  /** Перевод в пространстве имён плагина. Без него пункты палитры показывают маркер промаха. */
  readonly translate: Translate;
  /** Киты, между которыми можно выбирать. По умолчанию — один встроенный. */
  readonly sources?: readonly KitSource[];
}

/**
 * Пункты палитры «сменить кит» — по одному на установленный кит.
 *
 * Заголовок собирается ЗДЕСЬ, а не ключом: `PaletteItem.titleKey` разрешается словарём Host
 * (палитра переводит пункты им), а название кита живёт в его дескрипторе и переводу вообще
 * не подлежит. Поэтому строка приходит готовой — ровно тот случай, ради которого `title`
 * в контракте пункта и существует.
 *
 * Активный кит из списка не убирается: список, из которого исчезает выбранное, не отвечает
 * на вопрос «а что сейчас включено» — а это первое, зачем сюда заглядывают. Вместо этого
 * он подписан.
 */
export function createKitPaletteProvider(kits: KitsService, t: Translate): PaletteItemProvider {
  return {
    id: KITS_PALETTE_PROVIDER_ID,
    provide(): PaletteItem[] {
      return kits.available().map((kit) => ({
        id: `kits.use.${kit.id}`,
        title: t('palette.switch', { label: kit.label }),
        detail: kit.active
          ? t('palette.active')
          : t('palette.detail', { package: kit.package, version: kit.version }),
        run: () => kits.activate(kit.id),
      }));
    },
  };
}

/**
 * Плагин китов.
 *
 * Сервис создаётся ЗДЕСЬ, а не в `activate`: `activate` только регистрирует, а состояние,
 * которое сервис держит, обязано пережить перерегистрацию плагина не больше и не меньше,
 * чем сам плагин. Плюс так его можно отдать тесту, не поднимая ни одного реестра.
 */
export function createKitsPlugin(options: KitsPluginOptions): Plugin {
  // Служба создаётся при АКТИВАЦИИ, а не при объявлении плагина: настройки приходят
  // из реестра, а реестр есть только у контекста. Раньше служба заводилась здесь,
  // потому что настройки передавались параметром.
  let service: ReturnType<typeof createKitsService> | null = null;

  return definePlugin({
    id: KITS_PLUGIN_ID,
    activate(ctx) {
      // Настройки — из реестра, с запасным параметром для тестов. Отсутствие службы
      // не отказ: кит переключается, просто выбор не переживёт перезагрузку.
      const settings = options.settings ?? ctx.services.get(SettingsServiceToken);
      service = createKitsService({
        sources: options.sources ?? [BUILTIN_KIT],
        settings,
      });
      ctx.subscriptions.push(ctx.services.register(KitsServiceToken, service));
      // Умолчание объявляет тот, кто вносит настройку, и снимается оно вместе с ним: иначе
      // каждый потребитель дописывал бы свой `?? 'reformer-ui-kit'`, и они бы разъехались.
      if (settings !== undefined) {
        ctx.subscriptions.push(settings.registerDefault(KIT_SETTINGS_KEY, service.defaultId));
      }
      ctx.subscriptions.push(
        ctx.extensions.contribute(
          PaletteItemsPoint,
          createKitPaletteProvider(service, options.translate),
          { id: KITS_PALETTE_PROVIDER_ID }
        )
      );
      // Подписка сервиса на настройки — его собственная, и снять её обязан тот, кто её завёл.
      ctx.subscriptions.push({
        dispose: () => {
          service?.dispose();
        },
      });
      // Каталог заказывается ЗДЕСЬ и НЕ ожидается. Ждать нельзя: `activate` только регистрирует,
      // а 864 кБ по сети задержали бы запуск всех остальных плагинов. Не заказать тоже нельзя:
      // до каталога палитра пуста, а узнать о его приезде можно только подпиской, которой у
      // читателей сегодня нет (см. заметку о `onDidChange` в `service.ts`). Заказ на активации
      // означает, что каталог едет параллельно оболочке и успевает к выбору проекта — то есть
      // задолго до первого открытого файла формы.
      void service?.whenReady();
    },
  });
}
