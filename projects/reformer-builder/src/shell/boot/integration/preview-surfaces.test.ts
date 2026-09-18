/**
 * Поверхности стека ReFormer встречаются с правилом выбора превью-хоста.
 *
 * Правило (`plugins/preview`) и поверхности (`plugins/preview-runtime`) живут в разных
 * плагинах, а плагины друг друга не импортируют. Встречаются они только в собранном
 * приложении — поэтому и проверка здесь, в интеграционных тестах сборки.
 *
 * @module shell/boot/integration/preview-surfaces.test
 */

import { describe, expect, it } from 'vitest';
import { chooseSurface } from '@/plugins/preview';
import {
  builtinSurfaces,
  COMPILING_SURFACE_ID,
  RUNTIME_SURFACE_ID,
} from '@/plugins/preview-runtime';
import { createFakeHost, fakeRef } from '@/plugins/preview-runtime/testing';

const DOC = {
  id: 'fake:form.json',
  ref: fakeRef('fake:form.json'),
  kind: 'model' as const,
  providerId: 'form.schema',
};

const t = (key: string): string => key;

describe('запрет исполнения по источнику доходит до выбора', () => {
  it('на источнике без права исполнения компилирующая недоступна, показывается рантайм', () => {
    const choice = chooseSurface({
      surfaces: builtinSurfaces(createFakeHost(), t),
      doc: DOC,
      source: { executesCode: false },
    });
    expect(choice.surface?.id).toBe(RUNTIME_SURFACE_ID);
    expect(choice.fallback).toEqual({
      requested: COMPILING_SURFACE_ID,
      reason: 'source-forbids-code',
    });
  });

  it('с правом исполнения умолчание — компилирующая', () => {
    const choice = chooseSurface({
      surfaces: builtinSurfaces(createFakeHost(), t),
      doc: DOC,
      source: { executesCode: true },
    });
    expect(choice.surface?.id).toBe(COMPILING_SURFACE_ID);
  });

  it('документ другого стека поверхностей ReFormer не получает вовсе', () => {
    const choice = chooseSurface({
      surfaces: builtinSurfaces(createFakeHost(), t),
      doc: { ...DOC, providerId: 'plain.form' },
      source: { executesCode: true },
    });
    expect(choice.surface).toBeNull();
    expect(choice.options).toEqual([]);
  });
});
