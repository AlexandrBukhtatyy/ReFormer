import { test } from '@playwright/test';

const N = 15;
const TARGET = 'renderer-react';
const URL = `/mcp-credit-application-${TARGET}-v${N}`;

test.setTimeout(180_000);

test(`mcp-credit-${TARGET}-v${N} — walkthrough`, async ({ page }) => {
  await page.goto(URL);
  await page.waitForLoadState('networkidle');

  const click = async (selector: string) => {
    await page.locator(selector).first().click({ timeout: 2000 }).catch(() => undefined);
  };
  const fill = async (selector: string, value: string) => {
    await page.locator(selector).first().fill(value, { timeout: 5000 }).catch(() => undefined);
  };
  const next = async () => {
    await page.locator('[data-testid="btn-next"]').first().click();
    await page.waitForTimeout(900);
  };

  // -------- Step 1: Loan --------
  // loanType select — keep default 'consumer'
  await fill('[data-testid="input-loanAmount"]', '500000');
  await fill('[data-testid="input-loanTerm"]', '24');
  await fill('[data-testid="input-loanPurpose"]', 'Покупка бытовой техники для дома и ремонта');
  await page.screenshot({
    path: `screenshots/mcp-credit-v${N}/${TARGET}/page1-filled.png`,
    fullPage: true,
  });
  await next();

  // -------- Step 2: Personal Data --------
  await fill('[data-testid="input-personalData-lastName"]', 'Иванов');
  await fill('[data-testid="input-personalData-firstName"]', 'Иван');
  await fill('[data-testid="input-personalData-middleName"]', 'Иванович');
  await fill('[data-testid="input-personalData-birthDate"]', '1990-05-15');
  await fill('[data-testid="input-personalData-birthPlace"]', 'Москва');
  await fill('[data-testid="input-passportData-series"]', '45 01');
  await fill('[data-testid="input-passportData-number"]', '123456');
  await fill('[data-testid="input-passportData-issueDate"]', '2010-06-15');
  await fill('[data-testid="input-passportData-issuedBy"]', 'ОВД Тестовый');
  await fill('[data-testid="input-passportData-departmentCode"]', '770-001');
  await fill('[data-testid="input-inn"]', '123456789012');
  await fill('[data-testid="input-snils"]', '123-456-789 00');
  await page.screenshot({
    path: `screenshots/mcp-credit-v${N}/${TARGET}/page2-filled.png`,
    fullPage: true,
  });
  await next();

  // -------- Step 3: Contacts --------
  await fill('[data-testid="input-phoneMain"]', '+7 (495) 123-45-67');
  await fill('[data-testid="input-email"]', 'ivanov@example.com');
  await fill('[data-testid="input-registrationAddress-region"]', 'Москва');
  await page.waitForTimeout(500); // wait for cities loading
  await fill('[data-testid="input-registrationAddress-street"]', 'Ленинская');
  await fill('[data-testid="input-registrationAddress-house"]', '10');
  await fill('[data-testid="input-registrationAddress-postalCode"]', '123456');
  // Best-effort city select interaction
  await click('[data-testid="input-registrationAddress-city"]');
  await page.waitForTimeout(300);
  const opt = page.locator('[role="option"]').first();
  if (await opt.count()) await opt.click({ timeout: 1000 }).catch(() => undefined);
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.screenshot({
    path: `screenshots/mcp-credit-v${N}/${TARGET}/page3-filled.png`,
    fullPage: true,
  });
  await next();

  // -------- Step 4: Employment --------
  await fill('[data-testid="input-companyName"]', 'ООО Тест');
  await fill('[data-testid="input-companyInn"]', '1234567890');
  await fill('[data-testid="input-position"]', 'Менеджер');
  await fill('[data-testid="input-workExperienceTotal"]', '60');
  await fill('[data-testid="input-workExperienceCurrent"]', '24');
  await fill('[data-testid="input-monthlyIncome"]', '80000');
  await page.screenshot({
    path: `screenshots/mcp-credit-v${N}/${TARGET}/page4-filled.png`,
    fullPage: true,
  });
  await next();

  // -------- Step 5: Additional --------
  // maritalStatus, education defaults; dependents = 0 default
  await page.screenshot({
    path: `screenshots/mcp-credit-v${N}/${TARGET}/page5-filled.png`,
    fullPage: true,
  });
  await next();

  // -------- Step 6: Confirmation --------
  await click('[data-testid="input-agreePersonalData"]');
  await click('[data-testid="input-agreeCreditHistory"]');
  await click('[data-testid="input-agreeTerms"]');
  await click('[data-testid="input-confirmAccuracy"]');
  await fill('[data-testid="input-electronicSignature"]', '123456');
  await page.screenshot({
    path: `screenshots/mcp-credit-v${N}/${TARGET}/page6-filled.png`,
    fullPage: true,
  });

  // -------- Submit --------
  await page
    .locator('[data-testid="btn-submit"]')
    .first()
    .click({ timeout: 5000 })
    .catch(async () => {
      // fallback: click by label
      await page
        .getByRole('button', { name: /Отправить|Submit/i })
        .first()
        .click()
        .catch(() => undefined);
    });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: `screenshots/mcp-credit-v${N}/${TARGET}/page-final.png`,
    fullPage: true,
  });
});
