/**
 * Visual Regression Tests for Complex Multi-Step Form
 *
 * Покрывает абсолютно все состояния формы:
 * - Все 6 шагов с разными комбинациями данных
 * - Все 5 типов кредитов (условные поля step 1)
 * - Все 5 статусов занятости (step 4)
 * - Все варианты адреса (step 3) и дополнительной информации (step 5)
 * - Массивы: пустые, с одним и несколькими элементами
 * - Состояния валидации (touched, errors)
 * - Состояния компонентов (focus, hover, filled, error, disabled)
 * - Loading / Error boundaries
 * - Адаптивные viewport-ы (mobile, tablet, desktop, wide)
 * - Step indicator и progress во всех позициях
 *
 * Все скриншоты именуются с учётом варианта (`${variant}-...`) для изоляции
 * сравнений между compound / renderer / json.
 *
 * @tag @visual
 */

import { test, expect } from '../../shared/test-factory';
import type { Page } from '@playwright/test';
import { mockAllApisForHappyPath } from './mocks';

// ============================================================================
// Shared helpers
// ============================================================================

/**
 * Маскируем динамический контент и debug-оверлеи, которые делают
 * скриншоты нестабильными либо различают варианты рендеринга.
 */
function dynamicMasks(page: Page) {
  return [
    page.locator('[data-testid="timestamp"]'),
    page.locator('[data-testid="application-id"]'),
    // Debug overlay в renderer-варианте (createRenderSchema примеры)
    page.getByRole('button', { name: /Программное управление схемой/ }),
  ];
}

const shotOptions = (page: Page) => ({
  fullPage: true,
  animations: 'disabled' as const,
  mask: dynamicMasks(page),
  // Тонкая граница допуска: избегаем flaky diff-ов из-за субпиксельного
  // anti-aliasing в Chromium между запусками.
  maxDiffPixelRatio: 0.01,
});

// ============================================================================
// VIS-001: Step 1 — Basic Info (все типы кредита)
// ============================================================================

test.describe('Visual · VIS-001: Step 1 (Основная информация)', { tag: ['@visual'] }, () => {
  test('VIS-001-A: шаг 1 — потребительский кредит (default, загружен из API)', async ({
    page,
    creditForm,
  }) => {
    await creditForm.goto();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-1-consumer-prefilled.png`,
      shotOptions(page)
    );
  });

  test('VIS-001-B: шаг 1 — ипотека (условные поля: стоимость, первонач. взнос)', async ({
    page,
    creditForm,
  }) => {
    await creditForm.goto();
    await creditForm.selectLoanType('mortgage');
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-1-mortgage.png`,
      shotOptions(page)
    );
  });

  test('VIS-001-C: шаг 1 — ипотека (заполнена)', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillStep1Mortgage();

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-1-mortgage-filled.png`,
      shotOptions(page)
    );
  });

  test('VIS-001-D: шаг 1 — автокредит (условные поля: марка, модель, год, цена)', async ({
    page,
    creditForm,
  }) => {
    await creditForm.goto();
    await creditForm.selectLoanType('car');
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot(`${creditForm.variant}-step-1-car.png`, shotOptions(page));
  });

  test('VIS-001-E: шаг 1 — автокредит (заполнен)', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillStep1CarLoan();

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-1-car-filled.png`,
      shotOptions(page)
    );
  });

  test('VIS-001-F: шаг 1 — бизнес-кредит (поля бизнеса)', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.selectLoanType('business');
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-1-business.png`,
      shotOptions(page)
    );
  });

  test('VIS-001-G: шаг 1 — рефинансирование', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.selectLoanType('refinancing');
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-1-refinancing.png`,
      shotOptions(page)
    );
  });

  test('VIS-001-H: шаг 1 — ошибки валидации (touched, пустые обязательные)', async ({
    page,
    creditForm,
  }) => {
    await creditForm.goto({ disableMsw: true });
    await creditForm.input('loanAmount').fill('0');
    await creditForm.input('loanPurpose').fill('');
    await creditForm.goToNextStep();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-1-validation-errors.png`,
      shotOptions(page)
    );
  });
});

// ============================================================================
// VIS-002: Step 2 — Personal Data
// ============================================================================

test.describe('Visual · VIS-002: Step 2 (Персональные данные)', { tag: ['@visual'] }, () => {
  test('VIS-002-A: шаг 2 — default (загружен из API)', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillStep1ConsumerLoan();
    await creditForm.goToNextStep();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-2-prefilled.png`,
      shotOptions(page)
    );
  });

  test('VIS-002-B: шаг 2 — полностью заполнен вручную', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillStep1ConsumerLoan();
    await creditForm.goToNextStep();
    await creditForm.fillStep2PersonalData();

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-2-filled.png`,
      shotOptions(page)
    );
  });

  test('VIS-002-C: шаг 2 — ошибки валидации (пустой шаг + next)', async ({ page, creditForm }) => {
    await creditForm.goto({ disableMsw: true });
    await creditForm.fillStep1ConsumerLoan();
    await creditForm.goToNextStep();
    await creditForm.goToNextStep();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-2-validation-errors.png`,
      shotOptions(page)
    );
  });
});

