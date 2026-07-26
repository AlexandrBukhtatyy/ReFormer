/**
 * Контракт каталога компонентов (спека §5, §15): JSON Schema, описывающая структуру каталога-JSON,
 * адаптер `defaultPropSchemas → catalog.json` (с явным `role`) и валидатор каталога против контракта.
 * Билдер читает каталог через {@link buildCatalogFromJson} за неизменным `CatalogEntry` — смена
 * источника (прямой импорт → внешний валидированный catalog-JSON) не меняет остальной код.
 *
 * @module reformer-builder/catalog/contract
 */

import Ajv, { type ValidateFunction } from 'ajv';
import { defaultPropSchemas, mergeFieldPropsSchema, type PropsSchema } from '@reformer/ui-kit/meta';
import type { CatalogEntry, CatalogJson, CatalogRole } from './types';
import { CATALOG_CONTRACT_VERSION } from './types';
import { inferRole } from './role';
import { syntheticRecords } from './synthetic-entries';
import { makeNodeFor } from './make-node';

/** Имя регистра → категория палитры (спека §5 `category?`). */
const CATEGORY_BY_NAME: Record<string, string> = {
  Input: 'Поля ввода',
  InputPassword: 'Поля ввода',
  InputMask: 'Поля ввода',
  InputOTP: 'Поля ввода',
  Textarea: 'Поля ввода',
  DatePicker: 'Поля ввода',
  Calendar: 'Поля ввода',
  FileUpload: 'Поля ввода',
  FileUploadAvatar: 'Поля ввода',
  Select: 'Выбор и переключатели',
  NativeSelect: 'Выбор и переключатели',
  Combobox: 'Выбор и переключатели',
  RadioGroup: 'Выбор и переключатели',
  Checkbox: 'Выбор и переключатели',
  Switch: 'Выбор и переключатели',
  Slider: 'Выбор и переключатели',
  Toggle: 'Выбор и переключатели',
  ToggleGroup: 'Выбор и переключатели',
  Box: 'Контейнеры',
  Section: 'Контейнеры',
};

function categoryOf(name: string, role: CatalogRole): string {
  return CATEGORY_BY_NAME[name] ?? (role === 'container' ? 'Контейнеры' : 'Прочее');
}

/** JSON Schema контракта каталога (`component-catalog.schema.json`, draft-07). */
export const CATALOG_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://reformer.dev/schemas/component-catalog.schema.json',
  title: 'ReFormer component catalog',
  type: 'object',
  required: ['version', 'components'],
  additionalProperties: false,
  properties: {
    version: { type: 'string', minLength: 1 },
    components: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'role', 'propsSchema'],
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1 },
          role: { enum: ['field', 'container', 'array'] },
          category: { type: 'string' },
          // propsSchema — произвольная JSON Schema пропсов (валидируется её структура, не содержимое).
          propsSchema: { type: 'object' },
        },
      },
    },
  },
} as const;

/** Адаптер: `defaultPropSchemas` + синтетические → каталог-JSON (с явным `role`, сериализуемо). */
export function buildCatalogJson(
  schemas: Record<string, PropsSchema> = defaultPropSchemas
): CatalogJson {
  const components = Object.entries(schemas).map(([name, variant]) => {
    const role = inferRole(variant);
    const propsSchema = role === 'field' ? mergeFieldPropsSchema(variant) : variant;
    return { name, role, category: categoryOf(name, role), propsSchema };
  });
  return { version: CATALOG_CONTRACT_VERSION, components: [...components, ...syntheticRecords()] };
}

/** Реконструировать `CatalogEntry[]` из каталога-JSON (восстанавливает `makeNode`). */
export function buildCatalogFromJson(json: CatalogJson): CatalogEntry[] {
  return json.components.map((r) => ({
    name: r.name,
    role: r.role,
    category: r.category,
    propsSchema: r.propsSchema,
    makeNode: () => makeNodeFor(r.name, r.role),
  }));
}

let validateFn: ValidateFunction | null = null;

/** Провалидировать каталог-JSON против контракта (§5: билдер валидирует каталог). */
export function validateCatalog(json: unknown): { valid: boolean; errors: string[] } {
  if (!validateFn) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    validateFn = ajv.compile(CATALOG_SCHEMA);
  }
  const valid = validateFn(json);
  const errors = (validateFn.errors ?? []).map((e) =>
    `${e.instancePath || '/'} ${e.message ?? ''}`.trim()
  );
  return { valid: Boolean(valid), errors };
}
