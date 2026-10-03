/**
 * Раскрытие описателей сообщений в значении пропсов.
 *
 * @module i18n/resolve-localized
 */

import { Signal } from '@preact/signals-core';
import { isMessageDescriptor } from './descriptor';
import type { MessageValues } from './message-format';
import type { I18nHandle } from './translator';

/** Простой объект-литерал: в него можно заходить. Экземпляры классов и прокси узлов — нельзя. */
function isPlainObject(value: object): value is Record<string, unknown> {
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

/**
 * Значения, внутрь которых обход не заходит: сигналы и узлы дерева `model.$` (у них есть `__path`
 * либо `__kind`), React-элементы (`$$typeof`).
 */
function isOpaque(value: object): boolean {
  if (value instanceof Signal) return true;
  const probe = value as { __path?: unknown; __kind?: unknown; $$typeof?: unknown };
  return probe.$$typeof !== undefined || probe.__path !== undefined || probe.__kind !== undefined;
}

/** Значения подстановок: сигнал читается на месте, остальное — как есть. */
function readValues(
  values: Readonly<Record<string, unknown>> | undefined
): MessageValues | undefined {
  if (values === undefined) return undefined;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(values)) {
    const value = values[key];
    out[key] = value instanceof Signal ? (value.value as unknown) : value;
  }
  return out;
}

/**
 * `path` — объекты на пути от корня до текущего значения. Это защита от цикла, а не «уже
 * видели»: один и тот же массив опций вправе стоять в двух пропсах, и раскрыть его надо оба раза.
 */
function resolve(value: unknown, i18n: I18nHandle, path: Set<object>): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (isMessageDescriptor(value)) {
    return i18n.t(value.key, readValues(value.values), value.defaultMessage);
  }
  // Раньше проверки на массив: узел-массив дерева `model.$` тоже проходит `Array.isArray`.
  if (isOpaque(value) || path.has(value)) return value;

  if (Array.isArray(value)) {
    path.add(value);
    let changed = false;
    const next = value.map((item) => {
      const resolved = resolve(item, i18n, path);
      if (resolved !== item) changed = true;
      return resolved;
    });
    path.delete(value);
    return changed ? next : value;
  }

  if (!isPlainObject(value)) return value;

  path.add(value);
  let next: Record<string, unknown> | undefined;
  for (const key of Object.keys(value)) {
    const item = value[key];
    const resolved = resolve(item, i18n, path);
    if (resolved !== item) {
      next ??= { ...value };
      next[key] = resolved;
    }
  }
  path.delete(value);
  return next ?? value;
}

/**
 * Заменяет описатели сообщений на строки по активной локали. Обходит массивы и простые
 * объекты-литералы — подписи опций, заголовки шагов; сигналы, React-элементы, функции и
 * экземпляры классов (узлы формы) возвращает как есть. Поддерево без описателей сохраняет ссылку:
 * если раскрывать было нечего, возвращается тот же объект.
 *
 * @param value - Пропсы, массив или одиночное значение.
 * @param i18n - Ручка активной локали (`createI18n` / `useI18n`).
 *
 * @example
 * ```ts
 * resolveLocalized({ label: msg('profile.email.label'), options: [{ value: 'a', label: msg('opt.a') }] }, i18n);
 * // { label: 'Почта', options: [{ value: 'a', label: 'Вариант А' }] }
 * ```
 */
export function resolveLocalized<T>(value: T, i18n: I18nHandle): T {
  return resolve(value, i18n, new Set()) as T;
}
