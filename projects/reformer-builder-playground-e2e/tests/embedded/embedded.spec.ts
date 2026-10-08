import path from 'path';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './shared/fixtures';

/**
 * Билдер, встроенный в приложение (`<ReformerBuilder>` в `projects/reformer-builder-host-example`).
 *
 * Отличие от остальных тестов — в том, ЧТО рисует форму. Здесь билдер открыт поверх страницы
 * чужого приложения и об его устройстве не знает: в превью стоит рамка с самим приложением.
 * Поэтому проверяется связка целиком — билдер пишет файл, dev-сервер приложения его видит,
 * приложение в рамке показывает новое, — а не отрисовка формы билдером.
 */

/** Скриншоты — рядом с остальными снимками билдера (в git не едут). */
const SHOTS = path.resolve(__dirname, '../../../react-playground-e2e/screenshots/builder-embedded');

const SCHEMA = 'src/forms/contact/form.schema.json';
const FORM_MODULE = 'src/forms/contact/index.tsx';
const SERVICE = 'src/services/cities.ts';
const ENTRY = 'src/main.tsx';

/** Города из `server/cities.json` приложения — то, что отдаёт его `GET /api/cities`. */
const CITIES = ['Москва', 'Санкт-Петербург', 'Казань', 'Новосибирск'];

/** Регионы тех же городов: ими сервис подписывает опции после правки в тесте. */
const REGIONS = ['Центр', 'Северо-Запад', 'Поволжье', 'Сибирь'];

const MONACO_SCOPE = '[data-rb-plugin="reformer.editor-monaco"]';

/**
 * Набор в редакторе кода — с паузой между знаками, как печатает человек. Без неё текст
 * приходит быстрее, чем редактор сверяется с рабочей копией, и знаки ложатся не туда.
 */
const TYPING = { delay: 50 };

declare global {
  interface Window {
    /** Метка «страница не перезагружалась»: ставит тест, перезагрузка её стирает. */
    __e2eAlive?: boolean;
  }
}

/** Видимый редактор кода: у неактивной вкладки тело может оставаться в документе скрытым. */
const editorOf = (page: Page): Locator =>
  page.locator(`${MONACO_SCOPE} .monaco-editor`).filter({ visible: true }).first();

/** Как выглядит документ приложения — то, что билдер обязан вернуть, закрывшись. */
const pageLook = (page: Page) =>
  page.evaluate(() => {
    const body = getComputedStyle(document.body);
    return {
      title: document.title,
      rootClass: document.documentElement.className,
      builderStyles: document.querySelectorAll('style[data-reformer-builder-styles]').length,
      background: body.backgroundColor,
      color: body.color,
      font: body.fontFamily,
    };
  });

