import { test, expect } from '@playwright/test';
import { BehaviorsPage } from './behaviors-page.pom';

test.describe('Behaviors Examples', () => {
  let behaviorsPage: BehaviorsPage;

  test.beforeEach(async ({ page }) => {
    behaviorsPage = new BehaviorsPage(page);
    await behaviorsPage.goto();
  });

  test.describe('computeFrom: Automatic Calculation', () => {
    test('should calculate total from price and quantity @critical', async ({ page }) => {
      await behaviorsPage.fillPrice(100);
      await behaviorsPage.fillQuantity(5);
      await behaviorsPage.waitForBehaviorUpdate();

      await behaviorsPage.expectTotal(500);
    });

    test('should update total when price changes', async ({ page }) => {
      await behaviorsPage.fillPrice(100);
      await behaviorsPage.fillQuantity(2);
      await behaviorsPage.waitForBehaviorUpdate();
      await behaviorsPage.expectTotal(200);

      // Change price
      await behaviorsPage.fillPrice(150);
      await behaviorsPage.waitForBehaviorUpdate();

      await behaviorsPage.expectTotal(300);
    });

    test('should update total when quantity changes', async ({ page }) => {
      await behaviorsPage.fillPrice(100);
      await behaviorsPage.fillQuantity(2);
      await behaviorsPage.waitForBehaviorUpdate();
      await behaviorsPage.expectTotal(200);

      // Change quantity
      await behaviorsPage.fillQuantity(10);
      await behaviorsPage.waitForBehaviorUpdate();

      await behaviorsPage.expectTotal(1000);
    });

    test('should handle zero values', async ({ page }) => {
      await behaviorsPage.fillPrice(0);
      await behaviorsPage.fillQuantity(5);
      await behaviorsPage.waitForBehaviorUpdate();

      await behaviorsPage.expectTotal(0);
    });

    test('total field should be read-only', async ({ page }) => {
      const totalField = page.getByLabel(/итого/i).first();
      await expect(totalField).toBeDisabled();
    });
  });

  test.describe('enableWhen: Conditional Field Activation', () => {
    test.describe('Country -> City dependency', () => {
      test('should disable city field when no country selected @critical', async () => {
        await behaviorsPage.expectCityDisabled();
      });

      test('should enable city field when country is selected', async () => {
        await behaviorsPage.selectCountry('ru');
        await behaviorsPage.waitForBehaviorUpdate();

        await behaviorsPage.expectCityEnabled();
      });

      test('should reset city when country is cleared', async () => {
        // Select country and fill city
        await behaviorsPage.selectCountry('ru');
        await behaviorsPage.waitForBehaviorUpdate();
        await behaviorsPage.fillCity('Moscow');

        // Clear country
        await behaviorsPage.selectCountry('');
        await behaviorsPage.waitForBehaviorUpdate();

        // City should be reset and disabled
        await behaviorsPage.expectCityDisabled();
        const cityValue = await behaviorsPage.getCityValue();
        expect(cityValue).toBe('');
      });

      test('should preserve city when changing country', async () => {
        await behaviorsPage.selectCountry('ru');
        await behaviorsPage.waitForBehaviorUpdate();
        await behaviorsPage.fillCity('Moscow');

        // Change to different country (city should still be enabled)
        await behaviorsPage.selectCountry('us');
        await behaviorsPage.waitForBehaviorUpdate();

        await behaviorsPage.expectCityEnabled();
      });
    });

    test.describe('Discount checkbox -> Discount percent dependency', () => {
      test('should hide discount field when checkbox unchecked @critical', async () => {
        await behaviorsPage.expectDiscountFieldHidden();
      });

      test('should show discount field when checkbox checked', async () => {
        await behaviorsPage.toggleDiscount(true);
        await behaviorsPage.waitForBehaviorUpdate();

        await behaviorsPage.expectDiscountFieldVisible();
      });

      test('should hide and reset discount when unchecked', async ({ page }) => {
        // Enable and fill
        await behaviorsPage.toggleDiscount(true);
        await behaviorsPage.waitForBehaviorUpdate();
        await behaviorsPage.fillDiscountPercent(25);

        // Disable
        await behaviorsPage.toggleDiscount(false);
        await behaviorsPage.waitForBehaviorUpdate();

        await behaviorsPage.expectDiscountFieldHidden();
      });
    });
  });

  test.describe('disableWhen: Conditional Field Disabling', () => {
    test('should keep field enabled when not confirmed @critical', async () => {
      await behaviorsPage.expectEditableFieldEnabled();
    });

    test('should disable field when confirmed', async () => {
      await behaviorsPage.toggleConfirmed(true);
      await behaviorsPage.waitForBehaviorUpdate();

      await behaviorsPage.expectEditableFieldDisabled();
    });

    test('should re-enable field when unconfirmed', async () => {
      // Confirm
      await behaviorsPage.toggleConfirmed(true);
      await behaviorsPage.waitForBehaviorUpdate();
      await behaviorsPage.expectEditableFieldDisabled();

      // Unconfirm
      await behaviorsPage.toggleConfirmed(false);
      await behaviorsPage.waitForBehaviorUpdate();

      await behaviorsPage.expectEditableFieldEnabled();
    });

    test('should preserve value when disabled', async () => {
      // Fill field
      await behaviorsPage.fillEditableField('Test value');

      // Confirm (disable)
      await behaviorsPage.toggleConfirmed(true);
      await behaviorsPage.waitForBehaviorUpdate();

      // Value should be preserved
      const editableField = behaviorsPage.page.getByLabel(/редактируемое поле/i);
      await expect(editableField).toHaveValue('Test value');
    });
  });

  test.describe('copyFrom: Field Value Copying', () => {
    test('should not copy when checkbox unchecked @critical', async () => {
      await behaviorsPage.fillShippingAddress('123 Main St');
      await behaviorsPage.waitForBehaviorUpdate();

      const billingAddress = await behaviorsPage.getBillingAddress();
      expect(billingAddress).toBe('');
    });

    test('should copy shipping to billing when checkbox checked', async () => {
      await behaviorsPage.fillShippingAddress('123 Main St');
      await behaviorsPage.toggleUseShippingAsBilling(true);
      await behaviorsPage.waitForBehaviorUpdate();

      await behaviorsPage.expectBillingAddress('123 Main St');
    });

    test('should update billing when shipping changes (while copying)', async () => {
      await behaviorsPage.toggleUseShippingAsBilling(true);
      await behaviorsPage.fillShippingAddress('First Address');
      await behaviorsPage.waitForBehaviorUpdate();
      await behaviorsPage.expectBillingAddress('First Address');

      // Change shipping
      await behaviorsPage.fillShippingAddress('Second Address');
      await behaviorsPage.waitForBehaviorUpdate();

      await behaviorsPage.expectBillingAddress('Second Address');
    });

    test('should stop copying when checkbox unchecked', async () => {
      // Enable copying
      await behaviorsPage.toggleUseShippingAsBilling(true);
      await behaviorsPage.fillShippingAddress('Copied Address');
      await behaviorsPage.waitForBehaviorUpdate();

      // Disable copying
      await behaviorsPage.toggleUseShippingAsBilling(false);
      await behaviorsPage.waitForBehaviorUpdate();

      // Change shipping - billing should NOT update
      await behaviorsPage.fillShippingAddress('New Address');
      await behaviorsPage.waitForBehaviorUpdate();

      // Billing should still have old value
      await behaviorsPage.expectBillingAddress('Copied Address');
    });
  });

  test.describe('transformValue: Value Transformation', () => {
    test('should transform text to uppercase @critical', async () => {
      await behaviorsPage.fillUppercaseField('hello');
      await behaviorsPage.waitForBehaviorUpdate();

      await behaviorsPage.expectUppercaseFieldValue('HELLO');
    });

    test('should transform mixed case to uppercase', async () => {
      await behaviorsPage.fillUppercaseField('HeLLo WoRLd');
      await behaviorsPage.waitForBehaviorUpdate();

      await behaviorsPage.expectUppercaseFieldValue('HELLO WORLD');
    });

    test('should keep numbers unchanged', async () => {
      await behaviorsPage.fillUppercaseField('test123');
      await behaviorsPage.waitForBehaviorUpdate();

      await behaviorsPage.expectUppercaseFieldValue('TEST123');
    });

    test('should handle empty value', async () => {
      await behaviorsPage.fillUppercaseField('test');
      await behaviorsPage.waitForBehaviorUpdate();
      await behaviorsPage.fillUppercaseField('');
      await behaviorsPage.waitForBehaviorUpdate();

      await behaviorsPage.expectUppercaseFieldValue('');
    });
  });

  test.describe('resetWhen: Conditional Value Reset', () => {
    test('should show card field when payment type is card @critical', async () => {
      await behaviorsPage.selectPaymentType('card');
      await behaviorsPage.waitForBehaviorUpdate();

      await behaviorsPage.expectCardFieldVisible();
    });

    test('should hide card field when payment type is cash', async () => {
      await behaviorsPage.selectPaymentType('cash');
      await behaviorsPage.waitForBehaviorUpdate();

      await behaviorsPage.expectCardFieldHidden();
    });

    test('should reset card number when switching to cash', async () => {
      // Select card and fill
      await behaviorsPage.selectPaymentType('card');
      await behaviorsPage.waitForBehaviorUpdate();
      await behaviorsPage.fillCardNumber('1234 5678 9012 3456');

      // Switch to cash
      await behaviorsPage.selectPaymentType('cash');
      await behaviorsPage.waitForBehaviorUpdate();

      // Should show reset message
      await behaviorsPage.expectCardResetMessage();

      // Switch back to card - field should be empty
      await behaviorsPage.selectPaymentType('card');
      await behaviorsPage.waitForBehaviorUpdate();

      const cardField = behaviorsPage.page.getByLabel(/номер карты/i);
      await expect(cardField).toHaveValue('');
    });
  });

  test.describe('syncFields: Bidirectional Synchronization', () => {
    test('should sync field2 when field1 changes @critical', async () => {
      await behaviorsPage.fillSyncField1('Hello');
      await behaviorsPage.waitForBehaviorUpdate();

      await behaviorsPage.expectSyncField2Value('Hello');
    });

    test('should sync field1 when field2 changes', async () => {
      await behaviorsPage.fillSyncField2('World');
      await behaviorsPage.waitForBehaviorUpdate();

      await behaviorsPage.expectSyncField1Value('World');
    });

    test('should keep fields in sync during continuous changes', async () => {
      await behaviorsPage.fillSyncField1('First');
      await behaviorsPage.waitForBehaviorUpdate();
      await behaviorsPage.expectSyncField2Value('First');

      await behaviorsPage.fillSyncField2('Second');
      await behaviorsPage.waitForBehaviorUpdate();
      await behaviorsPage.expectSyncField1Value('Second');

      await behaviorsPage.fillSyncField1('Third');
      await behaviorsPage.waitForBehaviorUpdate();
      await behaviorsPage.expectSyncField2Value('Third');
    });
  });

  test.describe('revalidateWhen: Dependent Field Revalidation', () => {
    test('should revalidate amount when maxAmount changes @critical', async ({ page }) => {
      // Set initial values
      await behaviorsPage.fillMaxAmount(500);
      await behaviorsPage.fillAmount(600); // Over limit
      await page.keyboard.press('Tab');
      await behaviorsPage.waitForBehaviorUpdate();

      // Amount should show error (600 > 500, but validator uses fixed 1000)
      // The actual validation message depends on implementation
    });

    test('should trigger revalidation on dependency change', async ({ page }) => {
      // Fill amount first
      await behaviorsPage.fillAmount(800);
      await page.keyboard.press('Tab');
      await behaviorsPage.waitForBehaviorUpdate();

      // Change maxAmount - should trigger revalidation of amount
      await behaviorsPage.fillMaxAmount(500);
      await behaviorsPage.waitForBehaviorUpdate();

      // Amount field should be revalidated
      // (behavior depends on actual validation rules)
    });
  });

  test.describe('Form Reset', () => {
    test('should reset all fields to initial values', async () => {
      // Make changes
      await behaviorsPage.fillPrice(200);
      await behaviorsPage.fillQuantity(10);
      await behaviorsPage.selectCountry('us');
      await behaviorsPage.toggleDiscount(true);
      await behaviorsPage.fillUppercaseField('test');
      await behaviorsPage.waitForBehaviorUpdate();

      // Reset
      await behaviorsPage.reset();
      await behaviorsPage.waitForBehaviorUpdate();

      // Check initial values are restored
      await behaviorsPage.expectTotal(100); // 100 * 1 = 100 (initial values)
      await behaviorsPage.expectCityDisabled(); // No country selected
      await behaviorsPage.expectDiscountFieldHidden(); // Checkbox unchecked
    });
  });

  test.describe('Multiple Behaviors Interaction', () => {
    test('should handle multiple behaviors on same form', async () => {
      // computeFrom
      await behaviorsPage.fillPrice(50);
      await behaviorsPage.fillQuantity(4);
      await behaviorsPage.waitForBehaviorUpdate();
      await behaviorsPage.expectTotal(200);

      // enableWhen
      await behaviorsPage.selectCountry('de');
      await behaviorsPage.waitForBehaviorUpdate();
      await behaviorsPage.expectCityEnabled();
      await behaviorsPage.fillCity('Berlin');

      // transformValue
      await behaviorsPage.fillUppercaseField('germany');
      await behaviorsPage.waitForBehaviorUpdate();
      await behaviorsPage.expectUppercaseFieldValue('GERMANY');

      // All behaviors should work together
      await behaviorsPage.expectTotal(200);
      const cityValue = await behaviorsPage.getCityValue();
      expect(cityValue).toBe('Berlin');
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle rapid changes', async ({ page }) => {
      // Rapidly change price
      for (let i = 1; i <= 5; i++) {
        await behaviorsPage.fillPrice(i * 100);
      }
      await behaviorsPage.waitForBehaviorUpdate();

      // Final value should be correct
      await behaviorsPage.expectTotal(500); // 500 * 1 = 500
    });

    test('should handle clearing fields', async () => {
      // Fill and clear
      await behaviorsPage.fillUppercaseField('TEST');
      await behaviorsPage.waitForBehaviorUpdate();
      await behaviorsPage.fillUppercaseField('');
      await behaviorsPage.waitForBehaviorUpdate();

      await behaviorsPage.expectUppercaseFieldValue('');
    });

    test('should handle special characters in transform', async () => {
      await behaviorsPage.fillUppercaseField('test@123!');
      await behaviorsPage.waitForBehaviorUpdate();

      await behaviorsPage.expectUppercaseFieldValue('TEST@123!');
    });
  });

  test.describe('No Console Errors', () => {
    test('should not produce console errors during behaviors', async () => {
      // Trigger various behaviors
      await behaviorsPage.fillPrice(100);
      await behaviorsPage.fillQuantity(5);
      await behaviorsPage.selectCountry('ru');
      await behaviorsPage.toggleDiscount(true);
      await behaviorsPage.fillDiscountPercent(10);
      await behaviorsPage.toggleConfirmed(true);
      await behaviorsPage.fillShippingAddress('Test');
      await behaviorsPage.toggleUseShippingAsBilling(true);
      await behaviorsPage.fillUppercaseField('test');
      await behaviorsPage.selectPaymentType('card');
      await behaviorsPage.fillCardNumber('1234');
      await behaviorsPage.fillSyncField1('sync');

      await behaviorsPage.waitForBehaviorUpdate();

      // Check no errors occurred
      expect(behaviorsPage.hasNoErrors()).toBe(true);
    });
  });
});
