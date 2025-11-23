/**
 * Unit tests for FieldNode - основные тесты
 *
 * Покрывает:
 * - Инициализация (конструктор, дефолтные значения)
 * - Signals (value, touched, dirty, status, valid, invalid, errors, pending)
 * - Reset (reset, resetToInitial)
 * - Enable/disable
 * - shouldShowError computed
 * - componentProps
 * - Базовая синхронная валидация
 *
 * Другие тесты в отдельных файлах:
 * - field-node-update-on.test.ts - режимы updateOn
 * - field-node-race-condition.test.ts - race conditions async validation
 * - field-node-cleanup.test.ts - dispose mechanism
 * - field-node-error-handling.test.ts - async validator error handling
 * - field-node-set-update-on.test.ts - динамическая смена updateOn
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FieldNode } from '../../../src/core/nodes/field-node';
import type { ValidatorFn, AsyncValidatorFn } from '../../../src/core/types';
import { ComponentInstance } from '../../test-utils/types';

// ============================================================================
// Тестовые валидаторы
// ============================================================================

const requiredValidator: ValidatorFn<string> = (value) => {
  return value === '' || value === null || value === undefined
    ? { code: 'required', message: 'Field is required' }
    : null;
};

const minLengthValidator =
  (min: number): ValidatorFn<string> =>
  (value) => {
    return value && value.length < min
      ? { code: 'minLength', message: `Minimum ${min} characters`, params: { min } }
      : null;
  };

const emailValidator: ValidatorFn<string> = (value) => {
  if (!value) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value) ? null : { code: 'email', message: 'Invalid email' };
};

const asyncValidator =
  (delay: number): AsyncValidatorFn<string> =>
  async (value) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return value === 'taken' ? { code: 'taken', message: 'Value already taken' } : null;
  };

// ============================================================================
// Тесты
// ============================================================================

describe('FieldNode', () => {
  // ==========================================================================
  // 1. Инициализация
  // ==========================================================================

  describe('Initialization', () => {
    it('should create field with initial value', () => {
      const field = new FieldNode({
        value: 'initial',
        component: null as ComponentInstance,
      });

      expect(field.value.value).toBe('initial');
      expect(field.getValue()).toBe('initial');
    });

    it('should create field with empty string value', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
      });

      expect(field.value.value).toBe('');
    });

    it('should create field with null value', () => {
      const field = new FieldNode<string | null>({
        value: null,
        component: null as ComponentInstance,
      });

      expect(field.value.value).toBeNull();
    });

    it('should create field with number value', () => {
      const field = new FieldNode({
        value: 42,
        component: null as ComponentInstance,
      });

      expect(field.value.value).toBe(42);
    });

    it('should create field with boolean value', () => {
      const field = new FieldNode({
        value: true,
        component: null as ComponentInstance,
      });

      expect(field.value.value).toBe(true);
    });

    it('should create field with object value', () => {
      const initial = { name: 'John', age: 30 };
      const field = new FieldNode({
        value: initial,
        component: null as ComponentInstance,
      });

      expect(field.value.value).toEqual(initial);
    });

    it('should create field with array value', () => {
      const initial = [1, 2, 3];
      const field = new FieldNode({
        value: initial,
        component: null as ComponentInstance,
      });

      expect(field.value.value).toEqual(initial);
    });

    it('should initialize with default status "valid"', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
      });

      expect(field.status.value).toBe('valid');
      expect(field.valid.value).toBe(true);
      expect(field.invalid.value).toBe(false);
    });

    it('should initialize with touched = false', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
      });

      expect(field.touched.value).toBe(false);
    });

    it('should initialize with dirty = false', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
      });

      expect(field.dirty.value).toBe(false);
    });

    it('should initialize with pending = false', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
      });

      expect(field.pending.value).toBe(false);
    });

    it('should initialize with empty errors array', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
      });

      expect(field.errors.value).toEqual([]);
    });

    it('should initialize with default updateOn = "blur"', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
      });

      expect(field.getUpdateOn()).toBe('blur');
    });

    it('should initialize with custom updateOn', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        updateOn: 'blur',
      });

      expect(field.getUpdateOn()).toBe('blur');
    });

    it('should initialize with disabled status when disabled = true', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        disabled: true,
      });

      expect(field.status.value).toBe('disabled');
      expect(field.valid.value).toBe(false); // valid только если status === 'valid'
    });

    it('should store component reference', () => {
      const MockComponent = () => null;
      const field = new FieldNode({
        value: '',
        component: MockComponent,
      });

      expect(field.component).toBe(MockComponent);
    });

    it('should initialize with componentProps', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        componentProps: { placeholder: 'Enter text', disabled: false },
      });

      expect(field.componentProps.value).toEqual({
        placeholder: 'Enter text',
        disabled: false,
      });
    });

    it('should initialize with empty componentProps by default', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
      });

      expect(field.componentProps.value).toEqual({});
    });
  });

  // ==========================================================================
  // 2. Signals: value
  // ==========================================================================

  describe('Signals - value', () => {
    let field: FieldNode<string>;

    beforeEach(() => {
      field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
      });
    });

    it('should update value via setValue', () => {
      field.setValue('new value');

      expect(field.value.value).toBe('new value');
      expect(field.getValue()).toBe('new value');
    });

    it('should set dirty = true when setValue is called', () => {
      expect(field.dirty.value).toBe(false);

      field.setValue('changed');

      expect(field.dirty.value).toBe(true);
    });

    it('should update value via patchValue', () => {
      field.patchValue('patched');

      expect(field.value.value).toBe('patched');
    });

    it('should allow setting the same value', () => {
      field.setValue('test');
      field.setValue('test');

      expect(field.value.value).toBe('test');
    });

    it('should update value to empty string', () => {
      field.setValue('initial');
      field.setValue('');

      expect(field.value.value).toBe('');
    });

    it('getValue() should return current value without triggering reactivity', () => {
      field.setValue('test');

      const value = field.getValue();

      expect(value).toBe('test');
    });
  });

  // ==========================================================================
  // 3. Signals: touched
  // ==========================================================================

  describe('Signals - touched', () => {
    let field: FieldNode<string>;

    beforeEach(() => {
      field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
      });
    });

    it('should set touched = true via markAsTouched', () => {
      expect(field.touched.value).toBe(false);

      field.markAsTouched();

      expect(field.touched.value).toBe(true);
    });

    it('should set touched = false via markAsUntouched', () => {
      field.markAsTouched();
      expect(field.touched.value).toBe(true);

      field.markAsUntouched();

      expect(field.touched.value).toBe(false);
    });

    it('should remain touched after multiple markAsTouched calls', () => {
      field.markAsTouched();
      field.markAsTouched();
      field.markAsTouched();

      expect(field.touched.value).toBe(true);
    });
  });

  // ==========================================================================
  // 4. Signals: dirty
  // ==========================================================================

  describe('Signals - dirty', () => {
    let field: FieldNode<string>;

    beforeEach(() => {
      field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
      });
    });

    it('should remain dirty = false until setValue', () => {
      expect(field.dirty.value).toBe(false);
    });

    it('should set dirty = true after setValue', () => {
      field.setValue('changed');

      expect(field.dirty.value).toBe(true);
    });

    it('should remain dirty = true after multiple setValue calls', () => {
      field.setValue('value1');
      field.setValue('value2');

      expect(field.dirty.value).toBe(true);
    });

    it('should remain dirty = true even when setting to initial value', () => {
      field.setValue('changed');
      field.setValue(''); // Back to initial

      expect(field.dirty.value).toBe(true);
    });

    it('should set dirty = false via markAsPristine', () => {
      field.setValue('changed');
      expect(field.dirty.value).toBe(true);

      field.markAsPristine();

      expect(field.dirty.value).toBe(false);
    });
  });

  // ==========================================================================
  // 5. Signals: status, valid, invalid
  // ==========================================================================

  describe('Signals - status', () => {
    it('should have status "valid" when no errors', () => {
      const field = new FieldNode({
        value: 'test',
        component: null as ComponentInstance,
        validators: [requiredValidator],
      });

      expect(field.status.value).toBe('valid');
      expect(field.valid.value).toBe(true);
      expect(field.invalid.value).toBe(false);
    });

    it('should have status "invalid" when has errors', async () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        validators: [requiredValidator],
        updateOn: 'submit', // Prevent auto-validation
      });

      await field.validate();

      expect(field.status.value).toBe('invalid');
      expect(field.valid.value).toBe(false);
      expect(field.invalid.value).toBe(true);
    });

    it('should have status "pending" during async validation', async () => {
      const slowValidator: AsyncValidatorFn<string> = async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return value === '' ? { code: 'required', message: 'Required' } : null;
      };

      const field = new FieldNode({
        value: 'test',
        component: null as ComponentInstance,
        asyncValidators: [slowValidator],
        updateOn: 'submit',
      });

      const validatePromise = field.validate();

      // Should be pending immediately
      expect(field.status.value).toBe('pending');
      expect(field.pending.value).toBe(true);

      await validatePromise;

      // Should be valid after async validation completes
      expect(field.status.value).toBe('valid');
      expect(field.pending.value).toBe(false);
    });

    it('should have status "disabled" when field is disabled', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        disabled: true,
      });

      expect(field.status.value).toBe('disabled');
    });
  });

  // ==========================================================================
  // 6. Signals: errors
  // ==========================================================================

  describe('Signals - errors', () => {
    it('should have empty errors array initially', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
      });

      expect(field.errors.value).toEqual([]);
    });

    it('should set errors via setErrors', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
      });

      field.setErrors([
        { code: 'custom', message: 'Custom error' },
        { code: 'another', message: 'Another error' },
      ]);

      expect(field.errors.value).toHaveLength(2);
      expect(field.errors.value[0].code).toBe('custom');
      expect(field.errors.value[1].code).toBe('another');
      expect(field.status.value).toBe('invalid');
    });

    it('should clear errors via clearErrors', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
      });

      field.setErrors([{ code: 'error', message: 'Error' }]);
      expect(field.errors.value).toHaveLength(1);

      field.clearErrors();

      expect(field.errors.value).toEqual([]);
      expect(field.status.value).toBe('valid');
    });

    it('should set status to valid when setErrors with empty array', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
      });

      field.setErrors([{ code: 'error', message: 'Error' }]);
      expect(field.status.value).toBe('invalid');

      field.setErrors([]);

      expect(field.status.value).toBe('valid');
    });
  });

  // ==========================================================================
  // 7. shouldShowError computed
  // ==========================================================================

  describe('shouldShowError', () => {
    it('should be false when valid', () => {
      const field = new FieldNode({
        value: 'test',
        component: null as ComponentInstance,
        validators: [requiredValidator],
      });

      field.markAsTouched();

      expect(field.shouldShowError.value).toBe(false);
    });

    it('should be false when invalid but not touched and not dirty', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        validators: [requiredValidator],
        updateOn: 'submit',
      });

      field.setErrors([{ code: 'required', message: 'Required' }]);

      expect(field.invalid.value).toBe(true);
      expect(field.touched.value).toBe(false);
      expect(field.dirty.value).toBe(false);
      expect(field.shouldShowError.value).toBe(false);
    });

    it('should be true when invalid AND touched', async () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        validators: [requiredValidator],
        updateOn: 'blur',
      });

      field.markAsTouched();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.invalid.value).toBe(true);
      expect(field.touched.value).toBe(true);
      expect(field.shouldShowError.value).toBe(true);
    });

    it('should be true when invalid AND dirty', async () => {
      const field = new FieldNode({
        value: 'initial',
        component: null as ComponentInstance,
        validators: [requiredValidator],
        updateOn: 'change',
      });

      field.setValue('');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.invalid.value).toBe(true);
      expect(field.dirty.value).toBe(true);
      expect(field.shouldShowError.value).toBe(true);
    });

    it('should be true when invalid AND (touched OR dirty)', async () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        validators: [requiredValidator],
        updateOn: 'submit',
      });

      // Set invalid
      field.setErrors([{ code: 'required', message: 'Required' }]);

      // Not touched, not dirty
      expect(field.shouldShowError.value).toBe(false);

      // Touch only
      field.markAsTouched();
      expect(field.shouldShowError.value).toBe(true);

      // Untouch
      field.markAsUntouched();
      expect(field.shouldShowError.value).toBe(false);

      // Make dirty
      field.setValue('x', { emitEvent: false });
      expect(field.dirty.value).toBe(true);
      expect(field.shouldShowError.value).toBe(true);
    });
  });

  // ==========================================================================
  // 8. Reset
  // ==========================================================================

  describe('reset()', () => {
    it('should reset to initial value', () => {
      const field = new FieldNode({
        value: 'initial',
        component: null as ComponentInstance,
      });

      field.setValue('changed');
      expect(field.value.value).toBe('changed');

      field.reset();

      expect(field.value.value).toBe('initial');
    });

    it('should reset to provided value', () => {
      const field = new FieldNode({
        value: 'initial',
        component: null as ComponentInstance,
      });

      field.setValue('changed');

      field.reset('new initial');

      expect(field.value.value).toBe('new initial');
    });

    it('should clear errors', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        validators: [requiredValidator],
      });

      field.setErrors([{ code: 'required', message: 'Required' }]);
      expect(field.errors.value).toHaveLength(1);

      field.reset();

      expect(field.errors.value).toEqual([]);
    });

    it('should reset touched to false', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
      });

      field.markAsTouched();
      expect(field.touched.value).toBe(true);

      field.reset();

      expect(field.touched.value).toBe(false);
    });

    it('should reset dirty to false', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
      });

      field.setValue('changed');
      expect(field.dirty.value).toBe(true);

      field.reset();

      expect(field.dirty.value).toBe(false);
    });

    it('should set status to valid', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
      });

      field.setErrors([{ code: 'error', message: 'Error' }]);
      expect(field.status.value).toBe('invalid');

      field.reset();

      expect(field.status.value).toBe('valid');
    });
  });

  describe('resetToInitial()', () => {
    it('should reset to initial value', () => {
      const field = new FieldNode({
        value: 'initial',
        component: null as ComponentInstance,
      });

      field.setValue('changed');
      field.reset('temp');
      expect(field.value.value).toBe('temp');

      field.resetToInitial();

      expect(field.value.value).toBe('initial');
    });

    it('should clear state like reset()', () => {
      const field = new FieldNode({
        value: 'initial',
        component: null as ComponentInstance,
      });

      field.setValue('changed');
      field.markAsTouched();
      field.setErrors([{ code: 'error', message: 'Error' }]);

      field.resetToInitial();

      expect(field.value.value).toBe('initial');
      expect(field.touched.value).toBe(false);
      expect(field.dirty.value).toBe(false);
      expect(field.errors.value).toEqual([]);
      expect(field.status.value).toBe('valid');
    });
  });

  // ==========================================================================
  // 9. Enable/Disable
  // ==========================================================================

  describe('enable() / disable()', () => {
    it('should disable field', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
      });

      field.disable();

      expect(field.status.value).toBe('disabled');
    });

    it('should enable field', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        disabled: true,
      });

      expect(field.status.value).toBe('disabled');

      field.enable();

      expect(field.status.value).toBe('valid');
    });

    it('should clear errors when disabled', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
      });

      field.setErrors([{ code: 'error', message: 'Error' }]);
      expect(field.errors.value).toHaveLength(1);

      field.disable();

      expect(field.errors.value).toEqual([]);
    });

    it('should run validation when enabled', async () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        validators: [requiredValidator],
        disabled: true,
      });

      expect(field.status.value).toBe('disabled');
      expect(field.errors.value).toEqual([]);

      field.enable();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.status.value).toBe('invalid');
      expect(field.errors.value).toHaveLength(1);
    });

    it('should handle multiple enable/disable cycles', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
      });

      field.disable();
      expect(field.status.value).toBe('disabled');

      field.enable();
      expect(field.status.value).not.toBe('disabled');

      field.disable();
      expect(field.status.value).toBe('disabled');

      field.enable();
      expect(field.status.value).not.toBe('disabled');
    });
  });

  // ==========================================================================
  // 10. componentProps
  // ==========================================================================

  describe('componentProps', () => {
    it('should initialize with provided componentProps', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        componentProps: {
          placeholder: 'Enter value',
          maxLength: 100,
        },
      });

      expect(field.componentProps.value).toEqual({
        placeholder: 'Enter value',
        maxLength: 100,
      });
    });

    it('should update componentProps via updateComponentProps', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        componentProps: { placeholder: 'Initial' },
      });

      field.updateComponentProps({ placeholder: 'Updated' });

      expect(field.componentProps.value.placeholder).toBe('Updated');
    });

    it('should merge componentProps', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        componentProps: {
          placeholder: 'Initial',
          disabled: false,
        },
      });

      field.updateComponentProps({ disabled: true });

      expect(field.componentProps.value).toEqual({
        placeholder: 'Initial',
        disabled: true,
      });
    });

    it('should add new componentProps', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        componentProps: { placeholder: 'Initial' },
      });

      field.updateComponentProps({ maxLength: 50 });

      expect(field.componentProps.value).toEqual({
        placeholder: 'Initial',
        maxLength: 50,
      });
    });
  });

  // ==========================================================================
  // 11. Базовая синхронная валидация
  // ==========================================================================

  describe('Sync Validation', () => {
    it('should validate with single validator', async () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        validators: [requiredValidator],
        updateOn: 'submit',
      });

      const result = await field.validate();

      expect(result).toBe(false);
      expect(field.valid.value).toBe(false);
      expect(field.errors.value).toHaveLength(1);
      expect(field.errors.value[0].code).toBe('required');
    });

    it('should validate with multiple validators', async () => {
      const field = new FieldNode({
        value: 'ab',
        component: null as ComponentInstance,
        validators: [requiredValidator, minLengthValidator(5)],
        updateOn: 'submit',
      });

      const result = await field.validate();

      expect(result).toBe(false);
      expect(field.errors.value).toHaveLength(1);
      expect(field.errors.value[0].code).toBe('minLength');
    });

    it('should return true when valid', async () => {
      const field = new FieldNode({
        value: 'valid@email.com',
        component: null as ComponentInstance,
        validators: [requiredValidator, emailValidator],
        updateOn: 'submit',
      });

      const result = await field.validate();

      expect(result).toBe(true);
      expect(field.valid.value).toBe(true);
      expect(field.errors.value).toEqual([]);
    });

    it('should collect multiple errors from different validators', async () => {
      const alwaysErrorValidator: ValidatorFn<string> = () => ({
        code: 'always',
        message: 'Always fails',
      });

      const anotherErrorValidator: ValidatorFn<string> = () => ({
        code: 'another',
        message: 'Another error',
      });

      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        validators: [alwaysErrorValidator, anotherErrorValidator],
        updateOn: 'submit',
      });

      await field.validate();

      expect(field.errors.value).toHaveLength(2);
      expect(field.errors.value[0].code).toBe('always');
      expect(field.errors.value[1].code).toBe('another');
    });

    it('should not run async validators if sync validators fail', async () => {
      const asyncValidatorFn = vi.fn(async () => null);

      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        validators: [requiredValidator],
        asyncValidators: [asyncValidatorFn],
        updateOn: 'submit',
      });

      await field.validate();

      expect(field.valid.value).toBe(false);
      expect(asyncValidatorFn).not.toHaveBeenCalled();
    });

    it('should run async validators if sync validators pass', async () => {
      const asyncValidatorFn = vi.fn(async () => null);

      const field = new FieldNode({
        value: 'valid',
        component: null as ComponentInstance,
        validators: [requiredValidator],
        asyncValidators: [asyncValidatorFn],
        updateOn: 'submit',
      });

      await field.validate();

      expect(asyncValidatorFn).toHaveBeenCalledWith('valid');
    });
  });

  // ==========================================================================
  // 12. Async Validation (базовые кейсы)
  // ==========================================================================

  describe('Async Validation - Basic', () => {
    it('should set pending during async validation', async () => {
      const field = new FieldNode({
        value: 'test',
        component: null as ComponentInstance,
        asyncValidators: [asyncValidator(50)],
        updateOn: 'submit',
      });

      const validatePromise = field.validate();

      expect(field.pending.value).toBe(true);
      expect(field.status.value).toBe('pending');

      await validatePromise;

      expect(field.pending.value).toBe(false);
    });

    it('should return async validation error', async () => {
      const field = new FieldNode({
        value: 'taken',
        component: null as ComponentInstance,
        asyncValidators: [asyncValidator(10)],
        updateOn: 'submit',
      });

      await field.validate();

      expect(field.valid.value).toBe(false);
      expect(field.errors.value).toHaveLength(1);
      expect(field.errors.value[0].code).toBe('taken');
    });

    it('should pass async validation', async () => {
      const field = new FieldNode({
        value: 'available',
        component: null as ComponentInstance,
        asyncValidators: [asyncValidator(10)],
        updateOn: 'submit',
      });

      const result = await field.validate();

      expect(result).toBe(true);
      expect(field.valid.value).toBe(true);
      expect(field.errors.value).toEqual([]);
    });
  });

  // ==========================================================================
  // 13. watch()
  // ==========================================================================

  describe('watch()', () => {
    it('should call callback immediately with current value', () => {
      const field = new FieldNode({
        value: 'initial',
        component: null as ComponentInstance,
      });

      const callback = vi.fn();
      field.watch(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('initial');
    });

    it('should call callback on value change', () => {
      const field = new FieldNode({
        value: 'initial',
        component: null as ComponentInstance,
      });

      const callback = vi.fn();
      field.watch(callback);

      field.setValue('changed');

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith('changed');
    });

    it('should return unsubscribe function', () => {
      const field = new FieldNode({
        value: 'initial',
        component: null as ComponentInstance,
      });

      const callback = vi.fn();
      const unsubscribe = field.watch(callback);

      unsubscribe();
      field.setValue('changed');

      expect(callback).toHaveBeenCalledTimes(1); // Only initial call
    });
  });

  // ==========================================================================
  // 14. computeFrom()
  // ==========================================================================

  describe('computeFrom()', () => {
    it('should compute value from single source', () => {
      const source = new FieldNode({
        value: 10,
        component: null as ComponentInstance,
      });

      const computed = new FieldNode({
        value: 0,
        component: null as ComponentInstance,
      });

      computed.computeFrom([source.value], (val) => val * 2);

      expect(computed.value.value).toBe(20);
    });

    it('should update when source changes', () => {
      const source = new FieldNode({
        value: 10,
        component: null as ComponentInstance,
      });

      const computed = new FieldNode({
        value: 0,
        component: null as ComponentInstance,
      });

      computed.computeFrom([source.value], (val) => val * 2);

      source.setValue(20);

      expect(computed.value.value).toBe(40);
    });

    it('should compute from multiple sources', () => {
      const a = new FieldNode({
        value: 10,
        component: null as ComponentInstance,
      });

      const b = new FieldNode({
        value: 5,
        component: null as ComponentInstance,
      });

      const sum = new FieldNode({
        value: 0,
        component: null as ComponentInstance,
      });

      sum.computeFrom([a.value, b.value], (aVal, bVal) => aVal + bVal);

      expect(sum.value.value).toBe(15);

      a.setValue(20);
      expect(sum.value.value).toBe(25);

      b.setValue(10);
      expect(sum.value.value).toBe(30);
    });

    it('should return unsubscribe function', () => {
      const source = new FieldNode({
        value: 10,
        component: null as ComponentInstance,
      });

      const computed = new FieldNode({
        value: 0,
        component: null as ComponentInstance,
      });

      const unsubscribe = computed.computeFrom([source.value], (val) => val * 2);

      expect(computed.value.value).toBe(20);

      unsubscribe();
      source.setValue(30);

      expect(computed.value.value).toBe(20); // Not updated
    });
  });

  // ==========================================================================
  // 15. Edge cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle setValue with emitEvent: false', async () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        validators: [requiredValidator],
        updateOn: 'change',
      });

      field.setValue('value', { emitEvent: false });

      // Wait for potential validation
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Validation should not have been triggered
      expect(field.status.value).toBe('valid');
    });

    it('should handle falsy values correctly', () => {
      const numberField = new FieldNode({
        value: 0,
        component: null as ComponentInstance,
      });

      expect(numberField.value.value).toBe(0);

      const boolField = new FieldNode({
        value: false,
        component: null as ComponentInstance,
      });

      expect(boolField.value.value).toBe(false);
    });

    it('should handle undefined in validation', async () => {
      const field = new FieldNode<string | undefined>({
        value: undefined,
        component: null as ComponentInstance,
        validators: [requiredValidator as ValidatorFn<string | undefined>],
        updateOn: 'submit',
      });

      await field.validate();

      expect(field.valid.value).toBe(false);
      expect(field.errors.value[0].code).toBe('required');
    });
  });
});
