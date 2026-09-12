/**
 * Capability — это токен службы плюс версия. Второго реестра здесь НЕТ.
 *
 * ## Решение: capability живёт в {@link ServiceRegistry}
 *
 * Соблазн завести `CapabilityRegistry` рядом со службами выглядит естественным ровно до того
 * мига, когда начинаешь выписывать его содержимое: ключ — строка, значение — одна реализация,
 * повторная регистрация — конфликт, снятие — через `dispose`. Это буквально реестр служб,
 * переписанный вторым экземпляром. А цена дубликата известна заранее и записана в шапке
 * `sdk/index.ts`: два ключа на одну вещь расходятся молча, и «служба есть, но capability
 * не находится» становится обычным состоянием.
 *
 * Поэтому {@link Capability} РАСШИРЯЕТ `ServiceToken`: его можно передать в `services.register`
 * и `services.get` без всякого преобразования, а {@link CapabilityAccess} — это ВИД на тот же
 * реестр, а не своё хранилище. Решение зафиксировано в плане v4 (пункт 1.2.6).
 *
 * ## Что версия добавляет, а чего не добавляет
 *
 * Версия — это ДЕКЛАРАЦИЯ, и проверяется она до исполнения чужого кода: резолвер сверяет
 * `requires` манифеста с тем, что объявили провайдеры (`application/resolver/capability-resolver`),
 * и каталог плагинов отказывает в загрузке, если обязательное требование не выполнено.
 *
 * В РАНТАЙМЕ версии нет и быть не может: реестр служб хранит реализацию, а не её паспорт,
 * и `services.get(cap)` отвечает «слот занят», а не «занят версией 1.2.0». Отсюда правило,
 * которое надо понимать буквально: **версия проверяется по декларациям, а факт регистрации —
 * по реестру**. Именно поэтому рантайм плагинов сверяет, что объявленное в `provides`
 * действительно зарегистрировано к концу `activate` (`plugin/registry`): иначе резолвер верил бы
 * манифесту, а реестр молчал бы.
 *
 * @module shell/platform/primitives/capability
 */

import type { Disposable } from '@reformer/builder-plugin-api/internal';
import { toDisposable } from '@reformer/builder-plugin-api/internal';
import { parseRange, parseVersion, satisfiesRange } from '@reformer/builder-plugin-api/internal';
import type { ServiceRegistry, ServiceToken } from './service';

/**
 * Токен службы с объявленной версией контракта.
 *
 * Расширение, а не обёртка: всё, что принимает `ServiceToken`, принимает и capability.
 */
export interface Capability<T> extends ServiceToken<T> {
  /** Версия контракта: три числа, `1.0.0`. Диапазоны здесь недопустимы — это объявление. */
  readonly version: string;
}

/** Объявление «я даю такую-то возможность такой-то версии». Форма поля `provides` манифеста. */
export interface CapabilityDeclaration {
  readonly id: string;
  readonly version: string;
}

/** Требование «мне нужна такая-то возможность в таком-то диапазоне». Форма поля `requires`. */
export interface CapabilityRequirement {
  readonly id: string;
  /** Диапазон в записи `primitives/semver`: `^1`, `~1.2`, `>=1.2.3`, `1.x`, `*`. */
  readonly range: string;
}

/** Кто именно объявил возможность. `by` — идентификатор плагина, и он нужен диагностике. */
export interface CapabilityProvider extends CapabilityDeclaration {
  readonly by: string;
}

/**
 * Объявляет capability.
 *
 * Проверки — в момент объявления, а не в момент использования, по той же причине, что
 * у `defineService` и `definePlugin`: пустой идентификатор превратил бы диагностику
 * в «возможность «» не предоставлена», а диапазон вместо версии (`^1` в поле `version`)
 * сделал бы сравнение бессмысленным, причём молча — `satisfies('^1', '^1')` это `false`.
 */
export function defineCapability<T>(spec: CapabilityDeclaration): Capability<T> {
  if (spec.id.trim() === '') {
    throw new Error('defineCapability: идентификатор возможности не может быть пустым');
  }
  if (parseVersion(spec.version) === undefined) {
    throw new Error(
      `defineCapability: «${spec.id}» объявляет версию «${spec.version}», а нужна версия вида ` +
        '«1.0.0». Диапазон здесь недопустим: это объявление того, что есть, а не требование ' +
        'к чужому, а пререлизы утилита версий не поддерживает (см. primitives/semver)'
    );
  }
  return Object.freeze({ id: spec.id.trim(), version: spec.version.trim() });
}

