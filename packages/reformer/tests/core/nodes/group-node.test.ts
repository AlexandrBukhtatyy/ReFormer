/**
 * Unit tests for GroupNode - основные тесты
 *
 * Покрывает:
 * - Инициализация (конструктор, Proxy)
 * - getValue / setValue / patchValue
 * - reset
 * - Доступ к полям через Proxy
 * - Агрегация состояния (valid, invalid, touched, dirty, pending, status)
 * - markAsTouched/markAsUntouched/markAsDirty/markAsPristine (каскадные)
 * - enable/disable (каскадные)
 * - validate()
 * - submit()
 *
 * Другие тесты в отдельных файлах:
 * - group-node-form-errors.test.ts - form-level errors
 * - group-node-reference-equality.test.ts - value caching
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createModel } from '../../../src/model/index';
import { createFormFromModel } from '../../../src/form/create-form';
import { defineValidationSchema, validate, validateModel } from '../../../src/form/validation';
import { required } from '../../../src/form/validators';
import type { FormProxy } from '../../../src/form/types/index';
import { ComponentInstance } from '../../test-utils/types';
import { formFromFields, type TestFields } from '../../test-utils/form-from-fields';

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

const simpleSchema: TestFields<SimpleForm> = {
  email: { value: '', component: null as ComponentInstance },
  password: { value: '', component: null as ComponentInstance },
};

const nestedSchema: TestFields<NestedForm> = {
  name: { value: '', component: null as ComponentInstance },
  address: {
    city: { value: '', component: null as ComponentInstance },
    street: { value: '', component: null as ComponentInstance },
  },
};

// ============================================================================
// Форма со схемой валидации
// ============================================================================

const REQUIRED = [required({ message: 'Field is required' })];

/** Правила формы: обязательны `name` и `address.city`. */
const nestedRules = defineValidationSchema<NestedForm>(({ model }) => {
  validate(model.$.name, REQUIRED);
  validate(model.$.address.city, REQUIRED);
});

/** Модель и форма без схемы разметки: ноды строятся по виду узлов модели. */
function nestedFormWithModel(initial: Partial<NestedForm> = {}) {
  const model = createModel<NestedForm>({
    name: '',
    address: { city: '', street: 'has value' },
    ...initial,
  });
  return { model, form: createFormFromModel<NestedForm>({ model }) };
}

// ============================================================================
// Тесты
// ============================================================================

