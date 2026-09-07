/**
 * Запрет исполнения по источнику — главное правило безопасности превью.
 *
 * Проверяется ровно то, что записано в контракте Э8: поверхность с `executesCode: true`
 * не монтируется, если источник исполнять свой код не разрешил. Тест намеренно перебирает
 * все четыре комбинации, а не только «запрещающую»: половина ценности правила в том, что
 * оно НЕ мешает поверхностям, которые ничего не исполняют.
 *
 * @module plugins/preview/schema/source-guard.test
 */

import { describe, expect, it } from 'vitest';
import type { PreviewCapabilities } from '../contract';
import { canMountSurface, refusalMessageKey } from './source-guard';

function capabilities(executesCode: boolean): PreviewCapabilities {
  return { interactive: true, hitTest: true, dragSource: false, executesCode, sameRealm: true };
}

describe('canMountSurface', () => {
  it('исполняющая поверхность НЕ монтируется на источнике без права исполнения', () => {
    expect(canMountSurface(capabilities(true), { executesCode: false })).toEqual({
      allowed: false,
      reason: 'source-forbids-code',
    });
  });

  it('исполняющая поверхность монтируется, когда источник разрешил', () => {
    expect(canMountSurface(capabilities(true), { executesCode: true })).toEqual({ allowed: true });
  });

  it('неизвестный источник — это отказ, а не разрешение', () => {
    expect(canMountSurface(capabilities(true), null)).toEqual({
      allowed: false,
      reason: 'source-unknown',
    });
  });

  it('не исполняющая поверхность монтируется всегда, включая неизвестный источник', () => {
    expect(canMountSurface(capabilities(false), { executesCode: false })).toEqual({
      allowed: true,
    });
    expect(canMountSurface(capabilities(false), null)).toEqual({ allowed: true });
  });
});

describe('refusalMessageKey', () => {
  it('причина отказа адресует сообщение словаря', () => {
    expect(refusalMessageKey('source-forbids-code')).toBe('refusal.source-forbids-code');
    expect(refusalMessageKey('source-unknown')).toBe('refusal.source-unknown');
  });
});
