/**
 * Unit tests for CopyFrom behavior
 */

import { describe, it, expect } from 'vitest';
import { makeForm } from '../../../../src/core/utils/make-form';
import { copyFrom } from '../../../../src/core/behavior/behaviors/copy-from';
import type { BehaviorSchemaFn, FieldPath } from '../../../../src/core/types';
import { ComponentInstance } from '../../../test-utils/types';

describe('copyFrom behavior', () => {
  interface AddressForm {
    sameAsRegistration: boolean;
    registrationCity: string;
    registrationStreet: string;
    residenceCity: string;
    residenceStreet: string;
  }

  describe('basic functionality', () => {
    it('should copy value from source to target', async () => {
      const form = makeForm<AddressForm>({
        sameAsRegistration: { value: true, component: null as ComponentInstance },
        registrationCity: { value: 'Moscow', component: null as ComponentInstance },
        registrationStreet: { value: '', component: null as ComponentInstance },
        residenceCity: { value: '', component: null as ComponentInstance },
        residenceStreet: { value: '', component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<AddressForm> = (path: FieldPath<AddressForm>) => {
        copyFrom(path.registrationCity, path.residenceCity);
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Value should be copied from registrationCity to residenceCity
      expect(form.residenceCity.value.value).toBe('Moscow');
    });

    it('should update target when source changes', async () => {
      const form = makeForm<AddressForm>({
        sameAsRegistration: { value: true, component: null as ComponentInstance },
        registrationCity: { value: 'Moscow', component: null as ComponentInstance },
        registrationStreet: { value: '', component: null as ComponentInstance },
        residenceCity: { value: '', component: null as ComponentInstance },
        residenceStreet: { value: '', component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<AddressForm> = (path: FieldPath<AddressForm>) => {
        copyFrom(path.registrationCity, path.residenceCity);
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));
      expect(form.residenceCity.value.value).toBe('Moscow');

      // Change source
      form.registrationCity.setValue('Saint Petersburg');

      await new Promise((r) => setTimeout(r, 10));

      expect(form.residenceCity.value.value).toBe('Saint Petersburg');
    });
  });

  describe('when option', () => {
    it('should only copy when condition is true', async () => {
      const form = makeForm<AddressForm>({
        sameAsRegistration: { value: false, component: null as ComponentInstance },
        registrationCity: { value: 'Moscow', component: null as ComponentInstance },
        registrationStreet: { value: '', component: null as ComponentInstance },
        residenceCity: { value: 'Other', component: null as ComponentInstance },
        residenceStreet: { value: '', component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<AddressForm> = (path: FieldPath<AddressForm>) => {
        copyFrom(path.registrationCity, path.residenceCity, {
          when: (f) => f.sameAsRegistration === true,
        });
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Condition is false, so value should NOT be copied (even though watchField triggers)
      expect(form.residenceCity.value.value).toBe('Other');

      // Enable condition
      form.sameAsRegistration.setValue(true);

      await new Promise((r) => setTimeout(r, 10));

      // copyFrom uses watchField - it only triggers on SOURCE changes
      // After changing condition, need to change source to trigger copy
      form.registrationCity.setValue('New Moscow');

      await new Promise((r) => setTimeout(r, 10));

      // Now should be copied
      expect(form.residenceCity.value.value).toBe('New Moscow');
    });

    it('should stop copying when condition becomes false', async () => {
      const form = makeForm<AddressForm>({
        sameAsRegistration: { value: true, component: null as ComponentInstance },
        registrationCity: { value: 'Moscow', component: null as ComponentInstance },
        registrationStreet: { value: '', component: null as ComponentInstance },
        residenceCity: { value: '', component: null as ComponentInstance },
        residenceStreet: { value: '', component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<AddressForm> = (path: FieldPath<AddressForm>) => {
        copyFrom(path.registrationCity, path.residenceCity, {
          when: (f) => f.sameAsRegistration === true,
        });
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));
      expect(form.residenceCity.value.value).toBe('Moscow');

      // Disable condition
      form.sameAsRegistration.setValue(false);

      // Change source after condition is disabled
      form.registrationCity.setValue('New City');

      await new Promise((r) => setTimeout(r, 10));

      // Value should NOT be updated because condition is false
      expect(form.residenceCity.value.value).toBe('Moscow');
    });
  });

  describe('transform option', () => {
    it('should transform value before copying', async () => {
      interface PriceForm {
        netPrice: number;
        grossPrice: number;
        vatRate: number;
      }

      const form = makeForm<PriceForm>({
        netPrice: { value: 100, component: null as ComponentInstance },
        grossPrice: { value: 0, component: null as ComponentInstance },
        vatRate: { value: 20, component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<PriceForm> = (path: FieldPath<PriceForm>) => {
        copyFrom(path.netPrice, path.grossPrice, {
          transform: (net) => net * 1.2, // Add 20% VAT
        });
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      expect(form.grossPrice.value.value).toBe(120);
    });

    it('should handle string transformations', async () => {
      interface NameForm {
        fullName: string;
        displayName: string;
      }

      const form = makeForm<NameForm>({
        fullName: { value: 'John Doe', component: null as ComponentInstance },
        displayName: { value: '', component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<NameForm> = (path: FieldPath<NameForm>) => {
        copyFrom(path.fullName, path.displayName, {
          transform: (name) => name.toUpperCase(),
        });
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      expect(form.displayName.value.value).toBe('JOHN DOE');
    });
  });

  describe('cleanup', () => {
    it('should stop copying after cleanup', async () => {
      const form = makeForm<AddressForm>({
        sameAsRegistration: { value: true, component: null as ComponentInstance },
        registrationCity: { value: 'Moscow', component: null as ComponentInstance },
        registrationStreet: { value: '', component: null as ComponentInstance },
        residenceCity: { value: '', component: null as ComponentInstance },
        residenceStreet: { value: '', component: null as ComponentInstance },
      });

      const behavior: BehaviorSchemaFn<AddressForm> = (path: FieldPath<AddressForm>) => {
        copyFrom(path.registrationCity, path.residenceCity);
      };

      const cleanup = form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));
      expect(form.residenceCity.value.value).toBe('Moscow');

      // Cleanup
      cleanup();

      // Change source after cleanup
      form.registrationCity.setValue('New City');

      await new Promise((r) => setTimeout(r, 10));

      // Value should NOT be updated after cleanup
      expect(form.residenceCity.value.value).toBe('Moscow');
    });
  });
});
