/**
 * Правило выбора поверхности: ранг по возможностям, откат при отказе источника, переключение.
 *
 * @module plugins/preview/selection.test
 */

import { describe, expect, it, vi } from 'vitest';
import type { DocumentRef } from '@/sdk';
import type { PreviewCapabilities, PreviewSurface } from './contract';
import { chooseSurface, surfaceRank } from './selection';

const DOC: DocumentRef = {
  id: 'fake:form.json',
  ref: {
    id: 'fake:form.json',
    sourceId: 'fake',
    path: 'form.json',
    name: 'form.json',
    kind: 'file',
    mediaType: 'application/json',
  },
  kind: 'model',
};

function surface(
  id: string,
  capabilities: Partial<PreviewCapabilities> = {},
  applies: (doc: DocumentRef) => boolean = () => true
): PreviewSurface {
  return {
    id,
    applies,
    capabilities: {
      interactive: false,
      hitTest: false,
      dragSource: false,
      executesCode: false,
      sameRealm: true,
      ...capabilities,
    },
    mount: () => ({ dispose: () => undefined }),
  };
}

const SKELETON = surface('skeleton', { hitTest: true });
const RUNTIME = surface('runtime', { hitTest: true, interactive: true });
const COMPILING = surface('compiling', { hitTest: true, interactive: true, executesCode: true });
const ALL = [SKELETON, RUNTIME, COMPILING];

describe('surfaceRank', () => {
  it('исполнение кода перевешивает интерактивность вместе с хит-тестом', () => {
    expect(surfaceRank(COMPILING.capabilities)).toBeGreaterThan(surfaceRank(RUNTIME.capabilities));
    expect(surfaceRank(RUNTIME.capabilities)).toBeGreaterThan(surfaceRank(SKELETON.capabilities));
  });

  it('перетаскивание и realm в ранг не входят', () => {
    const withDrag = surface('x', { dragSource: true, sameRealm: false });
    expect(surfaceRank(withDrag.capabilities)).toBe(0);
  });
});

describe('chooseSurface', () => {
  it('по умолчанию берёт самую способную ДОСТУПНУЮ', () => {
    const choice = chooseSurface({ surfaces: ALL, doc: DOC, source: { executesCode: true } });
    expect(choice.surface?.id).toBe('compiling');
    expect(choice.fallback).toBeNull();
    expect(choice.options.map((option) => option.surface.id)).toEqual([
      'compiling',
      'runtime',
      'skeleton',
    ]);
  });

  it('источник без права исполнения откатывает на рантайм и называет причину САМ', () => {
    const choice = chooseSurface({ surfaces: ALL, doc: DOC, source: { executesCode: false } });
    expect(choice.surface?.id).toBe('runtime');
    // Никто ничего не просил — и именно поэтому причина обязана прийти сама: переключателя
    // нет, а форма без исполненной валидации выглядит как форма со сломанной валидацией.
    expect(choice.fallback).toEqual({ requested: 'compiling', reason: 'source-forbids-code' });
  });

  it('недоступная поверхность остаётся в списке — отказ обязан быть виден', () => {
    const choice = chooseSurface({ surfaces: ALL, doc: DOC, source: { executesCode: false } });
    const compiling = choice.options.find((option) => option.surface.id === 'compiling');
    expect(compiling).toEqual({
      surface: COMPILING,
      available: false,
      refusal: 'source-forbids-code',
    });
  });

  it('доступная самая способная причины не рождает: объяснять нечего', () => {
    const choice = chooseSurface({ surfaces: ALL, doc: DOC, source: { executesCode: true } });
    expect(choice.surface?.id).toBe('compiling');
    expect(choice.fallback).toBeNull();
  });

  it('неприменимая к документу поверхность не попадает в переключатель', () => {
    const foreign = surface('foreign', {}, () => false);
    const choice = chooseSurface({
      surfaces: [...ALL, foreign],
      doc: DOC,
      source: { executesCode: true },
    });
    expect(choice.options.map((option) => option.surface.id)).not.toContain('foreign');
  });

  it('упавший applies означает «не берусь», а не отказ всего превью', () => {
    const broken = surface('broken', {}, () => {
      throw new Error('сломался');
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const choice = chooseSurface({
      surfaces: [broken, ...ALL],
      doc: DOC,
      source: { executesCode: true },
    });
    expect(choice.surface?.id).toBe('compiling');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('пустой набор вкладов — законный ответ «показывать нечем»', () => {
    const choice = chooseSurface({ surfaces: [], doc: DOC, source: null });
    expect(choice.surface).toBeNull();
    expect(choice.options).toEqual([]);
  });
});
