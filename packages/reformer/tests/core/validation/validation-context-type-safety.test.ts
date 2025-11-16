/**
 * Unit tests for ValidationContext Type Safety improvements
 *
 * Tests the improved type guards, warnings, and type-safe access
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validate, validateTree } from '../../../src/core/validation';
import type { GroupNodeWithControls } from '../../../src/core/types';
import { makeForm } from '../../../src/core/utils/make-form';
import type { FieldPath } from '../../../src/core/types';
import { ComponentInstance } from '../../test-utils/types';

describe('ValidationContext - Type Safety', () => {
  interface TestForm {
    email: string;
    password: string;
    address: {
      city: string;
      street: string;
    };
  }

  let form: GroupNodeWithControls<TestForm>;
  let consoleWarnSpy: unknown;

  beforeEach(() => {
    form = makeForm<TestForm>({
      email: { value: 'test@mail.com', component: null as ComponentInstance },
      password: { value: 'password123', component: null as ComponentInstance },
      address: {
        city: { value: 'Moscow', component: null as ComponentInstance },
        street: { value: 'Lenina', component: null as ComponentInstance },
      },
    });

    // Spy on console.warn to check dev-mode warnings
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('getField() type safety', () => {
    it('should return value for existing field (type-safe key)', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: 'test@mail.com', component: null as ComponentInstance },
          password: { value: '', component: null as ComponentInstance },
          address: {
            city: { value: '', component: null as ComponentInstance },
            street: { value: '', component: null as ComponentInstance },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.email, (ctx) => {
            const email = ctx.getField('email');
            expect(email).toBe('test@mail.com');
            return null;
          });
        },
      });

      await form.validate();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should return value for nested field (string path)', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: '', component: null as ComponentInstance },
          password: { value: '', component: null as ComponentInstance },
          address: {
            city: { value: 'Moscow', component: null as ComponentInstance },
            street: { value: 'Lenina', component: null as ComponentInstance },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.email, (ctx) => {
            const city = ctx.getField('address.city');
            expect(city).toBe('Moscow');
            return null;
          });
        },
      });

      await form.validate();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should return undefined and warn for non-existent field (dev mode)', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: '', component: null as ComponentInstance },
          password: { value: '', component: null as ComponentInstance },
          address: {
            city: { value: '', component: null as ComponentInstance },
            street: { value: '', component: null as ComponentInstance },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.email, (ctx) => {
            const nonExistent = ctx.getField('nonexistent' as unknown);
            expect(nonExistent).toBeUndefined();
            return null;
          });
        },
      });

      await form.validate();

      // Check that warning was called (dev mode)
      if (process.env.NODE_ENV !== 'production') {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("[ValidationContext] Path 'nonexistent' not found in form")
        );
      }
    });

    it('should return undefined and warn for non-existent nested path', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: '', component: null as ComponentInstance },
          password: { value: '', component: null as ComponentInstance },
          address: {
            city: { value: '', component: null as ComponentInstance },
            street: { value: '', component: null as ComponentInstance },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.email, (ctx) => {
            const nonExistent = ctx.getField('address.nonexistent');
            expect(nonExistent).toBeUndefined();
            return null;
          });
        },
      });

      await form.validate();

      // Check that warning was called
      if (process.env.NODE_ENV !== 'production') {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "[ValidationContext] Path 'address.nonexistent' not found in form"
          )
        );
      }
    });

    it('should return undefined and warn for completely invalid path', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: '', component: null as ComponentInstance },
          password: { value: '', component: null as ComponentInstance },
          address: {
            city: { value: '', component: null as ComponentInstance },
            street: { value: '', component: null as ComponentInstance },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.email, (ctx) => {
            const nonExistent = ctx.getField('invalid.nested.path');
            expect(nonExistent).toBeUndefined();
            return null;
          });
        },
      });

      await form.validate();

      // Check that warning was called
      if (process.env.NODE_ENV !== 'production') {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "[ValidationContext] Path 'invalid.nested.path' not found in form"
          )
        );
      }
    });
  });

  describe('setField() type safety', () => {
    it('should set value for existing field (type-safe key)', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: 'old@mail.com', component: null as ComponentInstance },
          password: { value: '', component: null as ComponentInstance },
          address: {
            city: { value: '', component: null as ComponentInstance },
            street: { value: '', component: null as ComponentInstance },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.email, (ctx) => {
            ctx.setField('email', 'new@mail.com');
            return null;
          });
        },
      });

      await form.validate();
      expect(form.email.value.value).toBe('new@mail.com');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should set value for nested field (string path)', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: '', component: null as ComponentInstance },
          password: { value: '', component: null as ComponentInstance },
          address: {
            city: { value: 'Moscow', component: null as ComponentInstance },
            street: { value: 'Lenina', component: null as ComponentInstance },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.email, (ctx) => {
            ctx.setField('address.city', 'SPB');
            ctx.setField('address.street', 'Nevsky');
            return null;
          });
        },
      });

      await form.validate();
      expect(form.address.city.value.value).toBe('SPB');
      expect(form.address.street.value.value).toBe('Nevsky');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should warn when setting non-existent field', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: '', component: null as ComponentInstance },
          password: { value: '', component: null as ComponentInstance },
          address: {
            city: { value: '', component: null as ComponentInstance },
            street: { value: '', component: null as ComponentInstance },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.email, (ctx) => {
            ctx.setField('nonexistent' as unknown, 'value');
            return null;
          });
        },
      });

      await form.validate();

      // Check that warning was called
      if (process.env.NODE_ENV !== 'production') {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("[ValidationContext] Path 'nonexistent' not found in form")
        );
      }
    });

    it('should warn when setting non-existent nested path', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: '', component: null as ComponentInstance },
          password: { value: '', component: null as ComponentInstance },
          address: {
            city: { value: '', component: null as ComponentInstance },
            street: { value: '', component: null as ComponentInstance },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.email, (ctx) => {
            ctx.setField('address.nonexistent', 'value');
            return null;
          });
        },
      });

      await form.validate();

      // Check that warning was called
      if (process.env.NODE_ENV !== 'production') {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "[ValidationContext] Path 'address.nonexistent' not found in form"
          )
        );
      }
    });
  });

  describe('TreeValidationContext type safety', () => {
    it('should return value for existing field via getField', async () => {
      let email: unknown = null;
      let city: unknown = null;

      form = makeForm<TestForm>({
        form: {
          email: { value: 'test@mail.com', component: null as ComponentInstance },
          password: { value: '', component: null as ComponentInstance },
          address: {
            city: { value: 'Moscow', component: null as ComponentInstance },
            street: { value: '', component: null as ComponentInstance },
          },
        },
        validation: () => {
          validateTree((ctx) => {
            email = ctx.getField('email');
            city = ctx.getField('address.city');
            return null;
          });
        },
      });

      await form.validate();
      expect(email).toBe('test@mail.com');
      expect(city).toBe('Moscow');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should warn when accessing non-existent field', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: '', component: null as ComponentInstance },
          password: { value: '', component: null as ComponentInstance },
          address: {
            city: { value: '', component: null as ComponentInstance },
            street: { value: '', component: null as ComponentInstance },
          },
        },
        validation: () => {
          validateTree((ctx) => {
            const nonExistent = ctx.getField('nonexistent' as unknown);
            expect(nonExistent).toBeUndefined();
            return null;
          });
        },
      });

      await form.validate();

      // Check that warning was called
      if (process.env.NODE_ENV !== 'production') {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("[TreeValidationContext] Path 'nonexistent' not found in form")
        );
      }
    });

    it('should warn when accessing non-existent nested path', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: '', component: null as ComponentInstance },
          password: { value: '', component: null as ComponentInstance },
          address: {
            city: { value: '', component: null as ComponentInstance },
            street: { value: '', component: null as ComponentInstance },
          },
        },
        validation: () => {
          validateTree((ctx) => {
            const nonExistent = ctx.getField('invalid.path');
            expect(nonExistent).toBeUndefined();
            return null;
          });
        },
      });

      await form.validate();

      // Check that warning was called
      if (process.env.NODE_ENV !== 'production') {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("[TreeValidationContext] Path 'invalid.path' not found in form")
        );
      }
    });
  });

  describe('Type guard for FormNode', () => {
    it('should correctly identify FormNode via type guard', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: 'test@mail.com', component: null as ComponentInstance },
          password: { value: 'secret', component: null as ComponentInstance },
          address: {
            city: { value: 'Moscow', component: null as ComponentInstance },
            street: { value: 'Lenina', component: null as ComponentInstance },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.email, (ctx) => {
            // getField должен вернуть значение (не FormNode)
            const email = ctx.getField('email');
            expect(typeof email).toBe('string');
            expect(email).toBe('test@mail.com');

            const city = ctx.getField('address.city');
            expect(typeof city).toBe('string');
            expect(city).toBe('Moscow');

            return null;
          });
        },
      });

      await form.validate();
    });

    it('should use type guard in setField to ensure setValue exists', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: '', component: null as ComponentInstance },
          password: { value: '', component: null as ComponentInstance },
          address: {
            city: { value: 'Old', component: null as ComponentInstance },
            street: { value: '', component: null as ComponentInstance },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.email, (ctx) => {
            // setField должен использовать type guard и вызвать setValue
            ctx.setField('address.city', 'New');
            return null;
          });
        },
      }) as GroupNodeWithControls<TestForm>;

      await form.validate();

      // Verify that setValue was called via type guard
      expect(form.address.city.value.value).toBe('New');
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple levels of nesting', async () => {
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
        form: {
          level1: {
            level2: {
              level3: {
                value: { value: 'deep', component: null as ComponentInstance },
              },
            },
          },
        },
        validation: (path: FieldPath<DeepForm>) => {
          // Для поля с именем 'value' используем getFieldByPath
          const fieldPath = 'level1.level2.level3.value';
          validate(path.level1.level2.level3.value, (ctx) => {
            // ctx.getField() для поля 'value' вернёт FieldNode через getFieldByPath
            const value = ctx.getField(fieldPath);
            expect(value).toBe('deep');

            ctx.setField(fieldPath, 'updated');
            return null;
          });
        },
      });

      await deepForm.validate();
      // Поле 'value' получаем через fields.get()
      const valueField = deepForm.level1.level2.level3.fields.get('value' as unknown);
      expect(valueField?.value.value).toBe('updated');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle partial paths correctly', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: '', component: null as ComponentInstance },
          password: { value: '', component: null as ComponentInstance },
          address: {
            city: { value: 'Moscow', component: null as ComponentInstance },
            street: { value: 'Lenina', component: null as ComponentInstance },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.email, (ctx) => {
            // Accessing 'address' (GroupNode, not FieldNode)
            const address = ctx.getField('address');

            // Should return undefined or address object (not a leaf value)
            // Since 'address' is a GroupNode, not a FieldNode with value
            expect(address).toBeDefined();

            return null;
          });
        },
      });

      await form.validate();
    });

    it('should not break on empty path', async () => {
      form = makeForm<TestForm>({
        form: {
          email: { value: '', component: null as ComponentInstance },
          password: { value: '', component: null as ComponentInstance },
          address: {
            city: { value: '', component: null as ComponentInstance },
            street: { value: '', component: null as ComponentInstance },
          },
        },
        validation: (path: FieldPath<TestForm>) => {
          validate(path.email, (ctx) => {
            const result = ctx.getField('');
            expect(result).toBeUndefined();
            return null;
          });
        },
      });

      await form.validate();

      // Warning should be called for empty path
      if (process.env.NODE_ENV !== 'production') {
        expect(consoleWarnSpy).toHaveBeenCalled();
      }
    });
  });
});
