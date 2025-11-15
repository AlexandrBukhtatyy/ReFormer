/**
 * Unit tests for ValidationContext через публичный API GroupNode
 *
 * Тестирует ValidationContext через публичные методы GroupNode,
 * а не через внутреннюю реализацию ValidationContextImpl
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { required, validate, validateTree, email, minLength } from '../../../src/core/validation';
import type { GroupNodeWithControls } from '../../../src/core/types/group-node-proxy';
import { makeForm } from '../../../src/core/utils/make-form';
import type { FieldPath } from '../../../src/core/types';

describe('ValidationContext через публичный API', () => {
  interface TestForm {
    email: string;
    password: string;
    confirmPassword: string;
    address: {
      city: string;
      street: string;
    };
  }

  let form: GroupNodeWithControls<TestForm>;

  beforeEach(() => {
    form = makeForm<TestForm>({
      email: { value: 'test@mail.com', component: null as any },
      password: { value: 'password123', component: null as any },
      confirmPassword: { value: 'password123', component: null as any },
      address: {
        city: { value: 'Moscow', component: null as any },
        street: { value: 'Lenina', component: null as any },
      },
    });
  });

  describe('Доступ к значениям полей через context', () => {
    it('should access current field value via context.value()', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: 'test@mail.com', component: null as any },
          password: { value: '', component: null as any },
          confirmPassword: { value: '', component: null as any },
          address: {
            city: { value: '', component: null as any },
            street: { value: '', component: null as any },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.email, (ctx) => {
            // Проверяем, что context.value() возвращает текущее значение поля
            const emailValue = ctx.value();
            expect(emailValue).toBe('test@mail.com');
            return null;
          });
        },
      });

      await form.validate();
    });

    it('should access other field via context.getField()', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: 'test@mail.com', component: null as any },
          password: { value: 'secret123', component: null as any },
          confirmPassword: { value: '', component: null as any },
          address: {
            city: { value: '', component: null as any },
            street: { value: '', component: null as any },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.email, (ctx) => {
            // Проверяем доступ к другим полям
            const password = ctx.getField('password');
            expect(password).toBe('secret123');
            return null;
          });
        },
      });

      await form.validate();
    });

    it('should access nested field via context.getField()', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: '', component: null as any },
          password: { value: '', component: null as any },
          confirmPassword: { value: '', component: null as any },
          address: {
            city: { value: 'Moscow', component: null as any },
            street: { value: 'Lenina', component: null as any },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.email, (ctx) => {
            // Проверяем доступ к вложенным полям через путь
            const city = ctx.getField('address.city');
            expect(city).toBe('Moscow');

            const street = ctx.getField('address.street');
            expect(street).toBe('Lenina');
            return null;
          });
        },
      });

      await form.validate();
    });

    it('should return undefined for non-existent path', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: '', component: null as any },
          password: { value: '', component: null as any },
          confirmPassword: { value: '', component: null as any },
          address: {
            city: { value: '', component: null as any },
            street: { value: '', component: null as any },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.email, (ctx) => {
            const nonExistent = ctx.getField('nonexistent.path');
            expect(nonExistent).toBeUndefined();
            return null;
          });
        },
      });

      await form.validate();
    });
  });

  describe('Изменение значений полей через context', () => {
    it('should set field value via context.setField()', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: '', component: null as any },
          password: { value: 'oldpassword', component: null as any },
          confirmPassword: { value: '', component: null as any },
          address: {
            city: { value: '', component: null as any },
            street: { value: '', component: null as any },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.email, (ctx) => {
            // Изменяем значение другого поля
            ctx.setField('password', 'newpassword');
            return null;
          });
        },
      });

      await form.validate();

      // Проверяем, что значение действительно изменилось
      expect(form.password.value.value).toBe('newpassword');
    });

    it('should set nested field value via context.setField()', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: '', component: null as any },
          password: { value: '', component: null as any },
          confirmPassword: { value: '', component: null as any },
          address: {
            city: { value: 'Moscow', component: null as any },
            street: { value: 'Lenina', component: null as any },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.email, (ctx) => {
            // Изменяем вложенные поля
            ctx.setField('address.city', 'SPB');
            ctx.setField('address.street', 'Nevsky');
            return null;
          });
        },
      });

      await form.validate();

      // Проверяем, что значения изменились
      expect(form.address.city.value.value).toBe('SPB');
      expect(form.address.street.value.value).toBe('Nevsky');
    });
  });

  describe('Доступ к форме через context', () => {
    it('should access full form value via context.formValue()', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: 'test@mail.com', component: null as any },
          password: { value: 'password123', component: null as any },
          confirmPassword: { value: 'password123', component: null as any },
          address: {
            city: { value: 'Moscow', component: null as any },
            street: { value: 'Lenina', component: null as any },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.email, (ctx) => {
            const formValue = ctx.formValue();
            expect(formValue).toEqual({
              email: 'test@mail.com',
              password: 'password123',
              confirmPassword: 'password123',
              address: {
                city: 'Moscow',
                street: 'Lenina',
              },
            });
            return null;
          });
        },
      });

      await form.validate();
    });

    it('should access form reference via context.getForm()', async () => {
      let formRef: any = null;

      form = makeForm<TestForm>({
        form: {
          email: { value: '', component: null as any },
          password: { value: '', component: null as any },
          confirmPassword: { value: '', component: null as any },
          address: {
            city: { value: '', component: null as any },
            street: { value: '', component: null as any },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.email, (ctx) => {
            formRef = ctx.getForm();
            return null;
          });
        },
      });

      await form.validate();

      // Проверяем, что получили ссылку на форму
      expect(formRef).toBe(form);
      expect(formRef.getValue).toBeDefined();
      expect(formRef.setValue).toBeDefined();
    });

    it('should access field control via context.getControl()', async () => {
      let fieldControl: any = null;

      form = makeForm<TestForm>({
        form: {
          email: { value: 'test@mail.com', component: null as any },
          password: { value: '', component: null as any },
          confirmPassword: { value: '', component: null as any },
          address: {
            city: { value: '', component: null as any },
            street: { value: '', component: null as any },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.email, (ctx) => {
            fieldControl = ctx.getControl();
            return null;
          });
        },
      });

      await form.validate();

      // Проверяем, что получили контрол поля
      expect(fieldControl).toBe(form.email);
      expect(fieldControl.value.value).toBe('test@mail.com');
    });
  });

  describe('Кросс-полевая валидация (use cases)', () => {
    it('should validate password confirmation', async () => {
      let isValid = true;

      form = makeForm<TestForm>({
        form: {
          email: { value: '', component: null as any },
          password: { value: 'secret123', component: null as any },
          confirmPassword: { value: 'secret456', component: null as any },
          address: {
            city: { value: '', component: null as any },
            street: { value: '', component: null as any },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.confirmPassword, (ctx) => {
            const password = ctx.getField('password');
            const confirmPassword = ctx.value();

            if (password !== confirmPassword) {
              isValid = false;
              return {
                code: 'passwordMismatch',
                message: 'Пароли не совпадают',
              };
            }
            return null;
          });
        },
      });

      await form.validate();

      expect(isValid).toBe(false);
      expect(form.confirmPassword.errors.value).toHaveLength(1);
      expect(form.confirmPassword.errors.value[0].code).toBe('passwordMismatch');
    });

    it('should validate password confirmation (matching passwords)', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: '', component: null as any },
          password: { value: 'secret123', component: null as any },
          confirmPassword: { value: 'secret123', component: null as any },
          address: {
            city: { value: '', component: null as any },
            street: { value: '', component: null as any },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.confirmPassword, (ctx) => {
            const password = ctx.getField('password');
            const confirmPassword = ctx.value();

            if (password !== confirmPassword) {
              return {
                code: 'passwordMismatch',
                message: 'Пароли не совпадают',
              };
            }
            return null;
          });
        },
      });

      await form.validate();

      expect(form.confirmPassword.errors.value).toHaveLength(0);
      expect(form.valid.value).toBe(true);
    });

    it('should perform conditional validation based on other field', async () => {
      interface ConditionalForm {
        loanType: string;
        propertyValue: number | null;
      }

      const conditionalForm = makeForm<ConditionalForm>({
        form: {
          loanType: { value: 'mortgage', component: null as any },
          propertyValue: { value: null, component: null as any },
        },
        validation: (path: FieldPath<ConditionalForm>) => {
          validate(path.propertyValue, (ctx) => {
            const loanType = ctx.getField('loanType');
            const propertyValue = ctx.value();

            // Если loanType === 'mortgage', propertyValue обязательно
            if (
              loanType === 'mortgage' &&
              (propertyValue === null || propertyValue === undefined)
            ) {
              return {
                code: 'required',
                message: 'Укажите стоимость недвижимости',
              };
            }
            return null;
          });
        },
      }) as GroupNodeWithControls<ConditionalForm>;

      await conditionalForm.validate();

      expect(conditionalForm.propertyValue.errors.value).toHaveLength(1);
      expect(conditionalForm.propertyValue.errors.value[0].code).toBe('required');
    });
  });

  describe('TreeValidationContext (validateTree)', () => {
    it('should access all fields in tree validation', async () => {
      let contextFormValue: any = null;

      form = makeForm<TestForm>({
        form: {
          email: { value: 'test@mail.com', component: null as any },
          password: { value: 'password123', component: null as any },
          confirmPassword: { value: 'password123', component: null as any },
          address: {
            city: { value: 'Moscow', component: null as any },
            street: { value: 'Lenina', component: null as any },
          },
        },
        validation: () => {
          validateTree((ctx) => {
            contextFormValue = ctx.formValue();
            return null;
          });
        },
      });

      await form.validate();

      expect(contextFormValue).toEqual({
        email: 'test@mail.com',
        password: 'password123',
        confirmPassword: 'password123',
        address: {
          city: 'Moscow',
          street: 'Lenina',
        },
      });
    });

    it('should access any field by path in tree validation', async () => {
      let email: any = null;
      let password: any = null;
      let city: any = null;

      form = makeForm<TestForm>({
        form: {
          email: { value: 'test@mail.com', component: null as any },
          password: { value: 'secret', component: null as any },
          confirmPassword: { value: '', component: null as any },
          address: {
            city: { value: 'SPB', component: null as any },
            street: { value: '', component: null as any },
          },
        },
        validation: () => {
          validateTree((ctx) => {
            email = ctx.getField('email');
            password = ctx.getField('password');
            city = ctx.getField('address.city');
            return null;
          });
        },
      });

      await form.validate();

      expect(email).toBe('test@mail.com');
      expect(password).toBe('secret');
      expect(city).toBe('SPB');
    });

    it('should return undefined for non-existent path in tree validation', async () => {
      let nonExistent: any = 'not-undefined';

      form = makeForm<TestForm>({
        form: {
          email: { value: '', component: null as any },
          password: { value: '', component: null as any },
          confirmPassword: { value: '', component: null as any },
          address: {
            city: { value: '', component: null as any },
            street: { value: '', component: null as any },
          },
        },
        validation: () => {
          validateTree((ctx) => {
            nonExistent = ctx.getField('invalid.path');
            return null;
          });
        },
      });

      await form.validate();

      expect(nonExistent).toBeUndefined();
    });

    it('should target error to specific field via targetField option', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: '', component: null as any },
          password: { value: 'secret123', component: null as any },
          confirmPassword: { value: 'different', component: null as any },
          address: {
            city: { value: '', component: null as any },
            street: { value: '', component: null as any },
          },
        },
        validation: () => {
          validateTree(
            (ctx) => {
              const password = ctx.getField('password');
              const confirmPassword = ctx.getField('confirmPassword');

              if (password !== confirmPassword) {
                return {
                  code: 'passwordMismatch',
                  message: 'Пароли не совпадают',
                };
              }
              return null;
            },
            { targetField: 'confirmPassword' }
          );
        },
      });

      await form.validate();

      // Ошибка должна быть только у confirmPassword
      expect(form.confirmPassword.errors.value).toHaveLength(1);
      expect(form.confirmPassword.errors.value[0].code).toBe('passwordMismatch');
      expect(form.password.errors.value).toHaveLength(0);
      expect(form.email.errors.value).toHaveLength(0);
    });
  });

  describe('Реальные сценарии валидации', () => {
    it('should validate complete registration form', async () => {
      interface RegistrationForm {
        email: string;
        password: string;
        confirmPassword: string;
        terms: boolean;
      }

      const registrationForm = makeForm<RegistrationForm>({
        form: {
          email: { value: '', component: null as any },
          password: { value: 'short', component: null as any },
          confirmPassword: { value: 'different', component: null as any },
          terms: { value: false, component: null as any },
        },
        validation: (path: FieldPath<RegistrationForm>) => {
          // Email валидация
          required(path.email, { message: 'Email обязателен' });
          email(path.email);

          // Password валидация
          required(path.password, { message: 'Пароль обязателен' });
          minLength(path.password, 8, { message: 'Минимум 8 символов' });

          // Confirm password валидация
          validate(path.confirmPassword, (ctx) => {
            const password = ctx.getField('password');
            const confirmPassword = ctx.value();

            if (password !== confirmPassword) {
              return {
                code: 'passwordMismatch',
                message: 'Пароли не совпадают',
              };
            }
            return null;
          });

          // Terms валидация
          validate(path.terms, (ctx) => {
            if (!ctx.value()) {
              return {
                code: 'required',
                message: 'Необходимо согласиться с условиями',
              };
            }
            return null;
          });
        },
      }) as GroupNodeWithControls<RegistrationForm>;

      const isValid = await registrationForm.validate();

      expect(isValid).toBe(false);
      expect(registrationForm.email.errors.value.length).toBeGreaterThan(0);
      expect(registrationForm.password.errors.value.length).toBeGreaterThan(0);
      expect(registrationForm.confirmPassword.errors.value.length).toBeGreaterThan(0);
      expect(registrationForm.terms.errors.value.length).toBeGreaterThan(0);
    });
  });
});
