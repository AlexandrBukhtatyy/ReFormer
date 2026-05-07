import { test } from '@playwright/test';

const N = 15;
const TARGET = 'core';
const URL = `/mcp-credit-application-${TARGET}-v${N}`;

test(`mcp-credit-${TARGET}-v${N} — walkthrough`, async ({ page }) => {
  await page.goto(URL);
  await page.waitForLoadState('networkidle');

  // ---------------- Step 1 — Кредит ----------------
  // loanType default 'consumer', loanTerm default 12
  await page.getByTestId('input-loanAmount').fill('1500000');
  const termInput = page.getByTestId('input-loanTerm');
  await termInput.fill('36');
  await page
    .getByTestId('input-loanPurpose')
    .fill('Покупка мебели и техники для квартиры на новой квартире');
  await page.screenshot({
    path: `screenshots/mcp-credit-v${N}/${TARGET}/page1-filled.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Далее|Next/i }).click();

  // ---------------- Step 2 — Личные данные ----------------
  await page.getByTestId('input-personalData-lastName').fill('Иванов');
  await page.getByTestId('input-personalData-firstName').fill('Иван');
  await page.getByTestId('input-personalData-middleName').fill('Иванович');
  await page.getByTestId('input-personalData-birthDate').fill('1990-01-15');
  await page.getByTestId('input-personalData-birthPlace').fill('г. Москва');
  // Passport
  await page.getByTestId('input-passport-series').fill('1234');
  await page.getByTestId('input-passport-number').fill('567890');
  await page.getByTestId('input-passport-issueDate').fill('2015-05-20');
  await page.getByTestId('input-passport-issuedBy').fill('УВД г. Москвы');
  await page.getByTestId('input-passport-departmentCode').fill('770001');
  // INN/SNILS
  await page.getByTestId('input-inn').fill('123456789012');
  await page.getByTestId('input-snils').fill('12345678900');

  await page.screenshot({
    path: `screenshots/mcp-credit-v${N}/${TARGET}/page2-filled.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Далее|Next/i }).click();

  // ---------------- Step 3 — Контакты ----------------
  await page.getByTestId('input-phoneMain').fill('+7 (999) 123-45-67');
  await page.getByTestId('input-email').fill('ivan@example.com');
  // sameAsRegistration default true → only registration address required
  await page.getByTestId('input-reg-region').fill('Москва');
  // city loaded async — wait briefly for options
  await page.waitForTimeout(500);
  await page.getByTestId('input-reg-street').fill('Ленина');
  await page.getByTestId('input-reg-house').fill('10');
  await page.getByTestId('input-reg-postalCode').fill('123456');
  // Try to set city via select trigger
  try {
    await page.getByTestId('input-reg-city').click({ timeout: 1000 });
    await page.waitForTimeout(200);
    const moscowOption = page.getByRole('option', { name: 'Москва' });
    if (await moscowOption.isVisible({ timeout: 500 })) {
      await moscowOption.click();
    } else {
      await page.keyboard.press('Escape');
    }
  } catch {
    // ignore — city select may not open in test
  }

  await page.screenshot({
    path: `screenshots/mcp-credit-v${N}/${TARGET}/page3-filled.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Далее|Next/i }).click();

  // ---------------- Step 4 — Работа ----------------
  // employmentStatus default 'employed'
  await page.getByTestId('input-companyName').fill('ООО «Ромашка»');
  await page.getByTestId('input-companyInn').fill('1234567890');
  await page.getByTestId('input-companyPhone').fill('+7 (495) 555-12-34');
  await page.getByTestId('input-companyAddress').fill('Москва, ул. Ленина 1');
  await page.getByTestId('input-position').fill('Менеджер');
  await page.getByTestId('input-workExperienceTotal').fill('60');
  await page.getByTestId('input-workExperienceCurrent').fill('24');
  await page.getByTestId('input-monthlyIncome').fill('150000');
  await page.screenshot({
    path: `screenshots/mcp-credit-v${N}/${TARGET}/page4-filled.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Далее|Next/i }).click();

  // ---------------- Step 5 — Дополнительно ----------------
  // maritalStatus default 'single', education default 'higher', dependents 0
  // Skip arrays by leaving checkboxes unchecked
  await page.screenshot({
    path: `screenshots/mcp-credit-v${N}/${TARGET}/page5-filled.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Далее|Next/i }).click();

  // ---------------- Step 6 — Подтверждение ----------------
  await page.getByTestId('input-agreePersonalData').click();
  await page.getByTestId('input-agreeCreditHistory').click();
  await page.getByTestId('input-agreeTerms').click();
  await page.getByTestId('input-confirmAccuracy').click();
  await page.getByTestId('input-electronicSignature').fill('123456');
  await page.screenshot({
    path: `screenshots/mcp-credit-v${N}/${TARGET}/page6-filled.png`,
    fullPage: true,
  });

  // Submit
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Отправить|Submit/i }).click();
  await page.waitForLoadState('networkidle');
  await page.screenshot({
    path: `screenshots/mcp-credit-v${N}/${TARGET}/page-final.png`,
    fullPage: true,
  });
});
