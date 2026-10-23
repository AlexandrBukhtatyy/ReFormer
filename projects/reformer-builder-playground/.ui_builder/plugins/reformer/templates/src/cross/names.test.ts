/**
 * Токены имён модуля ReFormer в подстановке хозяина: значения считает стек (`makeNames`),
 * подставляет и бережёт от снимка каталога хозяин.
 *
 * @module plugins/reformer/templates/cross/names.test
 */

import { describe, expect, it } from 'vitest';
import { makeNames } from '../../../core/codegen';
import { hasTokens, materialize, tokenize } from '../render/placeholders';
import { MODULE_TOKENS, moduleNames, moduleTokens, tokenizeModuleNames } from '../stack/names';

/** Токены модуля, которые снимок каталога не вправе съесть. */
const RESERVED = Object.values(MODULE_TOKENS);

describe('имена модуля — как их выводит кодоген', () => {
  it('токены модуля подставляются именами кодогена, а не написаниями имени', () => {
    const template = '__FormType__ / __formType__ / __form-dir__ / __FormTitle__';
    expect(materialize(template, 'loan request', moduleTokens('loan request'))).toBe(
      'LoanRequestForm / loanRequestForm / loan-request / Loan request'
    );
  });

  it('значения считает makeNames: шаблон и кодоген называют форму одинаково', () => {
    for (const name of ['loan request', 'Профиль пользователя', 'contact form', 'ABCForm']) {
      const names = makeNames(name);
      expect(moduleNames(name)).toEqual({
        type: names.TypeName,
        typeCamel: names.entryConst.replace(/Entry$/, ''),
        dir: names.dir,
        title: names.title,
      });
    }
  });

  it('имя, оканчивающееся на Form, суффикса типа не удваивает', () => {
    // Ради этого у типа свой токен: «имя в PascalCase плюс Form» дало бы `ContactFormForm`,
    // а кодоген для той же формы печатает `ContactForm` — и страница легла бы в другой файл.
    const tokens = moduleTokens('contact form');
    expect(materialize('__FormType__.tsx', 'contact form', tokens)).toBe('ContactForm.tsx');
    expect(materialize('__FormName__Form.tsx', 'contact form', tokens)).toBe('ContactFormForm.tsx');
  });

  it('каталог — kebab билдера, а не склейка слов имени', () => {
    // Заглавные подряд `kebab` билдера словами не считает; написания имени — считают.
    const tokens = moduleTokens('ABCForm');
    expect(materialize('types/__form-dir__.ts', 'ABCForm', tokens)).toBe('types/abcform.ts');
    expect(materialize('types/__form-name__.ts', 'ABCForm', tokens)).toBe('types/abc-form.ts');
  });

  it('текст кодогена токенизируется по именам модуля — и раскладывается под новое имя', () => {
    const printed =
      "export const loanRequestFormEntry: FormEntry<LoanRequestForm> = { id: 'loan-request', " +
      "meta: { name: 'Loan request' }, model: createLoanRequestFormModel };";

    const tokenized = tokenizeModuleNames(printed, 'loan request');

    expect(tokenized).toBe(
      "export const __formType__Entry: FormEntry<__FormType__> = { id: '__form-dir__', " +
        "meta: { name: '__FormTitle__' }, model: create__FormType__Model };"
    );
    expect(
      materialize(tokenized, 'Профиль пользователя', moduleTokens('Профиль пользователя'))
    ).toBe(
      'export const profilPolzovatelyaFormEntry: FormEntry<ProfilPolzovatelyaForm> = { id: ' +
        "'profil-polzovatelya', meta: { name: 'Profil polzovatelya' }, model: " +
        'createProfilPolzovatelyaFormModel };'
    );
  });

  it('токенизация имён модуля идемпотентна', () => {
    const once = tokenizeModuleNames('LoanRequestForm in loan-request', 'loan request');
    expect(tokenizeModuleNames(once, 'loan request')).toBe(once);
  });

  it('токены модуля — тоже параметризация', () => {
    expect(hasTokens('types/__form-dir__.ts', RESERVED)).toBe(true);
    expect(hasTokens('__FormType__.tsx', RESERVED)).toBe(true);
    // Без токенов стека — не параметризация: хозяин о них не знает.
    expect(hasTokens('__FormType__.tsx')).toBe(false);
  });

  it('имя, совпавшее со словами токена модуля, не токенизируется', () => {
    // Иначе второй проход съел бы сам токен: `__FormType__` содержит `FormType`.
    expect(tokenize('__FormType__ form-type', 'form type', RESERVED)).toBe(
      '__FormType__ form-type'
    );
  });

  it('пустое имя оставляет токены модуля нетронутыми', () => {
    expect(materialize('__FormType__', '', moduleTokens(''))).toBe('__FormType__');
    expect(tokenizeModuleNames('Form', '')).toBe('Form');
  });
});
