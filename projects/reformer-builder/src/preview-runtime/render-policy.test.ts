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
import { toDescriptor } from '../kits/descriptor';
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

/**
 * Шов «политика параметризована китом» — не рефакторингом единым. Дескриптор чужого кита должен
 * менять РЕШЕНИЯ, а не только откуда читаются константы.
 */
describe('чужой кит: решения следуют дескриптору, а не дефолтам ui-kit', () => {
  const acme = toDescriptor({
    version: '2.0',
    components: [
      // Свой Dialog чужой кит рисует вживую — allowlist билдера ему не указ.
      { name: 'Dialog', role: 'container', propsSchema: {}, preview: { mode: 'live' } },
      // А свой Toast, наоборот, запрещает.
      {
        name: 'Toast',
        role: 'container',
        propsSchema: {},
        preview: { mode: 'limited', reason: 'нужен ToastProvider' },
      },
      { name: 'Fancy', role: 'container', propsSchema: {}, subpath: 'fancy' },
    ],
    kit: { id: 'acme', package: '@acme/ds', resolve: { fieldSuffix: 'Control' } },
  });

  const entry = (name: string, role: 'field' | 'container' = 'container', exportName?: string) =>
    ({
      name,
      role,
      propsSchema: {},
      ...(exportName ? { exportName } : {}),
    }) as unknown as CatalogEntry;

  it('поле резолвится по суффиксу кита, а не по ${name}Field', () => {
    const InputControl = () => null;
    expect(classify(entry('Input', 'field'), { InputControl }, acme)).toEqual({
      policy: 'live',
      component: InputControl,
    });
    // Суффикс ui-kit для этого кита ничего не значит.
    expect(classify(entry('Input', 'field'), { InputField: () => null }, acme).policy).toBe(
      'limited'
    );
  });

  it('exportName записи переопределяет правило кита', () => {
    const ChartContainer = () => null;
    expect(
      classify(entry('Chart', 'container', 'ChartContainer'), { ChartContainer }, acme)
    ).toEqual({ policy: 'live', component: ChartContainer });
  });

  it('явный preview: live снимает запрет, унаследованный от дефолтов билдера', () => {
    const Dialog = () => null;
    expect(classify(entry('Dialog'), { Dialog }, acme)).toEqual({
      policy: 'live',
      component: Dialog,
    });
  });

  it('свой запрет кита действует даже при наличии компонента в namespace', () => {
    const Toast = () => null;
    expect(classify(entry('Toast'), { Toast }, acme)).toEqual({
      policy: 'limited',
      reason: 'нужен ToastProvider',
    });
  });

  it('причина «не нашлось» берётся из subpath записи и называет пакет кита', () => {
    expect(classify(entry('Fancy'), {}, acme)).toEqual({
      policy: 'limited',
      reason: 'subpath-only: fancy',
    });
    expect(classify(entry('Unknown'), {}, acme)).toEqual({
      policy: 'limited',
      reason: 'не резолвится в @acme/ds',
    });
  });
});
