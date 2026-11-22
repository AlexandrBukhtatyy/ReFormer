import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { defaultPropSchemas } from '../meta';
import { mergeFieldPropsSchema } from './props-schema';
import { fieldWrapperPropsSchema } from '../components/form-field/form-field.props';
import { fieldCommonPropsSchema } from './field-common.props';

/**
 * Страж общей части field-схем: `labelTooltip` (враппер) и `tooltip` (контрол) объявлены ОДИН раз и
 * доезжают до каждого поля через `mergeFieldPropsSchema`.
 */

const catalog = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../component-catalog.json', import.meta.url)), 'utf8')
) as
  | { components?: Array<{ name: string; role?: string }> }
  | Array<{ name: string; role?: string }>;
const records = Array.isArray(catalog) ? catalog : (catalog.components ?? []);
const fieldNames = records.filter((r) => r.role === 'field').map((r) => r.name);

describe('mergeFieldPropsSchema — общие props полей', () => {
  it('каталог знает поля (иначе страж ниже ничего не проверяет)', () => {
    expect(fieldNames.length).toBeGreaterThanOrEqual(24);
  });

  it('объявления единственные: labelTooltip — во враппере, tooltip — в общем блоке', () => {
    expect(Object.keys(fieldWrapperPropsSchema.properties ?? {})).toContain('labelTooltip');
    expect(Object.keys(fieldCommonPropsSchema.properties ?? {})).toEqual(['tooltip']);
  });

  it.each(fieldNames)(
    '%s: после merge есть tooltip и labelTooltip, строгость сохранена',
    (name) => {
      const variant = defaultPropSchemas[name];
      expect(variant, `нет props-схемы для ${name}`).toBeDefined();

      // Вариант сам их не объявляет — иначе описание разъедется с общим.
      const own = Object.keys(variant.properties ?? {});
      expect(own).not.toContain('tooltip');
      expect(own).not.toContain('labelTooltip');

      const merged = mergeFieldPropsSchema(variant);
      expect(merged.properties?.tooltip?.type).toBe('string');
      expect(merged.properties?.labelTooltip?.type).toBe('string');
      expect(merged.additionalProperties).toBe(
        variant.additionalProperties === false ? false : undefined
      );

      // Проп не может быть одновременно авторским и рантаймовым.
      const runtime = Object.keys(merged['x-runtimeProps'] ?? {});
      expect(runtime).not.toContain('tooltip');
      expect(runtime).not.toContain('labelTooltip');
    }
  );
});
