// ============================================================================
// Validator Types
// ============================================================================

export type ValidatorFn<T = any> = (value: T) => ValidationError | null;
export type AsyncValidatorFn<T = any> = (value: T) => Promise<ValidationError | null>;

export interface ValidationError {
  code: string;
  message: string;
  params?: Record<string, any>;
}

/**
 * Опции для фильтрации ошибок в методе getErrors()
 */
export interface ErrorFilterOptions {
  /** Фильтр по коду ошибки */
  code?: string | string[];

  /** Фильтр по сообщению (поддерживает частичное совпадение) */
  message?: string;

  /** Фильтр по параметрам ошибки */
  params?: Record<string, any>;

  /** Кастомный предикат для фильтрации */
  predicate?: (error: ValidationError) => boolean;
}

// ============================================================================
// Field Status
// ============================================================================

export type FieldStatus = 'valid' | 'invalid' | 'pending' | 'disabled';

// ============================================================================
// Field Configuration (re-exported from deep-schema)
// ============================================================================

// Import and re-export FieldConfig from deep-schema for single source of truth
export type { FieldConfig } from './deep-schema';
export type { FieldPath, FieldPathNode } from '../types/field-path';

// ============================================================================
// Re-exports from validation-schema
// ============================================================================

export type {
  ValidationContext,
  TreeValidationContext,
  ContextualValidatorFn,
  ContextualAsyncValidatorFn,
  TreeValidatorFn,
  ConditionFn,
  ValidateOptions,
  ValidateAsyncOptions,
  ValidateTreeOptions,
  ValidationSchemaFn,
  ValidatorRegistration,
} from './validation-schema';

// ============================================================================
// Re-exports from deep-schema (Variant 5)
// ============================================================================

export type {
  FormSchema,
  DeepControls,
  GroupControlProxy,
  ArrayControlProxy,
  ArrayConfig,
} from './deep-schema';

// ============================================================================
// Re-exports from group-node-proxy (Typed Proxy Access)
// ============================================================================

export type {
  FormNodeControls,
  GroupNodeWithControls,
  ArrayNodeWithControls,
} from './group-node-proxy';

// ============================================================================
// GroupNode Configuration (with schemas)
// ============================================================================

import type { BehaviorSchemaFn } from '../behaviors/types';
import type { FormSchema } from './deep-schema';
import type { ValidationSchemaFn } from './validation-schema';

/**
 * Конфигурация GroupNode с поддержкой схем
 * Используется для создания форм с автоматическим применением behavior и validation схем
 */
export interface GroupNodeConfig<T extends Record<string, any>> {
  /** Схема структуры формы (поля и их конфигурация) */
  form: FormSchema<T>;

  /** Схема реактивного поведения (copyFrom, enableWhen, computeFrom и т.д.) */
  behavior?: BehaviorSchemaFn<T>;

  /** Схема валидации (required, email, minLength и т.д.) */
  validation?: ValidationSchemaFn<T>;
}
