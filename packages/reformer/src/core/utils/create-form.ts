/**
 * Фабричная функция для создания формы с правильной типизацией
 *
 * Это рекомендуемый способ создания форм в ReFormer v2.0+.
 * Создаёт GroupNode и возвращает его Proxy для типобезопасного доступа к полям.
 *
 * @group Utilities
 *
 * @example
 * ```typescript
 * // Рекомендуемый способ:
 * const form = createForm<MyForm>(config);
 * form.email.setValue('test@mail.com');  // Типобезопасный доступ к полям
 *
 * // Если нужен именно GroupNode instance:
 * const groupNode = new GroupNode<MyForm>(config);
 * const proxy = groupNode.getProxy();  // Явно получаем Proxy
 * ```
 */

import { GroupNode } from '../nodes/group-node';
import type { FormProxy, GroupNodeConfig, FormSchema } from '../types';

/**
 * Создать форму с полной конфигурацией (form, behavior, validation)
 *
 * @group Utilities
 *
 * @param config - Конфигурация формы с полями, поведением и валидацией
 * @returns Типизированная форма с Proxy-доступом к полям
 *
 * @example
 * ```typescript
 * const form = createForm<UserForm>({
 *   form: {
 *     email: { value: '', component: Input },
 *     password: { value: '', component: Input },
 *   },
 *   validation: (path) => {
 *     required(path.email);
 *     email(path.email);
 *     required(path.password);
 *     minLength(path.password, 8);
 *   },
 * });
 *
 * // TypeScript знает о полях:
 * form.email.setValue('test@mail.com');
 * ```
 */
export function createForm<T>(config: GroupNodeConfig<T>): FormProxy<T>;

/**
 * Создать форму только со схемой полей (обратная совместимость)
 *
 * @param schema - Схема полей формы
 * @returns Типизированная форма с Proxy-доступом к полям
 *
 * @example
 * ```typescript
 * const form = createForm<UserForm>({
 *   email: { value: '', component: Input },
 *   password: { value: '', component: Input },
 * });
 * ```
 */
export function createForm<T>(schema: FormSchema<T>): FormProxy<T>;

/**
 * Реализация фабричной функции
 */
export function createForm<T>(schemaOrConfig: FormSchema<T> | GroupNodeConfig<T>): FormProxy<T> {
  const groupNode = new GroupNode<T>(schemaOrConfig as GroupNodeConfig<T>);
  return groupNode.getProxy();
}
