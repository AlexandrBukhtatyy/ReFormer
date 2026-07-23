import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  FileUploadBase,
  FileUploadDropzone,
  FileUploadInput,
  FileUploadAvatar,
  FileUploadField,
  FileUploadBaseField,
  FileUploadAvatarField,
  fileUploadAdapter,
  fileUploadSingleAdapter,
} from './index';

/**
 * SSR-тесты вариантов FileUpload (конвенция ui-kit: renderToStaticMarkup, без jsdom).
 * Интерактив (пикер, DnD, загрузка) — в CDK-тестах ядра и e2e.
 */

const png = new File([new Uint8Array(1024)], 'photo.png', { type: 'image/png' });

describe('FileUploadBase (button)', () => {
  it('рендерит data-slot/data-variant, кнопку-триггер и hidden input', () => {
    const html = renderToStaticMarkup(
      <FileUploadBase
        value={null}
        accept=".pdf"
        multiple
        label="Документы"
        placeholder="Приложить"
        hint="PDF до 5 МБ"
      />
    );
    expect(html).toContain('data-slot="file-upload"');
    expect(html).toContain('data-variant="button"');
    expect(html).toContain('Приложить');
    expect(html).toContain('PDF до 5 МБ');
    expect(html).toContain('type="file"');
    expect(html).toContain('accept=".pdf"');
    expect(html).toContain('multiple');
    // label — конвенция FormField: компонент его не отображает и не течёт в DOM
    expect(html).not.toContain('Документы');
    expect(html).not.toContain('label=');
  });

  it('рендерит список файлов на Attachment из value', () => {
    const html = renderToStaticMarkup(<FileUploadBase value={[png]} multiple />);
    expect(html).toContain('data-slot="attachment"');
    expect(html).toContain('photo.png');
    expect(html).toContain('1 КБ');
    expect(html).toContain('data-status="local"');
    expect(html).toContain('aria-label="Удалить файл photo.png"');
  });

  it('preloaded RemoteFileRef[] рендерится как uploaded', () => {
    const html = renderToStaticMarkup(
      <FileUploadBase
        value={[{ id: '42', name: 'contract.pdf', size: 2048 }]}
        multiple
        uploader={() => Promise.reject(new Error('не должен вызываться в SSR'))}
      />
    );
    expect(html).toContain('contract.pdf');
    expect(html).toContain('2 КБ');
    expect(html).toContain('data-status="uploaded"');
  });
});

describe('FileUploadDropzone', () => {
  it('рендерит доступную зону (role=button, tabindex) с подсветкой data-атрибутами', () => {
    const html = renderToStaticMarkup(
      <FileUploadDropzone value={null} placeholder="Бросьте файлы" hint="до 10 МБ" />
    );
    expect(html).toContain('data-variant="dropzone"');
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('Бросьте файлы');
    expect(html).toContain('до 10 МБ');
    expect(html).toContain('border-dashed');
  });

  it('invalid помечает зону aria-invalid (подсветка рамки)', () => {
    expect(renderToStaticMarkup(<FileUploadDropzone value={null} invalid />)).toContain(
      'aria-invalid="true"'
    );
    expect(renderToStaticMarkup(<FileUploadDropzone value={null} />)).not.toContain('aria-invalid');
  });
});

describe('FileUploadInput', () => {
  it('рендерит инпут-зону с placeholder, скрепкой и hidden input', () => {
    const html = renderToStaticMarkup(
      <FileUploadInput value={null} placeholder="Прикрепите файлы" hint="до 5 МБ" multiple />
    );
    expect(html).toContain('data-variant="input"');
    expect(html).toContain('role="button"');
    expect(html).toContain('Прикрепите файлы');
    expect(html).toContain('до 5 МБ');
    expect(html).toContain('aria-label="Выбрать файлы"'); // кнопка-иконка (скрепка)
    expect(html).toContain('type="file"');
    // пусто — крестика очистки нет
    expect(html).not.toContain('Очистить выбранные файлы');
  });

  it('выбранные файлы показываются именами строкой + крестик очистки', () => {
    const html = renderToStaticMarkup(
      <FileUploadInput value={[png, new File([new Uint8Array(1)], 'doc.pdf')]} multiple />
    );
    expect(html).toContain('photo.png, doc.pdf');
    expect(html).toContain('aria-label="Очистить выбранные файлы"');
    expect(html).not.toContain('data-slot="file-upload-placeholder"');
  });

  it('invalid помечает зону aria-invalid', () => {
    expect(renderToStaticMarkup(<FileUploadInput value={null} invalid />)).toContain(
      'aria-invalid="true"'
    );
  });
});