describe('GroupNode', () => {
  // ==========================================================================
  // 1. Инициализация
  // ==========================================================================

  describe('Initialization', () => {
    it('should create from simple schema', () => {
      const form = formFromFields(simpleSchema);

      expect(form.email).toBeDefined();
      expect(form.password).toBeDefined();
    });

    it('should create with nested groups', () => {
      const form = formFromFields(nestedSchema);

      expect(form.name).toBeDefined();
      expect(form.address).toBeDefined();
      expect(form.address.city).toBeDefined();
      expect(form.address.street).toBeDefined();
    });

    it('should return Proxy from constructor', () => {
      const form = formFromFields(simpleSchema);

      // Proxy позволяет обращаться к полям напрямую
      expect(form.email.value.value).toBe('');
      expect(form.password.value.value).toBe('');
    });

    it('should initialize with initial values from schema', () => {
      const schemaWithValues: TestFields<SimpleForm> = {
        email: { value: 'test@mail.com', component: null as ComponentInstance },
        password: { value: 'secret', component: null as ComponentInstance },
      };

      const form = formFromFields(schemaWithValues);

      expect(form.email.value.value).toBe('test@mail.com');
      expect(form.password.value.value).toBe('secret');
    });

    it('should initialize with valid status', () => {
      const form = formFromFields(simpleSchema);

      expect(form.valid.value).toBe(true);
      expect(form.invalid.value).toBe(false);
      expect(form.status.value).toBe('valid');
    });

    it('should initialize with touched = false', () => {
      const form = formFromFields(simpleSchema);

      expect(form.touched.value).toBe(false);
    });

    it('should initialize with dirty = false', () => {
      const form = formFromFields(simpleSchema);

      expect(form.dirty.value).toBe(false);
    });

    it('should initialize with pending = false', () => {
      const form = formFromFields(simpleSchema);

      expect(form.pending.value).toBe(false);
    });

    it('should initialize with submitting = false', () => {
      const form = formFromFields(simpleSchema);

      expect(form.submitting.value).toBe(false);
    });

    it('should initialize with empty errors', () => {
      const form = formFromFields(simpleSchema);

      expect(form.errors.value).toEqual([]);
    });
  });

  // ==========================================================================
  // 2. Proxy доступ к полям
  // ==========================================================================

  describe('Proxy Field Access', () => {
    let form: FormProxy<SimpleForm>;

    beforeEach(() => {
      form = formFromFields(simpleSchema);
    });

    it('should access field via Proxy', () => {
      expect(form.email).toBeDefined();
      expect(form.email.value).toBeDefined();
    });

    it('should access nested field via Proxy', () => {
      const nestedForm = formFromFields(nestedSchema);

      expect(nestedForm.address.city).toBeDefined();
      expect(nestedForm.address.city.value.value).toBe('');
    });

    it('should set field value via Proxy', () => {
      form.email.setValue('test@mail.com');

      expect(form.email.value.value).toBe('test@mail.com');
    });

    it('should keep the same node in the fields map', () => {
      expect(form.fields.get('email')).toBe(form.email);
      expect(form.fields.size).toBe(2);
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
    let form: FormProxy<SimpleForm>;

    beforeEach(() => {
      form = formFromFields(simpleSchema);
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
      const nestedForm = formFromFields(nestedSchema);
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
      const nestedForm = formFromFields(nestedSchema);

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

  describe('reset', () => {
    let form: FormProxy<SimpleForm>;

    beforeEach(() => {
      form = formFromFields({
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

    it('should return to creation values by reset() after reset(values)', () => {
      form.reset({ email: 'temp', password: 'temp' });
      expect(form.email.value.value).toBe('temp');

      form.reset();

      expect(form.email.value.value).toBe('initial@mail.com');
      expect(form.password.value.value).toBe('initial');
    });

    it('should reset nested forms recursively', () => {
      const nestedForm = formFromFields<NestedForm>({
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
    let form: FormProxy<SimpleForm>;

    beforeEach(() => {
      form = formFromFields(simpleSchema);
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
    });
  });

  // ==========================================================================
  // 6. markAsTouched / markAsUntouched / markAsDirty / markAsPristine
  // ==========================================================================

  describe('State Methods (cascading)', () => {
    let form: FormProxy<SimpleForm>;

    beforeEach(() => {
      form = formFromFields(simpleSchema);
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

    it('should cascade to nested groups', () => {
      const nestedForm = formFromFields(nestedSchema);

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
    let form: FormProxy<SimpleForm>;

    beforeEach(() => {
      form = formFromFields(simpleSchema);
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
      const nestedForm = formFromFields(nestedSchema);

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
      const form = formFromFields(simpleSchema);

      const result = await form.validate();

      expect(result).toBe(true);
      expect(form.valid.value).toBe(true);
    });

    it('should return false when any field has an error', async () => {
      const form = formFromFields(simpleSchema);
      form.email.setErrors([{ code: 'required', message: 'Field is required' }]);

      const result = await form.validate();

      expect(result).toBe(false);
      expect(form.valid.value).toBe(false);
    });

    it('should not run rules by itself', async () => {
      const { form } = nestedFormWithModel();

      // Правила исполняет `validateModel`; без прогона у нод нет ошибок.
      await expect(form.validate()).resolves.toBe(true);
      expect(form.name.errors.value).toEqual([]);
    });

    it('should keep errors routed by validateModel', async () => {
      const { model, form } = nestedFormWithModel();

      await expect(validateModel(model, nestedRules)).resolves.toBe(false);
      const result = await form.validate();

      expect(result).toBe(false);
      expect(form.name.errors.value.map((error) => error.code)).toEqual(['required']);
      expect(form.address.city.errors.value.map((error) => error.code)).toEqual(['required']);
      expect(form.address.street.errors.value).toEqual([]);
    });

    it('should reflect a repeated validateModel run', async () => {
      const { model, form } = nestedFormWithModel();
      await validateModel(model, nestedRules);

      model.name = 'John';
      model.address.city = 'Moscow';
      await expect(validateModel(model, nestedRules)).resolves.toBe(true);

      await expect(form.validate()).resolves.toBe(true);
      expect(form.errors.value).toEqual([]);
    });

    it('should ignore warnings', async () => {
      const form = formFromFields(simpleSchema);
      form.email.setErrors([{ code: 'weak', message: 'Weak', severity: 'warning' }]);

      await expect(form.validate()).resolves.toBe(true);
      expect(form.email.errors.value).toHaveLength(1);
    });

    it('should ignore errors of disabled fields', async () => {
      const form = formFromFields(simpleSchema);
      form.email.setErrors([{ code: 'required', message: 'Field is required' }]);
      form.email.disable();

      await expect(form.validate()).resolves.toBe(true);
    });
  });

  // ==========================================================================
  // 9. submit()
  // ==========================================================================

  describe('submit()', () => {
    it('should call onSubmit when form is valid', async () => {
      const form = formFromFields(simpleSchema);
      const onSubmit = vi.fn().mockResolvedValue('success');

      const result = await form.submit(onSubmit);

      expect(onSubmit).toHaveBeenCalledWith({ email: '', password: '' });
      expect(result).toBe('success');
    });

    it('should not call onSubmit when form is invalid', async () => {
      const { model, form } = nestedFormWithModel();
      await validateModel(model, nestedRules);
      const onSubmit = vi.fn();

      const result = await form.submit(onSubmit);

      expect(onSubmit).not.toHaveBeenCalled();
      expect(result).toBeNull();
      // Отправка ошибок не стирает
      expect(form.name.errors.value.map((error) => error.code)).toEqual(['required']);
    });

    it('should markAsTouched() before validation', async () => {
      const form = formFromFields(simpleSchema);
      const onSubmit = vi.fn().mockResolvedValue('success');

      await form.submit(onSubmit);

      expect(form.email.touched.value).toBe(true);
      expect(form.password.touched.value).toBe(true);
    });

    it('should set submitting = true during execution', async () => {
      const form = formFromFields(simpleSchema);
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
      const form = formFromFields(simpleSchema);
      const onSubmit = vi.fn().mockRejectedValue(new Error('Submit failed'));

      await expect(form.submit(onSubmit)).rejects.toThrow('Submit failed');

      expect(form.submitting.value).toBe(false);
    });

    it('should return result from onSubmit', async () => {
      const form = formFromFields(simpleSchema);
      const onSubmit = vi.fn().mockResolvedValue({ id: 123, status: 'created' });

      const result = await form.submit(onSubmit);

      expect(result).toEqual({ id: 123, status: 'created' });
    });
  });

  // ==========================================================================
  // 10. Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty schema', () => {
      type EmptyForm = Record<string, never>;

      const emptyForm = formFromFields<EmptyForm>({});

      expect(emptyForm.getValue()).toEqual({});
      expect(emptyForm.valid.value).toBe(true);
    });

    it('should handle schema with single field', () => {
      interface SingleForm {
        name: string;
      }

      const singleForm = formFromFields<SingleForm>({
        name: { value: 'test', component: null as ComponentInstance },
      });

      expect(singleForm.getValue()).toEqual({ name: 'test' });
    });

    it('should handle deep nesting (3+ levels)', () => {
      interface DeepForm {
        level1: {
          level2: {
            level3: {
              title: string;
            };
          };
        };
      }

      const deepForm = formFromFields<DeepForm>({
        level1: {
          level2: {
            level3: {
              title: { value: 'deep', component: null as ComponentInstance },
            },
          },
        },
      });

      expect(deepForm.level1.level2.level3.title.value.value).toBe('deep');
      expect(deepForm.$.level1.$.level2.$.level3.$.title.value.value).toBe('deep');
    });
  });

  // ==========================================================================
  // 11. Имена полей данных
  // ==========================================================================

  describe('Field names', () => {
    // Вид ноды определяет узел модели, а не имя поля: имена, которыми сборка раньше различала
    // «поле», «группу» и «конфиг», — обычные поля данных.
    interface ReservedNames {
      schema: string;
      form: string;
      value: string;
      valueSignal: string;
      component: string;
      nested: {
        value: string;
        form: { schema: string };
      };
    }

    const build = () => {
      const model = createModel<ReservedNames>({
        schema: 's',
        form: 'f',
        value: 'v',
        valueSignal: 'vs',
        component: 'c',
        nested: { value: 'nv', form: { schema: 'nfs' } },
      });
      return { model, form: createFormFromModel<ReservedNames>({ model }) };
    };

    it('should build fields named like config keys', () => {
      const { form } = build();

      expect(form.getValue()).toEqual({
        schema: 's',
        form: 'f',
        value: 'v',
        valueSignal: 'vs',
        component: 'c',
        nested: { value: 'nv', form: { schema: 'nfs' } },
      });
    });

    it('should reach every such field via `form.$` and write through to the model', () => {
      const { model, form } = build();

      for (const name of ['schema', 'form', 'value', 'valueSignal', 'component'] as const) {
        const field = form.$[name];
        expect(field, name).toBeDefined();
        field.setValue(`${name}-changed`);
      }
      form.$.nested.$.form.$.schema.setValue('deep-changed');

      expect(model.get()).toMatchObject({
        schema: 'schema-changed',
        form: 'form-changed',
        value: 'value-changed',
        valueSignal: 'valueSignal-changed',
        component: 'component-changed',
        nested: { form: { schema: 'deep-changed' } },
      });
    });

    it('should keep a group named `form` a group', () => {
      const { form } = build();

      const nestedForm = form.$.nested.$.form;
      expect(nestedForm.getValue()).toEqual({ schema: 'nfs' });
    });

    it('should bind schema config to such fields by handle', () => {
      const model = createModel({ schema: '', form: '', value: '' });
      const component = () => null;
      const form = createFormFromModel({
        model,
        schema: {
          children: [
            { model: model.$.schema, component, componentProps: { label: 'Schema' } },
            { model: model.$.form, component },
            { model: model.$.value, component },
          ],
        },
      });

      const field = form.$.schema as unknown as {
        component: unknown;
        componentProps: { value: Record<string, unknown> };
      };
      expect(field.component).toBe(component);
      expect(field.componentProps.value).toEqual({ label: 'Schema' });
    });
  });
});
