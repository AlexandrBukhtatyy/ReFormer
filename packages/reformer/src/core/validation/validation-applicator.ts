/**
 * Применение валидаторов к форме.
 *
 * Отвечает только за логику применения валидаторов к полям формы.
 *
 * Новый контракт:
 * - Sync/Async валидаторы вызываются как `(value, controlProxy, rootProxy)`.
 * - Group валидаторы — как `(scopeProxy, rootProxy)`.
 *
 * @template T Тип формы
 */

import type { GroupNode } from '../nodes/group-node';
import type {
  ValidatorRegistration,
  ValidationError,
  Validator,
  AsyncValidator,
  GroupValidator,
  FormProxy,
} from '../types';
import { isFieldNode, isArrayNode, isGroupNode } from '../utils/type-guards';
import { FormErrorHandler, ErrorStrategy } from '../utils/error-handler';

/**
 * Узел, у которого можно получить FormProxy.
 * GroupNode/ArrayNode имеют getProxy(); FieldNode выступает сам себе FormProxy.
 */
interface ProxyCarrier<TField> {
  getProxy?: () => FormProxy<TField>;
}

/**
 * Получить FormProxy для узла-control.
 * - GroupNode/ArrayNode: вызываем getProxy().
 * - FieldNode: сам node является FormProxy<TField> для лиф-типов (см. form-proxy.ts).
 */
function controlProxyOf<TField>(control: unknown): FormProxy<TField> {
  const c = control as ProxyCarrier<TField>;
  if (typeof c.getProxy === 'function') {
    return c.getProxy();
  }
  return control as FormProxy<TField>;
}

export class ValidationApplicator<T> {
  private readonly form: GroupNode<T>;

  constructor(form: GroupNode<T>) {
    this.form = form;
  }

  /**
   * Применить валидаторы к полям формы.
   */
  async apply(validators: ValidatorRegistration[]): Promise<void> {
    const { validatorsByField, groupValidators } = this.groupValidators(validators);

    await this.applyFieldValidators(validatorsByField);
    this.applyGroupValidators(groupValidators);
  }

  private groupValidators(validators: ValidatorRegistration[]): {
    validatorsByField: Map<string, ValidatorRegistration[]>;
    groupValidators: ValidatorRegistration[];
  } {
    const validatorsByField = new Map<string, ValidatorRegistration[]>();
    const groupValidators: ValidatorRegistration[] = [];

    for (const registration of validators) {
      if (registration.type === 'group') {
        groupValidators.push(registration);
        continue;
      }
      if (registration.type === 'array-items') {
        // array-items обрабатываются в ValidationRegistry.applyArrayItemValidators
        continue;
      }
      const existing = validatorsByField.get(registration.fieldPath) || [];
      existing.push(registration);
      validatorsByField.set(registration.fieldPath, existing);
    }

    return { validatorsByField, groupValidators };
  }

  /**
   * Применение sync/async валидаторов к полям.
   */
  private async applyFieldValidators(
    validatorsByField: Map<string, ValidatorRegistration[]>
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rootProxy = this.form.getProxy() as FormProxy<any>;

    for (const [fieldPath, fieldValidators] of validatorsByField) {
      const control = this.form.getFieldByPath(fieldPath);

      if (!control) {
        if (import.meta.env.DEV) {
          throw new Error(`Field "${fieldPath}" not found in GroupNode`);
        }
        console.warn(`Field ${fieldPath} not found in GroupNode`);
        continue;
      }

      // Валидация работает только с FieldNode и ArrayNode.
      // GroupNode-валидация делается через validateGroup со scope.
      if (!isFieldNode(control) && !isArrayNode(control)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`Validation can only run on FieldNode or ArrayNode, skipping ${fieldPath}`);
        }
        continue;
      }

      const errors: ValidationError[] = [];

      // Значение поля для передачи валидатору.
      // FieldNode: control.value.value; ArrayNode: control.getValue() (массив значений).
      let value: unknown;
      if (isArrayNode(control)) {
        value = control.getValue();
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value = (control as any).value.value;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const controlProxy = controlProxyOf<any>(control);

      for (const registration of fieldValidators) {
        if (registration.condition) {
          if (!this.checkCondition(registration.condition)) continue;
        }

        try {
          let error: ValidationError | null = null;
          if (registration.type === 'sync') {
            const validator = registration.validator as Validator<unknown, unknown>;
            error = validator(value, controlProxy, rootProxy);
          } else if (registration.type === 'async') {
            const validator = registration.validator as AsyncValidator<unknown, unknown>;
            error = await validator(value, controlProxy, rootProxy);
          }

          if (error) {
            errors.push(error);
          }
        } catch (e) {
          FormErrorHandler.handle(
            e,
            `ValidationApplicator: validator for ${fieldPath}`,
            ErrorStrategy.LOG
          );
        }
      }

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
   * Применение group (cross-field) валидаторов.
   *
   * Scope определяется `registration.scopePath`:
   * - '' (пустая строка) → scope = root form;
   * - 'foo.bar' → scope = FormProxy подузла по пути.
   *
   * Ошибка ставится на `options.targetField` (FieldPathNode → строка пути).
   * Если `targetField` не задан, ошибка теряется (диагностика в DEV).
   */
  private applyGroupValidators(groupValidators: ValidatorRegistration[]): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rootProxy = this.form.getProxy() as FormProxy<any>;

    for (const registration of groupValidators) {
      if (registration.condition) {
        if (!this.checkCondition(registration.condition)) continue;
      }

      // Определяем scope proxy.
      let scopeProxy: FormProxy<unknown>;
      const scopePath = registration.scopePath ?? '';
      if (!scopePath) {
        scopeProxy = rootProxy;
      } else {
        const scopeNode = this.form.getFieldByPath(scopePath);
        if (!scopeNode) {
          if (import.meta.env.DEV) {
            console.warn(`validateGroup: scope path "${scopePath}" not found`);
          }
          continue;
        }
        scopeProxy = isGroupNode(scopeNode)
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (scopeNode as any).getProxy()
          : // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (scopeNode as any);
      }

      try {
        const validator = registration.validator as GroupValidator<unknown, unknown>;
        const error = validator(scopeProxy, rootProxy);

        if (!error) continue;

        // Привязка ошибки к targetField (если задан).
        const targetPath =
          registration.fieldPath && registration.fieldPath !== '__group__'
            ? registration.fieldPath
            : null;

        if (!targetPath) {
          if (import.meta.env.DEV) {
            console.warn(
              'validateGroup: error returned, but targetField not specified — error is dropped'
            );
          }
          continue;
        }

        const targetControl = this.form.getFieldByPath(targetPath);
        if (targetControl && isFieldNode(targetControl)) {
          const existingErrors = targetControl.errors.value;
          targetControl.setErrors([...existingErrors, error]);
        }
      } catch (e) {
        FormErrorHandler.handle(e, 'ValidationApplicator: group validator', ErrorStrategy.LOG);
      }
    }
  }

  private checkCondition(condition: {
    fieldPath: string;
    conditionFn: (value: unknown) => boolean;
  }): boolean {
    const conditionField = this.form.getFieldByPath(condition.fieldPath);
    if (!conditionField) {
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditionValue = (conditionField as any).value.value;
    return condition.conditionFn(conditionValue);
  }
}
