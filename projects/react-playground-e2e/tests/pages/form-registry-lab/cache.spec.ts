/**
 * Стенд реестра форм: доказательства работы кэша схем.
 *
 * **Почему не `page.route` и не `page.on('request')`.** Запросы, обслуженные Service Worker'ом MSW,
 * до перехватчиков Playwright не доходят — это уже зафиксировано комментариями в
 * `registration-form-json.spec.ts` и `credit-form-page.pom.ts`. Поэтому сеть считается там же, где
 * в неё ходит загрузчик: обёрткой `fetchImpl`, которую страница отдаёт провайдеру и зеркалит в
 * `window.__labNet`. Это измеряет ровно то утверждение, которое стенд делает, и не зависит ни от
 * Service Worker, ни от HTTP-кэша браузера, ни от версии Playwright.
 *
 * Счётчики `cache.stats()` проверяются рядом как вторая, семантическая опора: они ловят другой
 * класс поломок — «в сеть не пошли, потому что форма вообще не смонтировалась».
 *
 * Хранилище L2 фиксируется IndexedDB: `pickStorage` пробовал бы OPFS первым, а его доступность в
 * headless нестабильна — тест «переживает F5» начал бы флакать.
 */
import { test, expect, type Page } from '@playwright/test';

const PATH = '/examples/registry-lab';

/** Сколько раз загрузчик реально ходил в сеть. */
const netCalls = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __labNet?: unknown[] }).__labNet?.length ?? 0);

const stat = async (page: Page, name: string): Promise<number> =>
  Number(await page.getByTestId(`cache-stat-${name}`).textContent());

/** Дожидается формы в слоте: у всех трёх форм внутри есть поле ввода. */
async function expectFormMounted(page: Page): Promise<void> {
  await expect(page.getByTestId('lab-form-slot').locator('input').first()).toBeVisible({
    timeout: 15_000,
  });
}

async function remount(page: Page): Promise<void> {
  await page.getByTestId('lab-toggle-mount').click();
  await expect(page.getByTestId('lab-form-unmounted')).toBeVisible();
  await page.getByTestId('lab-toggle-mount').click();
  await expectFormMounted(page);
}

