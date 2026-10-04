/**
 * Билдер как страница: оболочка, общая для всех тестов.
 *
 * Здесь только то, что принадлежит оболочке и встречается в каждом сценарии: стартовая страница,
 * дерево проекта, вкладки, строка состояния, палитра команд. Локаторы редакторов (схема ReFormer,
 * форма RJSF) живут в самих тестах — у каждого плагина своя разметка, и общий объект на всё
 * стал бы свалкой.
 *
 * Строки — русские: локаль закреплена конфигом запуска playground (`builder.launch.json`).
 *
 * @module tests/shared/builder-app.pom
 */

import { expect, type Locator, type Page } from '@playwright/test';
import type { PlaygroundDisk } from './playground-disk';

export class BuilderApp {
  /** «Открыть папку…» на стартовой странице. */
  readonly openFolderButton: Locator;
  /** Дерево файлов открытого проекта. */
  readonly projectTree: Locator;
  /** Ряд вкладок открытых документов. */
  readonly tabs: Locator;
  readonly statusBar: Locator;
  readonly palette: Locator;

  constructor(
    readonly page: Page,
    readonly disk: PlaygroundDisk
  ) {
    this.openFolderButton = page
      .getByRole('main', { name: 'Редактор' })
      .getByRole('button', { name: 'Открыть папку…' });
    this.projectTree = page.getByRole('tree', { name: 'Ресурсы проекта' });
    this.tabs = page.getByRole('tablist', { name: 'Открытые документы' });
    this.statusBar = page.getByRole('contentinfo', { name: 'Строка состояния' });
    this.palette = page.getByRole('dialog', { name: 'Палитра команд' });
  }

  /** Открывает билдер и ждёт оболочку. Проект при этом не открыт. */
  async goto(): Promise<void> {
    await this.page.goto('/');
    await expect(this.statusBar).toBeVisible();
  }

  /**
   * Открывает playground как проект — тем же путём, что человек: «Открыть папку…» и выбор
   * каталога. Выбор подменён (см. {@link PlaygroundDisk}), всё остальное настоящее.
   */
  async openPlayground(): Promise<void> {
    await this.goto();
    await this.disk.seed();
    await this.openFolderButton.click();
    await expect(this.projectTree).toBeVisible();
    await expect(this.statusBar).toContainText('Всё сохранено');
    // Плагины из `.ui_builder/plugins` проекта поднимаются ПОЗЖЕ и отдельной цепочкой: сюда
    // они ещё могли не дойти. Тест, которому нужен их вклад, ждёт сам вклад (`toPass`).
  }

  /**
   * Строка дерева по пути от корня проекта.
   *
   * По пути, а не по имени: имя не уникально (`forms/contact` и `forms/contact.rjsf.json`
   * начинаются одинаково, одноимённые файлы лежат в разных каталогах), а в доступное имя
   * строки попадает ещё и счётчик проблем. `data-node-id` — идентификатор ресурса
   * `<рабочая область>:<путь>`.
   */
  treeItem(resourcePath: string): Locator {
    return this.projectTree.locator(`[role="treeitem"][data-node-id$=":${resourcePath}"]`);
  }

  /** Раскрывает каталоги по пути: `forms/contact` раскроет `forms`, затем `forms/contact`. */
  async expandFolder(folderPath: string): Promise<void> {
    const segments = folderPath.split('/');
    for (let depth = 1; depth <= segments.length; depth++) {
      const folder = this.treeItem(segments.slice(0, depth).join('/'));
      if ((await folder.getAttribute('aria-expanded')) !== 'true') await folder.click();
      await expect(folder).toHaveAttribute('aria-expanded', 'true');
    }
  }

  /** Открывает файл проекта во вкладке, раскрыв каталоги на пути к нему. */
  async openFile(filePath: string): Promise<void> {
    const separator = filePath.lastIndexOf('/');
    if (separator !== -1) await this.expandFolder(filePath.slice(0, separator));
    await this.treeItem(filePath).dblclick();
    await expect(this.tab(filePath.slice(separator + 1))).toHaveAttribute('aria-selected', 'true');
  }

  /**
   * Вкладка документа по имени файла.
   *
   * Совпадение по началу имени: несохранённый документ дописывает в доступное имя вкладки
   * «Есть несохранённые изменения».
   */
  tab(fileName: string): Locator {
    return this.tabs.getByRole('tab', { name: new RegExp(`^${escapeRegExp(fileName)}`) });
  }

  /** Сохраняет активный документ — сочетанием, как человек. */
  async save(): Promise<void> {
    await this.page.keyboard.press('ControlOrMeta+s');
  }

  /** Открывает палитру команд и, если задан запрос, печатает его. */
  async openPalette(query = ''): Promise<void> {
    await this.page.keyboard.press('ControlOrMeta+Shift+p');
    await expect(this.palette).toBeVisible();
    if (query !== '') await this.palette.getByRole('combobox').fill(query);
  }

  async closePalette(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.palette).toBeHidden();
  }

  /** Пункт палитры по точному названию команды. */
  paletteOption(title: string): Locator {
    return this.palette.getByRole('option', { name: title, exact: true });
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
