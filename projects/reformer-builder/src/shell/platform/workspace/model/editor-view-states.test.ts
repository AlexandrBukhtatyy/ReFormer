/**
 * Хранилище снимков вида: составной ключ и непрозрачность значения.
 *
 * Оба свойства ломаются молча. Общий ключ по документу означал бы, что переключение вида
 * восстанавливает ЧУЖОЙ снимок — текстовому редактору достались бы свёрнутые ветки
 * структурного, — а попытка заглянуть в значение сделала бы платформу зависимой от того,
 * что кладёт редактор. Ни то, ни другое не даёт ошибки: оно даёт неправильно открывшийся файл.
 *
 * @module shell/platform/workspace/model/editor-view-states.test
 */

import { describe, expect, it } from 'vitest';
import { createEditorViewStates } from './editor-view-states';

const DOCUMENT = 'fs:forms/credit/form.json';

describe('createEditorViewStates', () => {
  it('снимки разных редакторов на ОДНОМ документе не смешиваются', () => {
    const states = createEditorViewStates();

    states.forEditor('editor.monaco').record(DOCUMENT, { scrollTop: 120 });
    states.forEditor('editor.schema').record(DOCUMENT, { collapsed: ['узел'] });

    expect(states.forEditor('editor.monaco').peek(DOCUMENT)).toEqual({ scrollTop: 120 });
    expect(states.forEditor('editor.schema').peek(DOCUMENT)).toEqual({ collapsed: ['узел'] });
  });

  it('снимки одного редактора на разных документах не смешиваются', () => {
    const states = createEditorViewStates();
    const slice = states.forEditor('editor.monaco');

    slice.record(DOCUMENT, { scrollTop: 120 });
    slice.record('fs:readme.md', { scrollTop: 0 });

    expect(slice.peek(DOCUMENT)).toEqual({ scrollTop: 120 });
  });

  it('без записи отвечает «нет снимка», а не выдумывает начало', () => {
    expect(createEditorViewStates().forEditor('editor.monaco').peek(DOCUMENT)).toBeUndefined();
  });

  it('виды одного редактора смотрят в ОДНО хранилище, сколько бы их ни взяли', () => {
    // То, ради чего реестр переехал в платформу: раньше «тот же объект» раздавала композиция
    // троим, и второй экземпляр молча терял позицию курсора.
    const states = createEditorViewStates();

    states.forEditor('editor.monaco').record(DOCUMENT, { scrollTop: 7 });

    expect(states.forEditor('editor.monaco').peek(DOCUMENT)).toEqual({ scrollTop: 7 });
  });

  it('забывает снимок только у своего редактора', () => {
    const states = createEditorViewStates();
    states.forEditor('editor.monaco').record(DOCUMENT, { scrollTop: 120 });
    states.forEditor('editor.schema').record(DOCUMENT, { collapsed: [] });

    states.forEditor('editor.monaco').forget(DOCUMENT);

    expect(states.forEditor('editor.monaco').peek(DOCUMENT)).toBeUndefined();
    expect(states.forEditor('editor.schema').peek(DOCUMENT)).toEqual({ collapsed: [] });
  });

  it('значение непрозрачно: что положили, то и отдаётся, без разбора', () => {
    // Платформа в снимок не заглядывает и не может: что там лежит, знает только положивший.
    const states = createEditorViewStates();
    const snapshot = { какое: 'угодно', вложенное: { поле: 1 } };

    states.forEditor('editor.monaco').record(DOCUMENT, snapshot);

    expect(states.forEditor('editor.monaco').peek(DOCUMENT)).toBe(snapshot);
  });
});