test.describe('Стенд реестра форм — кэш схем', { tag: ['@form-registry'] }, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH);
    await page.getByTestId('lab-storage-indexeddb').click();
    await page.getByTestId('lab-source-static').click();
    await expectFormMounted(page);
    // Сбрасываем ПОСЛЕ первого монтирования: сюда входит и холодная загрузка, и то, что могло
    // остаться в L2 от предыдущего теста в этом же контексте.
    await page.getByTestId('btn-cache-reset-stats').click();
    await page.getByTestId('btn-net-reset').click();
  });

  test('REG-001: повторный монтаж не идёт в сеть — попадание в L1', async ({ page }) => {
    expect(await netCalls(page)).toBe(0);

    await remount(page);

    expect(await netCalls(page)).toBe(0); // главное утверждение стенда
    expect(await stat(page, 'l1Hit')).toBeGreaterThan(0);
    expect(await stat(page, 'fetched')).toBe(0);
  });

  test('REG-002: схема переживает перезагрузку страницы — поднимается из L2', async ({ page }) => {
    await page.reload();
    await page.getByTestId('lab-storage-indexeddb').click();
    await page.getByTestId('lab-source-static').click();
    await expectFormMounted(page);

    // После F5 память пуста, но хранилище осталось: значение приходит из L2, минуя сеть.
    expect(await stat(page, 'l2Hit')).toBeGreaterThan(0);
    expect(await stat(page, 'fetched')).toBe(0);
    expect(await netCalls(page)).toBe(0);
  });

  test('REG-003: протухшая запись ревалидируется условным запросом', async ({ page }) => {
    await page.getByTestId('lab-maxage-0').click(); // всё протухло → каждое чтение условное
    await expectFormMounted(page);

    expect(await stat(page, 'stale')).toBeGreaterThan(0);
    expect(await stat(page, 'revalidated')).toBeGreaterThan(0);
    expect(await stat(page, 'error')).toBe(0);
    // Тело повторно не качалось: сервер подтвердил кэш.
    expect(await stat(page, 'refetched')).toBe(0);
  });

  test('REG-004: две копии одной формы делят один запрос', async ({ page }) => {
    await page.getByTestId('lab-maxage-0').click();
    await expectFormMounted(page);
    await page.getByTestId('lab-toggle-mount').click(); // размонтировать обе
    await page.getByTestId('btn-cache-reset-stats').click();
    await page.getByTestId('lab-toggle-twin').click();
    await page.getByTestId('lab-toggle-mount').click(); // смонтировать сразу две
    await expectFormMounted(page);

    const outcomes =
      (await stat(page, 'fetched')) +
      (await stat(page, 'refetched')) +
      (await stat(page, 'revalidated'));
    expect(await stat(page, 'dedup')).toBeGreaterThan(0);
    // ИНВАРИАНТ: в сеть ушли ровно те чтения, что не нашли свежего значения.
    expect(outcomes).toBe((await stat(page, 'stale')) + (await stat(page, 'miss')));
  });

  /**
   * Готовит сценарий отказа.
   *
   * Порядок здесь не декоративный. Срок свежести переключается ДО инъекции по двум причинам:
   * при свежем кэше повторный монтаж вообще не дошёл бы до сети (и инъекция не сработала бы), а
   * само переключение пересоздаёт кэш и перезагружает форму — то есть съело бы заготовленный
   * отказ раньше, чем тест до него добрался.
   */
  async function armFailure(page: Page, status: 500 | 429 | 404): Promise<void> {
    await page.getByTestId('lab-source-msw').click();
    await expectFormMounted(page);
    await page.getByTestId('lab-maxage-0').click();
    await expectFormMounted(page);
    await page.getByTestId('btn-cache-reset-stats').click();
    await page.getByTestId('btn-net-reset').click();
    await page.getByTestId(`msw-fail-${status}`).click();
  }

  test('REG-005: 500 ретраится и форма всё равно собирается', async ({ page }) => {
    await armFailure(page, 500);

    await remount(page);

    // Одна инъекция даёт минимум две попытки: отказ и успешный повтор.
    expect(await netCalls(page)).toBeGreaterThanOrEqual(2);
    expect(await stat(page, 'error')).toBe(0);
    await expect(page.getByTestId('lab-form-error')).toHaveCount(0);
  });

  test('REG-006: 404 не ретраится — показывается ошибка с повтором', async ({ page }) => {
    await armFailure(page, 404);

    await page.getByTestId('lab-toggle-mount').click();
    await expect(page.getByTestId('lab-form-unmounted')).toBeVisible();
    await page.getByTestId('lab-toggle-mount').click();

    await expect(page.getByTestId('lab-form-error')).toBeVisible();
    await expect(page.getByTestId('btn-form-retry')).toBeVisible();
    expect(await stat(page, 'error')).toBeGreaterThan(0);

    // Причина названа, а не спрятана: загрузчик оборачивает 404, «не JSON» и обрыв сети в один
    // и тот же текст, и без разбора цепочки `cause` отказ неотличим от отказа.
    await expect(page.getByTestId('lab-error-kind')).toHaveText('http-error');
    await expect(page.getByTestId('lab-error-status')).toHaveText('HTTP 404');
    await expect(page.getByTestId('lab-error-url')).toHaveText('/mock-forms/registration-form');

    // Повтор проходит: инъекция израсходована, а отказ в кэше не залип.
    await page.getByTestId('btn-form-retry').click();
    await expectFormMounted(page);
  });

  test('REG-007: inline-источник кэш не трогает', async ({ page }) => {
    await page.getByTestId('lab-source-inline').click();
    await expectFormMounted(page);
    await page.getByTestId('btn-cache-reset-stats').click();
    await page.getByTestId('btn-net-reset').click();

    await remount(page);

    // Загрузчик отдаёт значение до кэша — нули здесь норма, а не признак поломки.
    expect(await netCalls(page)).toBe(0);
    expect(await stat(page, 'miss')).toBe(0);
    expect(await stat(page, 'l1Hit')).toBe(0);
  });

  test('REG-008: все три формы монтируются по сети и проходят preflight', async ({ page }) => {
    for (const formId of ['registration-form', 'credit-application', 'alerts-list']) {
      await page.getByTestId(`lab-tab-${formId}`).click();
      await expectFormMounted(page);
      await expect(page.getByTestId('lab-form-error')).toHaveCount(0);
    }
    await expect(page.getByTestId('lab-diagnostics')).toContainText('Чисто');
  });
});
