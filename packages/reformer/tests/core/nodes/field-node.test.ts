/**
 * Unit tests for FormControlNode (нода поля) - основные тесты
 *
 * Покрывает:
 * - Инициализация (конструктор, дефолтные значения)
 * - Signals (value, touched, dirty, disabled, valid, invalid, issues, pending)
 * - Reset
 * - Enable/disable
 * - shouldShowError computed
 * - componentProps
 * - valid как отражение замечаний, пришедших извне
 *
 * Другие тесты в отдельных файлах:
 * - field-node-model-binding.test.ts - привязка к сигналу модели
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@preact/signals-core';
import { FormControlNode } from '../../../src/form/nodes/form-control-node';
import type { ValidationIssue } from '../../../src/form/types/index';
import { fieldOf } from '../../test-utils/form-from-fields';

const REQUIRED: ValidationIssue = { code: 'required' };
const WARNING: ValidationIssue = { code: 'weak', severity: 'warning' };

describe('FormControlNode', () => {
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
      const field = new FormControlNode({ valueSignal });

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

      expect(field.valid.value).toBe(true);
      expect(field.valid.value).toBe(true);
      expect(field.invalid.value).toBe(false);
      expect(field.touched.value).toBe(false);
      expect(field.dirty.value).toBe(false);
      expect(field.pending.value).toBe(false);
      expect(field.issues.value).toEqual([]);
    });

    it('should initialize disabled when disabled = true', () => {
      const field = fieldOf('', { disabled: true });

      expect(field.disabled.value).toBe(true);
      expect(field.valid.value).toBe(false); // отключённое поле не валидно и не невалидно
      expect(field.invalid.value).toBe(false);
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
    let field: FormControlNode<string>;

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
    let field: FormControlNode<string>;

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

    it('should keep issues set from outside when touched', () => {
      field.setIssues([REQUIRED]);

      field.markAsTouched();

      expect(field.issues.value).toEqual([REQUIRED]);
    });
  });

  describe('Signals - dirty', () => {
    let field: FormControlNode<string>;

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

    it('should set dirty = false via reset', () => {
      field.setValue('changed');
      field.reset();

      expect(field.dirty.value).toBe(false);
    });
  });

  // ==========================================================================
  // 4. Signals: valid, invalid, disabled, issues
  // ==========================================================================

  describe('Signals - validity and issues', () => {
    it('should set issues via setIssues', () => {
      const field = fieldOf('');

      field.setIssues([{ code: 'custom' }, { code: 'another' }]);

      expect(field.issues.value).toHaveLength(2);
      expect(field.issues.value[0].code).toBe('custom');
      expect(field.issues.value[1].code).toBe('another');
      expect(field.invalid.value).toBe(true);
      expect(field.valid.value).toBe(false);
      expect(field.invalid.value).toBe(true);
    });

    it('should stay valid when only warnings are set', () => {
      const field = fieldOf('');

      field.setIssues([WARNING]);

      expect(field.issues.value).toEqual([WARNING]);
      expect(field.valid.value).toBe(true);
    });

    it('should clear issues via clearIssues', () => {
      const field = fieldOf('');

      field.setIssues([REQUIRED]);
      field.clearIssues();

      expect(field.issues.value).toEqual([]);
      expect(field.valid.value).toBe(true);
    });

    it('should become valid when setIssues with empty array', () => {
      const field = fieldOf('');

      field.setIssues([REQUIRED]);
      field.setIssues([]);

      expect(field.valid.value).toBe(true);
    });

    it('should be disabled when field is disabled', () => {
      const field = fieldOf('', { disabled: true });

      expect(field.disabled.value).toBe(true);
    });
  });

  // ==========================================================================
  // 5. valid — отражение замечаний, пришедших извне
  // ==========================================================================

  describe('valid from outside issues', () => {
    it('is valid when the field has no issues', () => {
      const field = fieldOf('');

      expect(field.valid.value).toBe(true);
    });

    it('is invalid when a blocking issue is set from outside', () => {
      const field = fieldOf('');
      field.setIssues([REQUIRED]);

      expect(field.valid.value).toBe(false);
      expect(field.invalid.value).toBe(true);
    });

    it('stays valid when only warnings are set', () => {
      const field = fieldOf('');
      field.setIssues([WARNING]);

      expect(field.valid.value).toBe(true);
      expect(field.issues.value).toEqual([WARNING]);
    });

    it('waits while a validation run is pending, then reflects issues', () => {
      const field = fieldOf('');
      field.setPending(true);
      field.setIssues([REQUIRED]);

      expect(field.pending.value).toBe(true);
      expect(field.valid.value).toBe(false);
      expect(field.invalid.value).toBe(false);

      field.setPending(false);
      expect(field.pending.value).toBe(false);
      expect(field.invalid.value).toBe(true);
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

      field.setIssues([REQUIRED]);

      expect(field.invalid.value).toBe(true);
      expect(field.shouldShowError.value).toBe(false);
    });

    it('should be true when invalid AND (touched OR dirty)', () => {
      const field = fieldOf('');
      field.setIssues([REQUIRED]);

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

    it('should clear issues, touched, dirty and status', () => {
      const field = fieldOf('initial');

      field.setValue('changed');
      field.markAsTouched();
      field.setIssues([REQUIRED]);

      field.reset();

      expect(field.issues.value).toEqual([]);
      expect(field.touched.value).toBe(false);
      expect(field.dirty.value).toBe(false);
      expect(field.valid.value).toBe(true);
    });
  });

  describe('reset() after reset(value)', () => {
    it('should return to the creation value: reset(value) does not move it', () => {
      const field = fieldOf('initial');

      field.setValue('changed');
      field.reset('temp');
      expect(field.value.value).toBe('temp');

      field.reset();

      expect(field.value.value).toBe('initial');
    });
  });

  // ==========================================================================
  // 8. Enable/Disable
  // ==========================================================================

  describe('enable() / disable()', () => {
    it('should disable field', () => {
      const field = fieldOf('');

      field.disable();

      expect(field.disabled.value).toBe(true);
      expect(field.disabled.value).toBe(true);
    });

    it('should enable field', () => {
      const field = fieldOf('', { disabled: true });

      field.enable();

      expect(field.valid.value).toBe(true);
      expect(field.disabled.value).toBe(false);
    });

    it('should clear issues when disabled', () => {
      const field = fieldOf('');
      field.setIssues([REQUIRED]);

      field.disable();

      expect(field.issues.value).toEqual([]);
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
      expect(field.valid.value).toBe(true);
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
  // 10. Edge Cases
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
