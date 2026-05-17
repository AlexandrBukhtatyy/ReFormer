/**
 * Unit tests for Apply
 */

import { describe, it, expect } from 'vitest';
import { createForm } from '../../../../src/core/utils/create-form';
import { apply } from '../../../../src/core/validation/core/apply';
import { validate } from '../../../../src/core/validation/core/validate';
import { required } from '../../../../src/core/validation/validators/required';
import { minLength } from '../../../../src/core/validation/validators/min-length';
import type { FieldPath, ValidationSchemaFn } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('Apply', () => {
  describe('primitive field schema', () => {
    interface Form {
      username: string;
    }

    // Type-level smoke + runtime: apply(path.primitive, ValidationSchemaFn<string>) должен
    // компилироваться (`FieldPath<string>` теперь = `FieldPathNode<unknown, string>`)
    // и фактически регистрировать правила на конкретное поле.
    it('compiles apply(path.primitive, ValidationSchemaFn<primitive>) and registers rules', async () => {
      const usernameRules: ValidationSchemaFn<string> = (path) => {
        validate(path, required());
        validate(path, minLength(3));
      };

      const form = createForm<Form>({
        username: { value: '', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<Form> = (path: FieldPath<Form>) => {
        apply(path.username, usernameRules);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      expect(form.username.valid.value).toBe(false);
      expect(form.username.errors.value[0].code).toBe('required');
    });
  });
});
