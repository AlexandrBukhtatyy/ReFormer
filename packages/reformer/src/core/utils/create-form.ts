/**
 * Фабричная функция для создания формы с правильной типизацией
 *
 * Решает проблему с типизацией конструктора GroupNode, который возвращает
 * Proxy (GroupNodeWithControls), но TypeScript не может это вывести автоматически.
 *
 * @group Utilities
 *
 * @example
 * ```typescript
 * // Вместо:
 * const form: GroupNodeWithControls<MyForm> = new GroupNode<MyForm>(config);
 *
 * // Используйте:
 * const form = createForm<MyForm>(config);
 * ```
 */

import { GroupNode } from '../nodes/group-node';
import type { GroupNodeWithControls, GroupNodeConfig, FormSchema } from '../types';

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
export function createForm<T>(config: GroupNodeConfig<T>): GroupNodeWithControls<T>;

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
export function createForm<T>(schema: FormSchema<T>): GroupNodeWithControls<T>;

/**
 * Реализация фабричной функции
 */
export function createForm<T>(
  schemaOrConfig: FormSchema<T> | GroupNodeConfig<T>
): GroupNodeWithControls<T> {
  return new GroupNode<T>(schemaOrConfig as GroupNodeConfig<T>);
}