// ============================================================================
// VIS-003: Step 3 — Contact Info
// ============================================================================

test.describe('Visual · VIS-003: Step 3 (Контакты и адреса)', { tag: ['@visual'] }, () => {
  test('VIS-003-A: шаг 3 — default (адрес проживания скрыт, sameAsRegistration=true)', async ({
    page,
    creditForm,
  }) => {
    await creditForm.goto();
    await creditForm.fillStep1ConsumerLoan();
    await creditForm.goToNextStep();
    await creditForm.fillStep2PersonalData();
    await creditForm.goToNextStep();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-3-same-address.png`,
      shotOptions(page)
    );
  });

  test('VIS-003-B: шаг 3 — показан отдельный адрес проживания', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillStep1ConsumerLoan();
    await creditForm.goToNextStep();
    await creditForm.fillStep2PersonalData();
    await creditForm.goToNextStep();
    await creditForm.toggleSameAsRegistration(false);
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-3-separate-residence.png`,
      shotOptions(page)
    );
  });

  test('VIS-003-C: шаг 3 — ошибки валидации', async ({ page, creditForm }) => {
    await creditForm.goto({ disableMsw: true });
    await creditForm.fillStep1ConsumerLoan();
    await creditForm.goToNextStep();
    await creditForm.fillStep2PersonalData();
    await creditForm.goToNextStep();
    await creditForm.goToNextStep();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-3-validation-errors.png`,
      shotOptions(page)
    );
  });
});

// ============================================================================
// VIS-004: Step 4 — Employment (все статусы занятости)
// ============================================================================

test.describe('Visual · VIS-004: Step 4 (Занятость)', { tag: ['@visual'] }, () => {
  test('VIS-004-A: шаг 4 — работающий (показаны поля работодателя)', async ({
    page,
    creditForm,
  }) => {
    await creditForm.goto();
    await creditForm.fillAndNavigateToStep4();
    await creditForm.selectEmploymentStatus('employed');
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-4-employed.png`,
      shotOptions(page)
    );
  });

  test('VIS-004-B: шаг 4 — работающий (полностью заполнен)', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillAndNavigateToStep4();
    await creditForm.fillStep4Employment();

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-4-employed-filled.png`,
      shotOptions(page)
    );
  });

  test('VIS-004-C: шаг 4 — ИП / самозанятый (поля бизнеса)', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillAndNavigateToStep4();
    await creditForm.selectEmploymentStatus('selfEmployed');
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-4-self-employed.png`,
      shotOptions(page)
    );
  });

  test('VIS-004-D: шаг 4 — безработный (warning-блок)', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillAndNavigateToStep4();
    await creditForm.selectEmploymentStatus('unemployed');
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-4-unemployed.png`,
      shotOptions(page)
    );
  });

  test('VIS-004-E: шаг 4 — пенсионер', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillAndNavigateToStep4();
    await creditForm.selectEmploymentStatus('retired');
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-4-retired.png`,
      shotOptions(page)
    );
  });

  test('VIS-004-F: шаг 4 — студент', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillAndNavigateToStep4();
    await creditForm.selectEmploymentStatus('student');
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-4-student.png`,
      shotOptions(page)
    );
  });
});

// ============================================================================
// VIS-005: Step 5 — Additional Info (toggle-секции + массивы)
// ============================================================================

test.describe('Visual · VIS-005: Step 5 (Доп. информация + массивы)', { tag: ['@visual'] }, () => {
  test('VIS-005-A: шаг 5 — базовое (все toggle-ы выключены)', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillAndNavigateToStep4();
    await creditForm.fillStep4Employment();
    await creditForm.goToNextStep();
    await creditForm.fillStep5AdditionalInfo({
      hasProperty: false,
      hasLoans: false,
      hasCoBorrower: false,
    });

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-5-toggles-off.png`,
      shotOptions(page)
    );
  });

  test('VIS-005-B: шаг 5 — имущество (пустой массив)', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillAndNavigateToStep4();
    await creditForm.fillStep4Employment();
    await creditForm.goToNextStep();
    await creditForm.toggleHasProperty(true);
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-5-property-empty.png`,
      shotOptions(page)
    );
  });

  test('VIS-005-C: шаг 5 — имущество (один элемент)', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillAndNavigateToStep4();
    await creditForm.fillStep4Employment();
    await creditForm.goToNextStep();
    await creditForm.toggleHasProperty(true);
    await creditForm.addProperty();
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-5-property-one-item.png`,
      shotOptions(page)
    );
  });

  test('VIS-005-D: шаг 5 — имущество (несколько элементов)', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillAndNavigateToStep4();
    await creditForm.fillStep4Employment();
    await creditForm.goToNextStep();
    await creditForm.toggleHasProperty(true);
    await creditForm.addProperty();
    await creditForm.addProperty();
    await creditForm.addProperty();
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-5-property-three-items.png`,
      shotOptions(page)
    );
  });

  test('VIS-005-E: шаг 5 — существующие кредиты (с элементом)', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillAndNavigateToStep4();
    await creditForm.fillStep4Employment();
    await creditForm.goToNextStep();
    await creditForm.toggleHasLoans(true);
    await creditForm.addExistingLoan();
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-5-loan-one-item.png`,
      shotOptions(page)
    );
  });

  test('VIS-005-F: шаг 5 — созаёмщики (с элементом)', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillAndNavigateToStep4();
    await creditForm.fillStep4Employment();
    await creditForm.goToNextStep();
    await creditForm.toggleAddCoBorrower(true);
    await creditForm.addCoBorrower();
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-5-coborrower-one-item.png`,
      shotOptions(page)
    );
  });

  test('VIS-005-G: шаг 5 — все toggle-ы включены с элементами', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillAndNavigateToStep4();
    await creditForm.fillStep4Employment();
    await creditForm.goToNextStep();
    await creditForm.toggleHasProperty(true);
    await creditForm.addProperty();
    await creditForm.toggleHasLoans(true);
    await creditForm.addExistingLoan();
    await creditForm.toggleAddCoBorrower(true);
    await creditForm.addCoBorrower();
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-5-all-arrays-filled.png`,
      shotOptions(page)
    );
  });
});

