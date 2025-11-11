import { test } from '@playwright/test';

test('Click on button', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.getByTestId('test').click();
});
