import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import type { FrameLocator, Locator, Page } from '@playwright/test';
import { HOST_EXAMPLE_DIR, PLAYGROUND_DIR } from '../shared/paths';
import { test, expect } from './shared/fixtures';
import type { HostApp } from './shared/host-app.pom';

/**
 * Билдер, встроенный в приложение (`<ReformerBuilder>` в `projects/reformer-builder-host-example`).
 *
 * Отличий от остальных тестов два. Первое — ГДЕ билдер: он открыт в рамке поверх страницы
 * чужого приложения, а отдаёт его dev-сервер этого приложения, тем же входом, что и билдер
 * в своей вкладке. Второе — ЧТО рисует форму: об устройстве приложения билдер не знает,
 * и вид «Форма» открытой вкладки — рамка с самим приложением (а панель «Превью» — оно же
 * целиком). Поэтому проверяется связка целиком — билдер пишет файл, dev-сервер приложения его
 * видит, приложение в рамке показывает новое, — а не отрисовка формы билдером.
 */

/** Скриншоты — рядом с остальными снимками билдера (в git не едут). */
const SHOTS = path.resolve(__dirname, '../../../react-playground-e2e/screenshots/builder-embedded');

const SCHEMA = 'src/forms/contact/schema/form.schema.json';
const FORM_MODULE = 'src/forms/contact/index.ts';
const SERVICE = 'src/services/cities.ts';
const ENTRY = 'src/main.tsx';
// Конфиг запуска приложения — пресет кита: без `REFORMER_BUILDER_CONFIG` его `vite.config.ts` берёт
// пресет ui-kit. `.ui_builder/config.json` — конфиг проекта: его билдер читает, открыв каталог.
const LAUNCH_CONFIG = '.ui_builder/presets/ui-kit.json';
const PLUGIN_MAIN = '.ui_builder/plugins/delivery-hello/main.ts';
const PLUGIN_LOCALE = '.ui_builder/plugins/delivery-hello/locales/ru.json';

/**
 * Манифест плагина, который едет с билдером, — собранный на месте, в каталоге проекта-образца:
 * оттуда встроенный билдер и берёт свои плагины, пока работает из исходников.
 */
const SHIPPED_MANIFEST = path.join(
  PLAYGROUND_DIR,
  '.ui_builder',
  'plugins',
  'base',
  'markdown-editor',
  'manifest.json'
);

/**
 * Словарь приложения — `server/cities.json`: то, что отдаёт его `GET /api/cities`.
 *
 * Читается из файла образца, а не повторяется здесь: образец правят (в том числе самим
 * встроенным билдером), и список, записанный в тесте, расходился бы с ним молча — до первого
 * прогона, упавшего «без причины».
 */
const DICTIONARY = JSON.parse(
  readFileSync(path.join(HOST_EXAMPLE_DIR, 'server', 'cities.json'), 'utf8')
) as readonly { readonly name: string; readonly region: string }[];

/** Города: ими опции подписаны, пока сервис не трогали. */
const CITIES = DICTIONARY.map((city) => city.name);

/** Регионы тех же городов: ими сервис подписывает опции после правки в тесте. */
const REGIONS = DICTIONARY.map((city) => city.region);

const MONACO_SCOPE = '[data-rb-plugin="reformer.editor-monaco"]';

/**
 * Набор в редакторе кода — с паузой между знаками, как печатает человек. Без неё текст
 * приходит быстрее, чем редактор сверяется с рабочей копией, и знаки ложатся не туда.
 */
const TYPING = { delay: 50 };

declare global {
  interface Window {
    /** Метка «документ не перезагружался»: ставит тест, перезагрузка её стирает. */
    __e2eAlive?: boolean;
  }
}

/** Видимый редактор кода: у неактивной вкладки тело может оставаться в документе скрытым. */
const editorOf = (shell: FrameLocator): Locator =>
  shell.locator(`${MONACO_SCOPE} .monaco-editor`).filter({ visible: true }).first();

/**
 * Как выглядит документ приложения — то, чего билдер не вправе касаться ни открытым,
 * ни закрытым: он живёт в своём документе.
 */