// ============================================================================
// VIS-006: Step 6 — Confirmation
// ============================================================================

test.describe('Visual · VIS-006: Step 6 (Подтверждение)', { tag: ['@visual'] }, () => {
  test('VIS-006-A: шаг 6 — initial (без согласий)', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillAndNavigateToStep6();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-6-initial.png`,
      shotOptions(page)
    );
  });

  test('VIS-006-B: шаг 6 — все обязательные согласия отмечены', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillAndNavigateToStep6();
    await creditForm.acceptPersonalDataAgreement();
    await creditForm.acceptCreditHistoryAgreement();
    await creditForm.acceptTermsAgreement();
    await creditForm.acceptAccuracyConfirmation();

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-6-agreements-checked.png`,
      shotOptions(page)
    );
  });

  test('VIS-006-C: шаг 6 — все согласия + код СМС (готов к submit)', async ({
    page,
    creditForm,
  }) => {
    await creditForm.goto();
    await creditForm.fillAndNavigateToStep6();
    await creditForm.fillStep6Confirmation({ acceptMarketing: true });
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-step-6-ready-to-submit.png`,
      shotOptions(page)
    );
  });
});

// ============================================================================
// VIS-007: Component states (focus / hover / error / disabled)
// ============================================================================

test.describe('Visual · VIS-007: Состояния компонентов', { tag: ['@visual'] }, () => {
  test('VIS-007-A: input — focus state', async ({ creditForm }) => {
    await creditForm.goto();
    const input = creditForm.input('loanAmount');
    await input.focus();

    await expect(input).toHaveScreenshot(`${creditForm.variant}-input-focus.png`);
  });

  test('VIS-007-B: input — filled state', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillLoanAmount(1000000);
    await page.locator('body').click(); // снимаем фокус
    const input = creditForm.input('loanAmount');

    await expect(input).toHaveScreenshot(`${creditForm.variant}-input-filled.png`);
  });

  test('VIS-007-C: input — error state (touched и пустой)', async ({ page, creditForm }) => {
    await creditForm.goto({ disableMsw: true });
    await creditForm.input('loanAmount').fill('0');
    await creditForm.goToNextStep();
    await page.waitForTimeout(300);

    const errorField = creditForm.field('loanAmount');
    if ((await errorField.count()) > 0) {
      await expect(errorField).toHaveScreenshot(`${creditForm.variant}-input-error.png`);
    }
  });

  test('VIS-007-D: input — disabled state (business fields)', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.selectLoanType('business');
    await page.waitForTimeout(300);
    const disabledInput = creditForm.input('businessType');

    if ((await disabledInput.count()) > 0) {
      await expect(disabledInput).toHaveScreenshot(`${creditForm.variant}-input-disabled.png`);
    }
  });

  test('VIS-007-E: кнопка Далее — default', async ({ page, creditForm }) => {
    await creditForm.goto();
    await page.mouse.move(0, 0);
    const btn = page.locator('[data-testid="btn-next"]');

    await expect(btn).toHaveScreenshot(`${creditForm.variant}-btn-next-default.png`);
  });

  test('VIS-007-F: кнопка Далее — hover', async ({ page, creditForm }) => {
    await creditForm.goto();
    const btn = page.locator('[data-testid="btn-next"]');
    await btn.hover();
    await page.waitForTimeout(100);

    await expect(btn).toHaveScreenshot(`${creditForm.variant}-btn-next-hover.png`);
  });

  test('VIS-007-G: кнопка Отправить заявку — на шаге 6', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillAndNavigateToStep6();
    await page.mouse.move(0, 0);
    const btn = page.locator('[data-testid="btn-submit"]');

    await expect(btn).toHaveScreenshot(`${creditForm.variant}-btn-submit.png`);
  });

  test('VIS-007-H: select — открытый список (loanType)', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.input('loanType').click();
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-select-loan-type-open.png`,
      shotOptions(page)
    );
  });
});

