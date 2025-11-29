/**
 * validateForm - утилита для валидации формы в соответствии со схемой
 *
 * Позволяет применить validation schema к форме без изменения
 * зарегистрированной схемы в ValidationRegistry.
 *
 * ## Использование
 *
 * - **Multi-step формы**: валидация только полей текущего шага
 * - **Условная валидация**: применение разных схем в зависимости от состояния
 * - **Временная валидация**: проверка без сохранения в реестр
 *
 * ## Как это работает
 *
 * 1. Создаётся временный ValidationRegistry для схемы
 * 2. Валидируются все FieldNode (field-level валидаторы из FieldConfig)
 * 3. Применяются ТОЛЬКО contextual validators из переданной схемы
 * 4. Временный реестр отменяется (не сохраняется в форму)
 *
 * ## Важно для multi-step форм
 *
 * Форма может быть создана С полной схемой валидации:
 * ```typescript
 * createForm({
 *   form: schema,
 *   validation: fullValidation, // Полная схема
 * });
 * ```
 *
 * При этом `validateForm(form, stepSchema)` будет применять
 * только валидаторы из `stepSchema`, игнорируя валидаторы
 * из других шагов.
 *
 * @see docs/multi-step-validation.md для подробной документации
 *
 * @module validation
 */

import { GroupNode } from '../nodes/group-node';
import { FieldNode } from '../nodes/field-node';
import { ArrayNode } from '../nodes/array-node';
import { FormNode } from '../nodes/form-node';
import type { ValidationSchemaFn, ValidatorRegistration, FormFields, FormValue } from '../types';
import { ValidationRegistry } from './validation-registry';
import { createFieldPath } from './field-path';

/**
 * Рекурсивно собирает все FieldNode из дерева формы
 *
 * Пропускает GroupNode и ArrayNode как узлы, но обходит их детей.
 * Это необходимо для validateForm, чтобы избежать триггера
 * contextual validators из validationRegistry вложенных групп.
 *
 * @param node - Корневой узел для обхода
 * @returns Массив всех FieldNode в дереве
 */
function collectAllFieldNodes(node: FormNode<FormValue>): FieldNode<FormValue>[] {
  if (node instanceof FieldNode) {
    return [node];
  }

  if (node instanceof GroupNode) {
    return Array.from(node.getAllFields()).flatMap(collectAllFieldNodes);
  }

  if (node instanceof ArrayNode) {
    // items приватный, используем публичный метод map()
    return node.map((item) => collectAllFieldNodes(item)).flat();
  }

  return [];
}

/**
 * Валидировать форму в соответствии с указанной схемой
 *
 * Функция создает временный контекст валидации, применяет валидаторы
 * из схемы и очищает контекст без сохранения в реестр.
 *
 * @param form - GroupNode для валидации
 * @param schema - Схема валидации (ValidationSchemaFn)
 * @returns Promise<boolean> - `true` если форма валидна, `false` если есть ошибки
 *
 * @example Multi-step форма: валидация текущего шага
 * ```typescript
 * const goToNextStep = async () => {
 *   const isValid = await validateForm(form, step1LoanValidation);
 *
 *   if (!isValid) {
 *     form.markAsTouched(); // Показать ошибки
 *     return false;
 *   }
 *
 *   setCurrentStep(2);
 *   return true;
 * };
 * ```
 *
 * @example Полная валидация перед submit
 * ```typescript
 * const handleSubmit = async () => {
 *   const isValid = await validateForm(form, fullValidationSchema);
 *
 *   if (isValid) {
 *     await form.submit(onSubmit);
 *   }
 * };
 * ```
 *
 * @example Условная валидация
 * ```typescript
 * const schema = isBusinessAccount
 *   ? businessValidation
 *   : personalValidation;
 *
 * const isValid = await validateForm(form, schema);
 * ```
 */
export async function validateForm<T extends FormFields>(
  form: GroupNode<T>,
  schema: ValidationSchemaFn<T>
): Promise<boolean> {
  //  Создаем временный реестр для этой валидации
  // Это изолирует валидацию от других форм и не затрагивает постоянный реестр формы
  const tempRegistry = new ValidationRegistry();

  // Начинаем регистрацию валидаторов в временном реестре
  tempRegistry.beginRegistration();

  let tempValidators: ValidatorRegistration[] = [];
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

    // Валидируем все FieldNode (field-level валидация)
    // ВАЖНО: Используем collectAllFieldNodes вместо getAllFields,
    // чтобы избежать вызова validate() на вложенных GroupNode/ArrayNode,
    // которые триггерят свой validationRegistry с полной схемой валидации
    const allFieldNodes = collectAllFieldNodes(form);
    await Promise.all(allFieldNodes.map((field) => field.validate()));

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
