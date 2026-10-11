import { describe, expect, it } from 'vitest';
import { makeNames } from '../../../core/codegen';
import {
  hasTokens,
  materialize,
  moduleNames,
  nameVariants,
  splitWords,
  toCase,
  tokenize,
  tokenizeModuleNames,
} from './placeholders';

describe('написания имени', () => {
  it('разбирает kebab, snake, camel и Pascal одинаково', () => {
    expect(splitWords('user-profile')).toEqual(['user', 'profile']);
    expect(splitWords('userProfile')).toEqual(['user', 'profile']);
    expect(splitWords('UserProfile')).toEqual(['user', 'profile']);
    expect(splitWords('USER_PROFILE')).toEqual(['user', 'profile']);
  });

  it('собирает все четыре написания', () => {
    expect(nameVariants('user profile')).toEqual({
      pascal: 'UserProfile',
      camel: 'userProfile',
      kebab: 'user-profile',
      snake: 'user_profile',
    });
  });

  it('пустое имя даёт пустые написания, а не мусор', () => {
    expect(toCase('', 'pascal')).toBe('');
  });
});

describe('токенизация', () => {
  it('заменяет имя во всех написаниях сразу', () => {
    const text = "import { CreditFormModel } from './credit-form/model';";
    expect(tokenize(text, 'credit form')).toBe(
      "import { __FormName__Model } from './__form-name__/model';"
    );
  });

  it('распадается на токен и остаток: CreditForm → __FormName__ + Form', () => {
    expect(tokenize('CreditForm', 'credit')).toBe('__FormName__Form');
  });

  it('идемпотентна: второй проход не съедает собственные токены', () => {
    const once = tokenize('CreditForm credit-form', 'credit');
    expect(tokenize(once, 'credit')).toBe(once);
  });

  it('имя, совпадающее с самим плейсхолдером, не токенизируется', () => {
    expect(tokenize('form-name', 'form name')).toBe('form-name');
  });

  it('слишком короткое имя оставляет текст нетронутым', () => {
    expect(tokenize('a b c', 'a')).toBe('a b c');
  });

  it('у односложного имени camel-идентификатор получает camel-токен, а не кебабный', () => {
    // Кебабный токен превратил бы `sampleFormEntry` в `profil-polzovatelyaFormEntry` —
    // синтаксическую ошибку. Проверяем весь путь: токенизация плюс подстановка.
    const tokenized = tokenize('export const sampleFormEntry = 1;', 'sample');
    expect(tokenized).toBe('export const __formName__FormEntry = 1;');
    expect(materialize(tokenized, 'профиль пользователя')).toBe(
      'export const profilPolzovatelyaFormEntry = 1;'
    );
  });

  it('кириллица транслитерируется: подстановка перестала молча ничего не делать', () => {
    expect(materialize('__FormName__', 'Профиль пользователя')).toBe('ProfilPolzovatelya');
    expect(materialize('__form-name__', 'Профиль пользователя')).toBe('profil-polzovatelya');
  });
});

describe('подстановка', () => {
  it('возвращает имя в том же написании, в каком стоял токен', () => {
    const template = '__FormName__ / __formName__ / __form-name__ / __form_name__';
    expect(materialize(template, 'user profile')).toBe(
      'UserProfile / userProfile / user-profile / user_profile'
    );
  });

  it('туда и обратно даёт исходный текст', () => {
    const source = "export const creditFormEntry = 'CreditForm';";
    expect(materialize(tokenize(source, 'credit form'), 'credit form')).toBe(source);
  });

  it('пустое имя формы оставляет шаблон нетронутым', () => {
    expect(materialize('__FormName__', '')).toBe('__FormName__');
  });

  it('видит параметризацию', () => {
    expect(hasTokens('__form-name__/model.ts')).toBe(true);
    expect(hasTokens('credit-form/model.ts')).toBe(false);
  });
});

describe('имена модуля — как их выводит кодоген', () => {
  it('токены модуля подставляются именами кодогена, а не написаниями имени', () => {
    const template = '__FormType__ / __formType__ / __form-dir__ / __FormTitle__';
    expect(materialize(template, 'loan request')).toBe(
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
    expect(materialize('__FormType__.tsx', 'contact form')).toBe('ContactForm.tsx');
    expect(materialize('__FormName__Form.tsx', 'contact form')).toBe('ContactFormForm.tsx');
  });

  it('каталог — kebab билдера, а не склейка слов имени', () => {
    // Заглавные подряд `kebab` билдера словами не считает; написания имени — считают.
    expect(materialize('types/__form-dir__.ts', 'ABCForm')).toBe('types/abcform.ts');
    expect(materialize('types/__form-name__.ts', 'ABCForm')).toBe('types/abc-form.ts');
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
    expect(materialize(tokenized, 'Профиль пользователя')).toBe(
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
    expect(hasTokens('types/__form-dir__.ts')).toBe(true);
    expect(hasTokens('__FormType__.tsx')).toBe(true);
  });

  it('имя, совпавшее со словами токена модуля, не токенизируется', () => {
    // Иначе второй проход съел бы сам токен: `__FormType__` содержит `FormType`.
    expect(tokenize('__FormType__ form-type', 'form type')).toBe('__FormType__ form-type');
  });

  it('пустое имя оставляет токены модуля нетронутыми', () => {
    expect(materialize('__FormType__', '')).toBe('__FormType__');
    expect(tokenizeModuleNames('Form', '')).toBe('Form');
  });
});
