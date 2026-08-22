/**
 * Точка входа сабпата `@reformer/core/validators` — все фабрики правил одним импортом.
 *
 * Все примитивы — фабрики, возвращающие чистый `Validator<TForm, TField>`; передаются вторым
 * аргументом оператора `validate` внутри схемы валидации: `validate(model.$.age, [required(), min(18)])`.
 * В layout-схему формы правила НЕ кладутся — поля `validators` у узла нет (снято в 7.0).
 *
 * Гранулярные сабпаты (`@reformer/core/validators/required` и ещё 20) собираются отдельными
 * entry для tree-shaking; этот модуль отдаёт полный набор для случаев, когда правил много.
 */

export { required } from './required';
export { min } from './min';
export { max } from './max';
export { minLength } from './min-length';
export { maxLength } from './max-length';
export { email } from './email';
export { pattern } from './pattern';
export { url, type UrlValidatorOptions } from './url';
export { phone, type PhoneFormat, type PhoneValidatorOptions } from './phone';
// Number validator factories
export { isNumber } from './is-number';
export { integer } from './integer';
export { multipleOf } from './multiple-of';
export { nonNegative } from './non-negative';
export { nonZero } from './non-zero';
// Date validator factories
export { isDate } from './is-date';
export { minDate } from './min-date';
export { maxDate } from './max-date';
export { pastDate } from './past-date';
export { futureDate } from './future-date';
export { minAge } from './min-age';
export { maxAge } from './max-age';
// File validator factories
export { maxFileSize } from './max-file-size';
export { minFileSize } from './min-file-size';
export { fileType } from './file-type';
export { maxFiles } from './max-files';
export { minFiles } from './min-files';
export { maxTotalFileSize } from './max-total-file-size';
export { isFileLike, matchesFileAccept, toFileArray, type FileLike } from './file-utils';
