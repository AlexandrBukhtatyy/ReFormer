/**
 * Unit tests for syncFields behavior
 */

import { describe, it, expect } from 'vitest';
import { makeForm } from '../../../../src/core/utils/create-form';
import { syncFields } from '../../../../src/core/behavior/behaviors/sync-fields';
import type { BehaviorSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('syncFields behavior', () => {
  interface SyncForm {
    email: string;
    emailCopy: string;
    primary: string;
    secondary: string;
  }

  describe('basic synchronization', () => {
    it('should sync field1 to field2 on initial apply', async () => {
      const form = makeForm<SyncForm>({
        email: { value: 'test@example.com', component: null as ComponentInstance },
        emailCopy: { value: '', component: null as ComponentInstance },
        primary: { value: '', component: null as ComponentInstance },
        secondary: { value: '', component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<SyncForm> = (path: FieldPath<SyncForm>) => {
        syncFields(path.email, path.emailCopy);
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // emailCopy should be synced to email's value
      expect(form.emailCopy.value.value).toBe('test@example.com');
    });

    it('should sync field1 changes to field2', async () => {
      const form = makeForm<SyncForm>({
        email: { value: '', component: null as ComponentInstance },
        emailCopy: { value: '', component: null as ComponentInstance },
        primary: { value: '', component: null as ComponentInstance },
        secondary: { value: '', component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<SyncForm> = (path: FieldPath<SyncForm>) => {
        syncFields(path.email, path.emailCopy);
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Change field1
      form.email.setValue('new@example.com');

      await new Promise((r) => setTimeout(r, 10));

      expect(form.emailCopy.value.value).toBe('new@example.com');
    });

    it('should sync field2 changes to field1', async () => {
      const form = makeForm<SyncForm>({
        email: { value: '', component: null as ComponentInstance },
        emailCopy: { value: '', component: null as ComponentInstance },
        primary: { value: '', component: null as ComponentInstance },
        secondary: { value: '', component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<SyncForm> = (path: FieldPath<SyncForm>) => {
        syncFields(path.email, path.emailCopy);
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Change field2
      form.emailCopy.setValue('copy@example.com');

      await new Promise((r) => setTimeout(r, 10));

      // field1 should be synced
      expect(form.email.value.value).toBe('copy@example.com');
    });

    it('should prevent circular updates', async () => {
      const form = makeForm<SyncForm>({
        email: { value: '', component: null as ComponentInstance },
        emailCopy: { value: '', component: null as ComponentInstance },
        primary: { value: '', component: null as ComponentInstance },
        secondary: { value: '', component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<SyncForm> = (path: FieldPath<SyncForm>) => {
        syncFields(path.email, path.emailCopy);
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Change field1 - should not cause infinite loop
      form.email.setValue('test@test.com');

      await new Promise((r) => setTimeout(r, 50));

      // Both fields should have same value
      expect(form.email.value.value).toBe('test@test.com');
      expect(form.emailCopy.value.value).toBe('test@test.com');
    });
  });

  describe('transform option', () => {
    it('should apply transform when syncing from field1 to field2', async () => {
      const form = makeForm<SyncForm>({
        email: { value: 'TEST@EXAMPLE.COM', component: null as ComponentInstance },
        emailCopy: { value: '', component: null as ComponentInstance },
        primary: { value: '', component: null as ComponentInstance },
        secondary: { value: '', component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<SyncForm> = (path: FieldPath<SyncForm>) => {
        syncFields(path.email, path.emailCopy, {
          transform: (value) => value?.toLowerCase() ?? '',
        });
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // emailCopy should have lowercase value
      expect(form.emailCopy.value.value).toBe('test@example.com');
    });

    it('should eventually apply transform even when changing field2 (due to bidirectional sync)', async () => {
      // When field2 changes -> field1 syncs -> effect triggers forward sync with transform
      // This is expected behavior for bidirectional sync with transform
      const form = makeForm<SyncForm>({
        email: { value: '', component: null as ComponentInstance },
        emailCopy: { value: '', component: null as ComponentInstance },
        primary: { value: '', component: null as ComponentInstance },
        secondary: { value: '', component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<SyncForm> = (path: FieldPath<SyncForm>) => {
        syncFields(path.email, path.emailCopy, {
          transform: (value) => value?.toLowerCase() ?? '',
        });
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Change field2 with uppercase
      form.emailCopy.setValue('REVERSE@EXAMPLE.COM');

      await new Promise((r) => setTimeout(r, 10));

      // Due to bidirectional sync, transform is eventually applied to both fields
      // field2 change -> field1 sync -> forward sync with transform -> field2 becomes lowercase
      expect(form.email.value.value).toBe('reverse@example.com');
      expect(form.emailCopy.value.value).toBe('reverse@example.com');
    });
  });

  describe('cleanup', () => {
    it('should stop syncing after cleanup', async () => {
      const form = makeForm<SyncForm>({
        email: { value: '', component: null as ComponentInstance },
        emailCopy: { value: '', component: null as ComponentInstance },
        primary: { value: '', component: null as ComponentInstance },
        secondary: { value: '', component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<SyncForm> = (path: FieldPath<SyncForm>) => {
        syncFields(path.email, path.emailCopy);
      };

      const cleanup = form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Verify sync works
      form.email.setValue('before@cleanup.com');
      await new Promise((r) => setTimeout(r, 10));
      expect(form.emailCopy.value.value).toBe('before@cleanup.com');

      // Cleanup
      cleanup();

      // Change field1 after cleanup
      form.email.setValue('after@cleanup.com');
      await new Promise((r) => setTimeout(r, 10));

      // field2 should NOT be synced
      expect(form.emailCopy.value.value).toBe('before@cleanup.com');
    });

    it('should stop reverse sync after cleanup', async () => {
      const form = makeForm<SyncForm>({
        email: { value: '', component: null as ComponentInstance },
        emailCopy: { value: '', component: null as ComponentInstance },
        primary: { value: '', component: null as ComponentInstance },
        secondary: { value: '', component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<SyncForm> = (path: FieldPath<SyncForm>) => {
        syncFields(path.email, path.emailCopy);
      };

      const cleanup = form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Cleanup
      cleanup();

      // Change field2 after cleanup
      form.emailCopy.setValue('changed@copy.com');
      await new Promise((r) => setTimeout(r, 10));

      // field1 should NOT be synced
      expect(form.email.value.value).toBe('');
    });
  });

  describe('multiple synced pairs', () => {
    it('should support multiple independent sync pairs', async () => {
      const form = makeForm<SyncForm>({
        email: { value: 'email@test.com', component: null as ComponentInstance },
        emailCopy: { value: '', component: null as ComponentInstance },
        primary: { value: 'primary', component: null as ComponentInstance },
        secondary: { value: '', component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<SyncForm> = (path: FieldPath<SyncForm>) => {
        syncFields(path.email, path.emailCopy);
        syncFields(path.primary, path.secondary);
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Both pairs should be synced
      expect(form.emailCopy.value.value).toBe('email@test.com');
      expect(form.secondary.value.value).toBe('primary');

      // Change one pair
      form.primary.setValue('updated');
      await new Promise((r) => setTimeout(r, 10));

      // Only secondary should change
      expect(form.emailCopy.value.value).toBe('email@test.com');
      expect(form.secondary.value.value).toBe('updated');
    });
  });
});
