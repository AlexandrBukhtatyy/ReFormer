/**
 * Compile-time проверки контракта «замечание без текста»: ни у опций правила, ни у самого
 * замечания нет `message` и `messageKey`. Файл видит `tsc`, но не vitest и не сборка.
 */
import type { ValidationIssue } from '../types/contracts';
import type { RuleOptions } from '../types/validation-schema';
import { min, required } from './index';

// @ts-expect-error — текста в опциях правила нет: строку по коду даёт словарь
required({ message: 'Обязательное поле' });
// @ts-expect-error — ключа сообщения тоже нет: свой текст задаётся своим кодом
min(5, { messageKey: 'app.min' });
// @ts-expect-error — литерал замечания с текстом не собирается
export const withText: ValidationIssue = { code: 'required', message: 'Обязательное поле' };
// @ts-expect-error — и с ключом сообщения
export const withKey: ValidationIssue = { code: 'required', messageKey: 'app.required' };

export const byCode = required({ code: 'phone.required', params: { hint: 1 } });
export const options: RuleOptions = { code: 'loanAmount.min', params: { currency: 'RUB' } };
export const warning: ValidationIssue = { code: 'min', params: { min: 1 }, severity: 'warning' };
