/**
 * Эффективный мок вкладки для runtime/live-превью: правки пользователя из панели мок-данных
 * ({@link TabState.mockText}) либо синтез из схемы ({@link synthMock}). Битый/неполный JSON —
 * деградирует к синтезу (превью не должно ломаться от правки в панели).
 *
 * @module reformer-builder/canvas/mock-data
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import { synthMock, type MockData } from '../preview-runtime';

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Мок вкладки: распарсенный `mockText` (с добором синтезом) либо чистый синтез из схемы. */
export function effectiveMock(schema: JsonFormSchema, mockText: string | undefined): MockData {
  if (mockText != null) {
    try {
      const parsed: unknown = JSON.parse(mockText);
      if (isObj(parsed)) {
        return {
          model: isObj(parsed.model) ? parsed.model : {},
          dataSources: isObj(parsed.dataSources) ? parsed.dataSources : {},
        };
      }
    } catch {
      /* невалидный JSON — синтез */
    }
  }
  return synthMock(schema);
}

/** Сериализовать мок для редактора панели (канонический отступ). */
export function serializeMock(mock: MockData): string {
  return JSON.stringify(mock, null, 2);
}
