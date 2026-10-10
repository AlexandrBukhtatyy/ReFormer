/**
 * Правило `email()` — формат адреса электронной почты.
 *
 * Задокументирован упрощённый regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`: ровно одна `@`, точка в домене,
 * ни одного пробельного символа. Полной проверки по RFC 5322 нет — кейсы ниже фиксируют, что именно
 * упрощение пропускает. Пустые значения — забота `required()`.
 */

import { describe, expect, it } from 'vitest';
import { email } from '../../../src/form/validators/email';
import { describeRule } from '../../test-utils/rule-table';

describeRule('email — допустимые адреса', email(), [
  { value: 'user@example.com', code: null },
  { value: 'a.b+tag@sub.example.co.uk', code: null },
  { value: 'пользователь@пример.рф', code: null, label: 'кириллица (IDN) допустима' },
  { value: 'a@b.c', code: null, label: 'однобуквенная зона — упрощение regex' },
  { value: 'a@b..c', code: null, label: 'две точки подряд в домене — упрощение regex' },
]);

describeRule('email — недопустимые адреса', email(), [
  { value: 'user@example', code: 'email', label: 'без точки в домене' },
  { value: 'user.example.com', code: 'email', label: 'без @' },
  { value: '@example.com', code: 'email', label: 'пустая локальная часть' },
  { value: 'user@', code: 'email', label: 'пустой домен' },
  { value: 'user@@example.com', code: 'email', label: 'две @' },
  { value: 'us er@example.com', code: 'email', label: 'пробел внутри' },
  { value: ' user@example.com', code: 'email', label: 'ведущий пробел' },
  { value: 'user@example.com ', code: 'email', label: 'хвостовой пробел' },
  { value: 'user@example.com\n', code: 'email', label: 'перевод строки в конце' },
]);

describeRule('email — пустые значения пропускаются', email(), [
  { value: '', code: null },
  { value: null, code: null },
  { value: undefined, code: null },
]);

describe('email — опции', () => {
  it('у замечания только код, без params', () => {
    expect(email()('x')).toEqual({ code: 'email' });
  });

  it('свой код и params', () => {
    expect(email({ code: 'contact.email', params: { example: 'name@mail.ru' } })('x')).toEqual({
      code: 'contact.email',
      params: { example: 'name@mail.ru' },
    });
  });

  it('повторный вызов на том же значении даёт тот же результат', () => {
    const rule = email();
    expect([rule('a@b.co'), rule('a@b.co'), rule('x'), rule('x')]).toEqual([
      null,
      null,
      { code: 'email' },
      { code: 'email' },
    ]);
  });
});
