/**
 * Unit-тесты слотов FileUpload — headless-компонента выбора/загрузки файлов.
 *
 * По конвенции CDK: слоты проверяются через `renderToStaticMarkup` с мокнутым
 * контекстом (см. AsyncBoundary.test.tsx); интерактивная логика (отбор, статусы,
 * проекции) — в чистых тестах `file-upload-core.test.ts`; браузерное поведение
 * (пикер, drag-and-drop, загрузка) — в e2e. SSR-рендер `Root` заодно фиксирует
 * SSR-безопасность (никаких обращений к `window`/`URL` при рендере).
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FileUploadContext, type FileUploadContextValue } from './FileUploadContext';
import { FileUpload } from './FileUpload';
import { makeFileError } from './file-upload-core';
import type { FileUploadItem } from './types';

const localItem: FileUploadItem = {
  key: 'k1',
  status: 'local',
  file: new File([new Uint8Array(1536)], 'report.pdf', { type: 'application/pdf' }),
};

const uploadingItem: FileUploadItem = {
  key: 'k2',
  status: 'uploading',
  file: new File([new Uint8Array(10)], 'photo.png', { type: 'image/png' }),
  progress: 42.4,
};

const errorItem: FileUploadItem = {
  key: 'k3',
  status: 'error',
  file: new File([new Uint8Array(10)], 'broken.txt', { type: 'text/plain' }),
  error: makeFileError('uploadFailed'),
};

const preloadedItem: FileUploadItem = {
  key: 'remote:42',
  status: 'uploaded',
  remote: { id: '42', name: 'contract.pdf', url: 'https://cdn/x/contract.pdf' },
};

function ctx(overrides: Partial<FileUploadContextValue> = {}): FileUploadContextValue {
  const items = overrides.items ?? [];
  return {
    items,
    rejections: [],
    dragging: false,
    focused: false,
    disabled: false,
    maxFilesReached: false,
    uploading: items.some((i) => i.status === 'uploading'),
    liveMessage: '',
    ids: {
      root: 'file-upload-x',
      hiddenInput: 'file-upload-input-x',
      dropzone: 'file-upload-dropzone-x',
      liveRegion: 'file-upload-live-x',
    },
    openFilePicker: () => {},
    addFiles: () => {},
    removeItem: () => {},
    clear: () => {},
    retry: () => {},
    abort: () => {},
    focus: () => {},
    getPreviewUrl: () => null,
    getRootProps: () => ({ id: 'file-upload-x' }),
    getDropzoneProps: () => ({
      id: 'file-upload-dropzone-x',
      role: 'button',
      tabIndex: 0,
      onClick: () => {},
      onKeyDown: () => {},
      onFocus: () => {},
      onBlur: () => {},
    }),
    getTriggerProps: () => ({ type: 'button', disabled: false, onClick: () => {} }),
    getHiddenInputProps: () => ({ ref: () => {}, type: 'file' }),
    getItemGroupProps: () => ({ role: 'list' }),
    getItemProps: (item) => ({ role: 'listitem', 'data-status': item.status }),
    getItemDeleteTriggerProps: (item) => ({
      type: 'button',
      'aria-label': `Удалить файл ${item.status === 'uploaded' ? (item.file?.name ?? item.remote.name) : item.file.name}`,
      disabled: false,
      onClick: () => {},
    }),
    getItemRetryTriggerProps: () => ({
      type: 'button',
      'aria-label': 'Повторить',
      onClick: () => {},
    }),
    getClearTriggerProps: () => ({
      type: 'button',
      disabled: items.length === 0,
      onClick: () => {},
    }),
    getLiveRegionProps: () => ({
      id: 'file-upload-live-x',
      role: 'status',
      'aria-live': 'polite',
      style: {},
    }),
    ...overrides,
  };
}

const render = (value: FileUploadContextValue, node: React.ReactElement) =>
  renderToStaticMarkup(
    <FileUploadContext.Provider value={value}>{node}</FileUploadContext.Provider>
  );

const renderItem = (
  value: FileUploadContextValue,
  item: FileUploadItem,
  children: React.ReactNode
) => render(value, <FileUpload.Item item={item}>{children}</FileUpload.Item>);

describe('FileUpload — слоты', () => {
  it('Trigger — кнопка type=button; asChild мержит пропсы в свой элемент', () => {
    expect(render(ctx(), <FileUpload.Trigger>Выбрать</FileUpload.Trigger>)).toContain(
      'type="button"'
    );
    const html = render(
      ctx(),
      <FileUpload.Trigger asChild>
        <a className="btn">Выбрать</a>
      </FileUpload.Trigger>
    );
    expect(html).toContain('<a');
    expect(html).toContain('class="btn"');
  });

  it('Dropzone — доступная кнопка (role/tabIndex), children внутри', () => {
    const html = render(
      ctx(),
      <FileUpload.Dropzone aria-label="Загрузка">Перетащите файлы</FileUpload.Dropzone>
    );
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Загрузка"');
    expect(html).toContain('Перетащите файлы');
  });

  it('ItemGroup — ul role=list с элементами; пустой список не рендерится', () => {
    expect(
      render(ctx(), <FileUpload.ItemGroup>{(item) => <li key={item.key} />}</FileUpload.ItemGroup>)
    ).toBe('');
    const html = render(
      ctx({ items: [localItem, errorItem] }),
      <FileUpload.ItemGroup>
        {(item) => (
          <FileUpload.Item key={item.key} item={item}>
            <FileUpload.ItemName />
          </FileUpload.Item>
        )}
      </FileUpload.ItemGroup>
    );
    expect(html).toContain('<ul role="list"');
    expect(html).toContain('data-status="local"');
    expect(html).toContain('data-status="error"');
    expect(html).toContain('report.pdf');
    expect(html).toContain('broken.txt');
  });

  it('ItemName/ItemSize — имя и человекочитаемый размер (у preloaded — из дескриптора)', () => {
    const html = renderItem(
      ctx(),
      localItem,
      <>
        <FileUpload.ItemName />
        <FileUpload.ItemSize />
      </>
    );
    expect(html).toContain('report.pdf');
    expect(html).toContain('1.5 КБ');

    const preloaded = renderItem(
      ctx(),
      preloadedItem,
      <>
        <FileUpload.ItemName />
        <FileUpload.ItemSize />
      </>
    );
    expect(preloaded).toContain('contract.pdf');
    expect(preloaded).not.toContain('КБ'); // size неизвестен — слот не рендерится
  });

  it('ItemProgress — только в uploading, целые проценты в aria-valuenow', () => {
    const html = renderItem(ctx(), uploadingItem, <FileUpload.ItemProgress />);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="42"');
    expect(html).toContain('42%');
    expect(renderItem(ctx(), localItem, <FileUpload.ItemProgress />)).not.toContain('progressbar');
  });

  it('ItemPreview — img для image/* с managed URL, фолбэк для остальных', () => {
    const withUrl = ctx({ getPreviewUrl: () => 'blob:preview-1' });
    const img = renderItem(
      withUrl,
      uploadingItem,
      <FileUpload.ItemPreview> икона</FileUpload.ItemPreview>
    );
    expect(img).toContain('<img');
    expect(img).toContain('src="blob:preview-1"');
    // не-изображение → фолбэк, URL даже не запрашивается
    const fallback = renderItem(
      withUrl,
      localItem,
      <FileUpload.ItemPreview>икона</FileUpload.ItemPreview>
    );
    expect(fallback).toContain('икона');
    expect(fallback).not.toContain('<img');
  });

  it('ItemDeleteTrigger — aria-label с именем файла; RetryTrigger только в error', () => {
    const del = renderItem(
      ctx(),
      localItem,
      <FileUpload.ItemDeleteTrigger>×</FileUpload.ItemDeleteTrigger>
    );
    expect(del).toContain('aria-label="Удалить файл report.pdf"');

    expect(
      renderItem(ctx(), localItem, <FileUpload.ItemRetryTrigger>↻</FileUpload.ItemRetryTrigger>)
    ).not.toContain('button');
    expect(
      renderItem(ctx(), errorItem, <FileUpload.ItemRetryTrigger>↻</FileUpload.ItemRetryTrigger>)
    ).toContain('type="button"');
  });

  it('ClearTrigger — заблокирован при пустом списке', () => {
    expect(render(ctx(), <FileUpload.ClearTrigger>Очистить</FileUpload.ClearTrigger>)).toContain(
      'disabled'
    );
    expect(
      render(
        ctx({ items: [localItem] }),
        <FileUpload.ClearTrigger>Очистить</FileUpload.ClearTrigger>
      )
    ).not.toContain('disabled');
  });

  it('слоты вне Root бросают понятную ошибку', () => {
    expect(() => renderToStaticMarkup(<FileUpload.Trigger>x</FileUpload.Trigger>)).toThrow(
      /within <FileUpload.Root>/
    );
    expect(
      () => render(ctx(), <FileUpload.ItemName />) // вне Item
    ).toThrow(/within <FileUpload.Item>/);
  });
});

describe('FileUpload.Root — SSR', () => {
  it('SSR-рендер без DOM-обращений: hidden input + live-регион + слоты', () => {
    const html = renderToStaticMarkup(
      <FileUpload.Root accept="image/*,.pdf" multiple capture="environment">
        <FileUpload.Trigger>Выбрать файлы</FileUpload.Trigger>
        <FileUpload.Dropzone aria-label="Зона загрузки">Бросьте файлы</FileUpload.Dropzone>
        <FileUpload.ItemGroup>{(item) => <li key={item.key} />}</FileUpload.ItemGroup>
      </FileUpload.Root>
    );
    expect(html).toContain('type="file"');
    expect(html).toContain('accept="image/*,.pdf"');
    expect(html).toContain('multiple');
    expect(html).toContain('capture="environment"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('role="button"');
    expect(html).toContain('Выбрать файлы');
  });

  it('disabled: дроп-зона вне таба и aria-disabled, кнопка disabled', () => {
    const html = renderToStaticMarkup(
      <FileUpload.Root disabled>
        <FileUpload.Trigger>Выбрать</FileUpload.Trigger>
        <FileUpload.Dropzone>Зона</FileUpload.Dropzone>
      </FileUpload.Root>
    );
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('disabled');
  });
});
