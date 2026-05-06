import { test } from '@playwright/test';

const N = 14;
const TARGET = 'renderer-json';
const URL = `/mcp-credit-application-${TARGET}-v${N}`;
const SCREENSHOT_DIR = `screenshots/mcp-credit-v${N}/${TARGET}`;

test(`mcp-credit-${TARGET}-v${N} — walkthrough`, async ({ page }) => {
  test.setTimeout(120_000);
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
  await page.getByRole('button', { name: /Далее|Next/i }).click();

  // ---- Step 2: Личные данные ----
  await page.getByTestId('input-lastName').fill('Иванов');
  await page.getByTestId('input-firstName').fill('Иван');
  await page.getByTestId('input-middleName').fill('Иванович');
  await page.getByTestId('input-birthDate').fill('1990-01-15');
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/page2-filled.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Далее|Next/i }).click();

  // ---- Step 3: Контакты ----
  await page.getByTestId('input-phoneMain').fill('+7 (999) 123-45-67');
  await page.getByTestId('input-email').fill('ivanov@example.com');
  await page.getByTestId('input-city').fill('Москва');
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/page3-filled.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Далее|Next/i }).click();

  // ---- Step 4: Работа (employmentStatus is 'employed' by default → companyName required) ----
  await page.getByTestId('input-companyName').fill('ООО "Ромашка"');
  await page.getByTestId('input-monthlyIncome').fill('120000');
  await page.getByTestId('input-additionalIncome').fill('20000');
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/page4-filled.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Далее|Next/i }).click();

  // ---- Step 5: Доп. инфо ----
  await page.getByTestId('input-dependents').fill('1');
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/page5-filled.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Далее|Next/i }).click();

  // ---- Step 6: Подтверждение ----
  await page.getByTestId('input-agreePersonalData').check();
  await page.getByTestId('input-agreeTerms').check();
  await page.getByTestId('input-confirmAccuracy').check();
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/page6-filled.png`,
    fullPage: true,
  });

  // Submit
  page.on('dialog', (dialog) => dialog.accept().catch(() => {}));
  await page
    .getByRole('button', { name: /Отправить|Submit/i })
    .click({ trial: false })
    .catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/page-final.png`,
    fullPage: true,
  });
});
