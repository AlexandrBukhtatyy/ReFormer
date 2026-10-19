import type { Locator, Page } from '@playwright/test';
import type { BuilderApp } from './shared/builder-app.pom';
import { test, expect } from './shared/fixtures';

/**
 * Кит из плагина проекта: пакет `kit-hexa-ui` в `.ui_builder/plugins` playground.
 *
 * Его сборка весит около 5 МБ, поэтому в обычную копию проекта каталог кита не входит —
 * эти тесты просят его явно.
 */
const KIT_PLUGIN = 'kit-hexa-ui';

/**
 * Шум HexaUI в консоли: кит объявляет React до 18-го, а билдер работает на 19-м, и antd
 * со styled-components внутри кита пишут предупреждения (README кита, «Ограничения»). Форма при
 * этом рисуется. Сюда попадает только известное — всё прочее по-прежнему проваливает тест.
 */
const KNOWN_KIT_NOISE = [
  /React does not recognize the `%s` prop on a DOM element/,
  /`onSearch` should work with `showSearch`/,
  /Accessing element\.ref was removed in React 19/,
  // `Text` HexaUI кладёт styled-проп `$color` прямо на DOM-узел (`createElement(htmlTag, {
  // $color })`), и React отвергает имя атрибута. Им подписаны шаги `Wizard`, поэтому шум приходит
  // с визардом кита. Это не React 19: дефект самого HexaUI, рисованию он не мешает.
  /Invalid attribute name: `%s` \$color/,
];

/** Форма для полей из палитры — своя, пустая (см. тест палитры). */
const FIELDS_FORM = 'forms/kit-fields/form.schema.json';

/** Пустая форма ReFormer: документ конструктора с корнем-контейнером без детей. */
const EMPTY_FORM = JSON.stringify(
  {
    format: 2,
    version: '1.0',
    root: {
      $nodeId: 'kitroot',
      component: '$html(div)',
      componentProps: { className: 'space-y-4' },
      children: [],
    },
  },
  null,
  2
);

/**
 * Выбирает кит HexaUI в ячейке строки состояния.
 *
 * Ячейка «кит» — вклад плагина китов. Пока кит один, она подпись; кнопкой она становится, когда
 * плагин внёс второй, — а плагины проекта поднимаются после открытия, поэтому список
 * переоткрывается. Кит меняется на лету, без перезагрузки.
 */
async function selectHexaKit(builder: BuilderApp, page: Page): Promise<void> {
  const cell = builder.statusBar.getByRole('button', { name: 'ReFormer UI Kit' });
  const hexa = page.getByRole('menuitemradio', { name: /Kaspersky HexaUI/ });
  await expect(async () => {
    await cell.click();
    try {
      await expect(hexa).toBeVisible({ timeout: 1_000 });
    } catch (error) {
      await page.keyboard.press('Escape');
      throw error;
    }
  }).toPass();

  await hexa.click();
  await expect(builder.statusBar.getByRole('button', { name: 'Kaspersky HexaUI' })).toBeVisible();
}

/** Вид «Форма» открытого документа схемы — живая отрисовка активным китом. */
async function showForm(page: Page): Promise<void> {
  await page
    .getByRole('main', { name: 'Редактор' })
    .getByRole('button', { name: 'Форма', exact: true })
    .click();
}

/**
 * Рамка кита вокруг формы. Она несёт идентификатор плагина — под ним оболочка изолирует его
 * стили. Контрол внутри неё значит, что форму нарисовал именно кит плагина, а не встроенный.
 */
function kitFrame(page: Page): Locator {
  return page.locator('[data-rb-plugin="kit-hexa-ui"]');
}

/** Левая колонка панелей: «Проект», «Компоненты», «Шаблоны форм». */
function leftPanel(page: Page, name: string): Locator {
  return page.getByRole('navigation', { name: 'Панели слева' }).getByRole('button', { name });
}