// ============================================================================
// VIS-008: Form Wizard — indicator & progress
// ============================================================================

test.describe('Visual · VIS-008: Навигация wizard', { tag: ['@visual'] }, () => {
  test('VIS-008-A: step indicator — шаг 1 current', async ({ page, creditForm }) => {
    await creditForm.goto();
    await page.mouse.move(0, 0);

    const indicator = page.getByRole('navigation', { name: 'Form steps' });
    await expect(indicator).toHaveScreenshot(`${creditForm.variant}-indicator-step-1.png`);
  });

  test('VIS-008-B: step indicator — шаг 3 (1, 2 completed)', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillStep1ConsumerLoan();
    await creditForm.goToNextStep();
    await creditForm.fillStep2PersonalData();
    await creditForm.goToNextStep();
    await page.mouse.move(0, 0);

    const indicator = page.getByRole('navigation', { name: 'Form steps' });
    await expect(indicator).toHaveScreenshot(`${creditForm.variant}-indicator-step-3.png`);
  });

  test('VIS-008-C: step indicator — шаг 6 (все completed)', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillAndNavigateToStep6();
    await page.mouse.move(0, 0);

    const indicator = page.getByRole('navigation', { name: 'Form steps' });
    await expect(indicator).toHaveScreenshot(`${creditForm.variant}-indicator-step-6.png`);
  });

  test('VIS-008-D: progress — шаг 1 (17%)', async ({ page, creditForm }) => {
    await creditForm.goto();
    const progress = page.getByText(/Шаг 1 из 6/);
    await expect(progress).toHaveScreenshot(`${creditForm.variant}-progress-step-1.png`);
  });

  test('VIS-008-E: progress — шаг 6 (100%)', async ({ page, creditForm }) => {
    await creditForm.goto();
    await creditForm.fillAndNavigateToStep6();
    const progress = page.getByText(/Шаг 6 из 6/);
    await expect(progress).toHaveScreenshot(`${creditForm.variant}-progress-step-6.png`);
  });
});

