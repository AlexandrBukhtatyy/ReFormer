/**
 * validateForm - утилита для валидации формы в соответствии со схемой
 *
 * Позволяет применить validation schema к форме без изменения
 * зарегистрированной схемы в ValidationRegistry.
 *
 * Используется для:
 * - Валидации отдельных шагов multi-step форм
 * - Условной валидации
 * - Временной валидации без изменения состояния
 */

import type { GroupNode } from '../nodes/group-node';
import type { ValidationSchemaFn } from '../types';
import { ValidationRegistry } from './validation-registry';
import { createFieldPath } from './field-path';

/**
 * Валидировать форму в соответствии с указанной схемой
 *
 * Функция создает временный контекст валидации, применяет валидаторы
 * из схемы и очищает контекст без сохранения в реестр.
 *
 * @param form - GroupNode для валидации
 * @param schema - Схема валидации
 * @returns Promise<boolean> - true если форма валидна
 *
 * @example
 * ```typescript
 * // Валидация отдельного шага
 * const isValid = await validateForm(form, step1ValidationSchema);
 *
 * if (isValid) {
 *   // Переход на следующий шаг
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Валидация полной формы
 * const isValid = await validateForm(form, fullValidationSchema);
 *
 * if (isValid) {
 *   await form.submit(onSubmit);
 * }
 * ```
 */
export async function validateForm<T extends Record<string, any>>(
  form: GroupNode<T>,
  schema: ValidationSchemaFn<T>
): Promise<boolean> {
  // ✅ Создаем временный реестр для этой валидации
  // Это изолирует валидацию от других форм и не затрагивает постоянный реестр формы
  const tempRegistry = new ValidationRegistry();

  // Начинаем регистрацию валидаторов в временном реестре
  tempRegistry.beginRegistration();

  let tempValidators: any[] = [];
  let cancelled = false;

  try {
    // Регистрируем валидаторы из схемы
    // schema() будет использовать tempRegistry через getCurrent() из context stack
    const path = createFieldPath<T>();
    schema(path);

    // Получаем валидаторы БЕЗ сохранения в реестр
    const context = tempRegistry.getCurrentContext();
    tempValidators = context?.getValidators() || [];

    // Отменяем регистрацию (не сохраняем в реестр формы)
    tempRegistry.cancelRegistration();
    cancelled = true;

    // Очищаем текущие ошибки полей
    form.clearErrors();

    // Валидируем все поля (field-level валидация)
    await Promise.all(Array.from(form.getAllFields()).map((field) => field.validate()));

    // Применяем contextual validators
    if (tempValidators.length > 0) {
      await form.applyContextualValidators(tempValidators);
    }

    // Проверяем результат
    return form.valid.value;
  } catch (error) {
    // В случае ошибки отменяем регистрацию только если еще не отменили
    if (!cancelled) {
      tempRegistry.cancelRegistration();
    }
    throw error;
  }
}
