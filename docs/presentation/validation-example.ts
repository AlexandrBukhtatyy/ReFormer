/**
 * ReFormer — операторы валидации и их контракты.
 *
 * Пять операторов навешивают валидаторы в схеме:
 *   validate, validateAsync, apply, applyWhen, validateItems
 * Валидаторы — чистые функции с контрактом (value, control, root).
 * Подсхему можно вынести в отдельный ValidationSchemaFn<T> и переиспользовать через apply.
 */
import type { AsyncValidator, Validator, ValidationSchemaFn } from '@reformer/core';
import {
  apply,
  applyWhen,
  required,
  validate,
  validateAsync,
  validateItems,
  minLength,
} from '@reformer/core/validators';

interface Profile {
  username: string;
  password: string;
  isBusiness: boolean;
  business: { taxId: string };
  phones: { number: string }[];
}

// Validator<TRoot, TField>: (value, control, root) => ValidationError | null
const strong: Validator<Profile, string> = (value) =>
  /\d/.test(value) ? null : { code: 'weak', message: 'Нужна цифра' };

// AsyncValidator<TRoot, TField>: тот же контракт, но Promise<…>
const unique: AsyncValidator<Profile, string> = async (value) =>
  (await isFree(value)) ? null : { code: 'taken', message: 'Занято' };

// Подсхема — обычный ValidationSchemaFn<T>: (path) => void.
// Применяется через apply к примитиву, объекту или всей форме.
const passwordRules: ValidationSchemaFn<string> = (path) => {
  validate(path, required());
  validate(path, strong);
};
const businessRules: ValidationSchemaFn<Profile> = (path) => {
  validate(path.business.taxId, required());
};
const phoneRules: ValidationSchemaFn<{ number: string }> = (path) => {
  validate(path.number, required());
};

export const profileSchema: ValidationSchemaFn<Profile> = (path) => {
  // validate — добавляет валидацию конкретному полю
  validate(path.username, required());
  validate(path.username, minLength(3));

  // validateAsync — асинхронный валидатор, опционально debounce
  validateAsync(path.username, unique, { debounce: 500 });

  // apply — встраивает подсхему (работает на примитиве, объекте, всей форме)
  apply(path.password, passwordRules);

  // applyWhen — подсхема активна, пока condition(triggerValue) === true
  applyWhen(path.isBusiness, (v) => Boolean(v), businessRules);

  // validateItems — подсхема применяется к каждому элементу динамического массива
  validateItems(path.phones, phoneRules);
};

declare function isFree(v: string): Promise<boolean>;
