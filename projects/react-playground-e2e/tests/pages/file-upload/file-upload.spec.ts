/**
 * E2E-тесты FileUpload (/examples/file-upload).
 *
 * Покрытие:
 * - FU-001 — выбор через пикер (accepted/rejected, удаление, добавление, дубликаты)
 * - FU-002 — dropzone: drag-and-drop, клавиатура (Enter → пикер), подсветка
 * - FU-003 — immediate upload: прогресс, success/error, retry, значение поля
 * - FU-004 — preloaded RemoteFileRef[] (редактирование) и сериализуемость значения
 * - FU-005 — avatar: выбор, превью, удаление
 * - FU-006 — a11y: aria-live, роли, aria-label кнопок
 *
 * @tag @file-upload
 */

import { test, expect } from '../../shared/test-factory';
import { FileUploadPage, pngFile, pdfFile } from './file-upload-page.pom';

test.describe('FileUpload', { tag: ['@file-upload'] }, () => {
  let fu: FileUploadPage;

  test.beforeEach(async ({ page, perf }) => {
    fu = new FileUploadPage(page, { perf });
    await fu.goto();
  });

  test.describe('FU-001: выбор через пикер (deferred, button)', () => {
    test('FU-001-A: валидный файл попадает в список со статусом local', async () => {
      await fu.selectFiles('documents', [pngFile('photo.png')]);

      await expect(fu.items('documents')).toHaveCount(1);
      await fu.expectItemStatus('documents', 'photo.png', 'local');
      await expect(fu.item('documents', 'photo.png')).toContainText('2 КБ');
      fu.expectNoErrors();
    });

    test('FU-001-B: файл больше лимита отклоняется с сообщением', async () => {
      await fu.selectFiles('documents', [
        pngFile('photo.png'),
        pdfFile('big.pdf', 6 * 1024 * 1024),
      ]);

      await expect(fu.items('documents')).toHaveCount(1);
      await expect(fu.rejections('documents')).toContainText('big.pdf');
      await expect(fu.rejections('documents')).toContainText('Файл больше 5 МБ');
    });

    test('FU-001-C: недопустимый тип отклоняется (accept применяется к отбору)', async () => {
      await fu.selectFiles('documents', [
        { name: 'virus.exe', mimeType: 'application/x-msdownload', buffer: Buffer.alloc(10, 1) },
      ]);

      await expect(fu.items('documents')).toHaveCount(0);
      await expect(fu.rejections('documents')).toContainText('virus.exe');
    });

    test('FU-001-D: повторный выбор ДОБАВЛЯЕТ файлы, дубликат отклоняется', async () => {
      await fu.selectFiles('documents', [pngFile('a.png')]);
      await fu.selectFiles('documents', [pngFile('b.png')]);
      await expect(fu.items('documents')).toHaveCount(2);

      // тот же файл ещё раз → fileExists
      await fu.selectFiles('documents', [pngFile('a.png')]);
      await expect(fu.items('documents')).toHaveCount(2);
      await expect(fu.rejections('documents')).toContainText('a.png');
    });

    test('FU-001-E: удаление файла из списка', async () => {
      await fu.selectFiles('documents', [pngFile('a.png'), pngFile('b.png')]);
      await expect(fu.items('documents')).toHaveCount(2);

      await fu.removeItem('documents', 'a.png');
      await expect(fu.items('documents')).toHaveCount(1);
      await expect(fu.item('documents', 'b.png')).toBeVisible();
    });

    test('FU-001-F: maxFiles — лишние отклоняются, не весь выбор', async () => {
      await fu.selectFiles('documents', [
        pngFile('1.png'),
        pngFile('2.png'),
        pngFile('3.png'),
        pngFile('4.png'),
      ]);

      await expect(fu.items('documents')).toHaveCount(3);
      await expect(fu.rejections('documents')).toContainText('4.png');
    });
  });

  test.describe('FU-002: dropzone', () => {
    test('FU-002-A: drag-and-drop добавляет файлы', async () => {
      await fu.dropFiles('dropzoneFiles', [pngFile('dropped.png'), pdfFile('dropped.pdf')]);

      await expect(fu.items('dropzoneFiles')).toHaveCount(2);
      await fu.expectItemStatus('dropzoneFiles', 'dropped.png', 'local');
    });

    test('FU-002-B: зона — доступная кнопка, Enter открывает пикер', async ({ page }) => {
      const zone = fu.dropzone('dropzoneFiles');
      await expect(zone).toHaveAttribute('role', 'button');
      await expect(zone).toHaveAttribute('tabindex', '0');

      await zone.focus();
      const chooserPromise = page.waitForEvent('filechooser');
      await page.keyboard.press('Enter');
      const chooser = await chooserPromise;
      expect(chooser.isMultiple()).toBe(true);
    });

    test('FU-002-C: клик по зоне открывает пикер', async ({ page }) => {
      const chooserPromise = page.waitForEvent('filechooser');
      await fu.dropzone('dropzoneFiles').click();
      await chooserPromise;
    });
  });

  test.describe('FU-003: immediate upload (uploader)', () => {
    test('FU-003-A: успешная загрузка — прогресс, статус uploaded, дескриптор в значении', async () => {
      await fu.selectFiles('uploadedDocs', [pngFile('photo.png')]);

      // во время загрузки виден progressbar
      await expect(fu.control('uploadedDocs').locator('[role="progressbar"]')).toBeVisible();
      // терминальный статус
      await fu.expectItemStatus('uploadedDocs', 'photo.png', 'uploaded');

      const snapshot = await fu.showSnapshot();
      expect(snapshot).toContain('"uploadedDocs"');
      expect(snapshot).toMatch(/"id":\s*"srv-/);
      fu.expectNoErrors();
    });

    test('FU-003-B: упавшая загрузка — статус error, сообщение, retry', async () => {
      await fu.selectFiles('uploadedDocs', [pngFile('fail.png')]);

      await fu.expectItemStatus('uploadedDocs', 'fail.png', 'error');
      await expect(fu.item('uploadedDocs', 'fail.png')).toContainText('Не удалось загрузить');

      // retry перезапускает загрузку (детерминированно падает снова)
      await fu.retryItem('uploadedDocs', 'fail.png');
      await fu.expectItemStatus('uploadedDocs', 'fail.png', 'uploading');
      await fu.expectItemStatus('uploadedDocs', 'fail.png', 'error');

      // упавший файл в значение поля не попадает
      const snapshot = await fu.showSnapshot();
      expect(snapshot).not.toContain('fail.png');
    });

    test('FU-003-C: удаление во время загрузки прерывает её без ошибок', async () => {
      await fu.selectFiles('uploadedDocs', [pngFile('slow.png')]);
      await fu.expectItemStatus('uploadedDocs', 'slow.png', 'uploading');

      await fu.removeItem('uploadedDocs', 'slow.png');
      await expect(fu.items('uploadedDocs')).toHaveCount(0);
      fu.expectNoErrors();
    });
  });

  test.describe('FU-004: preloaded и сериализуемость', () => {
    test('FU-004-A: preloaded RemoteFileRef[] отображаются как uploaded', async () => {
      await expect(fu.items('preloadedDocs')).toHaveCount(2);
      await fu.expectItemStatus('preloadedDocs', 'договор.pdf', 'uploaded');
      await fu.expectItemStatus('preloadedDocs', 'паспорт.jpg', 'uploaded');
    });

    test('FU-004-B: удаление preloaded-файла уходит в значение формы', async () => {
      await fu.removeItem('preloadedDocs', 'договор.pdf');
      await expect(fu.items('preloadedDocs')).toHaveCount(1);

      const snapshot = await fu.showSnapshot();
      expect(snapshot).not.toContain('договор.pdf');
      expect(snapshot).toContain('паспорт.jpg');
    });

    test('FU-004-C: значение формы сериализуемо (дескрипторы — JSON, File — метка)', async () => {
      const snapshot = await fu.showSnapshot();
      const parsed = JSON.parse(snapshot);
      expect(parsed.preloadedDocs).toEqual([
        expect.objectContaining({ id: 'doc-1', name: 'договор.pdf' }),
        expect.objectContaining({ id: 'doc-2', name: 'паспорт.jpg' }),
      ]);
    });
  });

  test.describe('FU-005: avatar (single image)', () => {
    test('FU-005-A: выбор изображения показывает превью и кнопку удаления', async () => {
      await fu.selectFiles('avatar', [pngFile('me.png')]);

      const avatar = fu.control('avatar');
      await expect(avatar.locator('img')).toBeVisible();
      await expect(avatar.locator('button[aria-label="Удалить файл me.png"]')).toBeVisible();
    });

    test('FU-005-B: повторный выбор заменяет, удаление очищает', async () => {
      await fu.selectFiles('avatar', [pngFile('one.png')]);
      await fu.selectFiles('avatar', [pngFile('two.png')]);
      await expect(
        fu.control('avatar').locator('button[aria-label="Удалить файл two.png"]')
      ).toBeVisible();

      await fu.removeItem('avatar', 'two.png');
      await expect(fu.control('avatar').locator('img')).toHaveCount(0);
    });
  });

  test.describe('FU-007: input-вариант (инпут с кнопкой-иконкой)', () => {
    test('FU-007-A: пустое поле — placeholder и скрепка; выбор показывает имена строкой', async () => {
      const field = fu.control('attachments');
      await expect(field).toContainText('Прикрепите файлы…');
      await expect(field.locator('button[aria-label="Выбрать файлы"]')).toBeVisible();

      await fu.selectFiles('attachments', [pngFile('a.png'), pngFile('b.png')]);
      await expect(field).toContainText('a.png, b.png');
      await expect(field).not.toContainText('Прикрепите файлы…');
    });

    test('FU-007-B: крестик очищает выбор', async () => {
      await fu.selectFiles('attachments', [pngFile('a.png')]);
      const field = fu.control('attachments');
      await field.locator('button[aria-label="Очистить выбранные файлы"]').click();
      await expect(field).toContainText('Прикрепите файлы…');
      await expect(field.locator('button[aria-label="Очистить выбранные файлы"]')).toHaveCount(0);
    });

    test('FU-007-C: клик по полю открывает пикер', async ({ page }) => {
      const chooserPromise = page.waitForEvent('filechooser');
      await fu.dropzone('attachments').click();
      await chooserPromise;
    });
  });

  test.describe('FU-008: invalid-состояние', () => {
    test('FU-008-A: проп invalid подсвечивает dropzone/input/avatar (aria-invalid)', async ({
      page,
    }) => {
      const showcase = page.locator('[data-testid="invalid-showcase"]');
      await expect(showcase.locator('[aria-invalid="true"]')).toHaveCount(3);
    });

    test('FU-008-B: button-вариант показывает ошибку валидации текстом (FormField.Error)', async ({
      page,
    }) => {
      await fu.validateAll();
      await expect(page.locator('[data-testid="error-documents"]')).toContainText(
        'Приложите хотя бы один файл'
      );
      // после выбора файла и повторной валидации ошибка уходит
      await fu.selectFiles('documents', [pngFile('photo.png')]);
      await fu.validateAll();
      await expect(page.locator('[data-testid="error-documents"]')).toHaveCount(0);
    });
  });

  test.describe('FU-006: доступность', () => {
    test('FU-006-A: aria-live регион объявляет добавление файла', async () => {
      await fu.selectFiles('documents', [pngFile('photo.png')]);
      await expect(fu.liveRegion('documents')).toContainText('photo.png');
    });

    test('FU-006-B: список — role=list, кнопки удаления имеют aria-label с именем', async () => {
      await fu.selectFiles('documents', [pngFile('photo.png')]);
      await expect(fu.control('documents').locator('[role="list"]')).toBeVisible();
      await expect(
        fu.control('documents').locator('button[aria-label="Удалить файл photo.png"]')
      ).toBeVisible();
    });

    test('FU-006-C: страница со скриншотом (визуальный якорь)', async ({ page }) => {
      await fu.selectFiles('documents', [pngFile('photo.png')]);
      await fu.selectFiles('uploadedDocs', [pngFile('ok.png'), pngFile('fail.png')]);
      await fu.expectItemStatus('uploadedDocs', 'ok.png', 'uploaded');
      await fu.expectItemStatus('uploadedDocs', 'fail.png', 'error');
      await page.screenshot({
        path: 'screenshots/file-upload/e2e-final-state.png',
        fullPage: true,
      });
    });
  });
});
