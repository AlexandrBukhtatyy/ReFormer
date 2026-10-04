/**
 * Формат документа домена RJSF: форма react-jsonschema-form как она есть — JSON Schema и uiSchema.
 *
 * Домен не придумывает своего языка схемы: `schema` — JSON Schema, которую RJSF рисует, `uiSchema` —
 * его подсказки отрисовки (`ui:order`, `ui:widget`, `ui:placeholder`). Своего у формата — только
 * обёртка с `$schema`, по которой билдер узнаёт документ: `.json` бывает схемой любого стека.
 *
 * Корень формы — объект с плоскими свойствами: поле — это свойство `schema.properties`. Вложенные
 * объекты и массивы редактор пока не ведёт (их разбор отказывает с объяснением).
 *
 * @module plugins/rjsf/core/schema
 */

/** Значение `$schema`, по которому домен узнаёт свой документ. */
export const RJSF_SCHEMA_ID = 'rjsf-form/1';

/** Провайдер модели документа RJSF: по нему поверхность и валидатор узнают документ домена. */
export const RJSF_PROVIDER_ID = 'rjsf.form';

/** Типы полей, которые ведёт редактор. */
export const RJSF_FIELD_TYPES = ['string', 'number', 'integer', 'boolean'] as const;

export type RjsfFieldType = (typeof RJSF_FIELD_TYPES)[number];

/** Значение варианта `enum`. */
export type RjsfEnumValue = string | number;

/**
 * Схема поля — JSON Schema свойства. Типизированы ключи, которыми пользуется редактор; прочие
 * ключевые слова JSON Schema (`minLength`, `pattern`, `format`…) проходят разбор и печать как есть.
 */
export type RjsfFieldSchema = Readonly<{
  type: RjsfFieldType;
  title?: string;
  description?: string;
  enum?: readonly RjsfEnumValue[];
  default?: unknown;
}> &
  Readonly<Record<string, unknown>>;

/** Корень формы: объект со свойствами-полями. Порядок ключей `properties` — порядок полей. */
export type RjsfObjectSchema = Readonly<{
  type: 'object';
  title?: string;
  required?: readonly string[];
  properties: Readonly<Record<string, RjsfFieldSchema>>;
}> &
  Readonly<Record<string, unknown>>;

/** Подсказки отрисовки одного поля (`ui:widget`, `ui:placeholder`…). */
export type RjsfFieldUi = Readonly<Record<string, unknown>>;

/**
 * uiSchema формы: `ui:order` — порядок полей (полный либо с `'*'`), по имени поля — его подсказки.
 */
export type RjsfUiSchema = Readonly<{ 'ui:order'?: readonly string[] }> &
  Readonly<Record<string, unknown>>;

export interface RjsfForm {
  readonly $schema: typeof RJSF_SCHEMA_ID;
  readonly schema: RjsfObjectSchema;
  readonly uiSchema?: RjsfUiSchema;
}

/** Значения формы: имя поля → значение. */
export type RjsfValues = Readonly<Record<string, unknown>>;
