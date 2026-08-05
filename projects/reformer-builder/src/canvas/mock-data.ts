/**
 * Эффективный мок вкладки для runtime/live-превью: правки пользователя из нижней панели
 * ({@link TabState.mock} — по JSON-тексту на секцию: «Модель» → `model`, «Registry» →
 * `dataSources`) либо синтез из схемы ({@link synthMock}). Секции независимы: битый/непредметный
 * JSON одной из них деградирует к синтезу именно этой секции (превью не должно ломаться от правки
 * в панели, и правка модели не роняет источники).
 *
 * @module reformer-builder/canvas/mock-data
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type { MockDraft, MockSection } from '../store';
import { synthMock, type MockData } from '../preview-runtime';

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Распарсить текст секции; `undefined`, если текста нет либо он не объект/битый. */
function parseSection(text: string | undefined): Record<string, unknown> | undefined {
  if (text == null) return undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    return isObj(parsed) ? parsed : undefined;
  } catch {
    return undefined; // невалидный JSON — синтез
  }
}

/** Мок вкладки: правки секций (каждая с добором синтезом) либо чистый синтез из схемы. */
export function effectiveMock(schema: JsonFormSchema, draft: MockDraft | undefined): MockData {
  if (draft?.model == null && draft?.dataSources == null) return synthMock(schema);
  const synth = synthMock(schema);
  return {
    model: parseSection(draft.model) ?? synth.model,
    dataSources: parseSection(draft.dataSources) ?? synth.dataSources,
  };
}

/** Сериализовать одну секцию мока для редактора панели (канонический отступ). */
export function serializeSection(mock: MockData, section: MockSection): string {
  return JSON.stringify(mock[section], null, 2);
}
