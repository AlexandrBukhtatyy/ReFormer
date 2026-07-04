/**
 * FormProxyBuilder - создание Proxy для типобезопасного доступа к полям формы
 *
 * Извлечён из GroupNode для улучшения разделения ответственностей (SRP).
 * Инкапсулирует всю логику создания Proxy-обёртки над GroupNode.
 *
 * @internal
 */

import type { FormNode } from '../nodes/form-node';
import type { FormProxy } from '../types/form-proxy';

/**
 * Интерфейс для объектов с методом getProxy (вложенные GroupNode)
 * @internal
 */
interface ProxyProvider<T> {
  getProxy(): FormProxy<T>;
}

/**
 * Проверка наличия метода getProxy
 * @internal
 */
function hasGetProxy<T>(obj: unknown): obj is ProxyProvider<T> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'getProxy' in obj &&
    typeof (obj as ProxyProvider<T>).getProxy === 'function'
  );
}

/**
 * Имя escape-hatch пространства имён «controls».
 *
 * `form.<name>` намеренно отдаёт приоритет собственным членам GroupNode
 * (`value`/`status`/`id`/`errors`/…), поэтому поле, названное любым из этих имён,
 * недостижимо через точечный доступ. `form.$.<name>` всегда возвращает узел поля
 * (или proxy вложенной группы), обходя это затенение.
 *
 * @internal
 */
const CONTROLS_NAMESPACE = '$';

/**
 * Создать Proxy для типобезопасного доступа к полям GroupNode
 *
 * Proxy обеспечивает:
 * - Доступ к полям через точечную нотацию (form.email, form.address.city)
 * - Приоритет собственных свойств GroupNode над полями
 * - Цепочку proxy для вложенных GroupNode
 * - Блокировку прямого присваивания полям (только через setValue/patchValue)
 *
 * @param target - GroupNode для которого создаётся proxy
 * @param fields - Map полей формы
 * @returns Типизированный Proxy
 *
 * @internal
 *
 * @example
 * ```typescript
 * const proxy = buildFormProxy(groupNode, groupNode._fields);
 * proxy.email.setValue('test@example.com');
 * console.log(proxy.email.value.value);
 * ```
 */
export function buildFormProxy<T>(
  target: FormNode<T>,
  fields: Map<keyof T, FormNode<unknown>>
): FormProxy<T> {
  // Ленивая (и закэшированная) запись controls-namespace: имя поля → узел / proxy вложенной группы.
  // Поля GroupNode фиксируются в конструкторе и далее не мутируются, поэтому запись безопасно
  // строить один раз.
  let controlsRecord: Record<string, unknown> | undefined;
  const getControlsRecord = (): Record<string, unknown> => {
    if (!controlsRecord) {
      const record: Record<string, unknown> = {};
      fields.forEach((field, key) => {
        // Вложенная группа → её proxy (цепочка form.$.address.city), иначе сам узел.
        record[key as string] = field && hasGetProxy(field) ? field.getProxy() : field;
      });
      controlsRecord = record;
    }
    return controlsRecord;
  };

  return new Proxy(target, {
    get: (proxyTarget, prop: string | symbol) => {
      // Приоритет 0: escape-hatch пространство имён form.$ — доступ ко ВСЕМ полям,
      // включая затенённые одноимёнными членами GroupNode (value/status/id/errors/…).
      if (prop === CONTROLS_NAMESPACE) {
        return getControlsRecord();
      }

      // Приоритет 1: Собственные свойства и методы GroupNode
      if (prop in proxyTarget) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (proxyTarget as any)[prop];
      }

      // Приоритет 2: Поля формы
      if (typeof prop === 'string' && fields.has(prop as keyof T)) {
        const field = fields.get(prop as keyof T);

        // Если поле - вложенный GroupNode, возвращаем его proxy для цепочки доступа
        // Например: form.address.city (address - GroupNode, city - FieldNode)
        if (field && hasGetProxy(field)) {
          return field.getProxy();
        }

        return field;
      }

      return undefined;
    },

    set: (proxyTarget, prop: string | symbol, value: unknown) => {
      if (typeof prop === 'string' && fields.has(prop as keyof T)) {
        if (import.meta.env.DEV) {
          console.warn(
            `[GroupNode] Cannot set field "${prop}" directly. Use .setValue() or .patchValue() instead.`
          );
        }
        return false;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (proxyTarget as any)[prop] = value;
      return true;
    },

    has: (proxyTarget, prop: string | symbol) => {
      if (prop === CONTROLS_NAMESPACE) {
        return true;
      }
      if (typeof prop === 'string' && fields.has(prop as keyof T)) {
        return true;
      }
      return prop in proxyTarget;
    },

    ownKeys: (proxyTarget) => {
      const nodeKeys = Reflect.ownKeys(proxyTarget);
      const fieldKeys = Array.from(fields.keys()) as (string | symbol)[];
      return [...new Set([...nodeKeys, ...fieldKeys])];
    },

    getOwnPropertyDescriptor: (proxyTarget, prop) => {
      if (typeof prop === 'string' && fields.has(prop as keyof T)) {
        return { enumerable: true, configurable: true };
      }
      return Reflect.getOwnPropertyDescriptor(proxyTarget, prop);
    },
  }) as FormProxy<T>;
}