/**
 * Удовлетворяет ли объявление требованию.
 *
 * Неразбираемый диапазон даёт `false`: требование, которое нельзя прочитать, не выполнено
 * ничем. Разбор манифеста отвергает такое требование раньше и с внятным текстом — эта
 * функция всего лишь не делает вид, что понимает написанное.
 */
export function meetsRequirement(
  declaration: CapabilityDeclaration,
  requirement: CapabilityRequirement
): boolean {
  if (declaration.id !== requirement.id) return false;
  const version = parseVersion(declaration.version);
  const range = parseRange(requirement.range);
  if (version === undefined || range === undefined) return false;
  return satisfiesRange(version, range);
}

/**
 * Вид на реестр служб в терминах capability — то, что получает плагин как `ctx.capabilities`.
 *
 * Три метода отвечают на три разных вопроса, и подменять один другим нельзя:
 * «возьму, если есть» (`get`), «без этого мне нечего делать» (`require`), «скажи, когда
 * появится» (`observe`).
 */
export interface CapabilityAccess {
  /** `undefined` — возможности нет. Вызывающий обязан деградировать, а не падать. */
  get<T>(cap: Capability<T>): T | undefined;
  /**
   * Бросает, если возможности нет, — с текстом, называющим и требование, и того, кто мог бы
   * его удовлетворить.
   *
   * Годится только там, где отсутствие возможности и есть отказ операции: внутри команды,
   * обработчика, тела панели. В `activate` его звать нельзя — порядок активации ничего
   * не значит, и провайдер имеет полное право подняться позже (см. `plugin/types`).
   */
  require<T>(cap: Capability<T>): T;
  /**
   * Сообщает о появлении и об исчезновении реализации.
   *
   * Зовёт обработчик СРАЗУ с текущим значением (`undefined`, если возможности нет), и это
   * решение, а не побочный эффект: наблюдатель почти всегда рисует состояние, и без
   * немедленного вызова каждый его потребитель писал бы `get` плюс `observe` — две строки,
   * между которыми помещается гонка.
   */
  observe<T>(cap: Capability<T>, listener: (impl: T | undefined) => void): Disposable;
}

export interface CapabilityAccessOptions {
  /**
   * Кто ОБЪЯВИЛ эту возможность — для сообщения об отказе `require`.
   *
   * Реестр служб такого вопроса не понимает: он знает занятые слоты, а не декларации. Поэтому
   * подсказку даёт тот, у кого декларации есть, — рантайм плагинов. Без неё отказ всё равно
   * внятен, просто короче: «никто не предоставил» вместо «объявляет плагин «kits», включите его».
   */
  readonly providers?: (capabilityId: string) => readonly string[];
}

/** Собирает вид на реестр. Хранилища у вида своего нет — всё читается из `services`. */
export function createCapabilityAccess(
  services: ServiceRegistry,
  options?: CapabilityAccessOptions
): CapabilityAccess {
  const hint = (cap: Capability<unknown>): string => {
    const providers = options?.providers?.(cap.id) ?? [];
    if (providers.length === 0) {
      return 'ни один плагин её не объявляет — возможно, нужный плагин не установлен';
    }
    return (
      `её объявляет ${providers.length === 1 ? 'плагин' : 'плагины'} ` +
      `${providers.map((id) => `«${id}»`).join(', ')} — проверьте, включён ли он и поднялся ли`
    );
  };

  return {
    get<T>(cap: Capability<T>): T | undefined {
      return services.get(cap);
    },

    require<T>(cap: Capability<T>): T {
      const impl = services.get(cap);
      if (impl === undefined) {
        throw new Error(
          `возможность «${cap.id}» версии ${cap.version} не предоставлена: ${hint(cap)}`
        );
      }
      return impl;
    },

    observe<T>(cap: Capability<T>, listener: (impl: T | undefined) => void): Disposable {
      const deliver = (): void => listener(services.get(cap));
      const subscription = services.onDidChange((event) => {
        if (event.id === cap.id) deliver();
      });
      deliver();
      // Собственный `Disposable`, а не подписка реестра: так вызывающий не может снять чужую,
      // а повторное освобождение остаётся безвредным (`toDisposable` одноразов).
      return toDisposable(() => subscription.dispose());
    },
  };
}
