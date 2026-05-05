import { test, expect } from '@playwright/test';

const N = 12;
const TARGET = 'renderer-json';
const URL = `/mcp-credit-application-${TARGET}-v${N}`;
const SHOTS_DIR = `screenshots/mcp-credit-v${N}/${TARGET}`;

test(`mcp-credit-${TARGET}-v${N} — walkthrough`, async ({ page }) => {
  await page.goto(URL);
  await page.waitForLoadState('networkidle');

  // ---- Step 1: Кредит ----
  await page.fill('input[data-testid="input-loanAmount"]', '500000');
  await page.fill('input[data-testid="input-loanTerm"]', '36');
  await page.fill('textarea[data-testid="input-loanPurpose"]', 'Покупка бытовой техники для дома');
  await page.screenshot({
    path: `${SHOTS_DIR}/page1-filled.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Далее|Next/i }).click();
  await page.waitForTimeout(300);

  // ---- Step 2: Личные данные ----
  await page.fill('input[data-testid="input-lastName"]', 'Иванов');
  await page.fill('input[data-testid="input-firstName"]', 'Иван');
  await page.fill('input[data-testid="input-middleName"]', 'Иванович');
  await page.fill('input[data-testid="input-birthDate"]', '1990-05-15');
  await page.fill('input[data-testid="input-birthPlace"]', 'г. Москва');
  await page.fill('input[data-testid="input-passportSeries"]', '1234');
  await page.fill('input[data-testid="input-passportNumber"]', '567890');
  await page.fill('input[data-testid="input-passportIssueDate"]', '2010-06-01');
  await page.fill('input[data-testid="input-passportIssuedBy"]', 'УФМС России по г. Москве');
  await page.fill('input[data-testid="input-passportDepartmentCode"]', '770001');
  await page.fill('input[data-testid="input-inn"]', '123456789012');
  await page.fill('input[data-testid="input-snils"]', '12345678900');
  await page.screenshot({
    path: `${SHOTS_DIR}/page2-filled.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Далее|Next/i }).click();
  await page.waitForTimeout(300);

  // ---- Step 3: Контакты ----
  await page.fill('input[data-testid="input-phoneMain"]', '79991234567');
  await page.fill('input[data-testid="input-email"]', 'ivan.ivanov@example.com');
  await page.fill('input[data-testid="input-regRegion"]', 'Московская область');
  await page.fill('input[data-testid="input-regCity"]', 'Москва');
  await page.fill('input[data-testid="input-regStreet"]', 'Тверская');
  await page.fill('input[data-testid="input-regHouse"]', '10');
  await page.fill('input[data-testid="input-regPostalCode"]', '125009');
  await page.screenshot({
    path: `${SHOTS_DIR}/page3-filled.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Далее|Next/i }).click();
  await page.waitForTimeout(300);

  // ---- Step 4: Работа ----
  await page.fill('input[data-testid="input-companyName"]', 'ООО Ромашка');
  await page.fill('input[data-testid="input-companyInn"]', '7707083893');
  await page.fill('input[data-testid="input-companyPhone"]', '74951234567');
  await page.fill('input[data-testid="input-companyAddress"]', 'г. Москва, ул. Ленина 1');
  await page.fill('input[data-testid="input-position"]', 'Менеджер');
  await page.fill('input[data-testid="input-workExperienceTotal"]', '60');
  await page.fill('input[data-testid="input-workExperienceCurrent"]', '24');
  await page.fill('input[data-testid="input-monthlyIncome"]', '120000');
  await page.screenshot({
    path: `${SHOTS_DIR}/page4-filled.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Далее|Next/i }).click();
  await page.waitForTimeout(300);

  // ---- Step 5: Дополнительно (минимум — без массивов) ----
  await page.fill('input[data-testid="input-dependents"]', '0');
  await page.screenshot({
    path: `${SHOTS_DIR}/page5-filled.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Далее|Next/i }).click();
  await page.waitForTimeout(300);

  // ---- Step 6: Подтверждение ----
  await page.getByText('Согласие на обработку персональных данных').click();
  await page.getByText('Согласие на проверку кредитной истории').click();
  await page.getByText('Согласие с условиями кредитования').click();
  await page.getByText(/Подтверждаю точность введ/).click();
  await page.fill('input[data-testid="input-electronicSignature"]', '123456');
  await page.screenshot({
    path: `${SHOTS_DIR}/page6-filled.png`,
    fullPage: true,
  });

  // Submit
  await page.getByRole('button', { name: /Отправить|Submit/i }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: `${SHOTS_DIR}/page-final.png`,
    fullPage: true,
  });

  await expect(page).toHaveURL(/mcp-credit-application-renderer-json-v12/);
});
