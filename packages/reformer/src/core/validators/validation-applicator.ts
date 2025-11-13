/**
 * Применение валидаторов к форме
 *
 * Извлечено из GroupNode для соблюдения SRP (Single Responsibility Principle).
 * Отвечает только за логику применения валидаторов к полям формы.
 *
 * @template T Тип формы
 *
 * @example
 * ```typescript
 * class GroupNode {
 *   private readonly validationApplicator = new ValidationApplicator(this);
 *
 *   async applyContextualValidators(validators: ValidatorRegistration[]) {
 *     await this.validationApplicator.apply(validators);
 *   }
 * }
 * ```
 */

import type { GroupNode } from '../nodes/group-node';
import type { FieldNode } from '../nodes/field-node';
import { ValidationContextImpl, TreeValidationContextImpl } from './validation-context';

/**
 * Type guard для проверки, является ли узел FieldNode
 */
function isFieldNode(value: any): value is FieldNode<any> {
  return value && typeof value === 'object' && 'validators' in value && 'asyncValidators' in value;
}

/**
 * Класс для применения валидаторов к форме
 *
 * Выполняет:
 * - Группировку валидаторов по полям
 * - Фильтрацию по условиям (condition)
 * - Применение sync/async валидаторов к FieldNode
 * - Применение tree валидаторов (кросс-полевая валидация)
 *
 * @template T Тип формы (объект)
 */
export class ValidationApplicator<T extends Record<string, any>> {
  private readonly form: GroupNode<T>;

  constructor(form: GroupNode<T>) {
    this.form = form;
  }

  /**
   * Применить валидаторы к полям формы
   *
   * Этапы применения:
   * 1. Разделение валидаторов на field и tree
   * 2. Применение field валидаторов (sync/async)
   * 3. Применение tree валидаторов (кросс-полевая валидация)
   *
   * @param validators Зарегистрированные валидаторы
   */
  async apply(validators: any[]): Promise<void> {
    // 1. Группировка валидаторов
    const { validatorsByField, treeValidators } = this.groupValidators(validators);

    // 2. Применение field валидаторов
    await this.applyFieldValidators(validatorsByField);

    // 3. Применение tree валидаторов
    this.applyTreeValidators(treeValidators);
  }

  /**
   * Группировка валидаторов по типам
   *
   * Разделяет валидаторы на:
   * - Field validators (sync/async) - группируются по fieldPath
   * - Tree validators - применяются ко всей форме
   *
   * @param validators Все зарегистрированные валидаторы
   * @returns Сгруппированные валидаторы
   */
  private groupValidators(validators: any[]): {
    validatorsByField: Map<string, any[]>;
    treeValidators: any[];
  } {
    const validatorsByField = new Map<string, any[]>();
    const treeValidators: any[] = [];

    for (const registration of validators) {
      if (registration.type === 'tree') {
        treeValidators.push(registration);
      } else {
        const existing = validatorsByField.get(registration.fieldPath) || [];
        existing.push(registration);
        validatorsByField.set(registration.fieldPath, existing);
      }
    }

    return { validatorsByField, treeValidators };
  }

  /**
   * Применение field валидаторов к полям
   *
   * Для каждого поля:
   * 1. Найти FieldNode по пути
   * 2. Проверить условия (condition)
   * 3. Выполнить sync/async валидаторы
   * 4. Установить ошибки на поле
   *
   * @param validatorsByField Валидаторы, сгруппированные по полям
   */
  private async applyFieldValidators(validatorsByField: Map<string, any[]>): Promise<void> {
    for (const [fieldPath, fieldValidators] of validatorsByField) {
      // Поддержка вложенных путей (например, "personalData.lastName")
      const control = this.form.getFieldByPath(fieldPath);

      if (!control) {
        if (import.meta.env.DEV) {
          const availableFields = Array.from(this.form['fields'].keys()).join(', ');
          throw new Error(
            `Field "${fieldPath}" not found in GroupNode.\n` +
              `Available fields: ${availableFields}`
          );
        }
        console.warn(`Field ${fieldPath} not found in GroupNode`);
        continue;
      }

      // Валидация работает только с FieldNode
      if (!isFieldNode(control)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`Validation can only run on FieldNode, skipping ${fieldPath}`);
        }
        continue;
      }

      const errors: any[] = [];
      const context = new ValidationContextImpl(this.form as any, fieldPath, control);

      // Выполнение валидаторов с учетом условий
      for (const registration of fieldValidators) {
        // Проверка условия (condition)
        if (registration.condition) {
          const shouldApply = this.checkCondition(registration.condition);
          if (!shouldApply) {
            continue;
          }
        }

        // Выполнение валидатора
        try {
          let error;
          if (registration.type === 'sync') {
            error = registration.validator(context);
          } else if (registration.type === 'async') {
            error = await registration.validator(context);
          }

          if (error) {
            errors.push(error);
          }
        } catch (e) {
          console.error(`Error in validator for ${fieldPath}:`, e);
        }
      }

      // Установка ошибок на поле
      if (errors.length > 0) {
        control.setErrors(errors);
      } else {
        // Очистить ошибки, если они были contextual
        if (
          control.errors.value.length > 0 &&
          !control.errors.value.some((e) => e.code !== 'contextual')
        ) {
          control.clearErrors();
        }
      }
    }
  }

  /**
   * Применение tree валидаторов (кросс-полевая валидация)
   *
   * Tree валидаторы имеют доступ ко всей форме через TreeValidationContext.
   * Ошибки устанавливаются на targetField (если указано).
   *
   * @param treeValidators Список tree валидаторов
   */
  private applyTreeValidators(treeValidators: any[]): void {
    for (const registration of treeValidators) {
      const context = new TreeValidationContextImpl(this.form as any);

      // Проверка условия (condition)
      if (registration.condition) {
        const shouldApply = this.checkCondition(registration.condition);
        if (!shouldApply) {
          continue;
        }
      }

      // Выполнение tree валидатора
      try {
        const error = registration.validator(context);
        if (error && registration.options?.targetField) {
          const targetControl = this.form['fields'].get(
            registration.options.targetField as keyof T
          );
          if (targetControl) {
            const existingErrors = targetControl.errors.value;
            targetControl.setErrors([...existingErrors, error]);
          }
        }
      } catch (e) {
        console.error('Error in tree validator:', e);
      }
    }
  }

  /**
   * Проверка условия (condition) для валидатора
   *
   * Условие определяет, должен ли валидатор выполняться.
   * Использует getFieldByPath для поддержки вложенных путей.
   *
   * @param condition Условие валидатора
   * @returns true, если условие выполнено
   */
  private checkCondition(condition: {
    fieldPath: string;
    conditionFn: (value: any) => boolean;
  }): boolean {
    const conditionField = this.form.getFieldByPath(condition.fieldPath);
    if (!conditionField) {
      return false;
    }

    const conditionValue = conditionField.value.value;
    return condition.conditionFn(conditionValue);
  }
}
