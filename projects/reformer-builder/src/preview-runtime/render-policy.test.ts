/**
 * Полнота render-policy (React-free, node). Стережёт единственную ручную ручку системы — два
 * allowlist'а: они не должны протухать (ссылаться на несуществующие имена) и не пересекаться.
 * Новый ui-kit-компонент заставит осознанно классифицировать (иначе `registry-drift.test.ts`
 * поймает его как нерезолвящийся при живом barrel).
 *
 * @module reformer-builder/preview-runtime/render-policy.test
 */

import { describe, expect, it } from 'vitest';
import { getCatalog, type CatalogEntry } from '../catalog';
import { OVERLAY_LIMITED, SUBPATH_LIMITED, classify, isRegistrable } from './render-policy';

describe('render-policy allowlists', () => {
  const catalog = getCatalog();
  const registrableNames = new Set(catalog.filter(isRegistrable).map((e) => e.name));
  const roleByName = new Map(catalog.map((e) => [e.name, e.role]));

  it('OVERLAY_LIMITED — подмножество registrable-имён каталога (нет протухших)', () => {
    for (const name of OVERLAY_LIMITED) expect(registrableNames.has(name)).toBe(true);
  });

  it('SUBPATH_LIMITED — подмножество registrable-имён каталога (нет протухших)', () => {
    for (const name of SUBPATH_LIMITED.keys()) expect(registrableNames.has(name)).toBe(true);
  });

  it('OVERLAY_LIMITED и SUBPATH_LIMITED не пересекаются', () => {
    for (const name of OVERLAY_LIMITED) expect(SUBPATH_LIMITED.has(name)).toBe(false);
  });

  it('каждый оверлей имеет role container', () => {
    for (const name of OVERLAY_LIMITED) expect(roleByName.get(name)).toBe('container');
  });

  it('каждый SUBPATH_LIMITED несёт непустой reason', () => {
    for (const [, reason] of SUBPATH_LIMITED) expect(reason.trim().length).toBeGreaterThan(0);
  });
});

describe('политика частей compound', () => {
  const entry = (name: string, compoundParent?: string) =>
    ({
      name,
      role: 'container',
      propsSchema: {},
      ...(compoundParent ? { compoundParent } : {}),
    }) as unknown as CatalogEntry;

  it('часть оверлея — стаб, даже если резолвится в barrel', () => {
    const ns = { DialogTitle: () => null };
    expect(classify(entry('DialogTitle', 'Dialog'), ns).policy).toBe('limited');
  });

  it('часть subpath-only корня наследует его причину (не резолвится из barrel)', () => {
    const policy = classify(entry('CarouselItem', 'Carousel'), {});
    expect(policy).toEqual({ policy: 'limited', reason: SUBPATH_LIMITED.get('Carousel') });
  });

  it('часть обычного корня рисуется живьём', () => {
    const AlertTitle = () => null;
    expect(classify(entry('AlertTitle', 'Alert'), { AlertTitle })).toEqual({
      policy: 'live',
      component: AlertTitle,
    });
  });
});
