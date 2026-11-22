/**
 * Привилегированные службы и вид реестра, который сверяет право перед тем, как их отдать.
 *
 * ## Что здесь принуждается
 *
 * Плагин видит платформу через `ctx.services` и `ctx.capabilities`, и оба — ВИДЫ на общий
 * реестр. Этот модуль сужает вид: адрес из {@link PRIVILEGED_SERVICES} отдаётся только тому,
 * кто объявил соответствующее право в манифесте и кому человек его подтвердил. Отказ — это
 * отсутствие объекта (`get` → `undefined`, `require` → исключение), а не совет не пользоваться.
 *
 * ## Почему не «плагин вежливо не зовёт»
 *
 * Потому что это ничего не значит: объявление, которое никто не проверяет, — ложное ощущение
 * границы, и ровно поэтому поля `permissions` в манифесте не было, пока не появилось вот это
 * место. Обратное тоже верно: имя права заводится ТОЛЬКО вместе с запираемой службой, иначе
 * в манифесте появилось бы слово без двери.
 *
 * ## Чего это не даёт
 *
 * Не песочницу. Плагин исполняется в том же realm, и код, который человек включил, дотянется
 * до чего угодно сам — граница доверия у нас одна, и она в другом месте: плагин включается
 * ЯВНО (`./catalog`). Права сужают ПОВЕРХНОСТЬ платформы: то, что оболочка подаёт плагину
 * сама, по адресу из контракта. Именно это и стоит сужать — остальное не в нашей власти.
 *
 * ## Регистрация тоже под правом
 *
 * Занять слот привилегированной службы без права нельзя. Иначе плагин, которому отказали
 * в сохранении, объявил бы СВОЙ `reformer.workspace.save` и стал бы тем, у кого соседи его
 * просят, — обход через подмену провайдера, а не через дверь.
 *
 * @module shell/platform/plugin/permissions
 */

import {
  PluginsCatalogCapability,
  WorkspaceResourcesCapability,
  WorkspaceSaveCapability,
  type PluginPermission,
  type ServiceRegistry,
  type ServiceToken,
} from '@reformer/builder-plugin-api/internal';
import type { Disposable } from '@reformer/builder-plugin-api/internal';

/**
 * Адрес службы → право, которое её открывает.
 *
 * Карта — единственное место, где «привилегированность» вообще существует: реестр о ней
 * не знает и знать не должен, иначе право пришлось бы протаскивать в каждый токен.
 */
export const PRIVILEGED_SERVICES: ReadonlyMap<string, PluginPermission> = new Map<
  string,
  PluginPermission
>([
  [WorkspaceSaveCapability.id, 'workspace.save'],
  [WorkspaceResourcesCapability.id, 'workspace.resources'],
  [PluginsCatalogCapability.id, 'plugins.manage'],
]);

/** Отказ по праву. Отдельный класс, чтобы интерфейс не разбирал текст сообщения. */
export class PluginPermissionError extends Error {
  readonly pluginId: string;
  readonly serviceId: string;
  readonly permission: PluginPermission;

  constructor(pluginId: string, serviceId: string, permission: PluginPermission) {
    super(
      `плагину «${pluginId}» не разрешено «${permission}», поэтому служба «${serviceId}» ему ` +
        'недоступна. Право объявляется полем «permissions» манифеста и подтверждается человеком'
    );
    this.name = 'PluginPermissionError';
    this.pluginId = pluginId;
    this.serviceId = serviceId;
    this.permission = permission;
  }
}

export interface PermittedServicesOptions {
  readonly pluginId: string;
  /** Права, подтверждённые ЭТОМУ плагину. Пусто — обычный случай, а не поломка. */
  readonly granted: readonly PluginPermission[];
}

/**
 * Вид на реестр, суженный правами плагина.
 *
 * Непривилегированные адреса проходят насквозь — их большинство, и платить за них проверкой
 * незачем. `onDidChange` тоже сквозной: событие несёт идентификатор и занятость слота, но
 * не сам объект, поэтому подписка ничего не выдаёт.
 */
export function createPermittedServices(
  services: ServiceRegistry,
  options: PermittedServicesOptions
): ServiceRegistry {
  const { pluginId, granted } = options;

  /** Право, которого не хватает для этого адреса; `undefined` — проходить можно. */
  const missing = (token: ServiceToken<unknown>): PluginPermission | undefined => {
    const required = PRIVILEGED_SERVICES.get(token.id);
    if (required === undefined || granted.includes(required)) return undefined;
    return required;
  };

  return {
    register<T>(token: ServiceToken<T>, impl: T): Disposable {
      const required = missing(token);
      if (required !== undefined) throw new PluginPermissionError(pluginId, token.id, required);
      return services.register(token, impl);
    },

    get<T>(token: ServiceToken<T>): T | undefined {
      return missing(token) === undefined ? services.get(token) : undefined;
    },

    require<T>(token: ServiceToken<T>): T {
      const required = missing(token);
      if (required !== undefined) throw new PluginPermissionError(pluginId, token.id, required);
      return services.require(token);
    },

    onDidChange(listener) {
      return services.onDidChange(listener);
    },
  };
}
