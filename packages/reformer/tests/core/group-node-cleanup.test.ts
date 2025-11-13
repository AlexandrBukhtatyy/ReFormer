/**
 * Unit tests for GroupNode cleanup (dispose mechanism)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeForm } from '../../src/core/utils/make-form';
import type { GroupNodeWithControls } from '../../src/core';

describe('GroupNode - Cleanup (dispose)', () => {
  interface TestForm {
    email: string;
    password: string;
    age: number;
  }

  let form: GroupNodeWithControls<TestForm>;

  beforeEach(() => {
    form = makeForm<TestForm>({
      email: { value: '', component: null as any },
      password: { value: '', component: null as any },
      age: { value: 0, component: null as any },
    });
  });

  describe('linkFields() cleanup', () => {
    it('should cleanup linkFields subscription when dispose() is called', () => {
      // Link age to password (silly example, but works for testing)
      form.linkFields('age', 'password', (age: number) => `password-${age}`);

      // Initial link
      expect(form.password.value.value).toBe('password-0');

      // Change source
      form.age.setValue(25);
      expect(form.password.value.value).toBe('password-25');

      // Dispose
      form.dispose();

      // Change source after dispose - target should NOT update
      form.age.setValue(30);
      expect(form.password.value.value).toBe('password-25'); // Still old value
    });

    it('should cleanup multiple linkFields subscriptions', () => {
      const form2 = makeForm<TestForm>({
        email: { value: '', component: null as any },
        password: { value: '', component: null as any },
        age: { value: 0, component: null as any },
      });

      form.linkFields('email', 'password', (email: string) => `pwd-${email}`);
      form2.linkFields('age', 'password', (age: string) => `pwd-${age}`);

      form.email.setValue('test');
      form2.age.setValue(25);

      expect(form.password.value.value).toBe('pwd-test');
      expect(form2.password.value.value).toBe('pwd-25');

      // Dispose only form
      form.dispose();

      // Change sources
      form.email.setValue('after-dispose');
      form2.age.setValue(30);

      // form should NOT update, form2 should update
      expect(form.password.value.value).toBe('pwd-test'); // Not updated
      expect(form2.password.value.value).toBe('pwd-30'); // Updated

      // Cleanup
      form2.dispose();
    });

    it('should allow manual unsubscribe for linkFields', () => {
      const unsubscribe = form.linkFields('email', 'password', (email: string) =>
        email.toUpperCase()
      );

      form.email.setValue('test');
      expect(form.password.value.value).toBe('TEST');

      // Manual unsubscribe
      unsubscribe();

      // Change source - target should NOT update
      form.email.setValue('after-unsubscribe');
      expect(form.password.value.value).toBe('TEST');

      // Dispose should not throw
      expect(() => form.dispose()).not.toThrow();
    });
  });

  describe('watchField() cleanup', () => {
    it('should cleanup watchField subscription when dispose() is called', () => {
      const callback = vi.fn();

      form.watchField('email', callback);

      // Initial call
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('');

      // Change field
      form.email.setValue('test@example.com');
      expect(callback).toHaveBeenCalledTimes(2);

      // Dispose
      form.dispose();

      // Change after dispose - callback should NOT be called
      form.email.setValue('after-dispose@example.com');
      expect(callback).toHaveBeenCalledTimes(2); // Still 2
    });

    it('should cleanup multiple watchField subscriptions', () => {
      const emailCallback = vi.fn();
      const passwordCallback = vi.fn();
      const ageCallback = vi.fn();

      form.watchField('email', emailCallback);
      form.watchField('password', passwordCallback);
      form.watchField('age', ageCallback);

      // Initial calls
      expect(emailCallback).toHaveBeenCalledTimes(1);
      expect(passwordCallback).toHaveBeenCalledTimes(1);
      expect(ageCallback).toHaveBeenCalledTimes(1);

      // Change fields
      form.email.setValue('test@example.com');
      form.password.setValue('secret');
      form.age.setValue(25);

      expect(emailCallback).toHaveBeenCalledTimes(2);
      expect(passwordCallback).toHaveBeenCalledTimes(2);
      expect(ageCallback).toHaveBeenCalledTimes(2);

      // Dispose all
      form.dispose();

      // Changes after dispose
      form.email.setValue('new@example.com');
      form.password.setValue('new-secret');
      form.age.setValue(30);

      // All should still be 2
      expect(emailCallback).toHaveBeenCalledTimes(2);
      expect(passwordCallback).toHaveBeenCalledTimes(2);
      expect(ageCallback).toHaveBeenCalledTimes(2);
    });

    it('should handle watchField with nested path', () => {
      interface NestedForm {
        user: {
          profile: {
            name: string;
          };
        };
      }

      const nestedForm = makeForm<NestedForm>({
        user: {
          profile: {
            name: { value: '', component: null as any },
          },
        },
      });

      const callback = vi.fn();
      nestedForm.watchField('user.profile.name', callback);

      // Initial call
      expect(callback).toHaveBeenCalledTimes(1);

      // Change nested field
      nestedForm.user.profile.name.setValue('John');
      expect(callback).toHaveBeenCalledTimes(2);

      // Dispose
      nestedForm.dispose();

      // Change after dispose
      nestedForm.user.profile.name.setValue('Jane');
      expect(callback).toHaveBeenCalledTimes(2); // Still 2
    });
  });

  describe('recursive cleanup of child nodes', () => {
    it('should recursively dispose all child FieldNode instances', () => {
      const emailCallback = vi.fn();
      const passwordCallback = vi.fn();

      // Add watchers to child fields
      form.email.watch(emailCallback);
      form.password.watch(passwordCallback);

      // Initial calls
      expect(emailCallback).toHaveBeenCalledTimes(1);
      expect(passwordCallback).toHaveBeenCalledTimes(1);

      // Dispose parent form
      form.dispose();

      // Changes should NOT trigger child watchers
      form.email.setValue('test@example.com');
      form.password.setValue('secret');

      expect(emailCallback).toHaveBeenCalledTimes(1); // Still 1
      expect(passwordCallback).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should recursively dispose nested GroupNode instances', () => {
      interface NestedForm {
        user: {
          email: string;
          profile: {
            name: string;
            age: number;
          };
        };
      }

      const nestedForm = makeForm<NestedForm>({
        user: {
          email: { value: '', component: null as any },
          profile: {
            name: { value: '', component: null as any },
            age: { value: 0, component: null as any },
          },
        },
      });

      // Add watchers at different levels (only FieldNodes have watch)
      const emailCallback = vi.fn();
      const nameCallback = vi.fn();
      const ageCallback = vi.fn();

      nestedForm.user.email.watch(emailCallback);
      nestedForm.user.profile.name.watch(nameCallback);
      nestedForm.user.profile.age.watch(ageCallback);

      // Initial calls
      expect(emailCallback).toHaveBeenCalledTimes(1);
      expect(nameCallback).toHaveBeenCalledTimes(1);
      expect(ageCallback).toHaveBeenCalledTimes(1);

      // Dispose root form
      nestedForm.dispose();

      // Changes should NOT trigger any watchers
      nestedForm.user.email.setValue('test@example.com');
      nestedForm.user.profile.name.setValue('John');
      nestedForm.user.profile.age.setValue(25);

      expect(emailCallback).toHaveBeenCalledTimes(1);
      expect(nameCallback).toHaveBeenCalledTimes(1);
      expect(ageCallback).toHaveBeenCalledTimes(1);
    });

    it('should dispose nested forms at any level', () => {
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
              value: { value: '', component: null as any },
            },
          },
        },
      });

      const callback = vi.fn();
      // Поле 'value' нужно получать через fields.get() или getFieldByPath(),
      // т.к. .value зарезервировано для computed signal
      const valueField = deepForm.level1.level2.level3.fields.get('value' as any);
      valueField?.watch(callback);

      expect(callback).toHaveBeenCalledTimes(1);

      // Dispose from middle level
      deepForm.level1.level2.dispose();

      valueField?.setValue('test');
      expect(callback).toHaveBeenCalledTimes(1); // Not triggered

      // Cleanup root
      deepForm.dispose();
    });
  });

  describe('mixed subscriptions cleanup', () => {
    it('should cleanup both linkFields and watchField', () => {
      const watchCallback = vi.fn();

      form.linkFields('email', 'password', (email: string) => `pwd-${email}`);
      form.watchField('age', watchCallback);

      // Initial state
      expect(form.password.value.value).toBe('pwd-');
      expect(watchCallback).toHaveBeenCalledTimes(1);

      // Changes
      form.email.setValue('test');
      form.age.setValue(25);

      expect(form.password.value.value).toBe('pwd-test');
      expect(watchCallback).toHaveBeenCalledTimes(2);

      // Dispose
      form.dispose();

      // Changes after dispose
      form.email.setValue('after');
      form.age.setValue(30);

      expect(form.password.value.value).toBe('pwd-test'); // Not updated
      expect(watchCallback).toHaveBeenCalledTimes(2); // Not triggered
    });
  });

  describe('edge cases', () => {
    it('should handle dispose() called multiple times', () => {
      const callback = vi.fn();
      form.watchField('email', callback);

      expect(() => {
        form.dispose();
        form.dispose();
        form.dispose();
      }).not.toThrow();

      form.email.setValue('test');
      expect(callback).toHaveBeenCalledTimes(1); // Only initial
    });

    it('should handle dispose() on empty form', () => {
      const emptyForm = makeForm<Record<string, never>>({});

      expect(() => emptyForm.dispose()).not.toThrow();
    });

    it('should allow new subscriptions after dispose', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      form.watchField('email', callback1);
      form.dispose();

      // Add new subscription after dispose
      form.watchField('email', callback2);

      form.email.setValue('test');

      expect(callback1).toHaveBeenCalledTimes(1); // Only initial
      expect(callback2).toHaveBeenCalledTimes(2); // Initial + setValue

      // Cleanup
      form.dispose();
    });

    it('should handle dispose() when some fields have no subscriptions', () => {
      const callback = vi.fn();

      // Only watch email, not password or age
      form.email.watch(callback);

      expect(() => form.dispose()).not.toThrow();

      form.email.setValue('test');
      expect(callback).toHaveBeenCalledTimes(1); // Only initial
    });
  });

  describe('memory leak prevention', () => {
    it('should not accumulate disposers in parent or children', () => {
      // Create many subscriptions
      for (let i = 0; i < 50; i++) {
        const callback = vi.fn();
        form.watchField('email', callback);
        form.linkFields('age', 'password', (age: number) => `pwd-${age}`);
      }

      // Dispose all
      form.dispose();

      // Verify cleanup worked by adding new subscription
      const callback = vi.fn();
      form.watchField('email', callback);

      form.email.setValue('test');
      expect(callback).toHaveBeenCalledTimes(2); // Should work normally

      form.dispose();
    });

    it('should handle partial manual unsubscribes before dispose', () => {
      const unsubscribes: Array<() => void> = [];

      // Create many subscriptions
      for (let i = 0; i < 20; i++) {
        const callback = vi.fn();
        const unsubscribe = form.watchField('email', callback);
        unsubscribes.push(unsubscribe);
      }

      // Manually unsubscribe half
      for (let i = 0; i < 10; i++) {
        unsubscribes[i]();
      }

      // Dispose should cleanup the rest
      expect(() => form.dispose()).not.toThrow();
    });
  });
});