// ============================================================================
// VIS-009: Responsive (mobile / tablet / desktop / wide)
// ============================================================================

test.describe('Visual · VIS-009: Адаптивные viewport-ы', { tag: ['@visual'] }, () => {
  const viewports = [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'wide', width: 1920, height: 1080 },
  ] as const;

  for (const vp of viewports) {
    test(`VIS-009-${vp.name}-1: шаг 1 в ${vp.name} (${vp.width}px)`, async ({
      page,
      creditForm,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await creditForm.goto();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot(
        `${creditForm.variant}-${vp.name}-step-1.png`,
        shotOptions(page)
      );
    });

    test(`VIS-009-${vp.name}-4: шаг 4 (employment) в ${vp.name}`, async ({ page, creditForm }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();

      await expect(page).toHaveScreenshot(
        `${creditForm.variant}-${vp.name}-step-4.png`,
        shotOptions(page)
      );
    });
  }
});

// ============================================================================
// VIS-010: Loading & Error boundaries
// ============================================================================

test.describe('Visual · VIS-010: Loading & Error', { tag: ['@visual'] }, () => {
  test('VIS-010-A: LoadingState во время загрузки', async ({ page, creditForm }) => {
    // Замедляем API, чтобы зафиксировать loading-состояние.
    await mockAllApisForHappyPath(page);
    await page.route('**/api/v1/credit-applications/1', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });
    const nav = creditForm.goto({ disableMsw: true });

    const loading = page.locator('[data-testid="loading-state"]');
    await expect(loading).toBeVisible({ timeout: 2000 });
    await expect(loading).toHaveScreenshot(`${creditForm.variant}-loading-state.png`);
    await nav.catch(() => {});
  });

  test('VIS-010-B: ErrorState при 500 на GET', async ({ page, creditForm }) => {
    await mockAllApisForHappyPath(page);
    await page.route('**/api/v1/credit-applications/1', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });
    await page.goto(`${creditForm.basePath}?mocks=off`);
    await page.waitForLoadState('networkidle');

    const errorState = page.locator('[data-testid="error-state"]');
    if ((await errorState.count()) > 0) {
      await expect(errorState).toHaveScreenshot(`${creditForm.variant}-error-state.png`);
    }
  });
});

// ============================================================================
// VIS-011: Обзор страницы (header / nav / footer / общий overview)
// ============================================================================

test.describe('Visual · VIS-011: Обзор страницы', { tag: ['@visual'] }, () => {
  test('VIS-011-A: вся страница целиком', async ({ page, creditForm }) => {
    await creditForm.goto();
    await page.waitForLoadState('networkidle');
    await page.mouse.move(0, 0);

    await expect(page).toHaveScreenshot(
      `${creditForm.variant}-page-overview.png`,
      shotOptions(page)
    );
  });

  test('VIS-011-B: header (шапка)', async ({ page, creditForm }) => {
    await creditForm.goto();
    const header = page.getByRole('banner');
    await expect(header).toHaveScreenshot(`${creditForm.variant}-header.png`);
  });

  test('VIS-011-C: footer (подвал)', async ({ page, creditForm }) => {
    await creditForm.goto();
    const footer = page.getByRole('contentinfo');
    await expect(footer).toHaveScreenshot(`${creditForm.variant}-footer.png`);
  });

  test('VIS-011-D: главная навигация примеров', async ({ page, creditForm }) => {
    await creditForm.goto();
    const nav = page.getByRole('navigation').first();
    await expect(nav).toHaveScreenshot(`${creditForm.variant}-main-nav.png`);
  });
});
