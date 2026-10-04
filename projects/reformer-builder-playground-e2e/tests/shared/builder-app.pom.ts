/**
 * Билдер как страница: оболочка, общая для всех тестов.
 *
 * Здесь только то, что принадлежит оболочке и встречается в каждом сценарии: стартовая страница,
 * дерево проекта, вкладки, строка состояния, палитра команд. Локаторы редакторов (схема ReFormer,
 * форма RJSF) живут в самих тестах — у каждого плагина своя разметка, и общий объект на всё
 * стал бы свалкой.
 *
 * Строки — русские: локаль закреплена конфигом playground (`.ui_builder/config.json`).
 *
 * @module tests/shared/builder-app.pom
 */

import { expect, type Locator, type Page } from '@playwright/test';
import type { PlaygroundDisk, SeedOptions } from './playground-disk';

declare global {
  interface Window {
    /** Тексты показанных уведомлений — пишет init-скрипт {@link BuilderApp.recordNotifications}. */
    __e2eNotifications?: string[];
  }
}

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

  /**
   * Включает запись уведомлений. Зовётся до первой навигации — как подмена выбора каталога.
   *
   * Уведомление живёт на экране около четырёх секунд, поэтому «сейчас их нет» ничего не говорит
   * о том, были ли они: проверка, которая ждёт пустого списка, дождётся его и после
   * предупреждения. Записываются все появившиеся — см. {@link shownNotifications}.
   */
  async recordNotifications(): Promise<void> {
    await this.page.addInitScript(() => {
      const shown: string[] = [];
      window.__e2eNotifications = shown;
      const record = (node: Node): void => {
        if (!(node instanceof Element)) return;
        // `data-sonner-toast` — разметка библиотеки уведомлений: строка списка в области
        // «Уведомления». Узел может прийти и сам, и внутри только что вставленного списка.
        const toasts = node.matches('[data-sonner-toast]')
          ? [node]
          : [...node.querySelectorAll('[data-sonner-toast]')];
        for (const toast of toasts) shown.push(toast.textContent ?? '');
      };
      new MutationObserver((mutations) => {
        for (const mutation of mutations) mutation.addedNodes.forEach(record);
      }).observe(document, { childList: true, subtree: true });
    });
  }

  /** Тексты всех уведомлений с последней загрузки страницы — включая уже исчезнувшие. */
  shownNotifications(): Promise<string[]> {
    return this.page.evaluate(() => [...(window.__e2eNotifications ?? [])]);
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
  async openPlayground(seed: SeedOptions = {}): Promise<void> {
    await this.goto();
    await this.disk.seed(seed);
    await this.openFolder();
  }

  /**
   * «Открыть папку…» на уже открытом билдере — когда тест сначала правит «диск»:
   * `goto()`, `disk.seed()`, правка, затем этот шаг.
   */
  async openFolder(): Promise<void> {
    await this.openFolderButton.click();
    await expect(this.projectTree).toBeVisible();
    await expect(this.statusBar).toContainText('Всё сохранено');
    // Конфиг проекта и плагины из `.ui_builder/plugins` читаются ПОЗЖЕ, отдельной цепочкой:
    // сюда она ещё могла не дойти. Кому нужен её итог — ждёт {@link projectPluginsReady}.
  }

  /**
   * Ждёт конца цепочки открытия проекта: конфиг и настройки прочитаны, плагины каталога подняты.
   *
   * Признак — команда плагина `playground-hello` в палитре: плагины проекта поднимаются
   * последним шагом цепочки. Палитра собирает пункты при открытии, поэтому она переоткрывается,
   * пока команды нет.
   */
  async projectPluginsReady(): Promise<void> {
    await expect(async () => {
      await this.openPalette('Playground Hello');
      try {
        await expect(this.paletteOption('Playground Hello: привет')).toBeVisible({
          timeout: 1_000,
        });
      } finally {
        await this.closePalette();
      }
    }).toPass();
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
