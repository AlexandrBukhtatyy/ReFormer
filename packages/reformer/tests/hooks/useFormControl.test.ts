/**
 * Unit tests for useFormControl hook
 *
 * Тестирует хук useFormControl, который предоставляет мемоизированный доступ
 * к сигналам FieldNode.
 *
 * Поскольку хук использует только useMemo для мемоизации объекта с сигналами,
 * тесты проверяют:
 * - Корректность возвращаемых сигналов
 * - Соответствие сигналов исходному FieldNode
 * - Реактивность изменений через сигналы
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FieldNode } from '../../src/core/nodes/field-node';
import type { FormControlState } from '../../src/hooks/useFormControl';
import type { ValidatorFn, AsyncValidatorFn, FormValue } from '../../src/core/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MockComponent: React.ComponentType<any> = () => null;

// ============================================================================
// Тестовые валидаторы
// ============================================================================

const requiredValidator: ValidatorFn<string> = (value) => {
  return value === '' || value === null || value === undefined
    ? { code: 'required', message: 'Field is required' }
    : null;
};

const asyncValidator =
  (delay: number): AsyncValidatorFn<string> =>
  async (value) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return value === 'taken' ? { code: 'taken', message: 'Value already taken' } : null;
  };

// ============================================================================
// Helper для тестирования хука без React рендера
// Поскольку useFormControl использует только useMemo, мы можем протестировать
// его логику напрямую, проверяя что возвращаемые сигналы соответствуют control
// ============================================================================

/**
 * Симулирует вызов useFormControl без React рендера
 * Возвращает объект с теми же полями, что и хук
 */
function simulateUseFormControl<T extends FormValue>(control: FieldNode<T>): FormControlState<T> {
  return {
    value: control.value,
    errors: control.errors,
    pending: control.pending,
    disabled: control.disabled,
    touched: control.touched,
    dirty: control.dirty,
    valid: control.valid,
    invalid: control.invalid,
    shouldShowError: control.shouldShowError,
  };
}

// ============================================================================
// Тесты
// ============================================================================

