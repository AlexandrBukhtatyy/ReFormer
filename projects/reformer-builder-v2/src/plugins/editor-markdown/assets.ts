/**
 * Кэш ссылок на картинки предпросмотра.
 *
 * Картинка в markdown — это путь в проекте, а показать её можно, только прочитав файл
 * и завернув байты в `blob:`-URL. Такой URL держит память до `revokeObjectURL`, поэтому все
 * они живут в одном кэше на документ: он же их и освобождает при смене файла или закрытии
 * вкладки. Кэш заодно убирает мигание — при каждой правке текста файл не перечитывается.
 *
 * ## Поколение вместо флага «жив»
 *
 * Чтение асинхронно, а сброс кэша может случиться посреди него. Флаг «уничтожен» тут не
 * работает: после сброса кэш обязан снова работать (React монтирует компоненты повторно —
 * `StrictMode` в разработке), поэтому уничтожения нет, есть номер поколения. Чтение,
 * начатое до сброса, по возвращении видит другое поколение и отзывает свой URL само —
 * иначе он утёк бы, потому что отзывать его больше некому.
 *
 * @module plugins/editor-markdown/assets
 */

import type { MarkdownDocument, MarkdownHost } from './host';
import { directoryOf, resolveRelativePath } from './markdown';

/** Что кэш умеет делать с байтами. Отдельный тип ради тестов: `URL` в `node` есть не всегда. */
export interface BlobFactory {
  create(bytes: Uint8Array, mediaType: string): string;
  revoke(url: string): void;
}

/** Ссылки браузера. Медиатип нужен, иначе `img` не покажет SVG. */
export const browserBlobs: BlobFactory = {
  create: (bytes, mediaType) =>
    // `slice()` вместо самого буфера: `Uint8Array` может быть видом на общий буфер, и `Blob`
    // тогда захватил бы лишнее. Копия здесь дешевле неожиданного расхода памяти.
    URL.createObjectURL(new Blob([bytes.slice().buffer], { type: mediaType })),
  revoke: (url) => {
    URL.revokeObjectURL(url);
  },
};

/** Медиатип по расширению: `Blob` без типа `img` не покажет. */
function mediaTypeOf(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.avif')) return 'image/avif';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

export interface AssetCache {
  /** Ссылка для `img`; `null` — файла нет или путь ведёт за пределы проекта. */
  get(src: string): Promise<string | null>;
  /** Освобождает выданные ссылки. Кэш после этого продолжает работать. */
  dispose(): void;
}

export interface AssetCacheOptions {
  readonly host: Pick<MarkdownHost, 'readBytes' | 'resourceAt'>;
  readonly document: MarkdownDocument;
  readonly blobs?: BlobFactory;
}

export function createAssetCache(options: AssetCacheOptions): AssetCache {
  const { host, document } = options;
  const blobs = options.blobs ?? browserBlobs;
  const baseDir = directoryOf(document.ref.path);
  const urls = new Map<string, Promise<string | null>>();
  let generation = 0;

  const read = async (src: string): Promise<string | null> => {
    const mine = generation;
    const path = resolveRelativePath(baseDir, src);
    if (path === null) return null;

    let bytes: Uint8Array | null;
    try {
      bytes = await host.readBytes(host.resourceAt(document, path));
    } catch {
      // Отсутствующая картинка — обычное дело в чужом README (опечатка в ссылке), а не сбой:
      // предпросмотр покажет подпись вместо изображения и продолжит рисовать текст.
      return null;
    }
    if (bytes === null) return null;

    const url = blobs.create(bytes, mediaTypeOf(path));
    if (mine !== generation) {
      // Пока читали, кэш сбросили: этот URL уже никто не отзовёт, делаем это сами.
      blobs.revoke(url);
      return null;
    }
    return url;
  };

  return {
    get(src) {
      const cached = urls.get(src);
      if (cached !== undefined) return cached;
      const pending = read(src);
      urls.set(src, pending);
      return pending;
    },

    dispose() {
      generation += 1;
      for (const pending of urls.values()) {
        void pending.then((url) => {
          if (url !== null) blobs.revoke(url);
        });
      }
      urls.clear();
    },
  };
}
