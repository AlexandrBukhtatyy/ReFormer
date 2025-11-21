/**
 * ProxyBuilder - создание Proxy для типобезопасного доступа к полям GroupNode
 *
 * Извлечено из GroupNode для соблюдения SRP (Single Responsibility Principle).
 * Отвечает только за создание Proxy с расширенной поддержкой операций.
 *
 * @template T Тип формы (объект)
 *
 * @example
 * ```typescript
 * const fieldRegistry = new FieldRegistry<FormType>();
 * const proxyBuilder = new ProxyBuilder(fieldRegistry);
 * const proxy = proxyBuilder.build(groupNode);
 *
 * // Теперь можно обращаться к полям напрямую:
 * console.log(proxy.email.value);
 * console.log('email' in proxy); // true
 * ```
 */

import type { GroupNode } from '../group-node';
import type { GroupNodeWithControls } from '../../types/group-node-proxy';
import type { FieldRegistry } from './field-registry';
import type { FormFields, FormValue } from '../../types';

/**
 * Строитель Proxy для GroupNode
 *
 * Создает Proxy с поддержкой:
 * - get: Прямой доступ к полям через точечную нотацию
 * - set: Предупреждение о попытке прямой установки полей
 * - has: Проверка существования поля ('email' in form)
 * - ownKeys: Перечисление всех ключей (Object.keys(form))
 * - getOwnPropertyDescriptor: Получение дескрипторов полей
 *
 * @template T Тип формы (объект)
 */
export class ProxyBuilder<T> {
  /**
   * @param fieldRegistry - Реестр полей для доступа к коллекции
   */
  constructor(private fieldRegistry: FieldRegistry<T>) {}

  /**
   * Создать Proxy для GroupNode
   *
   * Proxy позволяет обращаться к полям формы напрямую:
   * - form.email вместо form.fields.get('email')
   * - form.address.city вместо form.fields.get('address').fields.get('city')
   *
   * @param target - GroupNode для которого создается Proxy
   * @returns Proxy с типобезопасным доступом к полям
   *
   * @example
   * ```typescript
   * const proxy = proxyBuilder.build(groupNode);
   *
   * // Доступ к полям
   * console.log(proxy.email.value); // Работает!
   * console.log(proxy.name.value);  // Работает!
   *
   * // Доступ к методам GroupNode
   * await proxy.validate(); // Работает!
   * proxy.markAsTouched();  // Работает!
   *
   * // Проверка существования
   * if ('email' in proxy) { ... }
   *
   * // Перечисление ключей
   * Object.keys(proxy); // ['email', 'name', ...]
   * ```
   */
  build(target: GroupNode<T>): GroupNodeWithControls<T> {
    return new Proxy(target, {
      /**
       * Get trap: Перехват доступа к свойствам
       *
       * Приоритет:
       * 1. Собственные свойства и методы GroupNode (validate, setValue и т.д.)
       * 2. Поля формы из fieldRegistry
       * 3. undefined для несуществующих свойств
       */
      get: (target, prop: string | symbol) => {
        // Приоритет 1: Собственные свойства и методы GroupNode
        // Это важно, чтобы методы validate(), setValue() и т.д. работали корректно
        if (prop in target) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (target as any)[prop];
        }

        // Приоритет 2: Поля формы
        // Используем fieldRegistry для типобезопасного доступа
        if (typeof prop === 'string' && this.fieldRegistry.has(prop as keyof T)) {
          return this.fieldRegistry.get(prop as keyof T);
        }

        // Fallback для несуществующих свойств
        return undefined;
      },

      /**
       * Set trap: Перехват установки свойств
       *
       * Запрещает прямую установку значений полей через form.email = value
       * Пользователь должен использовать form.email.setValue(value) или form.setValue({...})
       */
      set: (target, prop: string | symbol, value: unknown) => {
        // Запретить прямое изменение полей
        if (typeof prop === 'string' && this.fieldRegistry.has(prop as keyof T)) {
          if (import.meta.env.DEV) {
            console.warn(
              `[GroupNode] Cannot set field "${prop}" directly. Use .setValue() or .patchValue() instead.\n` +
                `Example: form.setValue({ ${prop}: ${JSON.stringify(value)} })`
            );
          }
          return false;
        }

        // Разрешить установку других свойств
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (target as any)[prop] = value;
        return true;
      },

      /**
       * Has trap: Перехват оператора 'in'
       *
       * Позволяет проверять существование полей:
       * if ('email' in form) { ... }
       */
      has: (target, prop: string | symbol) => {
        // Проверяем наличие в полях
        if (typeof prop === 'string' && this.fieldRegistry.has(prop as keyof T)) {
          return true;
        }

        // Проверяем наличие в самом объекте
        return prop in target;
      },

      /**
       * OwnKeys trap: Перехват Object.keys() / Object.getOwnPropertyNames()
       *
       * Возвращает объединенный список:
       * - Ключей самого GroupNode
       * - Ключей полей из fieldRegistry
       */
      ownKeys: (target) => {
        const nodeKeys = Reflect.ownKeys(target);
        const fieldKeys = Array.from(this.fieldRegistry.keys()) as (string | symbol)[];
        // Используем Set для удаления дубликатов
        return [...new Set([...nodeKeys, ...fieldKeys])];
      },

      /**
       * GetOwnPropertyDescriptor trap: Перехват Object.getOwnPropertyDescriptor()
       *
       * Возвращает дескриптор свойства для полей и свойств GroupNode
       * Важно для корректной работы Object.keys() и других рефлексивных операций
       */
      getOwnPropertyDescriptor: (target, prop) => {
        // Дескриптор для полей формы
        if (typeof prop === 'string' && this.fieldRegistry.has(prop as keyof T)) {
          return {
            enumerable: true, // Поле должно быть перечисляемым
            configurable: true, // Поле может быть удалено
            // Не указываем writable, т.к. это accessor property через get/set traps
          };
        }

        // Дескриптор для свойств самого объекта
        return Reflect.getOwnPropertyDescriptor(target, prop);
      },
    }) as GroupNodeWithControls<T>;
  }
}
