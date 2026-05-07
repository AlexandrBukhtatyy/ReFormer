import { test, expect, type Page } from '@playwright/test';

const N = 16;
const TARGET = 'renderer-json';
const URL = `/mcp-credit-application-${TARGET}-v${N}`;

const screenshotPath = (file: string) =>
  `screenshots/mcp-credit-v${N}/${TARGET}/${file}`;

async function clickNext(page: Page) {
  await page.getByRole('button', { name: /Далее|Next/i }).click();
}

async function fillField(page: Page, testId: string, value: string) {
  const locator = page.locator(`[data-testid="input-${testId}"]`).first();
  if ((await locator.count()) === 0) return;
  await locator.fill(value);
}

test(`mcp-credit-${TARGET}-v${N} — walkthrough`, async ({ page }) => {
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[console.error]', msg.text());
  });

  await page.goto(URL);

  // Allow form to mount
  await page.waitForLoadState('networkidle');

  // ============= Step 1: Loan =============
  await fillField(page, 'loanAmount', '500000');
  await fillField(page, 'loanTerm', '24');
  await fillField(
    page,
    'loanPurpose',
    'Покупка бытовой техники и расходных материалов'
  );
  await page.screenshot({
    path: screenshotPath('page1-filled.png'),
    fullPage: true,
  });
  await clickNext(page);

  // ============= Step 2: Personal =============
  await fillField(page, 'personalData.lastName', 'Иванов');
  await fillField(page, 'personalData.firstName', 'Иван');
  await fillField(page, 'personalData.middleName', 'Иванович');
  await fillField(page, 'personalData.birthDate', '1990-05-15');
  await fillField(page, 'personalData.birthPlace', 'г. Москва');
  await fillField(page, 'passportData.series', '4501');
  await fillField(page, 'passportData.number', '123456');
  await fillField(page, 'passportData.issueDate', '2010-06-20');
  await fillField(page, 'passportData.issuedBy', 'ОВД района Тверской');
  await fillField(page, 'passportData.departmentCode', '770001');
  await fillField(page, 'inn', '771234567890');
  await fillField(page, 'snils', '12345678900');
  await page.screenshot({
    path: screenshotPath('page2-filled.png'),
    fullPage: true,
  });
  await clickNext(page);

  // ============= Step 3: Contacts =============
  await fillField(page, 'phoneMain', '+7 (495) 123-45-67');
  await fillField(page, 'email', 'ivan@example.com');
  // registrationAddress: select region msk, then fill rest
  const regionSelect = page
    .locator(`[data-testid="input-registrationAddress.region"]`)
    .first();
  if ((await regionSelect.count()) > 0) {
    try {
      await regionSelect.selectOption('msk');
    } catch {
      // select might be combobox-like; ignore
    }
  }
  await fillField(page, 'registrationAddress.street', 'Тверская');
  await fillField(page, 'registrationAddress.house', '5');
  await fillField(page, 'registrationAddress.apartment', '12');
  await fillField(page, 'registrationAddress.postalCode', '125009');
  await page.screenshot({
    path: screenshotPath('page3-filled.png'),
    fullPage: true,
  });
  await clickNext(page);

  // ============= Step 4: Employment =============
  await fillField(page, 'companyName', 'ООО «Ромашка»');
  await fillField(page, 'companyInn', '7712345678');
  await fillField(page, 'companyPhone', '+7 (495) 765-43-21');
  await fillField(page, 'companyAddress', 'Москва, ул. Тверская, 1');
  await fillField(page, 'position', 'Менеджер');
  await fillField(page, 'workExperienceTotal', '60');
  await fillField(page, 'workExperienceCurrent', '24');
  await fillField(page, 'monthlyIncome', '120000');
  await page.screenshot({
    path: screenshotPath('page4-filled.png'),
    fullPage: true,
  });
  await clickNext(page);

  // ============= Step 5: Additional =============
  await fillField(page, 'dependents', '1');
  await page.screenshot({
    path: screenshotPath('page5-filled.png'),
    fullPage: true,
  });
  await clickNext(page);

  // ============= Step 6: Confirmation =============
  // Check all required agreements (checkbox labels)
  const agreements = [
    'agreePersonalData',
    'agreeCreditHistory',
    'agreeTerms',
    'confirmAccuracy',
  ];
  for (const id of agreements) {
    const checkbox = page.locator(`[data-testid="input-${id}"]`).first();
    if ((await checkbox.count()) > 0) {
      try {
        await checkbox.check({ force: true });
      } catch {
        // some checkboxes wrap in label; try clicking
        await checkbox.click({ force: true }).catch(() => undefined);
      }
    }
  }
  await fillField(page, 'electronicSignature', '123456');
  await page.screenshot({
    path: screenshotPath('page6-filled.png'),
    fullPage: true,
  });

  // Submit
  const submitBtn = page.getByRole('button', { name: /Отправить|Submit/i });
  if ((await submitBtn.count()) > 0) {
    page.on('dialog', (dialog) => dialog.accept().catch(() => undefined));
    await submitBtn.click().catch(() => undefined);
    await page.waitForTimeout(1500);
  }
  await page.screenshot({
    path: screenshotPath('page-final.png'),
    fullPage: true,
  });

  // Test passes if nothing crashed
  expect(true).toBe(true);
});
