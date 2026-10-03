/**
 * Локали cdk: словари, три вида поставки и строки компонентов по активному языку.
 *
 * Живые сценарии (статус в aria-live после добавления файла, смена языка без перемонтирования,
 * запасной текст ошибки загрузки) требуют эффектов и идут в браузерном прогоне билдера —
 * `projects/reformer-builder/src/shell/boot/integration/cdk-locale.browser.test.tsx`.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  createLocaleLoader,
  I18nProvider,
  translateBuiltin,
  validateLocale,
} from '@reformer/core/i18n';
import { en as coreEn } from '@reformer/core/locale/en';
import { ru as coreRu } from '@reformer/core/locale/ru';
import { FileUpload } from '../components/file-upload/FileUpload';
import { useFileUpload } from '../components/file-upload/useFileUpload';
import type { FileUploadItem } from '../components/file-upload/types';
import { en } from './en';
import cdkEn from '../i18n/en.json';
import { CDK_LOCALES, loadCdkLocale } from './index';
import { ru } from './ru';
import cdkRu from '../i18n/ru.json';

describe('словари cdk', () => {
  it('русский словарь повторяет английский: те же ключи, разбор, те же аргументы', () => {
    expect(validateLocale(cdkRu, cdkEn)).toEqual([]);
    expect(validateLocale(cdkEn)).toEqual([]);
  });

  it('все ключи — в пространстве имён cdk.<компонент>.<имя>', () => {
    for (const key of Object.keys(cdkEn))
      expect(key).toMatch(/^cdk\.[a-z][A-Za-z]*\.[a-z][A-Za-z]*$/);
  });

  it('локаль накопительная: словарь ядра плюс строки cdk, служебные поля — от ядра', () => {
    expect(en.code).toBe('en');
    expect(ru.code).toBe('ru');
    expect(ru.weekStartsOn).toBe(coreRu.weekStartsOn);
    expect(ru.messages).toEqual({ ...coreRu.messages, ...cdkRu });
    expect(en.messages).toEqual({ ...coreEn.messages, ...cdkEn });
  });

  it('русские строки посимвольно совпадают с прежними зашитыми', () => {
    const t = (key: keyof typeof cdkEn, values?: Record<string, string | number>) =>
      translateBuiltin(ru, cdkEn, key, values);
    expect(t('cdk.fileUpload.added', { count: 1, name: 'a.png' })).toBe('Файл a.png добавлен');
    expect(t('cdk.fileUpload.added', { count: 3, name: 'a.png' })).toBe('Добавлено файлов: 3');
    expect(t('cdk.fileUpload.rejected', { count: 1, name: 'a.png' })).toBe('Файл a.png отклонён');
    expect(t('cdk.fileUpload.rejected', { count: 2, name: 'a.png' })).toBe('Отклонено файлов: 2');
    expect(t('cdk.fileUpload.removed', { name: 'a.png' })).toBe('Файл a.png удалён');
    expect(t('cdk.fileUpload.cleared')).toBe('Список файлов очищен');
    expect(t('cdk.fileUpload.uploaded', { name: 'a.png' })).toBe('Файл a.png загружен');
    expect(t('cdk.fileUpload.uploadAborted', { name: 'a.png' })).toBe('Загрузка a.png прервана');
    expect(t('cdk.fileUpload.uploadFailed', { name: 'a.png' })).toBe('Ошибка загрузки a.png');
    expect(t('cdk.fileUpload.removeFile', { name: 'a.png' })).toBe('Удалить файл a.png');
    expect(t('cdk.fileUpload.retryUpload', { name: 'a.png' })).toBe(
      'Повторить загрузку файла a.png'
    );
    expect(t('cdk.asyncBoundary.unknownError')).toBe('Неизвестная ошибка');
  });

  it('имя файла подставляется как есть: фигурные скобки и апострофы в нём — не разметка', () => {
    const name = "it's {draft}.png";
    expect(translateBuiltin(en, cdkEn, 'cdk.fileUpload.removeFile', { name })).toBe(
      `Remove file ${name}`
    );
  });
});

describe('loadCdkLocale', () => {
  it('отдаёт тот же объект локали, что и синхронный модуль', async () => {
    expect(CDK_LOCALES).toEqual(['en', 'ru']);
    expect(await loadCdkLocale('ru')).toBe(ru);
    expect(await loadCdkLocale('en')).toBe(en);
  });

  it('региональный код сводится к языку, незнакомый язык — пусто', async () => {
    expect(await loadCdkLocale('ru-RU')).toBe(ru);
    expect(await loadCdkLocale('de')).toBeNull();
  });

  it('встаёт источником в createLocaleLoader; правки приложения ложатся поверх', async () => {
    const load = createLocaleLoader([
      loadCdkLocale,
      () => ({ 'cdk.fileUpload.cleared': 'Файлы убраны' }),
    ]);
    const locale = await load('ru');
    expect(locale.code).toBe('ru');
    expect(locale.messages['cdk.fileUpload.cleared']).toBe('Файлы убраны');
    expect(locale.messages['cdk.fileUpload.removed']).toBe(cdkRu['cdk.fileUpload.removed']);
    expect(locale.messages['validation.required']).toBe(coreRu.messages['validation.required']);
  });
});

describe('строки компонентов', () => {
  const errorItem: FileUploadItem = {
    key: 'k1',
    status: 'error',
    file: new File([new Uint8Array(10)], 'broken.txt', { type: 'text/plain' }),
    error: { code: 'uploadFailed', message: '' },
  };

  function Labels() {
    const upload = useFileUpload({});
    return (
      <p>
        {upload.getItemDeleteTriggerProps(errorItem)['aria-label']}|
        {upload.getItemRetryTriggerProps(errorItem)['aria-label']}|{upload.liveMessage}
      </p>
    );
  }

  it('без I18nProvider подписи кнопок английские, статус пуст', () => {
    expect(renderToStaticMarkup(<Labels />)).toBe(
      '<p>Remove file broken.txt|Retry upload of broken.txt|</p>'
    );
  });

  it('под русской локалью — русские', () => {
    expect(
      renderToStaticMarkup(
        <I18nProvider locale={ru}>
          <Labels />
        </I18nProvider>
      )
    ).toBe('<p>Удалить файл broken.txt|Повторить загрузку файла broken.txt|</p>');
  });

  it('локаль без строк cdk (например, только ядро) оставляет подписи английскими', () => {
    expect(
      renderToStaticMarkup(
        <I18nProvider locale={coreRu}>
          <Labels />
        </I18nProvider>
      )
    ).toBe('<p>Remove file broken.txt|Retry upload of broken.txt|</p>');
  });

  const report = new File([new Uint8Array(1536)], 'report.pdf', { type: 'application/pdf' });

  const tree = (
    <FileUpload.Root value={[report]}>
      <FileUpload.ItemGroup>
        {(item) => (
          <FileUpload.Item key={item.key} item={item}>
            <FileUpload.ItemSize />
            <FileUpload.ItemDeleteTrigger>×</FileUpload.ItemDeleteTrigger>
          </FileUpload.Item>
        )}
      </FileUpload.ItemGroup>
    </FileUpload.Root>
  );

  it('FileUpload.ItemSize и кнопка удаления: число, единица и подпись — по языку', () => {
    const english = renderToStaticMarkup(tree);
    expect(english).toContain('1.5 KB');
    expect(english).toContain('aria-label="Remove file report.pdf"');

    const russian = renderToStaticMarkup(<I18nProvider locale={ru}>{tree}</I18nProvider>);
    expect(russian).toContain('1,5 КБ');
    expect(russian).toContain('aria-label="Удалить файл report.pdf"');
  });
});
