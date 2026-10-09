/**
 * Приложение-образец со встроенным билдером как страница.
 *
 * Документы на ней вложены друг в друга: страница приложения, поверх неё — рамка с билдером,
 * а внутри билдера — рамки, в которых рисует приложение. Их две, и у каждой своё место: форма
 * открытого файла — вид «Форма» его вкладки, приложение целиком — панель «Превью» в правом доке.
 * Оболочка билдера та же, что в своей вкладке, поэтому её локаторы не повторяются, а берутся
 * у общего объекта ({@link HostApp.builder}), которому названа рамка; здесь — только то, чего
 * в своей вкладке нет: кнопка режима, сама рамка билдера и рамки приложения.
 *
 * @module tests/embedded/shared/host-app.pom
 */

import { expect, type Frame, type FrameLocator, type Locator, type Page } from '@playwright/test';
import { BuilderApp } from '../../shared/builder-app.pom';
import type { HostDisk } from './host-disk';

/** Имя окна рамки билдера — `SHELL_FRAME_NAME` клиента (`@reformer/builder`). */
export const SHELL_FRAME_NAME = 'reformer-builder-shell';

/** Имя окна рамки превью — `APP_PREVIEW_FRAME_NAME` контракта плагинов. */
export const PREVIEW_FRAME_NAME = 'reformer-builder-preview';

const SHELL_FRAME = `iframe[name="${SHELL_FRAME_NAME}"]`;
// Имя у обеих рамок приложения одно — по нему приложение узнаёт, что открыто в превью, —
// поэтому различаются они местом: вид вкладки или панель дока.
const PREVIEW_FRAME = `iframe[name="${PREVIEW_FRAME_NAME}"]`;
const FORM_VIEW = '[data-app-preview="form"]';
const APP_PANEL = '[data-app-preview="panel"]';

/**
 * Сколько ждать первого открытия билдера. Его отдаёт вложенный dev-сервер, который
 * поднимается по первому запросу и на холодную собирает зависимости билдера.
 */
const FIRST_OPEN_TIMEOUT = 120_000;

export class HostApp {
  /** Оболочка билдера внутри его рамки. */
  readonly builder: BuilderApp;
  /** Документ билдера — рамка поверх страницы приложения. */
  readonly shell: FrameLocator;
  /** Кнопка режима билдера: «Билдер» на странице приложения, «Закрыть билдер» над рамкой. */
  readonly toggle: Locator;
  /** Сама рамка билдера — элемент страницы приложения. */
  readonly overlay: Locator;
  /** Шапка приложения — признак того, что страница приложения на месте. */
  readonly appHeader: Locator;
  /** Вид «Форма» открытой вкладки: область, в которой форму рисует приложение. */
  readonly formView: Locator;
  /** Документ приложения в виде «Форма»: стенд одной формы. */
  readonly form: FrameLocator;
  /** Панель превью в правом доке билдера: приложение целиком. */
  readonly previewPanel: Locator;
  /** Документ приложения в панели превью: страница. */
  readonly app: FrameLocator;
  /** Уведомления приложения в верхнем документе. */
  readonly appToasts: Locator;

  constructor(
    readonly page: Page,
    readonly disk: HostDisk
  ) {
    this.shell = page.frameLocator(SHELL_FRAME);
    this.builder = new BuilderApp(page, disk, { root: this.shell, frameName: SHELL_FRAME_NAME });
    this.toggle = page.locator('[data-reformer-builder="toggle"]');
    this.overlay = page.locator('[data-reformer-builder="overlay"]');
    this.appHeader = page.getByRole('banner').filter({ hasText: 'Сервис доставки' });
    this.formView = this.shell.locator(FORM_VIEW);
    this.form = this.formView.frameLocator(PREVIEW_FRAME);
    this.previewPanel = this.shell.locator(APP_PANEL);
    this.app = this.previewPanel.frameLocator(PREVIEW_FRAME);
    this.appToasts = page.locator('[data-app-toast]');
  }

