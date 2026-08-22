/**
 * Переименовывающие реэкспорты должны попадать в поверхность под ПУБЛИЧНЫМ именем.
 *
 * Зачем: `collectFromFile` рекурсировал с `Set` ЛОКАЛЬНЫХ имён, поэтому
 * `export { X as Y } from '...'` регистрировался как `X`. Следствия, обе — самоконтрадикция
 * сервера (ровно тот класс дефекта, ради которого заведён scripts/check-mcp-prompts.mjs):
 *
 *  1. `get_symbol_docs('useReactForm')` отвечал «not found», хотя ТРИ шаблона промптов
 *     этого же сервера (start-here, create-form, to-renderer) учат звать `useReactForm`.
 *     Плюс спецификатор был кросс-пакетным (`from '@reformer/core'`), а `resolveModule`
 *     отбрасывал любой не-относительный путь — символ терялся дважды.
 *  2. 15 field-обёрток ui-kit (`SelectField`, `CheckboxField`, `InputMaskField`, …) —
 *     то, что консумент реально пишет — были видны только под внутренними именами
 *     (`SelectAsyncField`, `CheckboxBaseField`, …), которые не пишет никто.
 *
 * Замерено: таких реэкспортов в исходниках ровно 17 (cdk 1 + ui-kit 15 + renderer-react 1),
 * и поверхность выросла ровно на 17 — то есть добавились именно они, без дублей.
 */

import { describe, it, expect } from 'vitest';
import { findSymbol, getPublicSymbols } from '../src/utils/symbols-parser';
import { KNOWN_PACKAGES } from '../src/utils/docs-parser';
import { AST_HEAVY_TIMEOUT_MS } from './timeouts';

const hasSymbols = getPublicSymbols('@reformer/core').length > 0;

describe('symbols-parser — переименовывающие реэкспорты', () => {
  it.runIf(hasSymbols)(
    'кросс-пакетный алиас виден под публичным именем',
    () => {
      // packages/reformer-renderer-react/src/index.ts:
      //   export { useFormBundle as useReactForm } from '@reformer/core';
      const sym = findSymbol('useReactForm');
      expect(
        sym,
        '`useReactForm` не резолвится, хотя промпты сервера учат её звать'
      ).not.toBeNull();
      expect(sym!.package).toBe('@reformer/renderer-react');
    },
    AST_HEAVY_TIMEOUT_MS
  );

  it.runIf(hasSymbols)('field-обёртки ui-kit видны под публичными именами', () => {
    const missing = [
      'SelectField',
      'CheckboxField',
      'InputMaskField',
      'DatePickerField',
      'RadioGroupField',
      'TextareaField',
    ].filter((n) => findSymbol(n, '@reformer/ui-kit') === null);
    expect(missing, `публичные field-обёртки не резолвятся: ${missing.join(', ')}`).toEqual([]);
  });

  it.runIf(hasSymbols)('каждое имя, которое учат промпты, резолвится', () => {
    // Список — имена, встречающиеся в шаблонах промптов как рекомендуемый API.
    // Держим его здесь, а не в prompt-imports.test.ts: тот проверяет только
    // `import { … } from '@reformer/…'`, а эти имена промпты называют в прозе.
    const taught = ['useFormBundle', 'useReactForm', 'useJsonForm', 'createReactForm'];
    const missing = taught.filter((n) => findSymbol(n) === null);
    expect(missing, `промпты учат несуществующему API: ${missing.join(', ')}`).toEqual([]);
  });

  it.runIf(hasSymbols)('имена уникальны внутри пакета (алиас не создал дубль)', () => {
    for (const pkg of KNOWN_PACKAGES) {
      const names = getPublicSymbols(pkg).map((s) => s.name);
      expect(new Set(names).size, `дубли имён в ${pkg}`).toBe(names.length);
    }
  });
});
