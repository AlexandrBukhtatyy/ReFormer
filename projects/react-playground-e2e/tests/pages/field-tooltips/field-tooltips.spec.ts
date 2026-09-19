import { test, expect } from '@playwright/test';
import { FieldTooltipsPage } from './field-tooltips-page.pom';
import { checkAriaValidity } from '../../shared/a11y';

/**
 * Подсказки-иконки (i): `labelTooltip` (после подписи, рисует FormField) и `tooltip` (в контроле).
 *
 * Юниты кита идут через renderToStaticMarkup: контент Radix Tooltip живёт в Portal, а порядок
 * «крестик → (i) → шеврон» — это координаты. Ни то ни другое там не видно, поэтому проверяется тут.
 */

let po: FieldTooltipsPage;

test.beforeEach(async ({ page }) => {
  po = new FieldTooltipsPage(page);
  await po.goto();
});

test.afterEach(() => {
  expect(po.pageErrors, 'необработанные ошибки страницы').toEqual([]);
  // React-warning об утёкшем в DOM пропе приходит именно как console.error.
  expect(
    po.consoleErrors.filter((e) => /does not recognize|tooltip/i.test(e)),
    'props подсказок не должны течь в DOM'
  ).toEqual([]);
});

test.describe('открытие и закрытие', () => {
  test('наведение показывает текст, уход курсора скрывает', async () => {
    await po.labelHint('email').hover();
    await expect(po.tooltip()).toContainText('Нужен только для отправки чеков');
    await po.screenshot('hover-label-tooltip');

    await po.movePointerAway();
    await expect(po.tooltip()).toHaveCount(0);
  });

  test('фокус с клавиатуры показывает, Escape скрывает и фокус остаётся на иконке', async ({
    page,
  }) => {
    await po.control('email').focus();
    // Иконка подписи стоит в DOM раньше инпута → Shift+Tab.
    await page.keyboard.press('Shift+Tab');
    await expect(po.labelHint('email')).toBeFocused();
    await expect(po.tooltip()).toContainText('Нужен только для отправки чеков');

    await page.keyboard.press('Escape');
    await expect(po.tooltip()).toHaveCount(0);
    await expect(po.labelHint('email')).toBeFocused();
  });

  test('Enter на иконке переключает тултип', async ({ page }) => {
    await po.controlHint('inn').focus();
    await expect(po.tooltip()).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(po.tooltip()).toHaveCount(0);
    await page.keyboard.press('Enter');
    await expect(po.tooltip()).toContainText('10 цифр для юрлица, 12 — для ИП');
  });

  test('открыт только один тултип', async () => {
    await po.controlHint('inn').hover();
    await expect(po.tooltip()).toHaveCount(1);
    await po.controlHint('comment').hover();
    await expect(po.tooltip()).toHaveCount(1);
    await expect(po.tooltip()).toContainText('Увидит только менеджер');
  });
});

test.describe('тач-устройство', () => {
  test.use({ hasTouch: true });

  test('тап открывает и держит, повторный тап закрывает, тап мимо закрывает', async ({ page }) => {
    await po.controlHint('inn').tap();
    await expect(po.tooltip()).toContainText('10 цифр для юрлица, 12 — для ИП');
    // Штатный Radix Tooltip по тапу мигнул бы и закрылся — проверяем, что держится.
    await page.waitForTimeout(400);
    await expect(po.tooltip()).toBeVisible();
    await po.screenshot('tap-control-tooltip');

    await po.controlHint('inn').tap();
    await expect(po.tooltip()).toHaveCount(0);

    await po.controlHint('inn').tap();
    await expect(po.tooltip()).toBeVisible();
    await page.locator('h2').first().tap();
    await expect(po.tooltip()).toHaveCount(0);
  });
});

