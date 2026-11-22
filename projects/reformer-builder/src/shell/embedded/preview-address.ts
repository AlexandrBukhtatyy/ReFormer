/**
 * Адреса превью со стороны билдера: что он знает о приложении, рядом с которым открыт.
 *
 * Знает он два адреса — страницы приложения и «стенда», по которому приложение рисует одну
 * форму без остальной страницы. Всё остальное об устройстве приложения ему неизвестно намеренно.
 *
 * Читает адреса вторая сторона — клиент билдера в документе приложения (`client/addresses`):
 * параметр стенда и разбор пути у них общие и объявлены там, потому что клиент из билдера
 * ничего не импортирует, а билдер из клиента — вправе.
 *
 * Модуль чистый: `window` сюда не попадает, только то, что из него прочитано.
 *
 * @module shell/embedded/preview-address
 */

import {
  toDisposable,
  type AppPreviewService,
  type Disposable,
} from '@reformer/builder-plugin-api/internal';
import { FORM_STAND_PARAM, normalizeModulePath } from '@/client/addresses';

/** Адрес страницы в объёме, который здесь нужен. `window.location` подходит структурно. */
export interface PageLocation {
  readonly origin: string;
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
}

/** Строка запроса без параметра стенда — с ведущим `?` либо пустая. */
function searchWithoutStand(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(FORM_STAND_PARAM);
  const rest = params.toString();
  return rest === '' ? '' : `?${rest}`;
}

/** Адрес страницы как он есть, но без параметра стенда: стенд — не страница приложения. */
export function pageUrlOf(location: PageLocation): string {
  return `${location.origin}${location.pathname}${searchWithoutStand(location.search)}${location.hash}`;
}

/** Адрес стенда для модуля формы — на той же странице приложения. */
export function formUrlOf(location: PageLocation, modulePath: string): string {
  const params = new URLSearchParams(searchWithoutStand(location.search));
  params.set(FORM_STAND_PARAM, normalizeModulePath(modulePath));
  return `${location.origin}${location.pathname}?${params.toString()}`;
}

/** Источник события «файлы проекта записаны на диск». */
export interface SourceWrites {
  subscribe(listener: () => void): Disposable;
}

/** Событие записи, которое зовёт тот, кто о записи узнал. */
export interface SourceWriteSignal extends SourceWrites {
  emit(): void;
}

export function createSourceWriteSignal(): SourceWriteSignal {
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return toDisposable(() => {
        listeners.delete(listener);
      });
    },
    emit() {
      for (const listener of [...listeners]) {
        try {
          listener();
        } catch (error) {
          // Политика всех хранилищ оболочки: упавший подписчик не мешает остальным.
          console.error('[app-preview] подписчик записи в источник упал', error);
        }
      }
    },
  };
}

/** Служба адресов для панели превью — поверх текущего адреса приложения. */
export function createAppPreviewService(
  location: () => PageLocation,
  writes: SourceWrites
): AppPreviewService {
  return {
    pageUrl: () => pageUrlOf(location()),
    formUrl: (modulePath) => formUrlOf(location(), modulePath),
    onDidWriteSource: (cb) => writes.subscribe(cb),
  };
}
