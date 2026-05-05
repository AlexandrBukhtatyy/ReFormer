import { test, expect } from '@playwright/test';

const N = 12;
const TARGET = 'renderer-react';
const URL = `/mcp-credit-application-${TARGET}-v${N}`;
const SHOTS_BASE = `screenshots/mcp-credit-v${N}/${TARGET}`;

test(`mcp-credit-${TARGET}-v${N} — walkthrough`, async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL);
  await page.waitForLoadState('domcontentloaded');

  // ─── Step 1: loan ───────────────────────────────────────────────────────
  await page.screenshot({ path: `${SHOTS_BASE}/page1-initial.png`, fullPage: true });

  // loanType — Select (already 'consumer' by default)
  await page.locator('[data-testid="input-loanAmount"]').fill('500000');
  await page.locator('[data-testid="input-loanTerm"]').fill('24');
  await page.locator('[data-testid="input-loanPurpose"]').fill('Покупка бытовой техники для дома');

  await page.screenshot({ path: `${SHOTS_BASE}/page1-filled.png`, fullPage: true });
  await page.getByRole('button', { name: /Далее|Next/i }).click();
  await page.waitForTimeout(300);

  // ─── Step 2: personal data ──────────────────────────────────────────────
  await page.locator('[data-testid="input-lastName"]').fill('Иванов');
  await page.locator('[data-testid="input-firstName"]').fill('Иван');
  await page.locator('[data-testid="input-middleName"]').fill('Иванович');
  await page.locator('[data-testid="input-birthDate"]').fill('1990-01-15');
  await page.locator('[data-testid="input-birthPlace"]').fill('г. Москва');
  await page.locator('[data-testid="input-passportSeries"]').fill('4520');
  await page.locator('[data-testid="input-passportNumber"]').fill('123456');
  await page.locator('[data-testid="input-issueDate"]').fill('2015-06-20');
  await page.locator('[data-testid="input-issuedBy"]').fill('ОВД района Тверской');
  await page.locator('[data-testid="input-departmentCode"]').fill('770001');
  await page.locator('[data-testid="input-inn"]').fill('123456789012');
  await page.locator('[data-testid="input-snils"]').fill('12345678900');

  await page.screenshot({ path: `${SHOTS_BASE}/page2-filled.png`, fullPage: true });
  await page.getByRole('button', { name: /Далее|Next/i }).click();
  await page.waitForTimeout(300);

  // ─── Step 3: contacts ───────────────────────────────────────────────────
  await page.locator('[data-testid="input-phoneMain"]').fill('+79161234567');
  await page.locator('[data-testid="input-email"]').fill('ivanov@example.com');
  await page.locator('[data-testid="input-regRegion"]').fill('Москва');
  await page.locator('[data-testid="input-regCity"]').fill('Москва');
  await page.locator('[data-testid="input-regStreet"]').fill('Тверская');
  await page.locator('[data-testid="input-regHouse"]').fill('1');
  await page.locator('[data-testid="input-regPostalCode"]').fill('125009');

  await page.screenshot({ path: `${SHOTS_BASE}/page3-filled.png`, fullPage: true });
  await page.getByRole('button', { name: /Далее|Next/i }).click();
  await page.waitForTimeout(300);

  // ─── Step 4: employment ─────────────────────────────────────────────────
  await page.locator('[data-testid="input-companyName"]').fill('ООО Ромашка');
  await page.locator('[data-testid="input-companyInn"]').fill('1234567890');
  await page.locator('[data-testid="input-position"]').fill('Менеджер');
  await page.locator('[data-testid="input-workExperienceTotal"]').fill('60');
  await page.locator('[data-testid="input-workExperienceCurrent"]').fill('24');
  await page.locator('[data-testid="input-monthlyIncome"]').fill('100000');

  await page.screenshot({ path: `${SHOTS_BASE}/page4-filled.png`, fullPage: true });
  await page.getByRole('button', { name: /Далее|Next/i }).click();
  await page.waitForTimeout(300);

  // ─── Step 5: additional ─────────────────────────────────────────────────
  await page.locator('[data-testid="input-dependents"]').fill('1');

  await page.screenshot({ path: `${SHOTS_BASE}/page5-filled.png`, fullPage: true });
  await page.getByRole('button', { name: /Далее|Next/i }).click();
  await page.waitForTimeout(300);

  // ─── Step 6: agreements + submit ────────────────────────────────────────
  // Try clicking each required checkbox by data-testid input
  for (const id of ['agreePersonalData', 'agreeCreditHistory', 'agreeTerms', 'confirmAccuracy']) {
    const checkbox = page.locator(`[data-testid="input-${id}"]`).first();
    await checkbox.click().catch(() => null);
  }
  await page.locator('[data-testid="input-electronicSignature"]').fill('123456');

  await page.screenshot({ path: `${SHOTS_BASE}/page6-filled.png`, fullPage: true });

  await page.getByRole('button', { name: /Отправить|Submit|Подтвердить/i }).click().catch(() => null);
  await page.waitForTimeout(1500);

  await page.screenshot({ path: `${SHOTS_BASE}/page-final.png`, fullPage: true });

  // Soft assertion: page loaded
  await expect(page).toHaveURL(new RegExp(URL));
});