const pageLook = (page: Page) =>
  page.evaluate(() => {
    const body = getComputedStyle(document.body);
    return {
      title: document.title,
      rootClass: document.documentElement.className,
      styleTags: document.querySelectorAll('style, link[rel="stylesheet"]').length,
      adoptedSheets: document.adoptedStyleSheets.length,
      background: body.backgroundColor,
      color: body.color,
      font: body.fontFamily,
    };
  });

/** Узел схемы формы в объёме, нужном, чтобы развернуть группы. */
interface SchemaNode {
  component?: string;
  children?: unknown[];
  [key: string]: unknown;
}

/**
 * Схема формы без групп: каждая группа (`$html(div)`) заменена своими полями — так, как их
 * развернула бы команда «Разгруппировать».
 *
 * Образец правят самим встроенным билдером, и в его схеме группы появляются и исчезают.
 * Сценарию, который сам собирает группу, нужна плоская форма на входе — иначе он проверял бы
 * то, что оставил в образце последний, кто с ним играл.
 */
function withoutGroups(node: SchemaNode): SchemaNode {
  if (!Array.isArray(node.children)) return node;
  const children = node.children.flatMap((child): unknown[] => {
    if (typeof child !== 'object' || child === null) return [child];
    const flat = withoutGroups(child as SchemaNode);
    return flat.component === '$html(div)' ? (flat.children ?? []) : [flat];
  });
  return { ...node, children };
}

/** Ждёт команду в палитре: вклады плагинов появляются после открытия проекта, не сразу. */
async function expectCommand(host: HostApp, query: string, title: string): Promise<void> {
  await expect(async () => {
    await host.builder.openPalette(query);
    try {
      await expect(host.builder.paletteOption(title)).toBeVisible({ timeout: 1_000 });
    } finally {
      await host.builder.closePalette();
    }
  }).toPass();
}

