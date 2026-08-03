/**
 * Гарантия «есть в палитре ⇒ зарегистрирован» (React-free, node). Симулирует дроп КАЖДОГО элемента
 * каталога (`entry.makeNode()`) в схему и проверяет, что ни один не даёт плейсхолдер
 * «не зарегистрирован в preview» — т.е. реестр не разошёлся с палитрой (спека §9).
 *
 * `$html(...)` (op `html`) и `FormArray` (`array`/`item`) в `$component`-реестр не попадают —
 * `collectUnknownComponentNames` их не учитывает, что и проверяется здесь заодно.
 *
 * @module reformer-builder/preview-runtime/registry-drift.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { getCatalog } from '../catalog';
import { collectUnknownComponentNames } from './unknown';

describe('registry drift (палитра ↔ реестр preview)', () => {
  it('дроп всего каталога не даёт ни одного незарегистрированного $component', () => {
    const schema = {
      version: '1.0',
      root: {
        component: '$component(Box)',
        children: getCatalog().map((entry) => entry.makeNode()),
      },
    } as unknown as JsonFormSchema;

    expect(collectUnknownComponentNames(schema)).toEqual([]);
  });

  it('реально не-каталожный $component по-прежнему считается unknown', () => {
    const schema = {
      version: '1.0',
      root: {
        component: '$component(Box)',
        children: [{ component: '$component(TotallyMadeUpComponent)', children: [] }],
      },
    } as unknown as JsonFormSchema;

    expect(collectUnknownComponentNames(schema)).toEqual(['TotallyMadeUpComponent']);
  });
});