  /** Открывает страницу приложения. Билдер при этом выключен. */
  async goto(pagePath = '/'): Promise<void> {
    await this.page.goto(pagePath);
    await expect(this.appHeader).toBeVisible();
    await expect(this.toggle).toHaveText('Билдер');
  }

  /** Включает режим билдера и ждёт его оболочку в рамке. */
  async openBuilder(): Promise<void> {
    await this.toggle.click();
    await expect(this.builder.statusBar).toBeVisible({ timeout: FIRST_OPEN_TIMEOUT });
  }

  /** Выключает режим: рамка прячется, но остаётся в документе — билдер в ней живёт дальше. */
  async closeBuilder(): Promise<void> {
    await this.toggle.click();
    await expect(this.overlay).toBeHidden();
    await expect(this.toggle).toHaveText('Билдер');
  }

  /**
   * Открывает приложение-образец как проект билдера — «Открыть папку…» и выбор каталога
   * (подменённый «диском», см. {@link HostDisk}).
   */
  async openProject(): Promise<void> {
    await this.disk.seed();
    await this.builder.openFolder();
  }

  /** Весь путь до открытого проекта: страница приложения → билдер → проект. */
  async openBuilderWithProject(pagePath = '/'): Promise<void> {
    await this.goto(pagePath);
    await this.openBuilder();
    await this.openProject();
  }

  /**
   * Документ билдера — чтобы прочитать или записать значение в нём, а не на странице
   * приложения. Рамки ещё нет — отказ: спрашивать её до открытия билдера не о чем.
   */
  shellFrame(): Frame {
    const frame = this.page.frame({ name: SHELL_FRAME_NAME });
    if (frame === null) throw new Error('рамка билдера ещё не открыта');
    return frame;
  }

  /** Кнопка панели на правом рейле: «Превью», «Свойства»… */
  rightPanelTab(name: string): Locator {
    return this.shell
      .getByRole('navigation', { name: 'Панели справа' })
      .getByRole('button', { name, exact: true });
  }

  /**
   * Открывает панель превью в правом доке — приложение целиком.
   *
   * Кнопка рейла — переключатель, а панель могла открыться и сама: правый док показывает
   * первую доступную панель, когда прежняя (свойства узла схемы) ушла вместе с документом.
   * Поэтому щелчок — только по не нажатой кнопке.
   */
  async openPreview(): Promise<void> {
    const tab = this.rightPanelTab('Превью');
    if ((await tab.getAttribute('aria-pressed')) !== 'true') await tab.click();
    await expect(this.previewPanel).toBeVisible();
  }

  /**
   * Кнопка вида в полосе вкладок открытого файла: «Дерево», «Схема», «Форма», «Исходный код».
   *
   * Те же кнопки, что у билдера в своей вкладке: вид «Форма» там рисует рендерер билдера,
   * здесь — приложение.
   */
  viewButton(name: string): Locator {
    return this.shell
      .getByRole('main', { name: 'Редактор' })
      .getByRole('button', { name, exact: true });
  }

  /** Показывает открытый файл видом «Форма» — тем, который рисует приложение. */
  async showForm(): Promise<void> {
    await this.viewButton('Форма').click();
    await expect(this.formView).toBeVisible();
  }

  /**
   * Вид «Форма» открыт на стенде этого модуля формы.
   *
   * Вид модуль не называет: он виден только в адресе рамки, параметром стенда.
   */
  async expectFormOf(modulePath: string): Promise<void> {
    await expect
      .poll(async () => {
        const src = await this.formView.locator(PREVIEW_FRAME).getAttribute('src');
        return src === null ? [] : [...new URL(src).searchParams.values()];
      })
      .toContain(modulePath);
  }

  /** Адресная строка панели превью. */
  get previewAddress(): Locator {
    return this.previewPanel.getByRole('textbox', { name: 'Адрес страницы приложения' });
  }
}
