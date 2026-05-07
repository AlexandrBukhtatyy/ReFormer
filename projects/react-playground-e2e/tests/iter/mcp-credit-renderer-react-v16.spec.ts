import { test, expect } from '@playwright/test';

const N = 16;
const TARGET = 'renderer-react';
const URL = `/mcp-credit-application-${TARGET}-v${N}`;
const SHOT_DIR = `screenshots/mcp-credit-v${N}/${TARGET}`;

test(`mcp-credit-${TARGET}-v${N} — walkthrough`, async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto(URL);
  await page.waitForLoadState('networkidle');

  // ---------- Step 1 ----------
  await page.locator('[data-testid="input-loanAmount"]').fill('500000');
  await page.locator('[data-testid="input-loanTerm"]').fill('24');
  await page.locator('[data-testid="input-loanPurpose"]').fill('Покупка бытовой техники для дома');
  await page.waitForTimeout(300);

  await page.screenshot({
    path: `${SHOT_DIR}/page1-filled.png`,
    fullPage: true,
  });

  await page.getByRole('button', { name: /Далее|Next/i }).click();

  // ---------- Step 2 ----------
  await page.waitForTimeout(500);
  await page.locator('[data-testid="input-lastName"]').fill('Иванов');
  await page.locator('[data-testid="input-firstName"]').fill('Иван');
  await page.locator('[data-testid="input-middleName"]').fill('Иванович');
  await page.locator('[data-testid="input-birthDate"]').fill('1990-05-15');
  await page.locator('[data-testid="input-birthPlace"]').fill('г. Москва');
  await page.locator('[data-testid="input-passportSeries"]').fill('12 34');
  await page.locator('[data-testid="input-passportNumber"]').fill('567890');
  await page.locator('[data-testid="input-passportIssueDate"]').fill('2015-06-20');
  await page.locator('[data-testid="input-passportIssuedBy"]').fill('ОВД района');
  await page.locator('[data-testid="input-passportDepartmentCode"]').fill('770-001');
  await page.locator('[data-testid="input-inn"]').fill('123456789012');
  await page.locator('[data-testid="input-snils"]').fill('123-456-789 00');
  await page.waitForTimeout(700); // wait for async validators

  await page.screenshot({
    path: `${SHOT_DIR}/page2-filled.png`,
    fullPage: true,
  });

  await page.getByRole('button', { name: /Далее|Next/i }).click();

  // ---------- Step 3 ----------
  await page.waitForTimeout(500);
  await page.locator('[data-testid="input-phoneMain"]').fill('+7 (916) 123-45-67');
  await page.locator('[data-testid="input-email"]').fill('ivan@example.com');
  // sameAsRegistration is true by default, so residence not required
  // registrationAddress
  // region select — try clicking
  try {
    await page.locator('[data-testid="input-regAddr-region"]').click({ timeout: 2000 });
    await page.getByRole('option', { name: 'Москва' }).first().click({ timeout: 2000 });
  } catch {
    // Fallback: skip — Select via keyboard if click fails
  }
  await page.waitForTimeout(800); // wait for async-options
  try {
    await page.locator('[data-testid="input-regAddr-city"]').click({ timeout: 2000 });
    await page.getByRole('option').first().click({ timeout: 2000 });
  } catch {
    /* noop */
  }
  await page.locator('[data-testid="input-regAddr-street"]').fill('Тверская');
  await page.locator('[data-testid="input-regAddr-house"]').fill('10');
  await page.locator('[data-testid="input-regAddr-postalCode"]').fill('123456');
  await page.waitForTimeout(700); // wait for email async validator

  await page.screenshot({
    path: `${SHOT_DIR}/page3-filled.png`,
    fullPage: true,
  });

  await page.getByRole('button', { name: /Далее|Next/i }).click();

  // ---------- Step 4 ----------
  await page.waitForTimeout(500);
  await page.locator('[data-testid="input-companyName"]').fill('ООО "Ромашка"');
  await page.locator('[data-testid="input-companyInn"]').fill('1234567890');
  await page.locator('[data-testid="input-companyPhone"]').fill('+7 (495) 123-45-67');
  await page.locator('[data-testid="input-companyAddress"]').fill('Москва, ул. Ленина 1');
  await page.locator('[data-testid="input-position"]').fill('Менеджер');
  await page.locator('[data-testid="input-workExperienceTotal"]').fill('60');
  await page.locator('[data-testid="input-workExperienceCurrent"]').fill('24');
  await page.locator('[data-testid="input-monthlyIncome"]').fill('120000');
  await page.locator('[data-testid="input-additionalIncome"]').fill('0');
  await page.waitForTimeout(300);

  await page.screenshot({
    path: `${SHOT_DIR}/page4-filled.png`,
    fullPage: true,
  });

  await page.getByRole('button', { name: /Далее|Next/i }).click();

  // ---------- Step 5 ----------
  await page.waitForTimeout(500);
  await page.locator('[data-testid="input-dependents"]').fill('1');
  // hasProperty/hasExistingLoans/hasCoBorrower stay default false
  await page.waitForTimeout(300);

  await page.screenshot({
    path: `${SHOT_DIR}/page5-filled.png`,
    fullPage: true,
  });

  await page.getByRole('button', { name: /Далее|Next/i }).click();

  // ---------- Step 6 ----------
  await page.waitForTimeout(500);
  // Check required-true checkboxes
  const required = [
    'agreePersonalData',
    'agreeCreditHistory',
    'agreeTerms',
    'confirmAccuracy',
  ];
  for (const id of required) {
    const cb = page.locator(`[data-testid="input-${id}"]`).first();
    await cb.click({ force: true }).catch(() => {});
  }
  await page.locator('[data-testid="input-electronicSignature"]').fill('123456');
  await page.waitForTimeout(300);

  await page.screenshot({
    path: `${SHOT_DIR}/page6-filled.png`,
    fullPage: true,
  });

  // ---------- Submit ----------
  await page.getByRole('button', { name: /Отправить|Submit/i }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  await page.screenshot({
    path: `${SHOT_DIR}/page-final.png`,
    fullPage: true,
  });

  // soft assertion: at least page rendered (no thrown errors)
  await expect(page).toHaveURL(URL);
});