test.describe('Билдер внутри приложения', () => {
  test('кнопка открывает билдер поверх страницы: тот же интерфейс, проект открывается', async ({
    host,
    page,
  }) => {
    await host.goto('/contact');
    await expect(page.getByRole('heading', { name: 'Обратная связь' })).toBeVisible();
    const title = await page.title();

    await host.openBuilder();

    // Билдер — отдельный документ в рамке на всю страницу; приложение под ней остаётся.
    const viewport = page.viewportSize();
    expect(await host.overlay.boundingBox()).toEqual({ x: 0, y: 0, ...viewport });
    await expect(host.appHeader).toBeAttached();
    // В рамке — оболочка билдера, как в своей вкладке.
    await expect(host.builder.openFolderButton).toBeVisible();
    await expect(host.shell.getByRole('menubar')).toBeVisible();
    // Вкладка принадлежит приложению: её заголовок билдер не трогает.
    expect(await page.title()).toBe(title);

    // Обслуживание хранилища у встроенного билдера есть: источник общий с приложением, но
    // сносит оно только пространство имён билдера (`storage/namespace`), чужое не трогает.
    await host.shell.getByRole('menuitem', { name: 'Файл' }).click();
    await expect(host.shell.getByRole('menuitem', { name: 'Открыть папку…' })).toBeVisible();
    await expect(host.shell.getByRole('menuitem', { name: 'Очистить кэш' })).toBeVisible();
    await page.keyboard.press('Escape');

    await host.openProject();
    await host.builder.openFile(SCHEMA);
    const schemaTree = host.shell.getByRole('tree', { name: 'Дерево схемы формы' });
    for (const field of ['Имя', 'Email', 'Город', 'Согласен на обработку данных']) {
      await expect(schemaTree.getByRole('treeitem', { name: field })).toBeVisible();
    }
    await page.screenshot({ path: path.join(SHOTS, '01-builder-over-application.png') });
  });

  test('вид «Форма» открытой вкладки: форму рисует приложение, со словарём из его API', async ({
    host,
    page,
  }) => {
    await host.openBuilderWithProject('/contact');
    await host.builder.openFile(SCHEMA);
    // Виды у вкладки те же, что у билдера в своей вкладке: кнопки со значками в её полосе.
    // Рендерера у встроенного билдера нет — вид «Форма» есть, потому что рисует приложение.
    for (const view of ['Дерево', 'Схема', 'Форма']) {
      await expect(host.viewButton(view)).toBeVisible();
    }
    await expect(host.viewButton('Дерево')).toHaveAttribute('data-state', 'on');

    await host.showForm();

    await expect(host.viewButton('Форма')).toHaveAttribute('data-state', 'on');
    // Форма заняла тело вкладки — на месте дерева схемы, а не рядом с ним.
    await expect(host.shell.getByRole('tree', { name: 'Дерево схемы формы' })).toHaveCount(0);
    const form = host.form;
    await expect(form.getByRole('heading', { name: 'Обратная связь' })).toBeVisible();
    // Только форма: ни шапки приложения, ни кнопки билдера внутри его же превью.
    await expect(form.getByRole('navigation', { name: 'Разделы приложения' })).toHaveCount(0);
    await expect(form.locator('[data-reformer-builder="toggle"]')).toHaveCount(0);
    // В рамке стенд именно этого модуля.
    await host.expectFormOf(FORM_MODULE);
    // Рамка занимает тело вкладки целиком, а не полоску в его углу.
    const area = await host.shell.getByRole('main', { name: 'Редактор' }).boundingBox();
    const shown = await host.formView.boundingBox();
    expect(shown?.width).toBe(area?.width);
    expect(shown?.height ?? 0).toBeGreaterThan((area?.height ?? 0) * 0.8);

    // Стили у формы — приложения: колонка формы ограничена его утилитой ширины.
    const column = form.locator('[data-reformer-builder-stand="form"] > div');
    expect(await column.evaluate((element) => getComputedStyle(element).maxWidth)).toBe('768px');

    // Словарь пришёл из API приложения: в схеме у поля опций нет.
    await form.getByRole('combobox', { name: 'Город' }).click();
    await expect(form.getByRole('option')).toHaveText(CITIES);
    await page.screenshot({ path: path.join(SHOTS, '02-form-view.png') });

    // Обратно к дереву — той же полосой: вид меняет тело вкладки, а не открывает что-то рядом.
    await host.viewButton('Дерево').click();
    await expect(host.shell.getByRole('tree', { name: 'Дерево схемы формы' })).toBeVisible();
    await expect(host.formView).toHaveCount(0);
  });

  test('панель «Превью»: приложение целиком, адресная строка, отдельная вкладка', async ({
    host,
    page,
    context,
    baseURL,
  }) => {
    await host.openBuilderWithProject('/contact');
    await host.openPreview();

    // Выбирать в панели нечего: она показывает приложение, а форму — вид вкладки.
    await expect(host.shell.getByRole('group', { name: 'Что показывать' })).toHaveCount(0);
    // И шапки с названием у неё нет: панель называет адресная строка — она и стоит у верхнего
    // края дока, а «Превью» написано на кнопке рейла.
    const dock = host.shell.getByRole('complementary', { name: 'Правая панель' });
    await expect(dock.getByRole('heading')).toHaveCount(0);
    const dockTop = (await dock.boundingBox())?.y ?? Number.NaN;
    const addressTop = (await host.previewAddress.boundingBox())?.y ?? Number.NaN;
    expect(addressTop - dockTop).toBeLessThan(16);
    // Страница, с которой включили билдер, — целиком и без кнопки билдера.
    const app = host.app;
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

  test('форма, отправленная в виде «Форма», показывает уведомление приложения', async ({
    host,
  }) => {
    await host.openBuilderWithProject('/contact');
    await host.builder.openFile(SCHEMA);
    await host.showForm();

    const form = host.form;
    await form.getByRole('textbox', { name: 'Имя' }).fill('Анна');
    await form.getByRole('textbox', { name: 'Email' }).fill('anna@example.com');
    await form.getByRole('button', { name: 'Отправить' }).click();

    // Обращение ушло в API приложения, и сказало об этом приложение — своим уведомлением.
    await expect(form.locator('[data-app-toast]')).toHaveText(/Обращение REQ-\d+ принято/);
    // Билдер тут ни при чём: ни на странице приложения, ни в его документе уведомлений нет.
    await expect(host.appToasts).toHaveCount(0);
    expect(await host.builder.shownNotifications()).toEqual([]);
  });

  test('правка формы: после сохранения приложение рисует в виде «Форма» новую форму', async ({
    host,
    disk,
    page,
  }) => {
    await host.openBuilderWithProject('/contact');
    await host.builder.openFile(SCHEMA);
    for (const document of [page.mainFrame(), host.shellFrame()]) {
      await document.evaluate(() => {
        window.__e2eAlive = true;
      });
    }

    await host.shell
      .getByRole('tree', { name: 'Дерево схемы формы' })
      .getByRole('treeitem', { name: 'Имя' })
      .click();
    await host.rightPanelTab('Свойства').click();
    await host.shell
      .getByRole('complementary', { name: 'Правая панель' })
      .getByRole('textbox', { name: 'Label', exact: true })
      .fill('Как к вам обращаться');
    await expect(host.builder.statusBar).toContainText('1 несохранённый файл');

    // До сохранения правка живёт в рабочей копии билдера: приложение рисует прежнее.
    // Панель свойств при этом остаётся рядом: вид меняет тело вкладки, а не правый док.
    await host.showForm();
    const form = host.form;
    await expect(form.getByRole('textbox', { name: 'Имя' })).toBeVisible();
    await expect(
      host.shell
        .getByRole('complementary', { name: 'Правая панель' })
        .getByRole('textbox', { name: 'Label', exact: true })
    ).toHaveValue('Как к вам обращаться');

    await host.builder.save();

    await expect(host.builder.statusBar).toContainText('Всё сохранено');
    // Файл лёг на диск под dev-сервером приложения…
    expect(disk.readServed(SCHEMA)).toContain('Как к вам обращаться');
    // …и рамка обновилась сама: форму заново нарисовало приложение.
    await expect(form.getByRole('textbox', { name: 'Как к вам обращаться' })).toBeVisible();
    await expect(form.getByRole('textbox', { name: 'Имя' })).toHaveCount(0);
    // Ни страница приложения, ни билдер при этом не перезагружались.
    expect(await page.evaluate(() => window.__e2eAlive)).toBe(true);
    expect(await host.shellFrame().evaluate(() => window.__e2eAlive)).toBe(true);
    await page.screenshot({ path: path.join(SHOTS, '04-form-edited.png') });
  });

  test('группа в ряд: до сохранения вид «Форма» говорит, что рисует записанное, после — поля в ряд', async ({
    host,
    disk,
    page,
  }) => {
    await host.openBuilderWithProject('/contact');
    // Плоская форма на входе, какой бы её ни оставили в образце: группу сценарий соберёт сам.
    const schema = JSON.parse(await disk.readText(SCHEMA)) as { root: SchemaNode };
    await disk.writeText(
      SCHEMA,
      JSON.stringify({ ...schema, root: withoutGroups(schema.root) }, null, 2)
    );
    await host.builder.openFile(SCHEMA);
    await host.viewButton('Схема').click();

    // Поля от «Имя» до «Email» — в группу, группу — в ряд.
    const schematic = host.shell.getByLabel('Схема формы');
    await schematic.getByText('Имя', { exact: true }).click();
    await schematic.getByText('Email', { exact: true }).click({ modifiers: ['Shift'] });
    await host.builder.openPalette('Сгруппировать');
    await page.keyboard.press('Enter');
    await expect(host.builder.palette).toBeHidden();
    await host.shell
      .getByRole('button', { name: 'Направление: столбец. Щелчок переворачивает' })
      .click();
    await expect(
      host.shell.getByRole('button', { name: 'Направление: ряд. Щелчок переворачивает' })
    ).toBeVisible();

    await host.showForm();
    const form = host.form;
    const top = async (label: string): Promise<number> => {
      const box = await form.getByRole('textbox', { name: label }).boundingBox();
      if (box === null) throw new Error(`поля «${label}» в форме нет`);
      return box.y;
    };
    // Приложение рисует то, что записано на диск: правка ещё в рабочей копии, и поля стоят
    // столбцом. Без объяснения это выглядело поломкой — «направление поменял, а поля не в ряд».
    expect(await top('Email')).toBeGreaterThan(await top('Имя'));
    const unsaved = host.formView.locator('[data-app-preview="unsaved"]');
    await expect(unsaved).toContainText('Есть несохранённые правки');
    await page.screenshot({ path: path.join(SHOTS, '04a-unsaved-notice.png') });

    // Сохранить можно тут же, не уходя из вида.
    await unsaved.getByRole('button', { name: 'Сохранить' }).click();

    await expect(host.builder.statusBar).toContainText('Всё сохранено');
    await expect(unsaved).toBeHidden();
    // Форму заново нарисовало приложение — и поля группы стоят в ряд.
    await expect.poll(async () => Math.abs((await top('Email')) - (await top('Имя')))).toBe(0);
    await page.screenshot({ path: path.join(SHOTS, '04b-group-in-row.png') });
  });

  test('правка сервиса в редакторе кода: словарь формы меняется — и в приложении, и в виде «Форма»', async ({
    host,
    disk,
    page,
  }) => {
    await host.openBuilderWithProject('/contact');
    await host.builder.openFile(SCHEMA);
    await host.showForm();
    await expect(host.form.getByRole('heading', { name: 'Обратная связь' })).toBeVisible();

    // Сервис лежит не в каталоге формы, и у его вкладки вида «Форма» нет. Форму при этом
    // держат на экране панелью «Превью»: страница приложения с этой формой стоит рядом
    // с редактором кода.
    await host.builder.openFile(SERVICE);
    await expect(host.viewButton('Форма')).toHaveCount(0);
    await host.openPreview();
    const app = host.app;
    await expect(app.getByRole('heading', { name: 'Обратная связь' })).toBeVisible();

    // Подпись опции: `label: city.name` → `label: city.region`. Курсор — в конец строки,
    // назад через ` }));` к слову `name`, слово выделяется и заменяется набором.
    const editor = editorOf(host.shell);
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
      await app.getByRole('combobox', { name: 'Город' }).click({ timeout: 2_000 });
      await expect(app.getByRole('option').first()).toHaveText(REGIONS[0], { timeout: 2_000 });
    }).toPass();
    await expect(app.getByRole('option')).toHaveText(REGIONS);
    await page.screenshot({ path: path.join(SHOTS, '05-service-edited.png') });

    // Вкладка формы помнит свой вид, и приложение рисует в нём форму уже по новому коду.
    await host.builder.tab('form.schema.json').click();
    await expect(host.viewButton('Форма')).toHaveAttribute('data-state', 'on');
    const form = host.form;
    await expect(async () => {
      await form.getByRole('combobox', { name: 'Город' }).click({ timeout: 2_000 });
      await expect(form.getByRole('option').first()).toHaveText(REGIONS[0], { timeout: 2_000 });
    }).toPass();
  });

  test('файл поправили в IDE, пока он правился в билдере: сохранение спрашивает и объединяет', async ({
    host,
    disk,
    page,
  }) => {
    await host.openBuilderWithProject('/contact');
    await host.builder.openFile(SERVICE);

    // Правка в билдере — подпись опции, как в тесте выше.
    const editor = editorOf(host.shell);
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
    const dialog = host.shell.getByRole('dialog', {
      name: 'Файл «cities.ts» изменился в источнике',
    });
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
    await expect(host.app.getByRole('heading', { name: 'Сервис доставки' })).toBeVisible();
    await host.builder.openFile(ENTRY);
    await page.evaluate(() => {
      window.__e2eAlive = true;
    });

    // У входа приложения нет границы «горячего» обновления: dev-сервер просит ВСЕ открытые
    // документы приложения перезагрузиться — и страницу, в рамке которой открыт билдер.
    await editorOf(host.shell).locator('.view-lines').click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('// edited in the builder', TYPING);
    await expect(host.builder.statusBar).toContainText('1 несохранённый файл');
    await host.builder.save();
    await expect(host.builder.statusBar).toContainText('Всё сохранено');
    expect(disk.readServed(ENTRY)).toContain('// edited in the builder');

    // Билдер на месте: вместе со страницей ушла бы и его рамка. Превью — обновилось.
    await expect(host.app.getByRole('heading', { name: 'Сервис доставки' })).toBeVisible();
    await expect(host.builder.tab('main.tsx')).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => window.__e2eAlive)).toBe(true);

    // Отложенная перезагрузка выполняется, когда приложение снова показывают.
    await host.toggle.click();
    await expect.poll(() => page.evaluate(() => window.__e2eAlive)).toBeUndefined();
    await expect(host.appHeader).toBeVisible();
    await expect(host.toggle).toHaveText('Билдер');
  });

  test('билдер живёт в своём документе: страницы приложения он не касается, и закрытие его не снимает', async ({
    host,
    page,
  }) => {
    await host.goto('/contact');
    const name = page.getByRole('textbox', { name: 'Имя' });
    await name.fill('Анна');
    const before = await pageLook(page);

    await host.openBuilder();
    await host.openProject();
    await host.builder.openFile(SCHEMA);

    // Открытый билдер с поднятыми плагинами не приносит в документ приложения ни стилей,
    // ни темы, ни заголовка: всё это — в его документе.
    expect(await pageLook(page)).toEqual(before);
    expect(
      await host.shellFrame().evaluate(() => document.adoptedStyleSheets.length)
    ).toBeGreaterThan(0);

    await host.shellFrame().evaluate(() => {
      window.__e2eAlive = true;
    });
    await host.closeBuilder();

    await expect(host.appHeader).toBeVisible();
    expect(await pageLook(page)).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
    // Приложение не размонтировалось: введённое в форму осталось.
    await expect(name).toHaveValue('Анна');

    // И билдер никуда не делся: рамка спрятана, а открытый проект и вкладка — на месте.
    await host.openBuilder();
    expect(await host.shellFrame().evaluate(() => window.__e2eAlive)).toBe(true);
    await expect(host.builder.tab('form.schema.json')).toHaveAttribute('aria-selected', 'true');
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

test.describe('Каталог .ui_builder приложения', () => {
  test('конфиг запуска читается из него — как у билдера, запущенного в каталоге проекта', async ({
    host,
    disk,
    page,
  }) => {
    await host.goto('/');
    await host.openBuilder();

    // `branding.title` — заголовок документа билдера; у страницы приложения заголовок свой.
    expect(await host.shellFrame().title()).toBe('Сервис доставки · билдер');

    // `defaults` действуют только на уровне запуска: конфиг открытого проекта их не применяет.
    // Здесь уровень запуска — пресет в каталоге приложения, и отдаёт его dev-сервер приложения.
    const config = JSON.parse(disk.readServed(LAUNCH_CONFIG)) as {
      defaults: Record<string, string>;
    };
    disk.writeServed(
      LAUNCH_CONFIG,
      JSON.stringify({
        ...config,
        branding: { title: 'Билдер команды' },
        defaults: { ...config.defaults, theme: 'dark' },
      })
    );
    await page.reload();

    await expect(host.builder.statusBar).toBeVisible();
    await expect.poll(() => host.shellFrame().title()).toBe('Билдер команды');
    const dark = (): boolean => document.documentElement.classList.contains('dark');
    expect(await host.shellFrame().evaluate(dark)).toBe(true);
    // Тема билдера — в его документе; документ приложения она не трогает.
    expect(await page.evaluate(dark)).toBe(false);
  });

  test('плагин приложения поднимается из него и перечитывается в режиме разработки', async ({
    host,
    disk,
  }) => {
    await host.openBuilderWithProject('/');

    // Плагин лежит в `.ui_builder/plugins` приложения и включён его `settings.json`.
    await expectCommand(host, 'Delivery Hello', 'Delivery Hello: привет');

    await host.builder.openPalette('Delivery Hello');
    await host.builder
      .paletteOption('Плагины: наблюдать «Delivery Hello» — режим разработки')
      .click();
    await expect(host.builder.palette).toBeHidden();

    // Правка «в IDE», мимо билдера: у плагина появляется вторая команда.
    const main = await disk.readText(PLUGIN_MAIN);
    await disk.writeText(
      PLUGIN_MAIN,
      main
        .replace("id: 'delivery-hello.hello'", "id: 'delivery-hello.bye'")
        .replace("titleKey: 'command.hello'", "titleKey: 'command.bye'")
    );
    await disk.writeText(
      PLUGIN_LOCALE,
      JSON.stringify({
        'command.hello': 'Delivery Hello: привет',
        'command.bye': 'Delivery Hello: пока',
      })
    );

    // Человек вернулся в билдер — плагин «в разработке» перечитан без перезагрузки страницы.
    await expect(async () => {
      await host.shellFrame().evaluate(() => {
        window.dispatchEvent(new Event('focus'));
      });
      await host.builder.openPalette('Delivery Hello');
      try {
        await expect(host.builder.paletteOption('Delivery Hello: пока')).toBeVisible({
          timeout: 1_000,
        });
      } finally {
        await host.builder.closePalette();
      }
    }).toPass();
  });
});

test.describe('Плагины, которые едут с билдером', () => {
  // Живой каталог есть только у билдера из исходников: готовая сборка несёт плагины в себе,
  // и под работающим приложением они не меняются.
  test.skip(process.env.BUILDER_E2E_UI === 'dist', 'готовая сборка: каталог плагинов не живой');

  test('плагин пересобрали — билдер перечитал его без перезагрузки страницы', async ({ host }) => {
    await host.goto('/');
    await host.openBuilder();
    await host.shellFrame().evaluate(() => {
      window.__e2eAlive = true;
    });

    await host.builder.openPalette('Настройки');
    await host.builder.palette.getByRole('option').first().click();
    await host.shell.getByRole('dialog').getByRole('button', { name: 'Плагины' }).click();
    const list = host.shell.getByTestId('settings-plugins');
    await expect(list).toContainText('Markdown');

    // «Пересборка»: у собранного плагина меняется манифест. Файл — артефакт сборки на месте
    // (в git не едет, каждый прогон собирает его заново) и после теста возвращается.
    const built = readFileSync(SHIPPED_MANIFEST, 'utf8');
    try {
      const manifest = JSON.parse(built) as Record<string, unknown>;
      writeFileSync(
        SHIPPED_MANIFEST,
        JSON.stringify({ ...manifest, name: 'Markdown, пересобран' }, null, 2)
      );

      // Человек вернулся в билдер: тот спросил у сервера ревизии плагинов и перезагрузил
      // изменившийся — остальные и сам документ не тронуты.
      await expect(async () => {
        await host.shellFrame().evaluate(() => {
          window.dispatchEvent(new Event('focus'));
        });
        await expect(list).toContainText('Markdown, пересобран', { timeout: 1_000 });
      }).toPass();
      expect(await host.shellFrame().evaluate(() => window.__e2eAlive)).toBe(true);
    } finally {
      writeFileSync(SHIPPED_MANIFEST, built);
    }
  });
});

test.describe('Источник интерфейса билдера', () => {
  // Последним в наборе: сервер не должен сменить источник и посреди прогона. Так уже было —
  // конфиг копии приложения называл готовую сборку, «диск» теста возвращал его к виду образца,
  // сервер перезапускался из исходников, и набор «над готовой сборкой» проверял не её.
  test('прогон идёт над тем, что ему назвали: исходники или готовая сборка', async ({ host }) => {
    await host.openBuilderWithProject('/');

    // Страницу из исходников отдаёт dev-сервер, и он дописывает в неё свой клиент.
    const fromSource = await host
      .shellFrame()
      .evaluate(() => document.querySelector('script[src*="@vite/client"]') !== null);

    expect(fromSource).toBe(process.env.BUILDER_E2E_UI !== 'dist');
  });
});
