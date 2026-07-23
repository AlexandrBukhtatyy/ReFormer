import { type Page, type Locator, expect } from '@playwright/test';
import type { PerformanceCollector } from '../../shared/performance-collector';

export interface FileUploadPageOptions {
  perf?: PerformanceCollector;
}

/** In-memory файл для setInputFiles — без фикстур на диске. */
export interface MemoryFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/** Валидный однопиксельный PNG (сигнатура + минимальные чанки) + паддинг до нужного размера. */
export function pngFile(name: string, sizeBytes = 2048): MemoryFile {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const padding = Buffer.alloc(Math.max(0, sizeBytes - pngHeader.length));
  return { name, mimeType: 'image/png', buffer: Buffer.concat([pngHeader, padding]) };
}

export function pdfFile(name: string, sizeBytes = 1024): MemoryFile {
  return { name, mimeType: 'application/pdf', buffer: Buffer.alloc(sizeBytes, 1) };
}

/**
 * Page Object Model страницы примеров FileUpload (/examples/file-upload).
 *
 * testId-конвенция FormField: `field-/label-/input-/error-<testId>`;
 * `input-<testId>` — корень компонента (data-slot="file-upload"), hidden
 * `<input type="file">` — внутри него.
 */
export class FileUploadPage {
  readonly page: Page;
  readonly baseUrl = '/examples/file-upload';
  readonly perf?: PerformanceCollector;

  readonly consoleErrors: string[] = [];
  readonly pageErrors: string[] = [];

  constructor(page: Page, options?: FileUploadPageOptions) {
    this.page = page;
    this.perf = options?.perf;

    page.on('console', (msg) => {
      if (msg.type() === 'error') this.consoleErrors.push(msg.text());
    });
    page.on('pageerror', (error) => this.pageErrors.push(error.message));
  }

  private async measure<T>(name: string, action: () => Promise<T>): Promise<T> {
    return this.perf ? this.perf.measure(name, action) : action();
  }

  async goto() {
    return this.measure('goto', async () => {
      await this.page.goto(this.baseUrl);
      await this.page.waitForLoadState('networkidle');
      await expect(this.control('documents')).toBeVisible();
    });
  }

  // ── Локаторы ──────────────────────────────────────────────────────────────

  /**
   * Контейнер поля (обёртка FormField). `input-<testId>` здесь не годится:
   * FormField вешает его на интерактивный элемент (кнопку/зону), а hidden input
   * и список файлов — его соседи внутри field-обёртки.
   */
  control(testId: string): Locator {
    return this.page.locator(`[data-testid="field-${testId}"]`);
  }

  /** Hidden input внутри контрола. */
  hiddenInput(testId: string): Locator {
    return this.control(testId).locator('input[type="file"]');
  }

  /**
   * Дроп-зона контрола: div с явным role=button (нативные кнопки атрибут role
   * не несут, поэтому селектор однозначен). id не годится — FormField
   * перекрывает его своим control-id.
   */
  dropzone(testId: string): Locator {
    return this.control(testId).locator('div[role="button"]');
  }

  /** Айтемы списка файлов (li c data-status). */
  items(testId: string): Locator {
    return this.control(testId).locator('[role="listitem"]');
  }

  /** Айтем по имени файла. */
  item(testId: string, fileName: string): Locator {
    return this.items(testId).filter({ hasText: fileName });
  }

  /** Блок отклонений последнего отбора. */
  rejections(testId: string): Locator {
    return this.control(testId).locator('[data-slot="file-upload-rejections"]');
  }

  /** aria-live регион статусов. */
  liveRegion(testId: string): Locator {
    return this.control(testId).locator('[role="status"][aria-live="polite"]');
  }

  // ── Действия ──────────────────────────────────────────────────────────────

  async selectFiles(testId: string, files: MemoryFile[]) {
    return this.measure(`selectFiles:${testId}`, async () => {
      await this.hiddenInput(testId).setInputFiles(files);
    });
  }

  /** Drag-and-drop файлов в зону через DataTransfer (CDP-безопасный способ). */
  async dropFiles(testId: string, files: MemoryFile[]) {
    const payload = files.map((f) => ({
      name: f.name,
      mimeType: f.mimeType,
      bytes: Array.from(f.buffer),
    }));
    await this.dropzone(testId).evaluate((zone, filesData) => {
      const dt = new DataTransfer();
      for (const f of filesData) {
        dt.items.add(new File([new Uint8Array(f.bytes)], f.name, { type: f.mimeType }));
      }
      zone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: dt }));
      zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }));
      zone.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
    }, payload);
  }

  async removeItem(testId: string, fileName: string) {
    await this.page
      .locator(`[data-testid="field-${testId}"] button[aria-label="Удалить файл ${fileName}"]`)
      .click();
  }

  async retryItem(testId: string, fileName: string) {
    await this.page
      .locator(
        `[data-testid="field-${testId}"] button[aria-label="Повторить загрузку файла ${fileName}"]`
      )
      .click();
  }

  async showSnapshot(): Promise<string> {
    await this.page.locator('[data-testid="button-snapshot"]').click();
    return (await this.page.locator('[data-testid="value-snapshot"]').textContent()) ?? '';
  }

  async validateAll() {
    await this.page.locator('[data-testid="button-validate"]').click();
  }

  // ── Ассерты ───────────────────────────────────────────────────────────────

  async expectItemStatus(testId: string, fileName: string, status: string) {
    await expect(this.item(testId, fileName)).toHaveAttribute('data-status', status);
  }

  expectNoErrors() {
    expect(this.pageErrors).toEqual([]);
  }
}
