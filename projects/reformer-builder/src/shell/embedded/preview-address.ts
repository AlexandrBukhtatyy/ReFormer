/**
 * Адреса превью: что билдер, встроенный в приложение, знает о самом приложении.
 *
 * Знает он два адреса — страницы, с которой его включили, и «стенда», по которому приложение
 * рисует одну форму без остальной страницы, — и один признак: документ открыт в рамке превью.
 * Всё остальное об устройстве приложения ему неизвестно намеренно.
 *
 * ## Стенд — тот же адрес страницы с параметром
 *
 * Отдельного маршрута под стенд нет: маршруты принадлежат приложению, и завести свой значило бы
 * вмешаться в его маршрутизатор. Параметр в строке запроса маршрутизаторы пропускают, а читает
 * его компонент билдера, стоящий в приложении ВЫШЕ маршрутов: увидев параметр внутри рамки
 * превью, он рисует вместо приложения одну форму.
 *
 * ## Параметр несёт путь модуля, а не адрес
 *
 * В адресе — путь файла от корня открытого проекта (`src/forms/contact/index.tsx`). В адрес
 * для загрузки его превращает уже стенд: какой префикс у проекта на dev-сервере, знает
 * компонент в приложении, и знает одинаково по обе стороны рамки — это один и тот же код.
 * Заодно параметром нельзя подсунуть чужой адрес: путь, уводящий с источника страницы,
 * стенд не загрузит.
 *
 * Модуль чистый: `window` сюда не попадает, только то, что из него прочитано.
 *
 * @module shell/embedded/preview-address
 */

import {
  APP_PREVIEW_FRAME_NAME,
  toDisposable,
  type AppPreviewService,
  type Disposable,
} from '@reformer/builder-plugin-api/internal';

/** Параметр адреса стенда: путь модуля формы от корня открытого проекта. */
export const FORM_STAND_PARAM = 'reformer-builder-form';

/** Адрес страницы в объёме, который здесь нужен. `window.location` подходит структурно. */
export interface PageLocation {
  readonly origin: string;
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
}

/** Открыт ли документ в рамке превью билдера. */
export function isPreviewFrame(frame: { readonly name: string }): boolean {
  return frame.name === APP_PREVIEW_FRAME_NAME;
}

/** Путь модуля формы, который просят показать на стенде; `null` — это обычная страница. */
export function standRequest(search: string): string | null {
  const value = new URLSearchParams(search).get(FORM_STAND_PARAM);
  return value === null || value === '' ? null : value;
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

/** Путь от корня проекта без ведущих слэшей и с прямыми разделителями. */
function normalizeModulePath(modulePath: string): string {
  return modulePath.replace(/\\/g, '/').replace(/^\/+/, '');
}

/** Адрес стенда для модуля формы — на той же странице, с которой включили билдер. */
export function formUrlOf(location: PageLocation, modulePath: string): string {
  const params = new URLSearchParams(searchWithoutStand(location.search));
  params.set(FORM_STAND_PARAM, normalizeModulePath(modulePath));
  return `${location.origin}${location.pathname}?${params.toString()}`;
}

/**
 * Адрес, по которому dev-сервер отдаёт модуль формы, либо `null`, если путь уводит с источника.
 *
 * @param projectBase Префикс, под которым сервер отдаёт открытую в билдере папку. `/` — папка
 * совпадает с корнем dev-сервера.
 */
export function moduleUrlOf(
  origin: string,
  projectBase: string,
  modulePath: string
): string | null {
  const base = `/${projectBase.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');
  let url: URL;
  try {
    url = new URL(base + normalizeModulePath(modulePath), origin);
  } catch {
    return null;
  }
  // Путь из адресной строки — данные извне. Модуль с чужого источника и выход над префикс
  // проекта стенд не загружает: первое — чужой код, второе — не файл проекта.
  if (url.origin !== origin || !url.pathname.startsWith(base)) return null;
  return url.href;
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

/** Служба адресов для панели превью — поверх текущего адреса страницы. */
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
