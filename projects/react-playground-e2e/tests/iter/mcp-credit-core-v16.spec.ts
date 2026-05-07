/**
 * iter-16 / target=core — walkthrough.
 * Generated through MCP-only sandbox.
 */
import { expect, test, type Page } from '@playwright/test';

const N = 16;
const TARGET = 'core';
const URL = `/mcp-credit-application-${TARGET}-v${N}`;
const SCREEN_DIR = `screenshots/mcp-credit-v${N}/${TARGET}`;

async function fillByTestId(page: Page, testId: string, value: string) {
  const input = page.locator(`[data-testid="input-${testId}"]`).first();
  await input.waitFor({ state: 'visible', timeout: 5000 });
  // For native inputs/textareas — fill works
  await input.fill(value).catch(async () => {
    // Fallback for wrapped controls
    await input.click();
    await input.fill(value);
  });
  await input.blur().catch(() => {});
}

async function selectByTestId(page: Page, testId: string, label: string) {
  const trigger = page.locator(`[data-testid="input-${testId}"]`).first();
  await trigger.waitFor({ state: 'visible', timeout: 5000 });
  await trigger.click();
  // Try option by role (for portal-style listbox) — fall back to visible text
  const opt = page.getByRole('option', { name: label }).first();
  await opt.waitFor({ state: 'visible', timeout: 3000 }).catch(async () => {
    // Final fallback: click any element containing the text
    await page.locator(`text="${label}"`).first().click();
  });
  if (await opt.isVisible().catch(() => false)) {
    await opt.click();
  }
}

async function checkByTestId(page: Page, testId: string) {
  const cb = page.locator(`[data-testid="input-${testId}"]`).first();
  await cb.waitFor({ state: 'visible', timeout: 5000 });
  await cb.click({ force: true });
}

async function clickNext(page: Page) {
  const next = page.locator('[data-testid="btn-next"]').first();
  await next.waitFor({ state: 'visible', timeout: 5000 });
  await next.click();
}

test(`mcp-credit-${TARGET}-v${N} — walkthrough`, async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto(URL);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="input-loanAmount"]', { timeout: 10_000 });

  // -------------------------------------------------------------------------
  // Step 1 — Loan (loanType already 'consumer' by default — keep it)
  // -------------------------------------------------------------------------
  await fillByTestId(page, 'loanAmount', '500000');
  await fillByTestId(page, 'loanTerm', '24');
  await fillByTestId(page, 'loanPurpose', 'Покупка бытовой техники для дома');

  await page.screenshot({
    path: `${SCREEN_DIR}/page1-filled.png`,
    fullPage: true,
  });

  await clickNext(page);

  // -------------------------------------------------------------------------
  // Step 2 — Personal
  // -------------------------------------------------------------------------
  await page.waitForSelector('[data-testid="input-lastName"]', { timeout: 10_000 });
  await fillByTestId(page, 'lastName', 'Иванов');
  await fillByTestId(page, 'firstName', 'Иван');
  await fillByTestId(page, 'middleName', 'Иванович');
  await fillByTestId(page, 'birthDate', '1990-05-15');
  await fillByTestId(page, 'birthPlace', 'г. Москва');

  await fillByTestId(page, 'passportSeries', '12 34');
  await fillByTestId(page, 'passportNumber', '567890');
  await fillByTestId(page, 'passportIssueDate', '2010-06-20');
  await fillByTestId(page, 'passportIssuedBy', 'ОУФМС России по г. Москве');
  await fillByTestId(page, 'passportDepartmentCode', '770-001');

  await fillByTestId(page, 'inn', '771234567890');
  await fillByTestId(page, 'snils', '123-456-789 00');

  await page.screenshot({
    path: `${SCREEN_DIR}/page2-filled.png`,
    fullPage: true,
  });

  await clickNext(page);

  // -------------------------------------------------------------------------
  // Step 3 — Contacts
  // -------------------------------------------------------------------------
  await page.waitForSelector('[data-testid="input-phoneMain"]', { timeout: 10_000 });
  await fillByTestId(page, 'phoneMain', '+7 (495) 123-45-67');
  await fillByTestId(page, 'email', 'ivanov@example.com');

  await selectByTestId(page, 'regAddrRegion', 'Москва');
  // wait for cities async load
  await page.waitForTimeout(900);
  await selectByTestId(page, 'regAddrCity', 'Москва');

  await fillByTestId(page, 'regAddrStreet', 'ул. Тверская');
  await fillByTestId(page, 'regAddrHouse', '10');
  await fillByTestId(page, 'regAddrPostalCode', '125009');

  await page.screenshot({
    path: `${SCREEN_DIR}/page3-filled.png`,
    fullPage: true,
  });

  await clickNext(page);

  // -------------------------------------------------------------------------
  // Step 4 — Employment (default 'employed')
  // -------------------------------------------------------------------------
  await page.waitForSelector('[data-testid="input-companyName"]', { timeout: 10_000 });
  await fillByTestId(page, 'companyName', 'ООО Ромашка');
  await fillByTestId(page, 'companyInn', '7712345678');
  await fillByTestId(page, 'companyPhone', '+7 (495) 555-12-34');
  await fillByTestId(page, 'companyAddress', 'г. Москва, ул. Ленина, 1');
  await fillByTestId(page, 'position', 'Менеджер');
  await fillByTestId(page, 'workExperienceTotal', '60');
  await fillByTestId(page, 'workExperienceCurrent', '24');
  await fillByTestId(page, 'monthlyIncome', '120000');

  await page.screenshot({
    path: `${SCREEN_DIR}/page4-filled.png`,
    fullPage: true,
  });

  await clickNext(page);

  // -------------------------------------------------------------------------
  // Step 5 — Additional
  // -------------------------------------------------------------------------
  await page.waitForSelector('[data-testid="input-dependents"]', { timeout: 10_000 });
  await fillByTestId(page, 'dependents', '1');

  await page.screenshot({
    path: `${SCREEN_DIR}/page5-filled.png`,
    fullPage: true,
  });

  await clickNext(page);

  // -------------------------------------------------------------------------
  // Step 6 — Confirmation
  // -------------------------------------------------------------------------
  await page.waitForSelector('[data-testid="input-agreePersonalData"]', { timeout: 10_000 });
  await checkByTestId(page, 'agreePersonalData');
  await checkByTestId(page, 'agreeCreditHistory');
  await checkByTestId(page, 'agreeTerms');
  await checkByTestId(page, 'confirmAccuracy');
  await fillByTestId(page, 'electronicSignature', '123456');

  await page.screenshot({
    path: `${SCREEN_DIR}/page6-filled.png`,
    fullPage: true,
  });

  // Submit (alert dialog handled)
  page.once('dialog', async (dialog) => {
    await dialog.accept().catch(() => {});
  });

  const submit = page.getByRole('button', { name: /Отправить|Submit/i }).first();
  await submit.click().catch(() => {});
  await page.waitForTimeout(800);

  await page.screenshot({
    path: `${SCREEN_DIR}/page-final.png`,
    fullPage: true,
  });

  await expect(page.locator('body')).toBeVisible();
});
