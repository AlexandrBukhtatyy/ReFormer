/**
 * Сборка {@link PluginContext} — единственное место, где платформа превращается в то,
 * что видит плагин.
 *
 * Модуль маленький, но несущий: именно здесь `pluginId` **связывается** с видом реестра
 * вкладов и с пространствами имён хранилища и секретов. Плагин получает уже связанные
 * объекты, поэтому подделать происхождение вклада или адрес хранилища ему нечем — не потому,
 * что это запрещено правилом, а потому, что в его API нет соответствующего параметра.
 *
 * Контекст создаётся **на каждую активацию заново**. Это то, что делает перезагрузку плагина
 * простой операцией: снять `subscriptions` прежнего контекста и построить новый, вместо того
 * чтобы вычищать состояние из общего.
 *
 * ## Чего здесь нет
 *
 * `workspace` — и не будет полем: на момент активации рабочей области ещё нет (проект
 * открывают позже), поэтому она приходит СЛУЖБОЙ (`DocumentsServiceToken`), которая
 * существует с запуска и без проекта отвечает `null` и отказом записи.
 *
 * `i18n`, наоборот, полем стал: словарь плагина существует ровно столько же, сколько его
 * активация, и регистрировать его больше некуда — раньше приёмник ИСКАЛСЯ структурно
 * (`plugins/<id>/messages.ts`: «появится штатный ctx.i18n — словарь уедет туда сам»).
 *
 * @module shell/platform/plugin/context
 */

import { createCapabilityAccess } from '@/shell/platform/primitives/capability';
import { createPermittedServices } from './permissions';
import type { CommandRegistry } from '@reformer/builder-plugin-api/internal';
import type { EventBus } from '@reformer/builder-plugin-api/internal';
import type { RootExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import { toDisposable } from '@reformer/builder-plugin-api/internal';
import type { PluginPermission, ServiceRegistry } from '@reformer/builder-plugin-api/internal';
import { FALLBACK_LOCALE, type RootI18nService } from '@/shell/platform/services/i18n/i18n';
import { type PluginI18n } from '@reformer/builder-plugin-api/internal';
import { createPluginStorage, createSecretStorage } from './storage';
import type { PluginStorageBackend, SecretSessionStore } from './storage';
import type { PluginContext } from '@reformer/builder-plugin-api/internal';

/**
 * Платформа, из которой собирается контекст. Одна на всё приложение, общая для всех плагинов.
 *
 * `extensions` — **корневой** реестр, а не вид: вид на него умеет делать только этот модуль,
 * и ровно поэтому плагину достаётся `forPlugin(id)`, а не то, что он попросит сам.
 */
export interface PluginContextDeps {
  readonly services: ServiceRegistry;
  /**
   * Права, подтверждённые ЭТОМУ плагину. Отсутствие — то же, что пустой список: привилегированные
   * службы ему не видны. Умолчание именно такое, потому что права даёт человек, а не забывчивость
   * вызывающего: контекст, собранный без них, обязан быть самым узким, а не самым широким.
   */
  readonly permissions?: readonly PluginPermission[];
  /**
   * Кто ОБЪЯВИЛ возможность — только ради текста отказа `capabilities.require`.
   *
   * Необязательна, и её отсутствие — названная деградация, а не поломка: отказ становится
   * короче («ни один плагин её не объявляет» вместо «объявляет плагин «kits»»). Знание это
   * есть у рантайма плагинов (он собирает декларации при регистрации), а не у реестра служб,
   * который знает занятые слоты, а не паспорта.
   */
  readonly capabilityProviders?: (capabilityId: string) => readonly string[];
  readonly extensions: RootExtensionRegistry;
  readonly commands: CommandRegistry;
  readonly events: EventBus;
  /** Постоянное хранилище. В бою — IndexedDB, в тестах — подставной или памятный. */
  readonly storage: PluginStorageBackend;
  /** Память сессии для секретов. Живёт столько же, сколько рантайм плагинов. */
  readonly secrets: SecretSessionStore;
  /**
   * Служба локализации — КОРЕНЬ, а не вид: вид на пространство имён плагина умеет делать
   * только этот модуль, ровно как с реестром вкладов.
   *
   * Необязательна, и отсутствие — названная деградация, а не поломка: контекст получает
   * словарь-пустышку, у которой `t` возвращает ключ. Это тот же ответ, который служба даёт
   * на промах, и видно его сразу — маркером в интерфейсе. Так собираются стенды, которым
   * локализация не нужна вовсе; настоящую передаёт запуск.
   */
  readonly i18n?: Pick<RootI18nService, 'forPlugin'>;
}

/**
 * Словарь-пустышка: отвечает МАРКЕРОМ ПРОМАХА, словарь принимает и забывает.
 *
 * Маркер — тот же и той же формы, что у настоящей службы на ненайденном ключе (`⟦id.key⟧`),
 * и это не подражание ради красоты: стенд без локализации обязан выглядеть как приложение
 * с недостающим переводом, а не как приложение с другим поведением. Верни он ключ как есть,
 * разница вылезла бы в первом же тесте, сравнивающем строку, — и обнаружилась бы как
 * «почему-то без скобок», а не как «локализации нет».
 */
function missingI18n(pluginId: string): PluginI18n {
  return {
    locale: FALLBACK_LOCALE,
    t: (key) => `⟦${pluginId}.${key}⟧`,
    contribute: () => {},
    onDidChangeLocale: () => toDisposable(() => {}),
  };
}

/**
 * Собирает контекст для одного плагина.
 *
 * `subscriptions` — свежий пустой массив на каждый вызов: он принадлежит этой активации
 * и освобождается при её завершении. Переиспользование массива между активациями означало бы,
 * что повторная активация складывает вклады поверх старых, а деактивация пытается снять
 * уже снятое.
 */
export function createPluginContext(pluginId: string, deps: PluginContextDeps): PluginContext {
  if (pluginId.trim() === '') {
    throw new Error('createPluginContext: идентификатор плагина не может быть пустым');
  }

  // Вид, суженный правами: привилегированные адреса отдаются только тому, кому их подтвердили
  // (`./permissions`). Сужается ОДИН объект, и от него же строится доступ к возможностям, —
  // иначе запертая служба осталась бы открытой через `ctx.capabilities`.
  const services = createPermittedServices(deps.services, {
    pluginId,
    granted: deps.permissions ?? [],
  });

  return {
    id: pluginId,
    services,
    // Вид на ТОТ ЖЕ реестр служб: своего хранилища у возможностей нет и не будет — см. решение
    // в шапке `primitives/capability`. Строка одна ровно потому, что дублировать нечего.
    capabilities: createCapabilityAccess(services, {
      ...(deps.capabilityProviders === undefined ? {} : { providers: deps.capabilityProviders }),
    }),
    extensions: deps.extensions.forPlugin(pluginId),
    // Вид реестра, а не сам реестр: команда обязана знать владельца, чтобы её заголовок
    // переводился словарём того, кто её внёс. Тем же приёмом, что у вкладов, — и по той же
    // причине: параметр забыли бы или подставили чужой.
    commands: deps.commands.forPlugin(pluginId),
    events: deps.events,
    i18n: deps.i18n?.forPlugin(pluginId) ?? missingI18n(pluginId),
    storage: createPluginStorage(pluginId, deps.storage),
    secrets: createSecretStorage(pluginId, { session: deps.secrets, backend: deps.storage }),
    subscriptions: [],
  };
}
