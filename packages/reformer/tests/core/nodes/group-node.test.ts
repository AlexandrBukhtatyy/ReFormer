/**
 * Unit tests for GroupNode - основные тесты
 *
 * Покрывает:
 * - Инициализация (конструктор, Proxy)
 * - getValue / setValue / patchValue
 * - reset / resetToInitial
 * - Доступ к полям через Proxy
 * - Агрегация состояния (valid, invalid, touched, dirty, pending, status)
 * - markAsTouched/markAsUntouched/markAsDirty/markAsPristine (каскадные)
 * - enable/disable (каскадные)
 * - validate()
 * - submit()
 * - linkFields / watchField (базовые тесты)
 *
 * Другие тесты в отдельных файлах:
 * - group-node-cleanup.test.ts - dispose mechanism
 * - group-node-form-errors.test.ts - form-level errors
 * - group-node-get-field-by-path.test.ts - path navigation
 * - group-node-reference-equality.test.ts - value caching
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeForm } from '../../../src/core/utils/create-form';
import { GroupNode } from '../../../src/core/nodes/group-node';
import type {
  GroupNodeWithControls,
  FormSchema,
  ValidatorFn,
  AsyncValidatorFn,
} from '../../../src/core/types';
import { ComponentInstance } from '../../test-utils/types';

// ============================================================================
// Тестовые схемы
// ============================================================================

interface SimpleForm {
  email: string;
  password: string;
}

interface NestedForm {
  name: string;
  address: {
    city: string;
    street: string;
  };
}

interface FormWithNumbers {
  count: number;
  price: number;
}

const simpleSchema: FormSchema<SimpleForm> = {
  email: { value: '', component: null as ComponentInstance },
  password: { value: '', component: null as ComponentInstance },
};

const nestedSchema: FormSchema<NestedForm> = {
  name: { value: '', component: null as ComponentInstance },
  address: {
    city: { value: '', component: null as ComponentInstance },
    street: { value: '', component: null as ComponentInstance },
  },
};

// ============================================================================
// Тестовые валидаторы
// ============================================================================

const requiredValidator: ValidatorFn<string> = (value) => {
  return value === '' ? { code: 'required', message: 'Field is required' } : null;
};

const asyncValidator =
  (delay: number): AsyncValidatorFn<string> =>
  async (value) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return value === 'taken' ? { code: 'taken', message: 'Value is taken' } : null;
  };

// ============================================================================
// Тесты
// ============================================================================

describe('GroupNode', () => {
  // ==========================================================================
  // 1. Инициализация
  // ==========================================================================

  describe('Initialization', () => {
    it('should create from simple schema', () => {
      const form = new GroupNode(simpleSchema);

      expect(form.email).toBeDefined();
      expect(form.password).toBeDefined();
    });

    it('should create with new API (GroupNodeConfig)', () => {
      const form = new GroupNode<SimpleForm>({
        form: simpleSchema,
      });

      expect(form.email).toBeDefined();
      expect(form.password).toBeDefined();
    });

    it('should create with nested groups', () => {
      const form = new GroupNode(nestedSchema);

      expect(form.name).toBeDefined();
      expect(form.address).toBeDefined();
      expect(form.address.city).toBeDefined();
      expect(form.address.street).toBeDefined();
    });

    it('should return Proxy from constructor', () => {
      const form = new GroupNode(simpleSchema);

      // Proxy позволяет обращаться к полям напрямую
      expect(form.email.value.value).toBe('');
      expect(form.password.value.value).toBe('');
    });

    it('should initialize with initial values from schema', () => {
      const schemaWithValues: FormSchema<SimpleForm> = {
        email: { value: 'test@mail.com', component: null as ComponentInstance },
        password: { value: 'secret', component: null as ComponentInstance },
      };

      const form = new GroupNode(schemaWithValues);

      expect(form.email.value.value).toBe('test@mail.com');
      expect(form.password.value.value).toBe('secret');
    });

    it('should initialize with valid status', () => {
      const form = new GroupNode(simpleSchema);

      expect(form.valid.value).toBe(true);
      expect(form.invalid.value).toBe(false);
      expect(form.status.value).toBe('valid');
    });

    it('should initialize with touched = false', () => {
      const form = new GroupNode(simpleSchema);

      expect(form.touched.value).toBe(false);
    });

    it('should initialize with dirty = false', () => {
      const form = new GroupNode(simpleSchema);

      expect(form.dirty.value).toBe(false);
    });

    it('should initialize with pending = false', () => {
      const form = new GroupNode(simpleSchema);

      expect(form.pending.value).toBe(false);
    });

    it('should initialize with submitting = false', () => {
      const form = new GroupNode(simpleSchema);

      expect(form.submitting.value).toBe(false);
    });

    it('should initialize with empty errors', () => {
      const form = new GroupNode(simpleSchema);

      expect(form.errors.value).toEqual([]);
    });
  });

  // ==========================================================================
  // 2. Proxy доступ к полям
  // ==========================================================================

  describe('Proxy Field Access', () => {
    let form: GroupNodeWithControls<SimpleForm>;

    beforeEach(() => {
      form = makeForm(simpleSchema);
    });

    it('should access field via Proxy', () => {
      expect(form.email).toBeDefined();
      expect(form.email.value).toBeDefined();
    });

    it('should access nested field via Proxy', () => {
      const nestedForm = makeForm(nestedSchema);

      expect(nestedForm.address.city).toBeDefined();
      expect(nestedForm.address.city.value.value).toBe('');
    });

    it('should set field value via Proxy', () => {
      form.email.setValue('test@mail.com');

      expect(form.email.value.value).toBe('test@mail.com');
    });

    it('should get field via getField()', () => {
      const emailField = form.getField('email');

      expect(emailField).toBe(form.email);
    });

    it('should return same instance on multiple accesses', () => {
      const email1 = form.email;
      const email2 = form.email;

      expect(email1).toBe(email2);
    });
  });

  // ==========================================================================
  // 3. getValue / setValue / patchValue
  // ==========================================================================

  describe('getValue / setValue / patchValue', () => {
    let form: GroupNodeWithControls<SimpleForm>;

    beforeEach(() => {
      form = makeForm(simpleSchema);
    });

    it('should return all values as object via getValue()', () => {
      form.email.setValue('test@mail.com');
      form.password.setValue('secret');

      expect(form.getValue()).toEqual({
        email: 'test@mail.com',
        password: 'secret',
      });
    });

    it('should set all values via setValue()', () => {
      form.setValue({
        email: 'new@mail.com',
        password: 'newpass',
      });

      expect(form.email.value.value).toBe('new@mail.com');
      expect(form.password.value.value).toBe('newpass');
    });

    it('should update only specified values via patchValue()', () => {
      form.email.setValue('initial@mail.com');
      form.password.setValue('initial');

      form.patchValue({ email: 'patched@mail.com' });

      expect(form.email.value.value).toBe('patched@mail.com');
      expect(form.password.value.value).toBe('initial');
    });

    it('should ignore undefined in patchValue()', () => {
      form.email.setValue('initial@mail.com');

      form.patchValue({ email: undefined as unknown as string, password: 'patched' });

      expect(form.email.value.value).toBe('initial@mail.com');
      expect(form.password.value.value).toBe('patched');
    });

    it('should get nested values recursively', () => {
      const nestedForm = makeForm(nestedSchema);
      nestedForm.address.city.setValue('Moscow');
      nestedForm.address.street.setValue('Main St');

      expect(nestedForm.getValue()).toEqual({
        name: '',
        address: {
          city: 'Moscow',
          street: 'Main St',
        },
      });
    });

    it('should set nested values recursively', () => {
      const nestedForm = makeForm(nestedSchema);

      nestedForm.setValue({
        name: 'John',
        address: {
          city: 'NYC',
          street: '5th Ave',
        },
      });

      expect(nestedForm.address.city.value.value).toBe('NYC');
      expect(nestedForm.address.street.value.value).toBe('5th Ave');
    });

    it('should mark fields as dirty on setValue()', () => {
      form.setValue({ email: 'new@mail.com', password: 'new' });

      expect(form.email.dirty.value).toBe(true);
      expect(form.password.dirty.value).toBe(true);
    });
  });

  // ==========================================================================
  // 4. reset / resetToInitial
  // ==========================================================================

  describe('reset / resetToInitial', () => {
    let form: GroupNodeWithControls<SimpleForm>;

    beforeEach(() => {
      form = makeForm({
        email: { value: 'initial@mail.com', component: null as ComponentInstance },
        password: { value: 'initial', component: null as ComponentInstance },
      });
    });

    it('should reset to initial values', () => {
      form.email.setValue('changed@mail.com');
      form.password.setValue('changed');

      form.reset();

      expect(form.email.value.value).toBe('initial@mail.com');
      expect(form.password.value.value).toBe('initial');
    });

    it('should reset to provided values', () => {
      form.reset({
        email: 'reset@mail.com',
        password: 'reset',
      });

      expect(form.email.value.value).toBe('reset@mail.com');
      expect(form.password.value.value).toBe('reset');
    });

    it('should clear touched flag on reset()', () => {
      form.email.markAsTouched();
      expect(form.touched.value).toBe(true);

      form.reset();

      expect(form.email.touched.value).toBe(false);
      expect(form.touched.value).toBe(false);
    });

    it('should clear dirty flag on reset()', () => {
      form.email.setValue('changed');
      expect(form.dirty.value).toBe(true);

      form.reset();

      expect(form.email.dirty.value).toBe(false);
      expect(form.dirty.value).toBe(false);
    });

    it('should clear errors on reset()', () => {
      form.email.setErrors([{ code: 'error', message: 'Error' }]);
      expect(form.errors.value.length).toBeGreaterThan(0);

      form.reset();

      expect(form.email.errors.value).toEqual([]);
    });

    it('should resetToInitial() always use initial values', () => {
      form.reset({ email: 'temp', password: 'temp' });
      expect(form.email.value.value).toBe('temp');

      form.resetToInitial();

      expect(form.email.value.value).toBe('initial@mail.com');
      expect(form.password.value.value).toBe('initial');
    });

    it('should reset nested forms recursively', () => {
      const nestedForm = makeForm<NestedForm>({
        name: { value: 'Initial', component: null as ComponentInstance },
        address: {
          city: { value: 'Moscow', component: null as ComponentInstance },
          street: { value: 'Main', component: null as ComponentInstance },
        },
      });

      nestedForm.address.city.setValue('Changed');
      nestedForm.reset();

      expect(nestedForm.address.city.value.value).toBe('Moscow');
    });
  });

  // ==========================================================================
  // 5. Агрегация состояния
  // ==========================================================================

  describe('Aggregated State', () => {
    let form: GroupNodeWithControls<SimpleForm>;

    beforeEach(() => {
      form = makeForm(simpleSchema);
    });

    describe('touched', () => {
      it('should be false when no fields touched', () => {
        expect(form.touched.value).toBe(false);
      });

      it('should be true when any field touched', () => {
        form.email.markAsTouched();

        expect(form.touched.value).toBe(true);
      });

      it('should be true when all fields touched', () => {
        form.email.markAsTouched();
        form.password.markAsTouched();

        expect(form.touched.value).toBe(true);
      });
    });

    describe('dirty', () => {
      it('should be false when no fields dirty', () => {
        expect(form.dirty.value).toBe(false);
      });

      it('should be true when any field dirty', () => {
        form.email.setValue('changed');

        expect(form.dirty.value).toBe(true);
      });
    });

    describe('valid / invalid', () => {
      it('should be valid when all fields valid', () => {
        expect(form.valid.value).toBe(true);
        expect(form.invalid.value).toBe(false);
      });

      it('should be invalid when any field has errors', () => {
        form.email.setErrors([{ code: 'error', message: 'Error' }]);

        expect(form.valid.value).toBe(false);
        expect(form.invalid.value).toBe(true);
      });
    });

    describe('pending', () => {
      it('should be false when no async validation running', () => {
        expect(form.pending.value).toBe(false);
      });

      it('should be true during async validation', async () => {
        const formWithAsync = makeForm<SimpleForm>({
          email: {
            value: '',
            component: null as ComponentInstance,
            asyncValidators: [asyncValidator(100)],
            updateOn: 'submit',
          },
          password: { value: '', component: null as ComponentInstance },
        });

        const validatePromise = formWithAsync.email.validate();

        expect(formWithAsync.pending.value).toBe(true);

        await validatePromise;

        expect(formWithAsync.pending.value).toBe(false);
      });
    });
  });

  // ==========================================================================
  // 6. markAsTouched / markAsUntouched / markAsDirty / markAsPristine
  // ==========================================================================

  describe('State Methods (cascading)', () => {
    let form: GroupNodeWithControls<SimpleForm>;

    beforeEach(() => {
      form = makeForm(simpleSchema);
    });

    it('should markAsTouched() all fields recursively', () => {
      form.markAsTouched();

      expect(form.email.touched.value).toBe(true);
      expect(form.password.touched.value).toBe(true);
      expect(form.touched.value).toBe(true);
    });

    it('should markAsUntouched() all fields recursively', () => {
      form.email.markAsTouched();
      form.password.markAsTouched();

      form.markAsUntouched();

      expect(form.email.touched.value).toBe(false);
      expect(form.password.touched.value).toBe(false);
      expect(form.touched.value).toBe(false);
    });

    it('should markAsDirty() all fields recursively', () => {
      form.markAsDirty();

      expect(form.email.dirty.value).toBe(true);
      expect(form.password.dirty.value).toBe(true);
    });

    it('should markAsPristine() all fields recursively', () => {
      form.email.setValue('changed');
      form.password.setValue('changed');

      form.markAsPristine();

      expect(form.email.dirty.value).toBe(false);
      expect(form.password.dirty.value).toBe(false);
      expect(form.dirty.value).toBe(false);
    });

    it('should touchAll() work as markAsTouched()', () => {
      form.touchAll();

      expect(form.email.touched.value).toBe(true);
      expect(form.password.touched.value).toBe(true);
    });

    it('should cascade to nested groups', () => {
      const nestedForm = makeForm(nestedSchema);

      nestedForm.markAsTouched();

      expect(nestedForm.name.touched.value).toBe(true);
      expect(nestedForm.address.city.touched.value).toBe(true);
      expect(nestedForm.address.street.touched.value).toBe(true);
    });
  });

  // ==========================================================================
  // 7. enable / disable
  // ==========================================================================

  describe('enable / disable', () => {
    let form: GroupNodeWithControls<SimpleForm>;

    beforeEach(() => {
      form = makeForm(simpleSchema);
    });

    it('should disable() all fields', () => {
      form.disable();

      expect(form.email.status.value).toBe('disabled');
      expect(form.password.status.value).toBe('disabled');
      expect(form.status.value).toBe('disabled');
    });

    it('should enable() all fields', () => {
      form.disable();
      form.enable();

      expect(form.email.status.value).not.toBe('disabled');
      expect(form.password.status.value).not.toBe('disabled');
      expect(form.status.value).not.toBe('disabled');
    });

    it('should clear errors on disable()', () => {
      form.email.setErrors([{ code: 'error', message: 'Error' }]);

      form.disable();

      expect(form.email.errors.value).toEqual([]);
    });

    it('should cascade to nested groups', () => {
      const nestedForm = makeForm(nestedSchema);

      nestedForm.disable();

      expect(nestedForm.name.status.value).toBe('disabled');
      expect(nestedForm.address.city.status.value).toBe('disabled');
      expect(nestedForm.address.street.status.value).toBe('disabled');
    });
  });

  // ==========================================================================
  // 8. validate()
  // ==========================================================================

  describe('validate()', () => {
    it('should return true when all fields valid', async () => {
      const form = makeForm(simpleSchema);

      const result = await form.validate();

      expect(result).toBe(true);
      expect(form.valid.value).toBe(true);
    });

    it('should return false when any field invalid', async () => {
      const form = makeForm<SimpleForm>({
        email: {
          value: '',
          component: null as ComponentInstance,
          validators: [requiredValidator],
        },
        password: { value: '', component: null as ComponentInstance },
      });

      const result = await form.validate();

      expect(result).toBe(false);
      expect(form.valid.value).toBe(false);
    });

    it('should validate all fields', async () => {
      const form = makeForm<SimpleForm>({
        email: {
          value: '',
          component: null as ComponentInstance,
          validators: [requiredValidator],
        },
        password: {
          value: '',
          component: null as ComponentInstance,
          validators: [requiredValidator],
        },
      });

      await form.validate();

      expect(form.email.errors.value.length).toBeGreaterThan(0);
      expect(form.password.errors.value.length).toBeGreaterThan(0);
    });

    it('should validate nested groups', async () => {
      const nestedForm = makeForm<NestedForm>({
        name: {
          value: '',
          component: null as ComponentInstance,
          validators: [requiredValidator],
        },
        address: {
          city: {
            value: '',
            component: null as ComponentInstance,
            validators: [requiredValidator],
          },
          street: { value: 'has value', component: null as ComponentInstance },
        },
      });

      const result = await nestedForm.validate();

      expect(result).toBe(false);
      expect(nestedForm.name.errors.value.length).toBeGreaterThan(0);
      expect(nestedForm.address.city.errors.value.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 9. submit()
  // ==========================================================================

  describe('submit()', () => {
    it('should call onSubmit when form is valid', async () => {
      const form = makeForm(simpleSchema);
      const onSubmit = vi.fn().mockResolvedValue('success');

      const result = await form.submit(onSubmit);

      expect(onSubmit).toHaveBeenCalledWith({ email: '', password: '' });
      expect(result).toBe('success');
    });

    it('should not call onSubmit when form is invalid', async () => {
      const form = makeForm<SimpleForm>({
        email: {
          value: '',
          component: null as ComponentInstance,
          validators: [requiredValidator],
        },
        password: { value: '', component: null as ComponentInstance },
      });
      const onSubmit = vi.fn();

      const result = await form.submit(onSubmit);

      expect(onSubmit).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should markAsTouched() before validation', async () => {
      const form = makeForm(simpleSchema);
      const onSubmit = vi.fn().mockResolvedValue('success');

      await form.submit(onSubmit);

      expect(form.email.touched.value).toBe(true);
      expect(form.password.touched.value).toBe(true);
    });

    it('should set submitting = true during execution', async () => {
      const form = makeForm(simpleSchema);
      let submittingDuringCall = false;

      const onSubmit = vi.fn().mockImplementation(() => {
        submittingDuringCall = form.submitting.value;
        return Promise.resolve('done');
      });

      await form.submit(onSubmit);

      expect(submittingDuringCall).toBe(true);
      expect(form.submitting.value).toBe(false);
    });

    it('should set submitting = false after error', async () => {
      const form = makeForm(simpleSchema);
      const onSubmit = vi.fn().mockRejectedValue(new Error('Submit failed'));

      await expect(form.submit(onSubmit)).rejects.toThrow('Submit failed');

      expect(form.submitting.value).toBe(false);
    });

    it('should return result from onSubmit', async () => {
      const form = makeForm(simpleSchema);
      const onSubmit = vi.fn().mockResolvedValue({ id: 123, status: 'created' });

      const result = await form.submit(onSubmit);

      expect(result).toEqual({ id: 123, status: 'created' });
    });
  });

  // ==========================================================================
  // 10. linkFields
  // ==========================================================================

  describe('linkFields', () => {
    it('should link two fields', () => {
      const form = makeForm<FormWithNumbers>({
        count: { value: 10, component: null as ComponentInstance },
        price: { value: 0, component: null as ComponentInstance },
      });

      form.linkFields('count', 'price', (count: number) => count * 100);

      expect(form.price.value.value).toBe(1000);
    });

    it('should update target when source changes', () => {
      const form = makeForm<FormWithNumbers>({
        count: { value: 10, component: null as ComponentInstance },
        price: { value: 0, component: null as ComponentInstance },
      });

      form.linkFields('count', 'price', (count: number) => count * 100);

      form.count.setValue(20);

      expect(form.price.value.value).toBe(2000);
    });

    it('should return unsubscribe function', () => {
      const form = makeForm<FormWithNumbers>({
        count: { value: 10, component: null as ComponentInstance },
        price: { value: 0, component: null as ComponentInstance },
      });

      const unsubscribe = form.linkFields('count', 'price', (count: number) => count * 100);

      unsubscribe();
      form.count.setValue(20);

      expect(form.price.value.value).toBe(1000); // Not updated
    });
  });

  // ==========================================================================
  // 11. watchField
  // ==========================================================================

  describe('watchField', () => {
    it('should call callback on field change', () => {
      const form = makeForm(simpleSchema);
      const callback = vi.fn();

      form.watchField('email', callback);

      form.email.setValue('test@mail.com');

      expect(callback).toHaveBeenCalledWith('test@mail.com');
    });

    it('should call callback immediately with current value', () => {
      const form = makeForm({
        email: { value: 'initial@mail.com', component: null as ComponentInstance },
        password: { value: '', component: null as ComponentInstance },
      });
      const callback = vi.fn();

      form.watchField('email', callback);

      expect(callback).toHaveBeenCalledWith('initial@mail.com');
    });

    it('should return unsubscribe function', () => {
      const form = makeForm(simpleSchema);
      const callback = vi.fn();

      const unsubscribe = form.watchField('email', callback);

      unsubscribe();
      form.email.setValue('test@mail.com');

      expect(callback).toHaveBeenCalledTimes(1); // Only initial call
    });

    it('should support nested paths', () => {
      const nestedForm = makeForm(nestedSchema);
      const callback = vi.fn();

      nestedForm.watchField('address.city', callback);

      nestedForm.address.city.setValue('Moscow');

      expect(callback).toHaveBeenCalledWith('Moscow');
    });
  });

  // ==========================================================================
  // 12. getAllFields
  // ==========================================================================

  describe('getAllFields', () => {
    it('should return iterator of all fields', () => {
      const form = makeForm(simpleSchema);

      const fields = Array.from(form.getAllFields());

      expect(fields).toHaveLength(2);
    });

    it('should include nested fields', () => {
      const nestedForm = makeForm(nestedSchema);

      const fields = Array.from(nestedForm.getAllFields());

      // getAllFields возвращает прямых потомков: name + address = 2
      expect(fields.length).toBe(2);
    });
  });

  // ==========================================================================
  // 13. Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty schema', () => {
      type EmptyForm = Record<string, never>;

      const emptyForm = makeForm<EmptyForm>({});

      expect(emptyForm.getValue()).toEqual({});
      expect(emptyForm.valid.value).toBe(true);
    });

    it('should handle schema with single field', () => {
      interface SingleForm {
        name: string;
      }

      const singleForm = makeForm<SingleForm>({
        name: { value: 'test', component: null as ComponentInstance },
      });

      expect(singleForm.getValue()).toEqual({ name: 'test' });
    });

    it('should handle deep nesting (3+ levels)', () => {
      interface DeepForm {
        level1: {
          level2: {
            level3: {
              value: string;
            };
          };
        };
      }

      const deepForm = makeForm<DeepForm>({
        level1: {
          level2: {
            level3: {
              value: { value: 'deep', component: null as ComponentInstance },
            },
          },
        },
      });

      // Используем getFieldByPath для доступа к полю value
      const valueField = deepForm.getFieldByPath('level1.level2.level3.value');
      expect(valueField?.value.value).toBe('deep');
    });
  });
});
