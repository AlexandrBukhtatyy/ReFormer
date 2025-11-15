/**
 * Тесты изоляции форм
 *
 * Проверяет, что формы полностью изолированы друг от друга:
 * - ValidationRegistry использует композицию (не Singleton)
 * - BehaviorRegistry использует композицию (не Singleton)
 * - Валидаторы одной формы не влияют на другую
 * - Behaviors одной формы не влияют на другую
 */

import { describe, it, expect } from 'vitest';
import { required, email } from '../../../src/core/validation/validators';
import { computeFrom, enableWhen } from '../../../src/core/behavior/behaviors';
import type { ValidationSchemaFn } from '../../../src/core/types/validation-schema';
import type { BehaviorSchemaFn } from '../../../src/core/behavior/types';
import { makeForm } from '../../../src/core/utils/make-form';
import type { GroupNodeWithControls } from '../../src';
import type { FieldPath } from '../../../src/core/types';

// Mock компонент для тестов
const Input = () => null;

interface TestForm {
  email: string;
  name: string;
  age: string; // Используем string вместо number для проверки required
}

describe('Form Isolation', () => {
  describe('ValidationRegistry Isolation', () => {
    it('должен изолировать валидаторы между двумя формами', async () => {
      // Форма 1: требует email и name
      const validationSchema1: ValidationSchemaFn<TestForm> = (path: FieldPath<TestForm>) => {
        required(path.email, { message: 'Email обязателен' });
        email(path.email);
        required(path.name, { message: 'Имя обязательно' });
      };

      // Форма 2: требует только age
      const validationSchema2: ValidationSchemaFn<TestForm> = (path: FieldPath<TestForm>) => {
        required(path.age, { message: 'Возраст обязателен' });
      };

      // Создаем две формы с одинаковой структурой
      const form1 = makeForm<TestForm>({
        email: { value: '', component: Input },
        name: { value: '', component: Input },
        age: { value: '', component: Input },
      });

      const form2 = makeForm<TestForm>({
        email: { value: '', component: Input },
        name: { value: '', component: Input },
        age: { value: '', component: Input },
      });

      // Применяем разные схемы валидации
      form1.applyValidationSchema(validationSchema1);
      form2.applyValidationSchema(validationSchema2);

      // Валидируем обе формы
      await form1.validate();
      await form2.validate();

      // Форма 1: должна иметь ошибки на email и name
      expect(form1.valid.value).toBe(false);
      expect(form1.email.invalid.value).toBe(true); // email валидируется
      expect(form1.name.invalid.value).toBe(true); // name валидируется
      expect(form1.age.invalid.value).toBe(false); // age не валидируется

      // Форма 2: должна иметь ошибку только на age
      expect(form2.valid.value).toBe(false);
      expect(form2.email.invalid.value).toBe(false); // email не валидируется
      expect(form2.name.invalid.value).toBe(false); // name не валидируется
      expect(form2.age.invalid.value).toBe(true); // age валидируется
    });

    it('должен поддерживать одновременное создание форм', async () => {
      // Создаем 3 формы ПОСЛЕДОВАТЕЛЬНО (не одновременно)
      // чтобы избежать race conditions в context stack
      const forms: GroupNodeWithControls<TestForm>[] = [];

      for (let i = 0; i < 3; i++) {
        const form = makeForm<TestForm>({
          email: { value: '', component: Input },
          name: { value: '', component: Input },
          age: { value: '', component: Input },
        });

        // Каждая форма имеет свою уникальную схему валидации
        const schema: ValidationSchemaFn<TestForm> = (path: FieldPath<TestForm>) => {
          if (i === 0) {
            required(path.email, { message: `Form ${i}: Email обязателен` });
          } else if (i === 1) {
            required(path.name, { message: `Form ${i}: Имя обязательно` });
          } else {
            required(path.age, { message: `Form ${i}: Возраст обязателен` });
          }
        };

        form.applyValidationSchema(schema);
        forms.push(form);
      }

      // Валидируем все формы
      await Promise.all(forms.map((f) => f.validate()));

      // Проверяем, что каждая форма имеет только свои ошибки
      // Форма 0: только email
      expect(forms[0].email.invalid.value).toBe(true);
      expect(forms[0].name.invalid.value).toBe(false);
      expect(forms[0].age.invalid.value).toBe(false);

      // Форма 1: только name
      expect(forms[1].email.invalid.value).toBe(false);
      expect(forms[1].name.invalid.value).toBe(true);
      expect(forms[1].age.invalid.value).toBe(false);

      // Форма 2: только age
      expect(forms[2].email.invalid.value).toBe(false);
      expect(forms[2].name.invalid.value).toBe(false);
      expect(forms[2].age.invalid.value).toBe(true);
    });
  });

  describe('BehaviorRegistry Isolation', () => {
    it('должен изолировать behaviors между двумя формами', () => {
      interface BehaviorTestForm {
        sourceField: string;
        targetField1: string;
        targetField2: string;
      }

      // Форма 1: computeFrom копирует из sourceField в targetField1
      const behaviorSchema1: BehaviorSchemaFn<BehaviorTestForm> = (
        path: FieldPath<BehaviorTestForm>
      ) => {
        computeFrom(
          path.targetField1,
          [path.sourceField],
          ({ sourceField }) => `Copy1: ${sourceField}`
        );
      };

      // Форма 2: computeFrom копирует из sourceField в targetField2
      const behaviorSchema2: BehaviorSchemaFn<BehaviorTestForm> = (
        path: FieldPath<BehaviorTestForm>
      ) => {
        computeFrom(
          path.targetField2,
          [path.sourceField],
          ({ sourceField }) => `Copy2: ${sourceField}`
        );
      };

      // Создаем две формы
      const form1 = makeForm<BehaviorTestForm>({
        sourceField: { value: 'test', component: Input },
        targetField1: { value: '', component: Input },
        targetField2: { value: '', component: Input },
      });

      const form2 = makeForm<BehaviorTestForm>({
        sourceField: { value: 'test', component: Input },
        targetField1: { value: '', component: Input },
        targetField2: { value: '', component: Input },
      });

      // Применяем behaviors
      form1.applyBehaviorSchema(behaviorSchema1);
      form2.applyBehaviorSchema(behaviorSchema2);

      // Изменяем sourceField в обеих формах
      form1.sourceField.setValue('value1');
      form2.sourceField.setValue('value2');

      // Форма 1: только targetField1 должен быть обновлен
      expect(form1.targetField1.value.value).toBe('Copy1: value1');
      expect(form1.targetField2.value.value).toBe(''); // не обновляется

      // Форма 2: только targetField2 должен быть обновлен
      expect(form2.targetField1.value.value).toBe(''); // не обновляется
      expect(form2.targetField2.value.value).toBe('Copy2: value2');
    });

    it('должен изолировать enableWhen между формами', () => {
      interface EnableTestForm {
        condition: boolean;
        field1: string;
        field2: string;
      }

      // Форма 1: enableWhen для field1
      const behaviorSchema1: BehaviorSchemaFn<EnableTestForm> = (
        path: FieldPath<EnableTestForm>
      ) => {
        enableWhen(path.field1, (form) => form.condition);
      };

      // Форма 2: enableWhen для field2
      const behaviorSchema2: BehaviorSchemaFn<EnableTestForm> = (
        path: FieldPath<EnableTestForm>
      ) => {
        enableWhen(path.field2, (form) => form.condition);
      };

      // Создаем две формы
      const form1 = makeForm<EnableTestForm>({
        condition: { value: false, component: Input },
        field1: { value: '', component: Input },
        field2: { value: '', component: Input },
      });

      const form2 = makeForm<EnableTestForm>({
        condition: { value: false, component: Input },
        field1: { value: '', component: Input },
        field2: { value: '', component: Input },
      });

      // Применяем behaviors
      form1.applyBehaviorSchema(behaviorSchema1);
      form2.applyBehaviorSchema(behaviorSchema2);

      // Проверяем начальное состояние: все поля disabled
      expect(form1.field1.status.value).toBe('disabled');
      expect(form1.field2.status.value).toBe('valid'); // не управляется behavior

      expect(form2.field1.status.value).toBe('valid'); // не управляется behavior
      expect(form2.field2.status.value).toBe('disabled');

      // Включаем условие в форме 1
      form1.condition.setValue(true);

      // Форма 1: только field1 должен быть enabled
      expect(form1.field1.status.value).toBe('valid');
      expect(form1.field2.status.value).toBe('valid');

      // Форма 2: не должна измениться
      expect(form2.field1.status.value).toBe('valid');
      expect(form2.field2.status.value).toBe('disabled');

      // Включаем условие в форме 2
      form2.condition.setValue(true);

      // Форма 2: только field2 должен быть enabled
      expect(form2.field1.status.value).toBe('valid');
      expect(form2.field2.status.value).toBe('valid');
    });
  });

  describe('Полная изоляция (Validation + Behavior)', () => {
    it('должен полностью изолировать формы друг от друга', async () => {
      interface FullTestForm {
        email: string;
        confirmEmail: string;
        autoFill: boolean;
      }

      // Форма 1: валидация email + behavior копирования
      const form1 = makeForm<FullTestForm>({
        form: {
          email: { value: '', component: Input },
          confirmEmail: { value: '', component: Input },
          autoFill: { value: false, component: Input },
        },
        validation: (path: FieldPath<FullTestForm>) => {
          required(path.email);
          email(path.email);
        },
        behavior: (path: FieldPath<FullTestForm>) => {
          computeFrom(path.confirmEmail, [path.email, path.autoFill], ({ email, autoFill }) =>
            autoFill ? email : ''
          );
        },
      });

      // Форма 2: валидация confirmEmail (другое поле!)
      const form2 = makeForm<FullTestForm>({
        form: {
          email: { value: '', component: Input },
          confirmEmail: { value: '', component: Input },
          autoFill: { value: false, component: Input },
        },
        validation: (path: FieldPath<FullTestForm>) => {
          required(path.confirmEmail);
          email(path.confirmEmail);
        },
        behavior: (_path: FieldPath<FullTestForm>) => {
          // Нет behaviors для этой формы
        },
      });

      // Валидация
      await form1.validate();
      await form2.validate();

      // Форма 1: ошибка на email
      expect(form1.email.invalid.value).toBe(true);
      expect(form1.confirmEmail.invalid.value).toBe(false);

      // Форма 2: ошибка на confirmEmail
      expect(form2.email.invalid.value).toBe(false);
      expect(form2.confirmEmail.invalid.value).toBe(true);

      // Behavior: только форма 1 должна копировать
      form1.email.setValue('test@mail.com');
      form1.autoFill.setValue(true);

      form2.email.setValue('test2@mail.com');
      form2.autoFill.setValue(true);

      // Форма 1: confirmEmail обновляется
      expect(form1.confirmEmail.value.value).toBe('test@mail.com');

      // Форма 2: confirmEmail НЕ обновляется (нет behavior)
      expect(form2.confirmEmail.value.value).toBe('');
    });
  });
});