test.describe('клик по иконке не трогает контрол', () => {
  test('Checkbox не переключается', async () => {
    const checkbox = po.control('agree');
    await expect(checkbox).toHaveAttribute('aria-checked', 'false');
    await po.controlHint('agree').click();
    await expect(po.tooltip()).toContainText('Оферта действует с момента оплаты');
    await expect(checkbox).toHaveAttribute('aria-checked', 'false');
  });

  test('Switch с labelTooltip не переключается', async () => {
    await po.labelHint('notify').click();
    await expect(po.tooltip()).toBeVisible();
    await expect(po.control('notify')).toHaveAttribute('aria-checked', 'false');
  });

  test('Select не открывает список и не теряет значение', async ({ page }) => {
    await po.controlHint('city').click();
    await expect(po.tooltip()).toContainText('Город регистрации компании');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(po.control('city')).toContainText('Москва');
  });

  test('вариант RadioGroup не выбирается', async () => {
    await po.optionHint('plan', 'basic').click();
    await expect(po.tooltip()).toContainText('До 3 пользователей, без SLA');
    await expect(po.control('plan').getByRole('radio', { checked: true })).toHaveCount(0);
    // У варианта без подсказки иконки нет.
    await expect(po.optionHint('plan', 'custom')).toHaveCount(0);
  });

  test('Input не получает фокус и значение', async () => {
    await po.controlHint('inn').click();
    await expect(po.control('inn')).not.toBeFocused();
    await expect(po.control('inn')).toHaveValue('');
  });
});

test.describe('порядок в правой зоне: крестик → (i) → родные элементы', () => {
  for (const testId of ['city', 'framework', 'r-country']) {
    test(`${testId}: крестик левее иконки, иконка левее шеврона`, async () => {
      const clear = await po.right(po.clearButton(testId));
      const hintLeft = await po.left(po.controlHint(testId));
      const hintRight = await po.right(po.controlHint(testId));
      const chevron = await po.left(po.chevron(testId));
      expect(clear).toBeLessThanOrEqual(hintLeft);
      expect(hintRight).toBeLessThanOrEqual(chevron);
    });
  }

  test('при очистке значения иконка не сдвигается (кластер прижат вправо)', async () => {
    const before = await po.left(po.controlHint('city'));
    await po.clearButton('city').click();
    await expect(po.clearButton('city')).toHaveCount(0);
    expect(await po.left(po.controlHint('city'))).toBe(before);
  });

  test('InputPassword: иконка левее глаза; без глаза — у правого края', async () => {
    const eye = po.field('password').locator('[data-slot="input-password-toggle"]');
    expect(await po.right(po.controlHint('password'))).toBeLessThanOrEqual(await po.left(eye));

    const withEye = await po.left(po.controlHint('password'));
    await po.control('password').fill('');
    await expect(eye).toHaveCount(0);
    expect(await po.left(po.controlHint('password'))).toBeGreaterThan(withEye);
  });

  test('длинное значение не заезжает под кластер иконок', async ({ page }) => {
    await po.control('city').click();
    await page.getByRole('option', { name: /Очень длинное/ }).click();
    const value = po.control('city').locator('[data-slot="select-value"]');
    await po.movePointerAway();
    expect(await po.right(value)).toBeLessThanOrEqual(await po.left(po.clearButton('city')));
    await po.screenshot('long-value-select');
  });

  test('внутри поля: иконка Input лежит в границах контрола', async () => {
    const hint = po.controlHint('inn');
    expect(await po.left(hint)).toBeGreaterThan(await po.left(po.control('inn')));
    expect(await po.right(hint)).toBeLessThan(await po.right(po.control('inn')));
  });

  test('снаружи: у Slider иконка правее контрола', async () => {
    expect(await po.left(po.controlHint('volume'))).toBeGreaterThanOrEqual(
      await po.right(po.control('volume'))
    );
  });
});

test.describe('renderer-react', () => {
  test('оба пропа работают под FormRenderer с fieldWrapper: FormField', async () => {
    await po.labelHint('r-phone').hover();
    await expect(po.tooltip()).toContainText('Для связи курьера');
    await po.controlHint('r-phone').hover();
    await expect(po.tooltip()).toContainText('В международном формате');
  });
});

