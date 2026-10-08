/**
 * Приложение-образец со встроенным билдером как страница.
 *
 * Две поверхности в одном документе: само приложение и билдер поверх него. Оболочка билдера
 * та же, что в своей вкладке, поэтому её локаторы не повторяются, а берутся у общего объекта
 * ({@link HostApp.builder}); здесь — только то, чего в своей вкладке нет: кнопка режима,
 * оверлей и рамка превью, в которой форму и страницу рисует приложение.
 *
 * @module tests/embedded/shared/host-app.pom
 */

import { expect, type FrameLocator, type Locator, type Page } from '@playwright/test';
import { BuilderApp } from '../../shared/builder-app.pom';
import type { HostDisk } from './host-disk';

/** Имя окна рамки превью — `APP_PREVIEW_FRAME_NAME` контракта плагинов. */
const PREVIEW_FRAME = 'iframe[name="reformer-builder-preview"]';

export class HostApp {
  /** Оболочка билдера внутри оверлея. */
  readonly builder: BuilderApp;
  /** Кнопка режима билдера: «Билдер» на странице приложения, «Закрыть билдер» в оверлее. */
  readonly toggle: Locator;
  readonly overlay: Locator;
  /** Шапка приложения — признак того, что на экране оно, а не билдер. */
  readonly appHeader: Locator;
  /** Панель превью в правом доке билдера. */
  readonly previewPanel: Locator;
  /** Документ приложения в рамке превью. */
  readonly preview: FrameLocator;
  /** Уведомления приложения в верхнем документе. */
  readonly appToasts: Locator;

  constructor(
    readonly page: Page,
    readonly disk: HostDisk
  ) {
    this.builder = new BuilderApp(page, disk);
    this.toggle = page.locator('[data-reformer-builder="toggle"]');
    this.overlay = page.locator('[data-reformer-builder="overlay"]');
    this.appHeader = page.getByRole('banner').filter({ hasText: 'Сервис доставки' });
    this.previewPanel = page.locator('[data-app-preview="panel"]');
    this.preview = page.frameLocator(PREVIEW_FRAME);
    this.appToasts = page.locator('[data-app-toast]');
  }

  /** Открывает страницу приложения. Билдер при этом выключен. */
  async goto(pagePath = '/'): Promise<void> {
    await this.page.goto(pagePath);
    await expect(this.appHeader).toBeVisible();
    await expect(this.toggle).toHaveText('Билдер');
  }

  /** Включает режим билдера и ждёт его оболочку. */
  async openBuilder(): Promise<void> {
    await this.toggle.click();
    await expect(this.builder.statusBar).toBeVisible();
  }

  async closeBuilder(): Promise<void> {
    await this.toggle.click();
    await expect(this.overlay).toHaveCount(0);
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

  /** Кнопка панели на правом рейле: «Превью», «Свойства»… */
  rightPanelTab(name: string): Locator {
    return this.page
      .getByRole('navigation', { name: 'Панели справа' })
      .getByRole('button', { name, exact: true });
  }

  /**
   * Открывает панель превью в правом доке.
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

  /** Переключатель «что показывать»: одна форма или приложение целиком. */
  previewMode(name: 'Форма' | 'Приложение'): Locator {
    return this.previewPanel
      .getByRole('group', { name: 'Что показывать' })
      .getByRole('button', { name });
  }

  /** Адресная строка панели превью. */
  get previewAddress(): Locator {
    return this.previewPanel.getByRole('textbox', { name: 'Адрес страницы приложения' });
  }
}
