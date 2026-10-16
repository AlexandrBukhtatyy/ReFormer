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
 *  2. 15 field-обёрток ui-kit (`SelectField`, `CheckboxField`, …) были видны только под
 *     внутренними именами (`SelectAsyncField`, `CheckboxBaseField`, …), которые не пишет никто.
 *
 * Тогда таких реэкспортов было 17 (cdk 1 + ui-kit 15 + renderer-react 1). Алиас renderer-react
 * удалён вместе с прежней сборкой (кросс-пакетных алиасов больше нет), field-обёртки ui-kit —
 * тоже: в `component` поля кладётся сам компонент (`SelectAsync`,
 * `CheckboxWithLabel`, …), и он экспортируется под своим именем. Проверка ui-kit ниже теперь
 * страхует именно это — что компоненты полей, которые учат промпты и генератор, резолвятся.
 */

import { describe, it, expect } from 'vitest';
import { findSymbol, getPublicSymbols } from '../src/platform/cli/symbols-parser';
import { KNOWN_PACKAGES } from '../src/utils/docs-parser';
import { AST_HEAVY_TIMEOUT_MS } from './timeouts';

const hasSymbols = getPublicSymbols('@reformer/core').length > 0;

describe('symbols-parser — переименовывающие реэкспорты', () => {
  it.runIf(hasSymbols)(
    'переименовывающий реэкспорт виден под публичным именем',
    () => {
      // packages/reformer-cdk/src/components/file-upload/index.ts:
      //   export type { FileUploadItem as FileUploadItemData, … } from './file-upload-core';
      const sym = findSymbol('FileUploadItemData');
      expect(sym, '`FileUploadItemData` не резолвится под публичным именем').not.toBeNull();
      expect(sym!.package).toBe('@reformer/cdk');
    },
    AST_HEAVY_TIMEOUT_MS
  );

  it.runIf(hasSymbols)('компоненты полей ui-kit видны под публичными именами', () => {
    const missing = [
      'SelectAsync',
      'CheckboxWithLabel',
      'InputMask',
      'DatePicker',
      'RadioGroupOptions',
      'Textarea',
      'InputNumber',
      'SwitchWithLabel',
      'FileUploadDropzone',
    ].filter((n) => findSymbol(n, '@reformer/ui-kit') === null);
    expect(missing, `компоненты полей ui-kit не резолвятся: ${missing.join(', ')}`).toEqual([]);
  });

  it.runIf(hasSymbols)('каждое имя, которое учат промпты, резолвится', () => {
    // Список — имена, встречающиеся в шаблонах промптов как рекомендуемый API.
    // Держим его здесь, а не в prompt-imports.test.ts: тот проверяет только
    // `import { … } from '@reformer/…'`, а эти имена промпты называют в прозе.
    const taught = ['useFormBundle', 'createForm', 'FormRenderer', 'defineFormBehavior'];
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
