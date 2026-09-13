/**
 * Пункты палитры команд, которые вносит плагин.
 *
 * Здесь ВКЛАД и ТОЧКА. Слияние пунктов, ранжирование по запросу и исполнитель запросов живут
 * в оболочке билдера: как искать и в каком порядке показывать — решает она.
 *
 * @module @reformer/builder-plugin-api/ui/menu/palette
 */

import { defineExtensionPoint } from '../../primitives/extension-point';
import type { WhenContext } from '../../primitives/when-context';

/**
 * Пункт палитры.
 *
 * `titleKey` **либо** `title`: первое — для того, что переводится, второе — для динамических
 * данных. Указаны оба — выигрывает `title`: готовая строка уже содержит то, что человек
 * ожидает увидеть, а ключ рядом с ней означает, что вносящий не решил, и молча предпочесть
 * перевод значило бы показать не тот текст.
 */
export interface PaletteItem {
  /** Уникален в пределах палитры. Служит React-ключом и адресом при слиянии. */
  readonly id: string;
  /** Ключ i18n — либо он… */
  readonly titleKey?: string;
  /** …либо готовая строка для динамических данных (имя файла). */
  readonly title?: string;
  /** Пояснение справа: путь, раздел, сочетание клавиш. Участвует в поиске. */
  readonly detail?: string;
  readonly run: () => unknown | Promise<unknown>;
  /** Меньше — выше. По умолчанию `0`. */
  readonly order?: number;
}

/**
 * Поставщик динамических пунктов.
 *
 * `provide` получает запрос и контекст и вправе отвечать асинхронно. Отмены в сигнатуре нет
 * намеренно: поставщик не обязан уметь прерываться, а устаревший ответ отбрасывает вызывающий
 * (см. {@link createPaletteQueryRunner}). Требовать `AbortSignal` от каждого поставщика значило
 * бы усложнить простой случай ради того, что и так решается на стороне палитры.
 */
export interface PaletteItemProvider {
  readonly id: string;
  provide(query: string, ctx: WhenContext): PaletteItem[] | Promise<PaletteItem[]>;
}

/** Точка расширения динамических пунктов палитры. */
export const PaletteItemsPoint = defineExtensionPoint<PaletteItemProvider>('palette.items');
