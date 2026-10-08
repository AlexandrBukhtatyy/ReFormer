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
 * - validate() как отражение ошибок, пришедших извне
 * - watch / computeFrom
 *
 * Другие тесты в отдельных файлах:
 * - field-node-cleanup.test.ts - dispose mechanism
 * - field-node-model-binding.test.ts - привязка к сигналу модели
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@preact/signals-core';
import { FieldNode } from '../../../src/form/nodes/field-node';
import type { ValidationError } from '../../../src/form/types/index';
import { fieldOf } from '../../test-utils/form-from-fields';

const REQUIRED: ValidationError = { code: 'required', message: 'Field is required' };
const WARNING: ValidationError = { code: 'weak', message: 'Weak value', severity: 'warning' };

describe('FieldNode', () => {
  // ==========================================================================
  // 1. Инициализация
  // ==========================================================================

  describe('Initialization', () => {
    it('should create field with initial value', () => {
      const field = fieldOf('initial');

      expect(field.value.value).toBe('initial');
      expect(field.getValue()).toBe('initial');
    });

    it('should not own the value: it reads and writes the given signal', () => {
      const valueSignal = signal('from model');
      const field = new FieldNode({ valueSignal });

      expect(field.value.value).toBe('from model');

      valueSignal.value = 'changed in model';
      expect(field.value.value).toBe('changed in model');

      field.setValue('changed in field');
      expect(valueSignal.value).toBe('changed in field');
    });

    it.each([
      ['empty string', ''],
      ['null', null],
      ['number', 42],
      ['boolean', true],
      ['object', { name: 'John', age: 30 }],
      ['array', [1, 2, 3]],
    ])('should create field with %s value', (_label, initial) => {
      const field = fieldOf<unknown>(initial);

      expect(field.value.value).toEqual(initial);
    });

    it('should initialize with default state', () => {
      const field = fieldOf('');

      expect(field.status.value).toBe('valid');
      expect(field.valid.value).toBe(true);
      expect(field.invalid.value).toBe(false);
      expect(field.touched.value).toBe(false);
      expect(field.dirty.value).toBe(false);
      expect(field.pending.value).toBe(false);
      expect(field.errors.value).toEqual([]);
    });

    it('should initialize with disabled status when disabled = true', () => {
      const field = fieldOf('', { disabled: true });

      expect(field.status.value).toBe('disabled');
      expect(field.valid.value).toBe(false); // valid только если status === 'valid'
    });

    it('should store component reference', () => {
      const MockComponent = () => null;
      const field = fieldOf('', { component: MockComponent });

      expect(field.component).toBe(MockComponent);
    });

    it('should initialize with componentProps', () => {
      const field = fieldOf('', {
        componentProps: { placeholder: 'Enter text', disabled: false },
      });

      expect(field.componentProps.value).toEqual({
        placeholder: 'Enter text',
        disabled: false,
      });
    });

    it('should initialize with empty componentProps by default', () => {
      const field = fieldOf('');

      expect(field.componentProps.value).toEqual({});
    });
  });

  // ==========================================================================
  // 2. Signals: value
  // ==========================================================================

  describe('Signals - value', () => {
    let field: FieldNode<string>;

    beforeEach(() => {
      field = fieldOf('initial');
    });

    it('should update value via setValue', () => {
      field.setValue('new value');

      expect(field.value.value).toBe('new value');
    });

    it('should set dirty = true when setValue is called', () => {
      expect(field.dirty.value).toBe(false);

      field.setValue('new value');

      expect(field.dirty.value).toBe(true);
    });

    it('should update value via patchValue', () => {
      field.patchValue('patched');

      expect(field.value.value).toBe('patched');
    });

    it('should update value to empty string', () => {
      field.setValue('');

      expect(field.value.value).toBe('');
    });

    it('getValue() should return current value without triggering reactivity', () => {
      field.setValue('test');

      expect(field.getValue()).toBe('test');
    });
  });

  // ==========================================================================
  // 3. Signals: touched / dirty
  // ==========================================================================

  describe('Signals - touched', () => {
    let field: FieldNode<string>;

    beforeEach(() => {
      field = fieldOf('');
    });

    it('should set touched = true via markAsTouched', () => {
      field.markAsTouched();

      expect(field.touched.value).toBe(true);
    });

    it('should set touched = false via markAsUntouched', () => {
      field.markAsTouched();
      field.markAsUntouched();

      expect(field.touched.value).toBe(false);
    });

    it('should keep errors set from outside when touched', () => {
      field.setErrors([REQUIRED]);

      field.markAsTouched();

      expect(field.errors.value).toEqual([REQUIRED]);
    });
  });

  describe('Signals - dirty', () => {
    let field: FieldNode<string>;

    beforeEach(() => {
      field = fieldOf('initial');
    });

    it('should remain dirty = false until setValue', () => {
      expect(field.dirty.value).toBe(false);
    });

    it('should remain dirty = true even when setting to initial value', () => {
      field.setValue('changed');
      field.setValue('initial');

      expect(field.dirty.value).toBe(true);
    });

    it('should set dirty = false via markAsPristine', () => {
      field.setValue('changed');
      field.markAsPristine();

      expect(field.dirty.value).toBe(false);
    });

    it('should set dirty = true via markAsDirty', () => {
      field.markAsDirty();

      expect(field.dirty.value).toBe(true);
    });
  });

  // ==========================================================================
  // 4. Signals: status, errors
  // ==========================================================================

  describe('Signals - status and errors', () => {
    it('should set errors via setErrors', () => {
      const field = fieldOf('');

      field.setErrors([
        { code: 'custom', message: 'Custom error' },
        { code: 'another', message: 'Another error' },
      ]);

      expect(field.errors.value).toHaveLength(2);
      expect(field.errors.value[0].code).toBe('custom');
      expect(field.errors.value[1].code).toBe('another');
      expect(field.status.value).toBe('invalid');
      expect(field.valid.value).toBe(false);
      expect(field.invalid.value).toBe(true);
    });

    it('should stay valid when only warnings are set', () => {
      const field = fieldOf('');

      field.setErrors([WARNING]);

      expect(field.errors.value).toEqual([WARNING]);
      expect(field.status.value).toBe('valid');
    });

    it('should clear errors via clearErrors', () => {
      const field = fieldOf('');

      field.setErrors([REQUIRED]);
      field.clearErrors();

      expect(field.errors.value).toEqual([]);
      expect(field.status.value).toBe('valid');
    });

    it('should set status to valid when setErrors with empty array', () => {
      const field = fieldOf('');

      field.setErrors([REQUIRED]);
      field.setErrors([]);

      expect(field.status.value).toBe('valid');
    });

    it('should have status "disabled" when field is disabled', () => {
      const field = fieldOf('', { disabled: true });

      expect(field.status.value).toBe('disabled');
    });
  });

  // ==========================================================================
  // 5. validate() — отражение текущих ошибок
  // ==========================================================================

  describe('validate()', () => {
    it('should resolve true when the field has no errors', async () => {
      const field = fieldOf('');

      await expect(field.validate()).resolves.toBe(true);
    });

    it('should resolve false when a blocking error is set from outside', async () => {
      const field = fieldOf('');
      field.setErrors([REQUIRED]);

      await expect(field.validate()).resolves.toBe(false);
    });

    it('should resolve true when only warnings are set', async () => {
      const field = fieldOf('');
      field.setErrors([WARNING]);

      await expect(field.validate()).resolves.toBe(true);
    });

    it('should not clear errors set from outside', async () => {
      const field = fieldOf('');
      field.setErrors([REQUIRED]);

      await field.validate();

      expect(field.errors.value).toEqual([REQUIRED]);
      expect(field.status.value).toBe('invalid');
    });
  });

  // ==========================================================================
  // 6. shouldShowError computed
  // ==========================================================================

  describe('shouldShowError', () => {
    it('should be false when valid', () => {
      const field = fieldOf('test');

      field.markAsTouched();

      expect(field.shouldShowError.value).toBe(false);
    });

    it('should be false when invalid but not touched and not dirty', () => {
      const field = fieldOf('');

      field.setErrors([REQUIRED]);

      expect(field.invalid.value).toBe(true);
      expect(field.shouldShowError.value).toBe(false);
    });

    it('should be true when invalid AND (touched OR dirty)', () => {
      const field = fieldOf('');
      field.setErrors([REQUIRED]);

      field.markAsTouched();
      expect(field.shouldShowError.value).toBe(true);

      field.markAsUntouched();
      expect(field.shouldShowError.value).toBe(false);

      field.setValue('x');
      expect(field.dirty.value).toBe(true);
      expect(field.shouldShowError.value).toBe(true);
    });
  });

  // ==========================================================================
  // 7. Reset
  // ==========================================================================

  describe('reset()', () => {
    it('should reset to initial value', () => {
      const field = fieldOf('initial');

      field.setValue('changed');
      field.reset();

      expect(field.value.value).toBe('initial');
    });

    it('should reset to provided value', () => {
      const field = fieldOf('initial');

      field.setValue('changed');
      field.reset('new initial');

      expect(field.value.value).toBe('new initial');
    });

    it('should clear errors, touched, dirty and status', () => {
      const field = fieldOf('initial');

      field.setValue('changed');
      field.markAsTouched();
      field.setErrors([REQUIRED]);

      field.reset();

      expect(field.errors.value).toEqual([]);
      expect(field.touched.value).toBe(false);
      expect(field.dirty.value).toBe(false);
      expect(field.status.value).toBe('valid');
    });
  });

  describe('resetToInitial()', () => {
    it('should reset to initial value even after reset(newValue)', () => {
      const field = fieldOf('initial');

      field.setValue('changed');
      field.reset('temp');
      expect(field.value.value).toBe('temp');

      field.resetToInitial();

      expect(field.value.value).toBe('initial');
    });

    it('should clear state like reset()', () => {
      const field = fieldOf('initial');

      field.setValue('changed');
      field.markAsTouched();
      field.setErrors([REQUIRED]);

      field.resetToInitial();

      expect(field.errors.value).toEqual([]);
      expect(field.touched.value).toBe(false);
      expect(field.dirty.value).toBe(false);
    });
  });

  // ==========================================================================
  // 8. Enable/Disable
  // ==========================================================================

  describe('enable() / disable()', () => {
    it('should disable field', () => {
      const field = fieldOf('');

      field.disable();

      expect(field.status.value).toBe('disabled');
      expect(field.disabled.value).toBe(true);
    });

    it('should enable field', () => {
      const field = fieldOf('', { disabled: true });

      field.enable();

      expect(field.status.value).toBe('valid');
      expect(field.disabled.value).toBe(false);
    });

    it('should clear errors when disabled', () => {
      const field = fieldOf('');
      field.setErrors([REQUIRED]);

      field.disable();

      expect(field.errors.value).toEqual([]);
    });

    it('should handle multiple enable/disable cycles', () => {
      const field = fieldOf('');

      field.disable();
      expect(field.disabled.value).toBe(true);

      field.enable();
      expect(field.disabled.value).toBe(false);

      field.disable();
      expect(field.disabled.value).toBe(true);

      field.enable();
      expect(field.status.value).toBe('valid');
    });
  });

  // ==========================================================================
  // 9. componentProps
  // ==========================================================================

  describe('componentProps', () => {
    it('should update componentProps via updateComponentProps', () => {
      const field = fieldOf('', { componentProps: { placeholder: 'Initial' } });

      field.updateComponentProps({ placeholder: 'Updated' });

      expect(field.componentProps.value).toEqual({ placeholder: 'Updated' });
    });

    it('should merge componentProps', () => {
      const field = fieldOf('', {
        componentProps: { placeholder: 'Text', maxLength: 100 },
      });

      field.updateComponentProps({ placeholder: 'New text' });

      expect(field.componentProps.value).toEqual({ placeholder: 'New text', maxLength: 100 });
    });

    it('should add new componentProps', () => {
      const field = fieldOf('', { componentProps: { placeholder: 'Text' } });

      field.updateComponentProps({ options: ['a', 'b'] });

      expect(field.componentProps.value).toEqual({ placeholder: 'Text', options: ['a', 'b'] });
    });
  });

  // ==========================================================================
  // 10. watch / computeFrom
  // ==========================================================================

  describe('watch()', () => {
    it('should call callback immediately with current value', () => {
      const field = fieldOf('initial');
      const callback = vi.fn();

      field.watch(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('initial', expect.any(AbortSignal));
    });

    it('should call callback on value change', () => {
      const field = fieldOf('initial');
      const callback = vi.fn();

      field.watch(callback);
      field.setValue('changed');

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith('changed', expect.any(AbortSignal));
    });

    it('should return unsubscribe function', () => {
      const field = fieldOf('initial');
      const callback = vi.fn();

      const unsubscribe = field.watch(callback);
      unsubscribe();
      field.setValue('changed');

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('computeFrom()', () => {
    it('should compute value from single source', () => {
      const source = fieldOf(100);
      const target = fieldOf(0);

      target.computeFrom([source.value], (value: number) => value * 2);

      expect(target.value.value).toBe(200);
    });

    it('should update when source changes', () => {
      const source = fieldOf(100);
      const target = fieldOf(0);

      target.computeFrom([source.value], (value: number) => value * 2);
      source.setValue(50);

      expect(target.value.value).toBe(100);
    });

    it('should compute from multiple sources', () => {
      const price = fieldOf(100);
      const quantity = fieldOf(2);
      const total = fieldOf(0);

      total.computeFrom(
        [price.value, quantity.value],
        (priceValue: number, quantityValue: number) => priceValue * quantityValue
      );

      expect(total.value.value).toBe(200);

      quantity.setValue(5);
      expect(total.value.value).toBe(500);
    });

    it('should return unsubscribe function', () => {
      const source = fieldOf(100);
      const target = fieldOf(0);

      const unsubscribe = target.computeFrom([source.value], (value: number) => value * 2);
      unsubscribe();
      source.setValue(50);

      expect(target.value.value).toBe(200);
    });
  });

  // ==========================================================================
  // 11. Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle falsy values correctly', () => {
      const zero = fieldOf(0);
      const empty = fieldOf('');
      const falsy = fieldOf(false);

      expect(zero.value.value).toBe(0);
      expect(empty.value.value).toBe('');
      expect(falsy.value.value).toBe(false);
    });
  });
});
