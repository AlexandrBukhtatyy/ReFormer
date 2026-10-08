/**
 * Что показывает панель превью — решение без React и без рамки.
 *
 * Панель отвечает на один вопрос: какой адрес приложения открыть в рамке. Ответ зависит от
 * режима («форма» или «приложение»), от открытого в билдере файла и от того, лежит ли рядом
 * с ним модуль формы. Всё это — чистые функции: рамке остаётся только открыть адрес.
 *
 * ## Модуль формы — `index.tsx` в каталоге открытого файла
 *
 * Тот самый файл, который печатает кодоген: компонент формы в нём экспортирован по умолчанию,
 * и приложение рисует его на стенде. Что внутри, панель не знает и знать не должна — она
 * передаёт путь, а рисует приложение.
 *
 * Какой модуль показан, решает панель: форма открытого файла, а когда у него своей нет
 * (открыт сервис, которым форма пользуется) — та, что была на экране до него.
 *
 * @module plugins/base/app-preview/model
 */

import type { ResourceRef } from '@reformer/builder-plugin-api';

/** Что показывать: одну форму или приложение целиком. */
export type PreviewMode = 'form' | 'page';

/** Имя модуля формы в её каталоге. */
export const FORM_MODULE_NAME = 'index.tsx';

/**
 * Сколько ждать после записи файла, прежде чем перезагрузить рамку.
 *
 * Запись закончилась раньше, чем dev-сервер приложения её заметил: он следит за файлами
 * и узнаёт о правке с задержкой. Перезагрузка в тот же миг показала бы прежнее.
 */
export const RELOAD_DELAY_MS = 300;

/** Путь модуля формы от корня проекта среди записей каталога; `null` — модуля там нет. */
export function formModulePath(entries: readonly ResourceRef[]): string | null {
  const module = entries.find((entry) => entry.kind === 'file' && entry.name === FORM_MODULE_NAME);
  return module?.path ?? null;
}

/** Что панель показывает на месте рамки. */
export type PreviewTarget =
  | { readonly kind: 'frame'; readonly url: string }
  /** Режим «форма», а файл не открыт: показывать нечего, и это не ошибка. */
  | { readonly kind: 'no-document' }
  /** Режим «форма», файл открыт, но модуля формы рядом нет. */
  | { readonly kind: 'no-module' };

export interface PreviewTargetInput {
  readonly mode: PreviewMode;
  /** Адрес страницы приложения, который сейчас стоит в адресной строке панели. */
  readonly pageAddress: string;
  /** Открыт ли в билдере файл. */
  readonly hasDocument: boolean;
  /** Путь модуля формы открытого файла; `null` — модуля нет. */
  readonly modulePath: string | null;
  /** Адрес стенда по пути модуля. */
  readonly formUrl: (modulePath: string) => string;
}

export function previewTarget(input: PreviewTargetInput): PreviewTarget {
  if (input.mode === 'page') return { kind: 'frame', url: input.pageAddress };
  if (!input.hasDocument) return { kind: 'no-document' };
  if (input.modulePath === null) return { kind: 'no-module' };
  return { kind: 'frame', url: input.formUrl(input.modulePath) };
}

/**
 * Адрес из адресной строки панели — адресом ЭТОГО приложения либо `null`.
 *
 * Человек вправе написать и полный адрес, и путь (`/contacts`): путь достраивается от текущего
 * адреса. Адрес другого источника не принимается: рамка превью показывает запущенное
 * приложение, а не произвольный сайт, и компонент билдера в чужом документе рамку не узнает.
 */
export function resolveAddress(input: string, current: string): string | null {
  const text = input.trim();
  if (text === '') return null;
  let url: URL;
  let base: URL;
  try {
    base = new URL(current);
    url = new URL(text, base);
  } catch {
    return null;
  }
  return url.origin === base.origin ? url.href : null;
}
