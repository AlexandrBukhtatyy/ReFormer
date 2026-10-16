import { test, expect } from '@playwright/test';
import { DatePickerPage, dayOf, dotted } from './date-picker-page.pom';

/**
 * E2E выбора дат. Юниты кита идут через `renderToStaticMarkup`, а календарь живёт в Portal
 * поповера и в SSR отсутствует — клики, черновик периода, потолок `maxItems` и контракт значения
 * до самой модели проверяются только тут.
 *
 * Контракт: период — кортеж `[from, to]`: nullable-поле хранит сброс как `null`, поле-кортеж
 * (начальное `[from, to]`) — как `[]`. Несколько дат — массив по возрастанию, пустой выбор `[]`
 * у поля-массива и `null` у nullable-поля.
 */
test.describe('Выбор дат', () => {
  let po: DatePickerPage;

  test.beforeEach(async ({ page }) => {
    po = new DatePickerPage(page);
    await po.goto();
  });

  test('стартовое состояние: период с префиллом — поле, остальное пусто', async () => {
    const model = await po.modelSnapshot();
    expect(model.birthDate).toBeNull();
    expect(model.vacation).toBeNull();
    // Кортеж в начальном значении — массив модели, а привязка компонента делает его полем.
    expect(model.stay).toEqual([dayOf(0, 10), dayOf(0, 14)]);
    expect(model.meetings).toEqual([]);
    expect(model.holidays).toBeNull();
    await expect(po.trigger('stay')).toHaveText(
      `${dotted(dayOf(0, 10))} – ${dotted(dayOf(0, 14))}`
    );
    await po.expectNoRuntimeErrors();
  });

  test('DatePickerRange: первый клик — черновик, второй — период и закрытие', async () => {
    const from = dayOf(0, 20);
    const to = dayOf(1, 5);

    await po.open('vacation');
    await po.pickDay(from);
    // Выбрано только начало: календарь открыт, значение поля прежнее.
    await expect(po.popover).toBeVisible();
    await expect(po.trigger('vacation')).toHaveAttribute('data-empty', 'true');

    await po.pickDay(to);
    await expect(po.popover).toBeHidden();
    await expect(po.trigger('vacation')).toHaveText(`${dotted(from)} – ${dotted(to)}`);
    await po.expectValue('vacation', [from, to]);
  });

  test('DatePickerRange: конец раньше начала — даты встают по порядку', async () => {
    await po.open('vacation');
    await po.pickDay(dayOf(0, 18));
    await po.pickDay(dayOf(0, 12));
    await po.expectValue('vacation', [dayOf(0, 12), dayOf(0, 18)]);
  });

  test('DatePickerRange: закрытие на черновике значение не трогает', async () => {
    await po.open('stay');
    await po.pickDay(dayOf(0, 3));
    await po.close();
    await po.expectValue('stay', [dayOf(0, 10), dayOf(0, 14)]);
  });

  test('сброс периода: nullable-поле → null, поле-кортеж → [], reset() возвращает префилл', async () => {
    await po.open('vacation');
    await po.pickDay(dayOf(0, 5));
    await po.pickDay(dayOf(0, 7));
    await po.clearButton('vacation').click();
    await po.clearButton('stay').click();

    const model = await po.modelSnapshot();
    expect(model.vacation).toBeNull();
    expect(model.stay).toEqual([]);
    await expect(po.trigger('stay')).toHaveAttribute('data-empty', 'true');

    await po.reset();
    await po.expectValue('stay', [dayOf(0, 10), dayOf(0, 14)]);
  });

  test('required(): пустой период и пустой список дат — ошибки', async () => {
    await po.validate();
    await expect(po.error('vacation')).toBeVisible();
    await expect(po.error('meetings')).toBeVisible();
  });

  test('DatePickerMulti: календарь не закрывается, даты по возрастанию, повторный клик снимает', async () => {
    await po.open('meetings');
    for (const day of [22, 5, 13]) await po.pickDay(dayOf(0, day));
    await expect(po.popover).toBeVisible();

    await po.pickDay(dayOf(0, 22));
    await po.close();

    await po.expectValue('meetings', [dayOf(0, 5), dayOf(0, 13)]);
    await expect(po.trigger('meetings')).toHaveText(
      `${dotted(dayOf(0, 5)).slice(0, 5)}, ${dotted(dayOf(0, 13)).slice(0, 5)}`
    );
  });

  test('DatePickerMulti: maxItems гасит невыбранные дни и отпускает их после снятия', async () => {
    await po.open('meetings');
    for (const day of [3, 8, 15, 22]) await po.pickDay(dayOf(0, day));

    await expect(po.day(dayOf(0, 25))).toBeDisabled();
    // Выбранные дни остаются кликабельными — их можно снять.
    await expect(po.day(dayOf(0, 8))).toBeEnabled();

    await po.pickDay(dayOf(0, 8));
    await expect(po.day(dayOf(0, 25))).toBeEnabled();
    await po.close();
  });

  test('DatePickerMulti nullable: сводка сверх порога, снятие всех → null', async () => {
    await po.open('holidays');
    for (const day of [1, 2, 3]) await po.pickDay(dayOf(0, day));
    await po.close();
    await expect(po.trigger('holidays')).toHaveText('Выбрано дат: 3');
    await po.expectValue('holidays', [dayOf(0, 1), dayOf(0, 2), dayOf(0, 3)]);

    await po.open('holidays');
    for (const day of [1, 2, 3]) await po.pickDay(dayOf(0, day));
    await po.close();
    await po.expectValue('holidays', null);
    await po.expectNoRuntimeErrors();
  });
});
