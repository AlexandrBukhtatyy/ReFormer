import type { JSONSchema7 } from 'json-schema';
import { seamRuntimeProps } from './seam.props';
import { fieldWrapperPropsSchema } from '../components/form-field/form-field.props';

/**
 * Инфраструктура props-компаньонов (`*.props.ts`). Единый машиночитаемый источник для:
 *  - `api.controls[]` в reformer-doc (через `controlsFromPropsSchema`);
 *  - валидации `componentProps` в renderer-json DSL.
 *
 * `*.props.ts` React-free (грузится MCP-сервером в голом Node) — не импортирует `.tsx`.
 */

export type PropGroup = 'Control' | 'Options' | 'Textfield' | 'Behavior' | 'State';
export type PropWidget = 'boolean' | 'text' | 'number' | 'enum' | 'readonly';

/**
 * `x-doc` — ровно то, чего нет в словаре JSON Schema. Остальное берётся из стандартных
 * ключей: `description`, `default`, `enum`→options, `minimum`/`maximum`/`multipleOf`.
 */
export interface PropDoc {
  group: PropGroup;
  /** Отображаемый TS-тип: JSON Schema не выражает `string | null` и сигнатуры функций. */
  type: string;
  /** Переопределить виджет. По умолчанию выводится из `type`/`enum`. */
  kind?: PropWidget;
}

/**
 * Проп, которого НЕ бывает в `componentProps`: резолвит seam (`value`/`onChange`/`onBlur`/`disabled`)
 * либо не представим в JSON (`resource.load`). Держим отдельно от `properties`, чтобы схема
 * не врала, будто его можно указать. Валидатор DSL этот блок не видит (вырезается с `x-*`).
 */
export interface RuntimePropDoc extends PropDoc {
  description: string;
  default?: string | number | boolean;
}

/**
 * ВНИМАНИЕ: форма `Omit<…> & {…}` — не косметика. Именно интерсекция с mapped-типом
 * пропускает `as const`-значения (readonly-кортежи в `required`/`enum`). Плоский interface
 * на них ругается (проверено). Рефакторить — только с прогоном typecheck.
 */
export type PropsSchema = Omit<
  JSONSchema7,
  'properties' | 'items' | 'anyOf' | 'additionalProperties'
> & {
  'x-doc'?: PropDoc;
  'x-runtimeProps'?: Record<string, RuntimePropDoc>;
  /**
   * Каноническое имя в реестре renderer-json. Ставит вариант, на который смотрит алиас
   * `<Cmp>Field`. По нему `generate-meta.mjs` собирает `defaultPropSchemas`.
   */
  'x-registryName'?: string;
  properties?: Record<string, PropsSchema>;
  items?: PropsSchema | PropsSchema[];
  anyOf?: PropsSchema[];
  additionalProperties?: boolean | PropsSchema;
};

/**
 * Полная схема `componentProps` field-ноды: контракт враппера + seam + вариант.
 *
 * Именно структурный merge `properties`, а НЕ `allOf: [wrapper, variant]`: в draft-07
 * `additionalProperties` смотрит только на `properties` СВОЕЙ схемы → в `allOf` каждая ветка
 * отвергла бы props соседней. Строгость решает вариант своим `additionalProperties`.
 */
export function mergeFieldPropsSchema(variantSchema: PropsSchema): PropsSchema {
  const strict = variantSchema.additionalProperties === false;
  return {
    type: 'object',
    properties: { ...fieldWrapperPropsSchema.properties, ...variantSchema.properties },
    ...(strict ? { additionalProperties: false } : {}),
    // Вариант переопределяет value/onChange под свой адаптер — его спред идёт последним.
    'x-runtimeProps': { ...seamRuntimeProps, ...variantSchema['x-runtimeProps'] },
  };
}
