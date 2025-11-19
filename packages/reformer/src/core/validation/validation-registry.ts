/**
 * ValidationRegistry - система регистрации и применения валидаторов
 *
 * Работает как стек контекстов:
 * 1. При вызове validation schema функции создается новый контекст
 * 2. Все вызовы validate(), applyWhen() и т.д. регистрируют валидаторы в текущем контексте
 * 3. После завершения схемы валидаторы применяются к GroupNode
 */

import type { GroupNode } from '../nodes/group-node';
import { FormFields } from '../types';
import type {
  ValidatorRegistration,
  ContextualValidatorFn,
  ContextualAsyncValidatorFn,
  TreeValidatorFn,
  ConditionFn,
  ValidateOptions,
  ValidateAsyncOptions,
  ValidateTreeOptions,
} from '../types/validation-schema';
import { RegistryStack } from '../utils/registry-stack';

/**
 * Контекст регистрации валидаторов
 */
class RegistrationContext {
  private validators: ValidatorRegistration[] = [];
  private conditionStack: Array<{ fieldPath: string; conditionFn: ConditionFn<unknown> }> = [];

  /**
   * Добавить валидатор в контекст
   */
  addValidator(registration: ValidatorRegistration): void {
    // Если есть активные условия, добавляем их к валидатору
    if (this.conditionStack.length > 0) {
      const condition = this.conditionStack[this.conditionStack.length - 1];
      registration.condition = condition;
    }

    this.validators.push(registration);
  }

  /**
   * Войти в условный блок
   */
  enterCondition(fieldPath: string, conditionFn: ConditionFn<unknown>): void {
    this.conditionStack.push({ fieldPath, conditionFn });
  }

  /**
   * Выйти из условного блока
   */
  exitCondition(): void {
    this.conditionStack.pop();
  }

  /**
   * Получить все зарегистрированные валидаторы
   */
  getValidators(): ValidatorRegistration[] {
    return this.validators;
  }
}

/**
 * Реестр валидаторов для формы
 *
 * Каждый экземпляр GroupNode создает собственный реестр (композиция).
 * Устраняет race conditions и изолирует формы друг от друга.
 *
 * Context stack используется для tracking текущего активного реестра:
 * - beginRegistration() помещает this в global stack
 * - endRegistration() извлекает из global stack
 * - getCurrent() возвращает текущий активный реестр
 *
 * @example
 * ```typescript
 * class GroupNode {
 *   private readonly validationRegistry = new ValidationRegistry();
 *
 *   applyValidationSchema(schemaFn) {
 *     this.validationRegistry.beginRegistration(); // Pushes this to global stack
 *     schemaFn(createFieldPath(this));             // Uses getCurrent()
 *     this.validationRegistry.endRegistration(this); // Pops from global stack
 *   }
 * }
 * ```
 */
export class ValidationRegistry {
  /**
   * Global stack активных реестров
   * Используется для изоляции форм друг от друга
   */
  private static registryStack = new RegistryStack<ValidationRegistry>();

  private contextStack: RegistrationContext[] = [];
  private validators: ValidatorRegistration[] = [];

  /**
   * Получить текущий активный реестр из global stack
   *
   * @returns Текущий активный реестр или null
   *
   * @example
   * ```typescript
   * // В schema-validators.ts
   * export function required(...) {
   *   const registry = ValidationRegistry.getCurrent();
   *   if (registry) {
   *     registry.registerSync(...);
   *   }
   * }
   * ```
   */
  static getCurrent(): ValidationRegistry | null {
    return ValidationRegistry.registryStack.getCurrent();
  }

  /**
   * Начать регистрацию валидаторов для формы
   *
   * Помещает this в global stack для изоляции форм
   */
  beginRegistration(): RegistrationContext {
    const context = new RegistrationContext();
    this.contextStack.push(context);
    // Помещаем this в global stack для tracking текущего активного реестра
    ValidationRegistry.registryStack.push(this);
    return context;
  }

  /**
   * Завершить регистрацию и применить валидаторы к GroupNode
   *
   * Извлекает this из global stack
   *
   * Сохраняет валидаторы в локальном состоянии (this.validators) вместо глобального WeakMap.
   */
  endRegistration<T extends FormFields>(form: GroupNode<T>): void {
    const context = this.contextStack.pop();
    if (!context) {
      throw new Error('No active registration context');
    }

    // Извлекаем из global stack с проверкой
    ValidationRegistry.registryStack.verify(this, 'ValidationRegistry');

    // Сохраняем валидаторы в локальном состоянии
    this.validators = context.getValidators();

    // Применяем валидаторы к полям
    this.applyValidators(form, this.validators);

    // Применяем array-items validators к ArrayNode элементам
    this.applyArrayItemValidators(form, this.validators);
  }

  /**
   * Отменить регистрацию без применения валидаторов
   * Используется для временной валидации (например, в validateForm)
   *
   * Извлекает this из global stack
   */
  cancelRegistration(): void {
    const context = this.contextStack.pop();
    if (!context) {
      throw new Error('No active registration context to cancel');
    }

    // Извлекаем из global stack с проверкой
    ValidationRegistry.registryStack.verify(this, 'ValidationRegistry');

    // Просто выбрасываем контекст без сохранения
  }

