/**
 * Буфер ресурсов: что скопировано или вырезано в дереве файлов.
 *
 * Здесь ОБЪЯВЛЕНИЕ. Сама служба живёт в оболочке билдера.
 *
 * @module @reformer/builder-plugin-api/services/resource-clipboard
 */

import type { Disposable } from '../primitives/disposable.js';
import type { ResourceId } from '../primitives/resource.js';
import { defineService } from '../primitives/service.js';

/**
 * Что сделали с записями.
 *
 * Различать обязательно: копия оставляет оригинал на месте, перенос — нет. Сейчас вставка
 * умеет только копирование, но вид хранится с самого начала, потому что добавить его позже
 * означало бы, что уже написанные вклады меню знают о буфере не всё.
 */
export type ClipboardMode = 'copy' | 'cut';

/** Снимок буфера. Ссылка стабильна между изменениями — условие `useSyncExternalStore`. */
export interface ClipboardState {
  readonly mode: ClipboardMode;
  readonly items: readonly ResourceId[];
}

export interface ResourceClipboardService {
  /** Кладёт записи в буфер, заменяя предыдущее содержимое. Пустой список очищает буфер. */
  copy(items: readonly ResourceId[]): void;
  /** То же, но с пометкой «вырезано»: вставка обязана перенести, а не скопировать. */
  cut(items: readonly ResourceId[]): void;
  clear(): void;
  /** Содержимое буфера; пустой список — буфер пуст. */
  get(): ClipboardState;
  /** Сколько записей лежит в буфере. Нужен предикатам применимости — им хватает числа. */
  size(): number;
  observe(cb: () => void): Disposable;
}

export const ResourceClipboardServiceToken =
  defineService<ResourceClipboardService>('reformer.clipboard');
