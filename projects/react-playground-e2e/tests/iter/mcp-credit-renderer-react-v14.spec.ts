import { test } from '@playwright/test';

const N = 14;
const TARGET = 'renderer-react';
const URL = `/mcp-credit-application-${TARGET}-v${N}`;

test(`mcp-credit-${TARGET}-v${N} — walkthrough`, async ({ page }) => {
  await page.goto(URL);
  await page.waitForLoadState('networkidle');

  // ---------------- Step 1 — Кредит ----------------
  // loanType has default 'consumer'; loanTerm default 12.
  await page.getByTestId('input-loanAmount').fill('1500000');
  await page.getByTestId('input-loanTerm').fill('36');
  await page.getByTestId('input-loanPurpose').fill('Покупка мебели и техники для квартиры');
  await page.screenshot({
    path: `screenshots/mcp-credit-v${N}/${TARGET}/page1-filled.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Далее|Next/i }).click();

  // ---------------- Step 2 — Личные данные ----------------
  await page.getByTestId('input-lastName').fill('Иванов');
  await page.getByTestId('input-firstName').fill('Иван');
  await page.getByTestId('input-middleName').fill('Иванович');
  await page.getByTestId('input-birthDate').fill('1990-01-15');
  await page.screenshot({
    path: `screenshots/mcp-credit-v${N}/${TARGET}/page2-filled.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Далее|Next/i }).click();

  // ---------------- Step 3 — Контакты ----------------
  await page.getByTestId('input-phoneMain').fill('+7 999 123-45-67');
  await page.getByTestId('input-email').fill('ivan@example.com');
  await page.getByTestId('input-city').fill('Москва');
  await page.screenshot({
    path: `screenshots/mcp-credit-v${N}/${TARGET}/page3-filled.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Далее|Next/i }).click();

  // ---------------- Step 4 — Работа ----------------
  // employmentStatus default 'employed' → companyName required (conditional)
  await page.getByTestId('input-companyName').fill('ООО «Ромашка»');
  await page.getByTestId('input-monthlyIncome').fill('150000');
  await page.getByTestId('input-additionalIncome').fill('20000');
  await page.screenshot({
    path: `screenshots/mcp-credit-v${N}/${TARGET}/page4-filled.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Далее|Next/i }).click();

  // ---------------- Step 5 — Доп. инфо ----------------
  // hasProperty unchecked → array section is empty/hidden, just go forward
  await page.screenshot({
    path: `screenshots/mcp-credit-v${N}/${TARGET}/page5-filled.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Далее|Next/i }).click();

  // ---------------- Step 6 — Подтверждение ----------------
  await page.getByTestId('input-agreePersonalData').click();
  await page.getByTestId('input-agreeTerms').click();
  await page.getByTestId('input-confirmAccuracy').click();
  await page.screenshot({
    path: `screenshots/mcp-credit-v${N}/${TARGET}/page6-filled.png`,
    fullPage: true,
  });

  // Handle alert from submit
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Отправить|Submit/i }).click();
  await page.waitForLoadState('networkidle');
  await page.screenshot({
    path: `screenshots/mcp-credit-v${N}/${TARGET}/page-final.png`,
    fullPage: true,
  });
});