describe('FileUploadAvatar', () => {
  it('рендерит круглую зону с aria-label и camera-плейсхолдером', () => {
    const html = renderToStaticMarkup(<FileUploadAvatar value={null} />);
    expect(html).toContain('data-variant="avatar"');
    expect(html).toContain('data-shape="circle"');
    expect(html).toContain('aria-label="Загрузить изображение"');
    expect(html).toContain('rounded-full');
    // accept по умолчанию — только изображения
    expect(html).toContain('accept="image/*"');
    // single: multiple не выставлен
    expect(html).not.toContain('multiple');
  });

  it('shape=square и кнопка удаления при выбранном файле', () => {
    const html = renderToStaticMarkup(<FileUploadAvatar value={[png]} shape="square" />);
    expect(html).toContain('data-shape="square"');
    expect(html).toContain('aria-label="Удалить файл photo.png"');
  });

  it('invalid помечает зону aria-invalid', () => {
    expect(renderToStaticMarkup(<FileUploadAvatar value={null} invalid />)).toContain(
      'aria-invalid="true"'
    );
  });
});

describe('FileUploadField — диспетчер', () => {
  it('variant=dropzone/input → зона/инпут, по умолчанию → кнопка; variant не течёт в DOM', () => {
    const dropzone = renderToStaticMarkup(<FileUploadField variant="dropzone" value={null} />);
    expect(dropzone).toContain('data-variant="dropzone"');
    const input = renderToStaticMarkup(<FileUploadField variant="input" value={null} />);
    expect(input).toContain('data-variant="input"');
    const button = renderToStaticMarkup(<FileUploadField value={null} />);
    expect(button).toContain('data-variant="button"');
    // bare-атрибут `variant` (в отличие от data-variant) означал бы утечку пропа в DOM
    expect(button).not.toContain(' variant="');
  });

  it('field-версии отбрасывают control (renderer-путь)', () => {
    const html = renderToStaticMarkup(
      <FileUploadBaseField value={null} control={{ id: 1 } as never} />
    );
    expect(html).toContain('data-slot="file-upload"');
    expect(html).not.toContain('control');
  });

  it('AvatarField: single value → массив внутрь, обратно single', () => {
    const html = renderToStaticMarkup(
      <FileUploadAvatarField value={png as never} control={undefined as never} />
    );
    expect(html).toContain('data-variant="avatar"');
    expect(html).toContain('rounded-full');
  });
});

describe('адаптеры — value-маппинг', () => {
  it('fileUploadAdapter: пустой массив → null, null → null', () => {
    expect(fileUploadAdapter.fromEmit([], {})).toBeNull();
    expect(fileUploadAdapter.fromEmit([png], {})).toEqual([png]);
    expect(fileUploadAdapter.toValue(undefined)).toBeNull();
    expect(fileUploadAdapter.toValue([png])).toEqual([png]);
  });

  it('fileUploadSingleAdapter: массив ↔ single', () => {
    expect(fileUploadSingleAdapter.fromEmit([png], {})).toBe(png);
    expect(fileUploadSingleAdapter.fromEmit([], {})).toBeNull();
    expect(fileUploadSingleAdapter.fromEmit(null, {})).toBeNull();
    expect(fileUploadSingleAdapter.toValue(png)).toEqual([png]);
    expect(fileUploadSingleAdapter.toValue(null)).toBeNull();
  });
});
