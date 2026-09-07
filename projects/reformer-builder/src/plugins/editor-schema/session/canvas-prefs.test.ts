/**
 * Тесты предпочтений канваса.
 *
 * Проверяется то, ради чего предпочтение вынесено из компонента: оно отвечает в том же
 * кадре, переживает отказ хранилища и не путается с чужим значением в настройках.
 *
 * @module plugins/editor-schema/session/canvas-prefs.test
 */

import { describe, expect, it, vi } from 'vitest';
import {
  CANVAS_VIEW_SETTING,
  createCanvasPrefs,
  DEFAULT_CANVAS_VIEW,
  isCanvasView,
  readCanvasView,
} from './canvas-prefs';
import type { SchemaViewSettings } from './view-mode';

function fakeSettings(initial: Record<string, unknown> = {}): SchemaViewSettings & {
  readonly written: [string, unknown][];
} {
  const values = new Map(Object.entries(initial));
  const written: [string, unknown][] = [];
  return {
    written,
    get: <T>(key: string) => values.get(key) as T | undefined,
    set(key, value) {
      written.push([key, value]);
      values.set(key, value);
    },
  };
}

describe('readCanvasView', () => {
  it('чужое значение читается как умолчание', () => {
    expect(readCanvasView('schematic')).toBe('schematic');
    expect(readCanvasView('tree')).toBe('tree');
    expect(readCanvasView('canvas')).toBe('tree');
    expect(readCanvasView(undefined)).toBe('tree');
  });
});

describe('createCanvasPrefs', () => {
  it('первый вопрос отвечает настройкой, дальше — своей копией', () => {
    const settings = fakeSettings({ [CANVAS_VIEW_SETTING]: 'schematic' });
    const prefs = createCanvasPrefs({ settings });
    expect(prefs.view()).toBe('schematic');

    prefs.setView('tree');
    expect(prefs.view()).toBe('tree');
    expect(settings.written).toEqual([[CANVAS_VIEW_SETTING, 'tree']]);
  });

  it('без настроек предпочтение живёт до перезагрузки', () => {
    const prefs = createCanvasPrefs();
    expect(prefs.view()).toBe('tree');
    prefs.setView('schematic');
    expect(prefs.view()).toBe('schematic');
  });

  it('подписчик узнаёт о смене, а повторная запись того же значения его не будит', () => {
    const prefs = createCanvasPrefs();
    const listener = vi.fn();
    const subscription = prefs.subscribe(listener);

    prefs.setView('schematic');
    prefs.setView('schematic');
    expect(listener).toHaveBeenCalledTimes(1);

    subscription.dispose();
    prefs.setView('tree');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('отказ хранилища не мешает переключению', async () => {
    const failing: SchemaViewSettings = {
      get: () => undefined,
      set: () => Promise.reject(new Error('хранилище закрыто')),
    };
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const prefs = createCanvasPrefs({ settings: failing });

    prefs.setView('schematic');
    expect(prefs.view()).toBe('schematic');
    // Отказ приходит следующим тиком: до него переключение уже состоялось.
    await Promise.resolve();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('живая форма как вид конструктора', () => {
  it('распознаётся наравне с деревом и схемой', () => {
    expect(isCanvasView('live')).toBe(true);
    expect(readCanvasView('live')).toBe('live');
  });

  it('умолчанием не становится: её может не быть в этой сборке', () => {
    // Порт живой поверхности даёт композиция, и без плагина превью его нет. Умолчание,
    // которого на половине запусков не существует, — не умолчание.
    expect(DEFAULT_CANVAS_VIEW).not.toBe('live');
  });

  it('запоминается как предпочтение человека', () => {
    const prefs = createCanvasPrefs();
    prefs.setView('live');
    expect(prefs.view()).toBe('live');
  });
});