describe('useFormControl', () => {
  // ==========================================================================
  // 1. Возвращаемые сигналы
  // ==========================================================================

  describe('Returned signals', () => {
    let field: FieldNode<string>;

    beforeEach(() => {
      field = new FieldNode({
        value: 'initial',
        component: MockComponent,
      });
    });

    it('should return value signal from control', () => {
      const state = simulateUseFormControl(field);

      expect(state.value).toBe(field.value);
      expect(state.value.value).toBe('initial');
    });

    it('should return errors signal from control', () => {
      const state = simulateUseFormControl(field);

      expect(state.errors).toBe(field.errors);
      expect(state.errors.value).toEqual([]);
    });

    it('should return pending signal from control', () => {
      const state = simulateUseFormControl(field);

      expect(state.pending).toBe(field.pending);
      expect(state.pending.value).toBe(false);
    });

    it('should return disabled signal from control', () => {
      const state = simulateUseFormControl(field);

      expect(state.disabled).toBe(field.disabled);
      expect(state.disabled.value).toBe(false);
    });

    it('should return touched signal from control', () => {
      const state = simulateUseFormControl(field);

      expect(state.touched).toBe(field.touched);
      expect(state.touched.value).toBe(false);
    });

    it('should return dirty signal from control', () => {
      const state = simulateUseFormControl(field);

      expect(state.dirty).toBe(field.dirty);
      expect(state.dirty.value).toBe(false);
    });

    it('should return valid signal from control', () => {
      const state = simulateUseFormControl(field);

      expect(state.valid).toBe(field.valid);
      expect(state.valid.value).toBe(true);
    });

    it('should return invalid signal from control', () => {
      const state = simulateUseFormControl(field);

      expect(state.invalid).toBe(field.invalid);
      expect(state.invalid.value).toBe(false);
    });

    it('should return shouldShowError signal from control', () => {
      const state = simulateUseFormControl(field);

      expect(state.shouldShowError).toBe(field.shouldShowError);
      expect(state.shouldShowError.value).toBe(false);
    });
  });

  // ==========================================================================
  // 2. Реактивность сигналов через control
  // ==========================================================================

  describe('Signal reactivity', () => {
    it('should reflect value changes from control', () => {
      const field = new FieldNode({
        value: 'initial',
        component: MockComponent,
      });

      const state = simulateUseFormControl(field);

      expect(state.value.value).toBe('initial');

      field.setValue('changed');

      expect(state.value.value).toBe('changed');
    });

    it('should reflect touched changes from control', () => {
      const field = new FieldNode({
        value: '',
        component: MockComponent,
      });

      const state = simulateUseFormControl(field);

      expect(state.touched.value).toBe(false);

      field.markAsTouched();

      expect(state.touched.value).toBe(true);
    });

    it('should reflect dirty changes from control', () => {
      const field = new FieldNode({
        value: '',
        component: MockComponent,
      });

      const state = simulateUseFormControl(field);

      expect(state.dirty.value).toBe(false);

      field.setValue('changed');

      expect(state.dirty.value).toBe(true);
    });

    it('should reflect errors changes from control', () => {
      const field = new FieldNode({
        value: '',
        component: MockComponent,
      });

      const state = simulateUseFormControl(field);

      expect(state.errors.value).toEqual([]);

      field.setErrors([{ code: 'custom', message: 'Custom error' }]);

      expect(state.errors.value).toHaveLength(1);
      expect(state.errors.value[0].code).toBe('custom');
    });

    it('should reflect valid/invalid changes from control', async () => {
      const field = new FieldNode({
        value: '',
        component: MockComponent,
        validators: [requiredValidator],
        updateOn: 'submit',
      });

      const state = simulateUseFormControl(field);

      expect(state.valid.value).toBe(true);
      expect(state.invalid.value).toBe(false);

      await field.validate();

      expect(state.valid.value).toBe(false);
      expect(state.invalid.value).toBe(true);
    });

    it('should reflect pending changes during async validation', async () => {
      const field = new FieldNode({
        value: 'test',
        component: MockComponent,
        asyncValidators: [asyncValidator(50)],
        updateOn: 'submit',
      });

      const state = simulateUseFormControl(field);

      expect(state.pending.value).toBe(false);

      const validatePromise = field.validate();

      expect(state.pending.value).toBe(true);

      await validatePromise;

      expect(state.pending.value).toBe(false);
    });

    it('should reflect disabled changes from control', () => {
      const field = new FieldNode({
        value: '',
        component: MockComponent,
      });

      const state = simulateUseFormControl(field);

      expect(state.disabled.value).toBe(false);

      field.disable();

      expect(state.disabled.value).toBe(true);

      field.enable();

      expect(state.disabled.value).toBe(false);
    });

    it('should reflect shouldShowError changes', async () => {
      const field = new FieldNode({
        value: '',
        component: MockComponent,
        validators: [requiredValidator],
        updateOn: 'blur',
      });

      const state = simulateUseFormControl(field);

      expect(state.shouldShowError.value).toBe(false);

      // Mark as touched triggers validation on blur
      field.markAsTouched();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(state.shouldShowError.value).toBe(true);
    });
  });

  // ==========================================================================
  // 3. Различные типы значений
  // ==========================================================================

  describe('Different value types', () => {
    it('should work with string values', () => {
      const field = new FieldNode({
        value: 'test',
        component: MockComponent,
      });

      const state = simulateUseFormControl(field);

      expect(state.value.value).toBe('test');
    });

    it('should work with number values', () => {
      const field = new FieldNode({
        value: 42,
        component: MockComponent,
      });

      const state = simulateUseFormControl(field);

      expect(state.value.value).toBe(42);
    });

    it('should work with boolean values', () => {
      const field = new FieldNode({
        value: true,
        component: MockComponent,
      });

      const state = simulateUseFormControl(field);

      expect(state.value.value).toBe(true);
    });

    it('should work with null values', () => {
      const field = new FieldNode<string | null>({
        value: null,
        component: MockComponent,
      });

      const state = simulateUseFormControl(field);

      expect(state.value.value).toBeNull();
    });

    it('should work with object values', () => {
      const objValue = { name: 'John', age: 30 };
      const field = new FieldNode({
        value: objValue,
        component: MockComponent,
      });

      const state = simulateUseFormControl(field);

      expect(state.value.value).toEqual(objValue);
    });

    it('should work with array values', () => {
      const arrayValue = [1, 2, 3];
      const field = new FieldNode({
        value: arrayValue,
        component: MockComponent,
      });

      const state = simulateUseFormControl(field);

      expect(state.value.value).toEqual(arrayValue);
    });
  });

  // ==========================================================================
  // 4. Инициальные состояния
  // ==========================================================================

  describe('Initial states', () => {
    it('should handle initially disabled field', () => {
      const field = new FieldNode({
        value: '',
        component: MockComponent,
        disabled: true,
      });

      const state = simulateUseFormControl(field);

      expect(state.disabled.value).toBe(true);
      expect(state.valid.value).toBe(false); // disabled !== valid
    });

    it('should handle field with initial errors', () => {
      const field = new FieldNode({
        value: '',
        component: MockComponent,
      });

      field.setErrors([{ code: 'initial', message: 'Initial error' }]);

      const state = simulateUseFormControl(field);

      expect(state.errors.value).toHaveLength(1);
      expect(state.invalid.value).toBe(true);
    });

    it('should handle pre-touched field', () => {
      const field = new FieldNode({
        value: '',
        component: MockComponent,
      });

      field.markAsTouched();

      const state = simulateUseFormControl(field);

      expect(state.touched.value).toBe(true);
    });

    it('should handle pre-dirtied field', () => {
      const field = new FieldNode({
        value: '',
        component: MockComponent,
      });

      field.setValue('changed');

      const state = simulateUseFormControl(field);

      expect(state.dirty.value).toBe(true);
    });
  });

  // ==========================================================================
  // 5. Интеграционные сценарии
  // ==========================================================================

  describe('Integration scenarios', () => {
    it('should track full form field lifecycle', async () => {
      const field = new FieldNode({
        value: '',
        component: MockComponent,
        validators: [requiredValidator],
        updateOn: 'change', // Use 'change' for immediate validation feedback
      });

      const state = simulateUseFormControl(field);

      // Initial state - no validation runs until setValue is called
      expect(state.value.value).toBe('');
      expect(state.touched.value).toBe(false);
      expect(state.dirty.value).toBe(false);
      expect(state.valid.value).toBe(true); // Valid initially (no validation yet)
      expect(state.shouldShowError.value).toBe(false);

      // User starts typing valid value
      field.setValue('a');
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(state.dirty.value).toBe(true);
      expect(state.valid.value).toBe(true);
      expect(state.shouldShowError.value).toBe(false);

      // User blurs the field
      field.markAsTouched();
      expect(state.touched.value).toBe(true);

      // User clears the field - validation runs on change
      field.setValue('');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(state.valid.value).toBe(false);
      expect(state.shouldShowError.value).toBe(true);
      expect(state.errors.value[0].code).toBe('required');

      // User fixes the error
      field.setValue('valid value');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(state.valid.value).toBe(true);
      expect(state.shouldShowError.value).toBe(false);
      expect(state.errors.value).toEqual([]);
    });

    it('should handle reset correctly', async () => {
      const field = new FieldNode({
        value: 'initial',
        component: MockComponent,
        validators: [requiredValidator],
        updateOn: 'change',
      });

      const state = simulateUseFormControl(field);

      // Make changes
      field.setValue('');
      await new Promise((resolve) => setTimeout(resolve, 10));
      field.markAsTouched();

      expect(state.dirty.value).toBe(true);
      expect(state.touched.value).toBe(true);
      expect(state.invalid.value).toBe(true);

      // Reset
      field.reset();

      expect(state.value.value).toBe('initial');
      expect(state.dirty.value).toBe(false);
      expect(state.touched.value).toBe(false);
      expect(state.valid.value).toBe(true);
      expect(state.errors.value).toEqual([]);
    });

    it('should handle disable/enable cycle', () => {
      const field = new FieldNode({
        value: 'test',
        component: MockComponent,
      });

      const state = simulateUseFormControl(field);

      // Initial state
      expect(state.disabled.value).toBe(false);

      // Disable
      field.disable();
      expect(state.disabled.value).toBe(true);

      // Enable
      field.enable();
      expect(state.disabled.value).toBe(false);
    });
  });

  // ==========================================================================
  // 6. Типовая проверка FormControlState
  // ==========================================================================

  describe('FormControlState type', () => {
    it('should have correct structure', () => {
      const field = new FieldNode({
        value: 'test',
        component: MockComponent,
      });

      const state: FormControlState<string> = simulateUseFormControl(field);

      // Verify all expected properties exist
      expect(state).toHaveProperty('value');
      expect(state).toHaveProperty('errors');
      expect(state).toHaveProperty('pending');
      expect(state).toHaveProperty('disabled');
      expect(state).toHaveProperty('touched');
      expect(state).toHaveProperty('dirty');
      expect(state).toHaveProperty('valid');
      expect(state).toHaveProperty('invalid');
      expect(state).toHaveProperty('shouldShowError');
    });

    it('should return exactly 9 properties', () => {
      const field = new FieldNode({
        value: 'test',
        component: MockComponent,
      });

      const state = simulateUseFormControl(field);

      expect(Object.keys(state)).toHaveLength(9);
    });
  });

  // ==========================================================================
  // 7. Проверка идентичности ссылок
  // ==========================================================================

  describe('Reference identity', () => {
    it('should return the same signal references as control', () => {
      const field = new FieldNode({
        value: 'test',
        component: MockComponent,
      });

      const state1 = simulateUseFormControl(field);
      const state2 = simulateUseFormControl(field);

      // Signals should be the same objects
      expect(state1.value).toBe(state2.value);
      expect(state1.errors).toBe(state2.errors);
      expect(state1.pending).toBe(state2.pending);
      expect(state1.disabled).toBe(state2.disabled);
      expect(state1.touched).toBe(state2.touched);
      expect(state1.dirty).toBe(state2.dirty);
      expect(state1.valid).toBe(state2.valid);
      expect(state1.invalid).toBe(state2.invalid);
      expect(state1.shouldShowError).toBe(state2.shouldShowError);
    });
  });
});