test.describe('Кит HexaUI — плагин проекта', () => {
  // Копия проекта тяжелее обычной на сборку плагина, и пространство имён кита грузится лениво.
  test.describe.configure({ timeout: 90_000 });

  // Известный шум кита отсеивается после каждого теста — до проверки консоли фикстурой.
  test.afterEach(({ pageErrors }) => {
    const unexpected = pageErrors.filter(
      (message) => !KNOWN_KIT_NOISE.some((pattern) => pattern.test(message))
    );
    pageErrors.splice(0, pageErrors.length, ...unexpected);
  });

  test('кит появляется в списке китов и рисует форму', async ({ builder, page }) => {
    await builder.openPlayground({ plugins: [KIT_PLUGIN] });
    await selectHexaKit(builder, page);

    await builder.openFile('forms/contact/form.schema.json');
    await showForm(page);

    const frame = kitFrame(page);
    await expect(frame.getByRole('textbox', { name: 'Как к вам обращаться' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      frame.getByRole('checkbox', { name: 'Согласен на обработку данных' })
    ).toBeVisible();
  });

  test('поле из палитры HexaUI живое в превью: календарь открывается внутри рамки кита', async ({
    builder,
    disk,
    page,
  }) => {
    // Форма своя и пустая: поле из палитры привязывается к `newField`, а в форме контакта этот
    // путь уже заняли поля других видов — значение у них общее.
    await builder.goto();
    await disk.seed({ plugins: [KIT_PLUGIN] });
    await disk.writeText(FIELDS_FORM, EMPTY_FORM);
    await builder.openFolder();
    await selectHexaKit(builder, page);
    await builder.openFile(FIELDS_FORM);

    // Палитра — из каталога HexaUI: поля под именами ui-kit (`DatePicker`) и те, которых
    // у ui-kit нет вовсе (`CheckboxGroup`, `WeeklySchedule`).
    await leftPanel(page, 'Компоненты').click();
    const paletteItem = (name: string): Locator =>
      page.getByRole('button', { name: `Добавить ${name}`, exact: true });
    for (const name of ['DatePicker', 'CheckboxGroup', 'WeeklySchedule']) {
      await expect(paletteItem(name)).toBeVisible();
    }

    await paletteItem('DatePicker').click();
    await expect(
      page
        .getByRole('tree', { name: 'Дерево схемы формы' })
        .getByRole('treeitem', { name: /^DatePicker newField/ })
    ).toBeVisible();

    await showForm(page);
    // Контрол поля — по `data-testid` обёртки поля кита: `input-<путь в модели>`. Календарь
    // HexaUI грузится лениво, а до него на месте поля — пустой ввод без этого идентификатора.
    const frame = kitFrame(page);
    const date = frame.getByTestId('input-newField');
    await expect(date).toBeVisible({ timeout: 30_000 });

    // Окно календаря — в контейнере всплывающих окон кита, внутри рамки, а не в `document.body`:
    // там на него не действовали бы изолированные стили кита.
    await date.click();
    const calendar = frame.locator('[data-hexa-popup-root]').getByRole('table');
    await expect(calendar).toBeVisible();

    // Пятнадцатое число в сетке месяца одно: соседние месяцы дают только начало и конец.
    await calendar.getByRole('cell', { name: '15', exact: true }).click();
    await expect(calendar).toBeHidden();
    await expect(date).toHaveValue(/15/);
  });

  test('пошаговая форма из шаблона: визард HexaUI не пускает дальше шага с пустым обязательным полем', async ({
    builder,
    page,
  }) => {
    await builder.openPlayground({ plugins: [KIT_PLUGIN] });
    await selectHexaKit(builder, page);

    // Встроенные шаблоны печатаются под активный кит; «Пошаговая форма» есть у кита с визардом
    // (`kit.adapters.wizard`). Созданная форма открывается сама — её схемой.
    await leftPanel(page, 'Шаблоны форм').click();
    await page.getByRole('button', { name: 'Пошаговая форма', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Создать форму по шаблону' });
    await dialog.getByLabel('Имя формы').fill('wizard-e2e');
    await dialog.getByRole('button', { name: 'Создать форму' }).click();
    await expect(builder.tab('form.schema.json')).toHaveAttribute('aria-selected', 'true');

    await showForm(page);
    const frame = kitFrame(page);
    const lastName = frame.getByTestId('input-lastName');
    const email = frame.getByTestId('input-email');
    await expect(lastName).toBeVisible({ timeout: 30_000 });

    // Шаги визарда HexaUI — шаги схемы в порядке потока формы.
    for (const step of ['Данные', 'Контакты', 'Дополнительно']) {
      await expect(frame.getByText(step, { exact: true })).toBeVisible();
    }
    // Подписи кнопок шаблон не задаёт — это словарь HexaUI, а провайдер кита локали не получает.
    const next = frame.getByRole('button', { name: 'Next', exact: true });

    // Превью заполняет форму фикстурой шаблона: обязательное поле очищается здесь.
    await lastName.fill('');
    await next.click();
    await expect(frame.getByTestId('field-lastName')).toContainText('Обязательное поле');
    await expect(lastName).toBeVisible();
    await expect(email).toBeHidden();

    await lastName.fill('Петров');
    await next.click();
    await expect(email).toBeVisible();
    await expect(lastName).toBeHidden();
  });
});
