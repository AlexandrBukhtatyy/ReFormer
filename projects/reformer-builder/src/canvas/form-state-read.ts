/**
 * Чтение состояния живой формы по модели: значение листа плюс его form-node (`valid`, `touched`,
 * `dirty`, `disabled`, `errors`).
 *
 * Почему через `getNodeForSignal`, а не обходом формы: у листа модели и его ноды один и тот же
 * сигнал, и реестр `сигнал → нода` — единственный шов, который работает одинаково для верхнего
 * уровня, вложенных групп и элементов массивов. Обход `FormProxy` пришлось бы писать под каждый
 * вид ноды заново.
 *
 * Все чтения делаются ВНУТРИ `effect` вызывающего: обращение к `.value` там = подписка ровно на
 * этот сигнал, поэтому панель перерисовывается только на реальные изменения.
 *
 * @module reformer-builder/canvas/form-state-read
 */

import { getNodeForSignal, type FormModel } from '@reformer/core';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Ошибка поля в том виде, в каком её показывает панель. */
export interface FieldError {
  code: string;
  message: string;
}

/** Снимок одного листа модели. */
export interface FieldSnapshot {
  /** Дот-путь (`passport.series`). */
  path: string;
  /** Значение, приведённое к короткой строке. */
  display: string;
  /** Пометки состояния: `touched`, `dirty`, `disabled`, `pending`, `invalid`. */
  flags: string[];
  errors: FieldError[];
}

/** Похоже ли значение на сигнал (лист модели). */
function isSignal(v: unknown): v is { value: unknown } {
  return typeof v === 'object' && v !== null && 'value' in (v as Record<string, unknown>);
}

/** Дот-пути всех листьев по снимку модели (`model.get()`). Массивы — лист целиком. */
export function modelLeafPaths(shape: unknown, prefix = ''): string[] {
  if (shape === null || typeof shape !== 'object' || Array.isArray(shape)) {
    return prefix ? [prefix] : [];
  }
  const out: string[] = [];
  for (const [key, value] of Object.entries(shape as Record<string, unknown>)) {
    out.push(...modelLeafPaths(value, prefix ? `${prefix}.${key}` : key));
  }
  return out;
}

/** Короткое представление значения для колонки «Значение». */
function display(value: unknown): string {
  if (value === '' || value === null || value === undefined) return '—';
  if (typeof value === 'string') return value.length > 60 ? `${value.slice(0, 57)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.length}]`;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return '{…}';
}

/**
 * Снимок листа по дот-пути. Читает `.value` сигнала и сигналы его ноды — вызывать только внутри
 * `effect`, иначе подписки не установятся.
 */
export function fieldSnapshot(
  model: FormModel<Record<string, unknown>>,
  path: string
): FieldSnapshot {
  const signal = path.split('.').reduce<any>((acc, seg) => (acc == null ? acc : acc[seg]), model);
  const value = isSignal(signal) ? signal.value : undefined;

  const node = isSignal(signal) ? getNodeForSignal(signal as any) : undefined;
  const flags: string[] = [];
  let errors: FieldError[] = [];

  if (node) {
    if (node.invalid.value) flags.push('invalid');
    if (node.touched.value) flags.push('touched');
    if (node.dirty.value) flags.push('dirty');
    if (node.disabled.value) flags.push('disabled');
    if (node.pending.value) flags.push('pending');
    errors = node.errors.value.map((e) => ({
      code: String((e as { code?: unknown }).code ?? 'error'),
      message: String((e as { message?: unknown }).message ?? ''),
    }));
  } else {
    // Путь есть в модели, но form-node под него не создан — верный признак, что узел схемы не
    // привязан к этому `$model`-пути. Показываем явно, а не молча пустой строкой.
    flags.push('нет form-node');
  }

  return { path, display: display(value), flags, errors };
}
