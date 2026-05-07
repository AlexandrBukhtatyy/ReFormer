import { test } from '@playwright/test';

const N = 15;
const TARGET = 'renderer-json';
const URL = `/mcp-credit-application-${TARGET}-v${N}`;
const SCREENSHOT_DIR = `screenshots/mcp-credit-v${N}/${TARGET}`;

test(`mcp-credit-${TARGET}-v${N} — walkthrough`, async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(URL);
  await page.waitForLoadState('networkidle');

  // ---- Step 1: Кредит ----
  await page.getByTestId('input-loanAmount').fill('500000');
  await page.getByTestId('input-loanTerm').fill('24');
  await page
    .getByTestId('input-loanPurpose')
    .fill('Покупка бытовой техники для нового дома');
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/page1-filled.png`,
    fullPage: true,
  });
  await page
    .getByRole('button', { name: /Далее|Next/i })
    .click()
    .catch(() => {});

  // ---- Step 2: Личные данные ----
  await page.getByTestId('input-lastName').fill('Иванов');
  await page.getByTestId('input-firstName').fill('Иван');
  await page.getByTestId('input-middleName').fill('Иванович');
  await page.getByTestId('input-birthDate').fill('1990-01-15');
  await page.getByTestId('input-birthPlace').fill('Москва');
  await page.getByTestId('input-passportSeries').fill('45 01').catch(() => {});
  await page.getByTestId('input-passportNumber').fill('123456').catch(() => {});
  await page.getByTestId('input-passportIssueDate').fill('2010-05-20').catch(() => {});
  await page.getByTestId('input-passportIssuedBy').fill('УФМС России').catch(() => {});
  await page.getByTestId('input-passportDepartmentCode').fill('770-001').catch(() => {});
  await page.getByTestId('input-inn').fill('123456789012').catch(() => {});
  await page.getByTestId('input-snils').fill('123-456-789 00').catch(() => {});
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/page2-filled.png`,
    fullPage: true,
  });
  await page
    .getByRole('button', { name: /Далее|Next/i })
    .click()
    .catch(() => {});

  // ---- Step 3: Контакты ----
  await page
    .getByTestId('input-phoneMain')
    .fill('+7 (999) 123-45-67')
    .catch(() => {});
  await page.getByTestId('input-email').fill('ivanov@example.com').catch(() => {});
  await page
    .getByTestId('input-registrationRegion')
    .fill('Московская область')
    .catch(() => {});
  // Wait for region watchField (reset city) to settle, then fill city
  await page.waitForTimeout(400);
  await page.getByTestId('input-registrationCity').fill('Москва').catch(() => {});
  await page.getByTestId('input-registrationStreet').fill('Ленина').catch(() => {});
  await page.getByTestId('input-registrationHouse').fill('10').catch(() => {});
  await page
    .getByTestId('input-registrationPostalCode')
    .fill('123456')
    .catch(() => {});
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/page3-filled.png`,
    fullPage: true,
  });
  await page
    .getByRole('button', { name: /Далее|Next/i })
    .click()
    .catch(() => {});

  // ---- Step 4: Работа (employmentStatus default 'employed') ----
  await page.getByTestId('input-companyName').fill('ООО "Ромашка"').catch(() => {});
  await page
    .getByTestId('input-companyInn')
    .fill('1234567890')
    .catch(() => {});
  await page
    .getByTestId('input-companyPhone')
    .fill('+7 (999) 555-44-33')
    .catch(() => {});
  await page
    .getByTestId('input-companyAddress')
    .fill('Москва, ул. Тверская, 1')
    .catch(() => {});
  await page.getByTestId('input-position').fill('Менеджер').catch(() => {});
  await page.getByTestId('input-workExperienceTotal').fill('60').catch(() => {});
  await page.getByTestId('input-workExperienceCurrent').fill('24').catch(() => {});
  await page.getByTestId('input-monthlyIncome').fill('120000').catch(() => {});
  await page.getByTestId('input-additionalIncome').fill('20000').catch(() => {});
  await page
    .getByTestId('input-additionalIncomeSource')
    .fill('Фриланс')
    .catch(() => {});
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/page4-filled.png`,
    fullPage: true,
  });
  await page
    .getByRole('button', { name: /Далее|Next/i })
    .click()
    .catch(() => {});

  // ---- Step 5: Доп. инфо ----
  await page.getByTestId('input-dependents').fill('1').catch(() => {});
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/page5-filled.png`,
    fullPage: true,
  });
  await page
    .getByRole('button', { name: /Далее|Next/i })
    .click()
    .catch(() => {});

  // ---- Step 6: Подтверждение ----
  await page.getByTestId('input-agreePersonalData').check().catch(() => {});
  await page.getByTestId('input-agreeCreditHistory').check().catch(() => {});
  await page.getByTestId('input-agreeTerms').check().catch(() => {});
  await page.getByTestId('input-confirmAccuracy').check().catch(() => {});
  await page
    .getByTestId('input-electronicSignature')
    .fill('123456')
    .catch(() => {});
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/page6-filled.png`,
    fullPage: true,
  });

  // Submit
  page.on('dialog', (dialog) => dialog.accept().catch(() => {}));
  await page
    .getByRole('button', { name: /Отправить|Submit/i })
    .first()
    .click({ trial: false })
    .catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/page-final.png`,
    fullPage: true,
  });
});