test.describe('Билдер внутри приложения', () => {
  test('кнопка открывает билдер поверх страницы: тот же интерфейс, проект открывается', async ({
    host,
    page,
  }) => {
    await host.goto('/contact');
    await expect(page.getByRole('heading', { name: 'Обратная связь' })).toBeVisible();
    const title = await page.title();

    await host.openBuilder();

    // Приложение под оверлеем скрыто; на экране — оболочка билдера, как в своей вкладке.
    await expect(host.appHeader).toBeHidden();
    await expect(host.builder.openFolderButton).toBeVisible();
    await expect(page.getByRole('menubar')).toBeVisible();
    // Вкладка принадлежит приложению: её заголовок билдер не трогает.
    expect(await page.title()).toBe(title);

    // Обслуживания хранилища у встроенного билдера нет — оно общее с приложением.
    await page.getByRole('menuitem', { name: 'Файл' }).click();
    await expect(page.getByRole('menuitem', { name: 'Открыть папку…' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Очистить кэш' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await host.openProject();
    await host.builder.openFile(SCHEMA);
    const schemaTree = page.getByRole('tree', { name: 'Дерево схемы формы' });
    for (const field of ['Имя', 'Email', 'Город', 'Согласен на обработку данных']) {
      await expect(schemaTree.getByRole('treeitem', { name: field })).toBeVisible();
    }
    await page.screenshot({ path: path.join(SHOTS, '01-builder-over-application.png') });
  });

  test('превью «Форма»: одна форма, как её рисует приложение, со словарём из его API', async ({
    host,
    page,
  }) => {
    await host.openBuilderWithProject('/contact');
    await host.builder.openFile(SCHEMA);
    await host.openPreview();

    const form = host.preview;
    await expect(form.getByRole('heading', { name: 'Обратная связь' })).toBeVisible();
    // Только форма: ни шапки приложения, ни кнопки билдера внутри его же превью.
    await expect(form.getByRole('navigation', { name: 'Разделы приложения' })).toHaveCount(0);
    await expect(form.locator('[data-reformer-builder="toggle"]')).toHaveCount(0);
    // Панель называет, чей это модуль.
    await expect(host.previewPanel).toContainText(FORM_MODULE);

    // Стили у формы — приложения: колонка формы ограничена его утилитой ширины.
    const column = form.locator('[data-reformer-builder-stand="form"] > div');
    expect(await column.evaluate((element) => getComputedStyle(element).maxWidth)).toBe('768px');

    // Словарь пришёл из API приложения: в схеме у поля опций нет.
    await form.getByRole('combobox', { name: 'Город' }).click();
    await expect(form.getByRole('option')).toHaveText(CITIES);
    await page.screenshot({ path: path.join(SHOTS, '02-preview-form.png') });
  });

  test('превью «Приложение»: страница целиком, адресная строка, отдельная вкладка', async ({
    host,
    page,
    context,
    baseURL,
  }) => {
    await host.openBuilderWithProject('/contact');
    await host.openPreview();
    // Файл не открыт — показывать в режиме «Форма» нечего, и панель говорит, что сделать.
    await expect(host.previewPanel.getByRole('status')).toContainText('Откройте файл формы');

    await host.previewMode('Приложение').click();

    // Страница, с которой включили билдер, — целиком и без кнопки билдера.
    const app = host.preview;
    await expect(app.getByRole('navigation', { name: 'Разделы приложения' })).toBeVisible();
    await expect(app.getByRole('heading', { name: 'Обратная связь' })).toBeVisible();
    await expect(app.locator('[data-reformer-builder="toggle"]')).toHaveCount(0);
    await expect(host.previewAddress).toHaveValue(`${baseURL}/contact`);
    await page.screenshot({ path: path.join(SHOTS, '03-preview-application.png') });

    // По адресной строке ходят по приложению.
    await host.previewAddress.fill('/');
    await host.previewAddress.press('Enter');
    await expect(app.getByRole('heading', { name: 'Сервис доставки' })).toBeVisible();
    await expect(host.previewAddress).toHaveValue(`${baseURL}/`);

    // Отдельная вкладка — то же приложение, но уже без билдера: режим в неё не переходит.
    const opened = context.waitForEvent('page');
    await host.previewPanel
      .getByRole('button', { name: 'Открыть приложение в отдельной вкладке' })
      .click();
    const tab = await opened;
    await expect(tab.getByRole('heading', { name: 'Сервис доставки' })).toBeVisible();
    await expect(tab.locator('[data-reformer-builder="toggle"]')).toHaveText('Билдер');
    expect(new URL(tab.url()).pathname).toBe('/');
  });

  test('форма, отправленная в превью, показывает уведомление приложения', async ({ host }) => {
    await host.openBuilderWithProject('/contact');
    await host.builder.openFile(SCHEMA);
    await host.openPreview();

    const form = host.preview;
    await form.getByRole('textbox', { name: 'Имя' }).fill('Анна');
    await form.getByRole('textbox', { name: 'Email' }).fill('anna@example.com');
    await form.getByRole('button', { name: 'Отправить' }).click();

    // Обращение ушло в API приложения, и сказало об этом приложение — своим уведомлением.
    await expect(form.locator('[data-app-toast]')).toHaveText(/Обращение REQ-\d+ принято/);
    // Билдер тут ни при чём: в его документе нет ни уведомления приложения, ни своего.
    await expect(host.appToasts).toHaveCount(0);
    expect(await host.builder.shownNotifications()).toEqual([]);
  });

  test('правка формы: после сохранения приложение в превью рисует новую форму', async ({
    host,
    disk,
    page,
  }) => {
    await host.openBuilderWithProject('/contact');
    await host.builder.openFile(SCHEMA);
    await page.evaluate(() => {
      window.__e2eAlive = true;
    });

    await page
      .getByRole('tree', { name: 'Дерево схемы формы' })
      .getByRole('treeitem', { name: 'Имя' })
      .click();
    await host.rightPanelTab('Свойства').click();
    await page
      .getByRole('complementary', { name: 'Правая панель' })
      .getByRole('textbox', { name: 'Label', exact: true })
      .fill('Как к вам обращаться');
    await expect(host.builder.statusBar).toContainText('1 несохранённый файл');

    // До сохранения правка живёт в рабочей копии билдера: приложение рисует прежнее.
    await host.openPreview();
    const form = host.preview;
    await expect(form.getByRole('textbox', { name: 'Имя' })).toBeVisible();

    await host.builder.save();

    await expect(host.builder.statusBar).toContainText('Всё сохранено');
    // Файл лёг на диск под dev-сервером приложения…
    expect(disk.readServed(SCHEMA)).toContain('Как к вам обращаться');
    // …и рамка обновилась сама: форму заново нарисовало приложение.
    await expect(form.getByRole('textbox', { name: 'Как к вам обращаться' })).toBeVisible();
    await expect(form.getByRole('textbox', { name: 'Имя' })).toHaveCount(0);
    // Страница с билдером при этом не перезагружалась.
    expect(await page.evaluate(() => window.__e2eAlive)).toBe(true);
    await page.screenshot({ path: path.join(SHOTS, '04-form-edited.png') });
  });

  test('правка сервиса в редакторе кода: словарь формы в превью меняется', async ({
    host,
    disk,
    page,
  }) => {
    await host.openBuilderWithProject('/contact');
    await host.builder.openFile(SCHEMA);
    await host.openPreview();
    const form = host.preview;
    await expect(form.getByRole('heading', { name: 'Обратная связь' })).toBeVisible();

    // Сервис лежит не в каталоге формы — форма при этом остаётся на экране.
    await host.builder.openFile(SERVICE);
    await host.openPreview();
    await expect(host.previewPanel).toContainText(FORM_MODULE);
    await expect(form.getByRole('heading', { name: 'Обратная связь' })).toBeVisible();

    // Подпись опции: `label: city.name` → `label: city.region`. Курсор — в конец строки,
    // назад через ` }));` к слову `name`, слово выделяется и заменяется набором.
    const editor = editorOf(page);
    await editor.locator('.view-line', { hasText: 'label: city.name' }).click();
    await page.keyboard.press('End');
    for (let step = 0; step < 5; step++) await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ControlOrMeta+Shift+ArrowLeft');
    await page.keyboard.type('region', TYPING);
    await expect(host.builder.statusBar).toContainText('1 несохранённый файл');
    await host.builder.save();

    await expect(host.builder.statusBar).toContainText('Всё сохранено');
    expect(disk.readServed(SERVICE)).toContain('label: city.region }));');
    // Словарь по-прежнему из API приложения, а подписи — уже по новому коду сервиса.
    await expect(async () => {
      await form.getByRole('combobox', { name: 'Город' }).click({ timeout: 2_000 });
      await expect(form.getByRole('option').first()).toHaveText(REGIONS[0], { timeout: 2_000 });
    }).toPass();
    await expect(form.getByRole('option')).toHaveText(REGIONS);
    await page.screenshot({ path: path.join(SHOTS, '05-service-edited.png') });
  });

  test('файл поправили в IDE, пока он правился в билдере: сохранение спрашивает и объединяет', async ({
    host,
    disk,
    page,
  }) => {
    await host.openBuilderWithProject('/contact');
    await host.builder.openFile(SERVICE);

    // Правка в билдере — подпись опции, как в тесте выше.
    const editor = editorOf(page);
    await editor.locator('.view-line', { hasText: 'label: city.name' }).click();
    await page.keyboard.press('End');
    for (let step = 0; step < 5; step++) await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ControlOrMeta+Shift+ArrowLeft');
    await page.keyboard.type('region', TYPING);
    await expect(host.builder.statusBar).toContainText('1 несохранённый файл');

    // Правка «в IDE» — другая строка того же файла, записанная мимо билдера. Файл под
    // dev-сервером приложения меняется вместе с ней: проект у них один.
    const original = await disk.readText(SERVICE);
    await disk.writeText(SERVICE, original.replace('@module services/cities', '@module ide-edit'));
    expect(disk.readServed(SERVICE)).toContain('@module ide-edit');

    await host.builder.save();

    // Билдер не затирает чужую правку молча и не упирается в «изменён снаружи», а спрашивает.
    const dialog = page.getByRole('dialog', { name: 'Файл «cities.ts» изменился в источнике' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Правки не пересеклись');
    await expect(dialog.getByRole('button', { name: 'Переписать своей версией' })).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, '06-changed-outside.png') });
    await dialog.getByRole('button', { name: 'Объединить правки' }).click();

    await expect(dialog).toBeHidden();
    await expect(host.builder.statusBar).toContainText('Всё сохранено');
    const served = disk.readServed(SERVICE);
    expect(served).toContain('label: city.region }));');
    expect(served).toContain('@module ide-edit');
  });

  test('правка, которую не обновить «на лету»: билдер остаётся, страница обновляется при закрытии', async ({
    host,
    disk,
    page,
  }) => {
    await host.openBuilderWithProject('/');
    await host.openPreview();
    await host.previewMode('Приложение').click();
    await expect(host.preview.getByRole('heading', { name: 'Сервис доставки' })).toBeVisible();
    await host.builder.openFile(ENTRY);
    await page.evaluate(() => {
      window.__e2eAlive = true;
    });

    // У входа приложения нет границы «горячего» обновления: dev-сервер просит ВСЕ открытые
    // документы перезагрузиться — и страницу с билдером тоже.
    await editorOf(page).locator('.view-lines').click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('// edited in the builder', TYPING);
    await expect(host.builder.statusBar).toContainText('1 несохранённый файл');
    await host.builder.save();
    await expect(host.builder.statusBar).toContainText('Всё сохранено');
    expect(disk.readServed(ENTRY)).toContain('// edited in the builder');

    // Билдер на месте: несохранённая работа в нём не пропала бы. Рамка — обновилась.
    await expect(host.preview.getByRole('heading', { name: 'Сервис доставки' })).toBeVisible();
    await expect(host.builder.tab('main.tsx')).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => window.__e2eAlive)).toBe(true);

    // Отложенная перезагрузка выполняется, когда приложение снова показывают.
    await host.toggle.click();
    await expect.poll(() => page.evaluate(() => window.__e2eAlive)).toBeUndefined();
    await expect(host.appHeader).toBeVisible();
    await expect(host.toggle).toHaveText('Билдер');
  });

  test('закрытие билдера возвращает страницу приложения такой, какой она была', async ({
    host,
    page,
  }) => {
    await host.goto('/contact');
    const name = page.getByRole('textbox', { name: 'Имя' });
    await name.fill('Анна');
    const before = await pageLook(page);
    expect(before.builderStyles).toBe(0);

    await host.openBuilder();
    // Пока билдер открыт, его стили в документе есть…
    expect((await pageLook(page)).builderStyles).toBe(1);

    await host.closeBuilder();

    // …а закрытый не оставляет ни стилей, ни темы, ни заголовка.
    await expect(host.appHeader).toBeVisible();
    expect(await pageLook(page)).toEqual(before);
    // Приложение не размонтировалось: введённое в форму осталось.
    await expect(name).toHaveValue('Анна');
  });

  test('перезагрузка страницы: билдер, проект и вкладка возвращаются сами', async ({
    host,
    page,
  }) => {
    await host.openBuilderWithProject('/contact');
    await host.builder.openFile(SCHEMA);

    await page.reload();

    await expect(host.builder.statusBar).toBeVisible();
    await expect(host.builder.projectTree).toBeVisible();
    await expect(host.builder.tab('form.schema.json')).toHaveAttribute('aria-selected', 'true');
    await expect(host.toggle).toHaveText('Закрыть билдер');
  });
});