  /**
   * Получить текущий контекст регистрации
   */
  getCurrentContext(): RegistrationContext | undefined {
    return this.contextStack[this.contextStack.length - 1];
  }

  /**
   * Зарегистрировать синхронный валидатор
   */
  registerSync<TForm = unknown, TField = unknown>(
    fieldPath: string,
    validator: ContextualValidatorFn<TForm, TField>,
    options?: ValidateOptions
  ): void {
    const context = this.getCurrentContext();
    if (!context) {
      throw new Error('Validators can only be registered inside a validation schema function');
    }

    context.addValidator({
      fieldPath,
      type: 'sync',
      validator: validator as ContextualValidatorFn<unknown, unknown>,
      options,
    });
  }

  /**
   * Зарегистрировать асинхронный валидатор
   */
  registerAsync<TForm = unknown, TField = unknown>(
    fieldPath: string,
    validator: ContextualAsyncValidatorFn<TForm, TField>,
    options?: ValidateAsyncOptions
  ): void {
    const context = this.getCurrentContext();
    if (!context) {
      throw new Error('Validators can only be registered inside a validation schema function');
    }

    context.addValidator({
      fieldPath,
      type: 'async',
      validator: validator as ContextualAsyncValidatorFn<unknown, unknown>,
      options,
    });
  }

  /**
   * Зарегистрировать tree валидатор
   */
  registerTree<TForm = unknown>(
    validator: TreeValidatorFn<TForm>,
    options?: ValidateTreeOptions
  ): void {
    const context = this.getCurrentContext();
    if (!context) {
      throw new Error('Validators can only be registered inside a validation schema function');
    }

    context.addValidator({
      fieldPath: options?.targetField || '__tree__',
      type: 'tree',
      validator: validator as TreeValidatorFn<unknown>,
      options,
    });
  }

  /**
   * Войти в условный блок
   */
  enterCondition(fieldPath: string, conditionFn: ConditionFn<unknown>): void {
    const context = this.getCurrentContext();
    if (!context) {
      throw new Error('Conditions can only be used inside a validation schema function');
    }

    context.enterCondition(fieldPath, conditionFn);
  }

  /**
   * Выйти из условного блока
   */
  exitCondition(): void {
    const context = this.getCurrentContext();
    if (!context) {
      throw new Error('No active condition');
    }

    context.exitCondition();
  }

  /**
   * Зарегистрировать validation schema для элементов массива
   *
   * Используется функцией validateItems() для регистрации схемы валидации,
   * которая будет применяться к каждому элементу ArrayNode.
   *
   * @param fieldPath - Путь к ArrayNode полю
   * @param itemSchemaFn - Validation schema для элемента массива
   */
  registerArrayItemValidation(
    fieldPath: string,
    itemSchemaFn: unknown // ValidationSchemaFn<TItem>
  ): void {
    const context = this.getCurrentContext();
    if (!context) {
      throw new Error(
        'Array item validators can only be registered inside a validation schema function'
      );
    }

    context.addValidator({
      fieldPath,
      type: 'array-items',
      validator: itemSchemaFn,
      options: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }

  /**
   * Получить зарегистрированные валидаторы для этого реестра
   *
   * Возвращает локальный массив валидаторов (без аргумента form).
   */
  getValidators(): ValidatorRegistration[] {
    return this.validators;
  }

  /**
   * Применить зарегистрированные валидаторы к GroupNode
   * @private
   */
  private applyValidators<T extends FormFields>(
    form: GroupNode<T>,
    validators: ValidatorRegistration[]
  ): void {
    // Группируем валидаторы по полям
    const validatorsByField = new Map<string, ValidatorRegistration[]>();

    for (const registration of validators) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (registration.type === 'tree' || (registration as any).type === 'array-items') {
        // Tree и array-items валидаторы обрабатываются отдельно
        continue;
      }

      const existing = validatorsByField.get(registration.fieldPath) || [];
      existing.push(registration);
      validatorsByField.set(registration.fieldPath, existing);
    }

    // Валидаторы сохранены в локальном массиве this.validators
    // Они будут применяться при вызове GroupNode.validate()
    if (import.meta.env.DEV) {
      console.log(`Registered ${validators.length} validators for GroupNode`);
    }
  }

  /**
   * Применить array-items validators к ArrayNode элементам
   * @private
   */
  private applyArrayItemValidators<T extends FormFields>(
    form: GroupNode<T>,
    validators: ValidatorRegistration[]
  ): void {
    // Фильтруем array-items validators
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arrayItemValidators = validators.filter((v: any) => v.type === 'array-items');

    if (arrayItemValidators.length === 0) {
      return;
    }

    // Применяем validation schema к каждому ArrayNode
    for (const registration of arrayItemValidators) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const arrayNode = (form as any)[registration.fieldPath.split('.')[0]];

      if (arrayNode && 'applyValidationSchema' in arrayNode) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const itemSchemaFn = (registration as any).validator;
        arrayNode.applyValidationSchema(itemSchemaFn);

        if (import.meta.env.DEV) {
          console.log(`Applied validation schema to ArrayNode: ${registration.fieldPath}`);
        }
      } else if (import.meta.env.DEV) {
        console.warn(`Field ${registration.fieldPath} is not an ArrayNode or doesn't exist`);
      }
    }
  }
}
