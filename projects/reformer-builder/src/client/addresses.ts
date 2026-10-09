/**
 * Адреса и имена, по которым страница приложения и билдер находят друг друга.
 *
 * Клиент билдера живёт в документе приложения и ничего из билдера не импортирует, а договор
 * у них общий: где билдер лежит на dev-сервере, как называются его рамки и каким параметром
 * приложение просят показать одну форму. Всё это — здесь, чистыми значениями и функциями:
 * `window` сюда не попадает, только то, что из него прочитано.
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
 * компонент в приложении. Заодно параметром нельзя подсунуть чужой адрес: путь, уводящий
 * с источника страницы, стенд не загрузит.
 *
 * @module client/addresses
 */

/** Адрес билдера на dev-сервере приложения — тот, под которым его отдаёт плагин Vite. */
export const BUILDER_URL = '/__reformer-builder/';

/** Имя окна рамки, в которой открыт сам билдер. */
export const SHELL_FRAME_NAME = 'reformer-builder-shell';

/**
 * Имя окна рамки превью — `APP_PREVIEW_FRAME_NAME` контракта плагинов.
 *
 * Повторено значением, а не импортом: клиент не тянет в приложение пакет контракта. Что
 * значения совпадают, держит тест.
 */
export const PREVIEW_FRAME_NAME = 'reformer-builder-preview';

/** Параметр адреса стенда: путь модуля формы от корня открытого проекта. */
export const FORM_STAND_PARAM = 'reformer-builder-form';

/** Открыт ли документ в рамке превью билдера. */
export function isPreviewFrame(frame: { readonly name: string }): boolean {
  return frame.name === PREVIEW_FRAME_NAME;
}

/** Открыт ли документ в рамке самого билдера. */
export function isShellFrame(frame: { readonly name: string }): boolean {
  return frame.name === SHELL_FRAME_NAME;
}

/** Путь модуля формы, который просят показать на стенде; `null` — это обычная страница. */
export function standRequest(search: string): string | null {
  const value = new URLSearchParams(search).get(FORM_STAND_PARAM);
  return value === null || value === '' ? null : value;
}

/** Путь от корня проекта без ведущих слэшей и с прямыми разделителями. */
export function normalizeModulePath(modulePath: string): string {
  return modulePath.replace(/\\/g, '/').replace(/^\/+/, '');
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