test.describe('доступность', () => {
  test('aria-describedby контрола ведёт на существующий текст подсказки', async ({ page }) => {
    for (const testId of ['email', 'inn', 'city']) {
      const ids = (await po.control(testId).getAttribute('aria-describedby'))?.split(' ') ?? [];
      expect(ids.length, `${testId}: aria-describedby пуст`).toBeGreaterThan(0);
      for (const id of ids) {
        await expect(page.locator(`[id="${id}"]`), `${testId}: висячий id ${id}`).toHaveCount(1);
      }
    }
    // Email: подсказка у подписи + description под полем — оба в описании, подсказка первой.
    const emailIds = (await po.control('email').getAttribute('aria-describedby'))!.split(' ');
    expect(emailIds).toHaveLength(2);
    await expect(page.locator(`[id="${emailIds[0]}"]`)).toHaveText(
      'Нужен только для отправки чеков'
    );
  });

  test('ARIA валидна с закрытым и с открытым тултипом', async ({ page }) => {
    expect((await checkAriaValidity(page)).issues).toEqual([]);
    await po.controlHint('city').hover();
    await expect(po.tooltip()).toBeVisible();
    expect((await checkAriaValidity(page)).issues).toEqual([]);
  });

  test('у выключенного поля иконка остаётся рабочей', async ({ page }) => {
    await page.getByTestId('disable-all').click();
    await expect(po.control('inn')).toBeDisabled();
    await expect(po.controlHint('inn')).toBeEnabled();
    await po.controlHint('inn').hover();
    await expect(po.tooltip()).toContainText('10 цифр для юрлица, 12 — для ИП');
    await po.screenshot('disabled-fields');
  });

  test('у выключенного поля свои кнопки гаснут: крестик скрыт, глаз не реагирует', async ({
    page,
  }) => {
    const eye = po.field('password').locator('[data-slot="input-password-toggle"]');
    await expect(eye).toBeEnabled();
    await expect(po.clearButton('city')).toBeVisible();

    await page.getByTestId('disable-all').click();

    // Крестик очистки у выключенного поля не рисуется вовсе.
    await expect(po.clearButton('city')).toHaveCount(0);
    await expect(po.clearButton('framework')).toHaveCount(0);

    // Глаз: заблокирован и не ловит указатель — ни клика, ни :hover.
    await expect(eye).toBeDisabled();
    expect(await eye.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    await expect(po.control('password')).toHaveAttribute('type', 'password');

    // RadioGroup: заблокированы сами radio, и подпись варианта гаснет вместе с ними.
    const radio = po.page.locator('[data-testid="input-plan-basic"]');
    await expect(radio).toBeDisabled();
    const optionLabel = po.field('plan').locator('label', { hasText: 'Базовый' });
    expect(Number(await optionLabel.evaluate((el) => getComputedStyle(el).opacity))).toBeLessThan(
      1
    );

    // Верхняя подпись поля гаснет (FormField ставит data-disabled на Field), а иконка рядом с
    // ней остаётся яркой и рабочей — в обоих путях: CDK и renderer-react.
    for (const testId of ['email', 'plan', 'r-phone']) {
      const topLabel = page.locator(`[data-testid="label-${testId}"]`);
      expect(
        Number(await topLabel.evaluate((el) => getComputedStyle(el).opacity)),
        `подпись ${testId}`
      ).toBeLessThan(1);
      expect(
        Number(await po.labelHint(testId).evaluate((el) => getComputedStyle(el).opacity)),
        `иконка у подписи ${testId}`
      ).toBe(1);
    }

    // Кнопка демо выключает и форму карточки renderer-react.
    await expect(po.control('r-phone')).toBeDisabled();
    await expect(po.control('r-country')).toBeDisabled();

    // А подсказка остаётся рабочей: по значению в заблокированном поле нужно пояснение.
    await po.controlHint('city').hover();
    await expect(po.tooltip()).toContainText('Город регистрации компании');
  });
});

test('общий вид страницы', async () => {
  await po.screenshot('overview');
});
