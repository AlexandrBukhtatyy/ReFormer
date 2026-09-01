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
 * ## Чего здесь пока нет
 *
 * Контракт (plugin-and-shell.md, «PluginContext») перечисляет ещё `workspace` и `i18n`.
 * Оба — соседние работы Э4, и когда они появятся, добавляются они сюда: поле в
 * {@link PluginContextDeps}, поле в контексте, одна строка в сборке. Рантайм от этого
 * не меняется, потому что он про жизненный цикл, а не про содержимое контекста.
 *
 * @module host/plugin/context
 */

import type { CommandRegistry } from '@/shell/platform/primitives/command';
import type { EventBus } from '@/shell/platform/primitives/event';
import type { RootExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import type { ServiceRegistry } from '@/shell/platform/primitives/service';
import { createPluginStorage, createSecretStorage } from './storage';
import type { PluginStorageBackend, SecretSessionStore } from './storage';
import type { PluginContext } from './types';

/**
 * Платформа, из которой собирается контекст. Одна на всё приложение, общая для всех плагинов.
 *
 * `extensions` — **корневой** реестр, а не вид: вид на него умеет делать только этот модуль,
 * и ровно поэтому плагину достаётся `forPlugin(id)`, а не то, что он попросит сам.
 */
export interface PluginContextDeps {
  readonly services: ServiceRegistry;
  readonly extensions: RootExtensionRegistry;
  readonly commands: CommandRegistry;
  readonly events: EventBus;
  /** Постоянное хранилище. В бою — IndexedDB, в тестах — подставной или памятный. */
  readonly storage: PluginStorageBackend;
  /** Память сессии для секретов. Живёт столько же, сколько рантайм плагинов. */
  readonly secrets: SecretSessionStore;
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

  return {
    id: pluginId,
    services: deps.services,
    extensions: deps.extensions.forPlugin(pluginId),
    // Вид реестра, а не сам реестр: команда обязана знать владельца, чтобы её заголовок
    // переводился словарём того, кто её внёс. Тем же приёмом, что у вкладов, — и по той же
    // причине: параметр забыли бы или подставили чужой.
    commands: deps.commands.forPlugin(pluginId),
    events: deps.events,
    storage: createPluginStorage(pluginId, deps.storage),
    secrets: createSecretStorage(pluginId, { session: deps.secrets, backend: deps.storage }),
    subscriptions: [],
  };
}
