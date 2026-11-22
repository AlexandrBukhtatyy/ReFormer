/**
 * Реестр сервисов — реализация слотов, объявленных контрактом плагинов.
 *
 * Сам токен (`ServiceToken`, `defineService`) и контракт реестра живут в пакете
 * `@reformer/builder-plugin-api`: плагин объявляет службы и берёт их из контекста, а вот
 * ЗАВОДИТЬ реестр — дело оболочки, и отдавать эту возможность в контракт незачем.
 *
 * Решения про сам слот — почему токен, а не строка, и почему `require` только для Host —
 * записаны там же, рядом с объявлением.
 *
 * @module shell/platform/primitives/service
 */

import {
  toDisposable,
  type Disposable,
  type ServiceChange,
  type ServiceRegistry,
  type ServiceToken,
} from '@reformer/builder-plugin-api/internal';

/**
 * Создаёт реестр сервисов.
 *
 * ## Решение: повторная регистрация занятого токена — ошибка
 *
 * Контракт молчал; выбрано «бросать», а не «заменять» и не «игнорировать».
 *
 * **Почему не заменять.** Тогда действующая реализация зависела бы от порядка активации
 * плагинов, а Э4 требует ровно обратного: «порядок активации ничего не значит», и правило
 * приёмки — активировать плагины в обратном порядке и получить то же поведение. Молчаливая
 * замена сделала бы этот тест невыполнимым по построению.
 *
 * **Почему не игнорировать.** Второй регистрирующий считал бы, что его реализация работает,
 * а `get` отдавал бы чужую. Отказ проявился бы далеко от места ошибки и выглядел бы как
 * «сервис ведёт себя не так, как написано в этом файле» — самая дорогая в отладке форма.
 *
 * **Почему бросать безопасно.** Слот освобождается через `dispose()`, поэтому осмысленная
 * замена выразима: снять прежнюю регистрацию и зарегистрировать заново — именно это делает
 * перезагрузка плагина, освобождая `subscriptions` при деактивации. А конфликт двух плагинов
 * за один токен — это конфликт конфигурации, который должен быть виден сразу и по имени
 * токена, а не разбираться потом по симптомам. Не дать активации плагина уронить приложение —
 * задача рантайма плагинов (Э4), который вызывает `activate` в своём контуре обработки ошибок.
 */
export function createServiceRegistry(): ServiceRegistry {
  const impls = new Map<string, unknown>();
  const listeners = new Set<(event: ServiceChange) => void>();

  const notify = (id: string, present: boolean): void => {
    // Копия набора: подписчик вправе отписаться прямо в обработчике, и обход живого набора
    // в этот момент пропустил бы соседа.
    for (const listener of [...listeners]) {
      try {
        listener({ id, present });
      } catch (error) {
        console.error(`[services] подписчик на «${id}» упал`, error);
      }
    }
  };

  return {
    register<T>(token: ServiceToken<T>, impl: T): Disposable {
      if (impls.has(token.id)) {
        throw new Error(
          `сервис «${token.id}» уже зарегистрирован. Один токен — одна реализация: ` +
            'освободите прежнюю регистрацию через dispose() или объявите точку расширения, ' +
            'если реализаций должно быть несколько'
        );
      }
      impls.set(token.id, impl);
      notify(token.id, true);

      // Снимать по id, не сверяя реализацию, безопасно: toDisposable одноразов, а занятый
      // слот повторно занять нельзя — значит устаревший dispose() не может снести чужую
      // регистрацию, пришедшую после освобождения.
      return toDisposable(() => {
        impls.delete(token.id);
        notify(token.id, false);
      });
    },

    get<T>(token: ServiceToken<T>): T | undefined {
      return impls.get(token.id) as T | undefined;
    },

    require<T>(token: ServiceToken<T>): T {
      if (!impls.has(token.id)) {
        throw new Error(
          `сервис «${token.id}» не зарегистрирован. require предназначен только для сервисов ` +
            'Host, которые есть всегда; для сервиса плагина используйте get и обработайте ' +
            'отсутствие как штатную деградацию'
        );
      }
      return impls.get(token.id) as T;
    },

    onDidChange(listener: (event: ServiceChange) => void): Disposable {
      listeners.add(listener);
      return toDisposable(() => {
        listeners.delete(listener);
      });
    },
  };
}
