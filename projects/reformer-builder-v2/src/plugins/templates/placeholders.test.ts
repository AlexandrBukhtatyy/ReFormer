import { describe, expect, it } from 'vitest';
import { hasTokens, materialize, nameVariants, splitWords, toCase, tokenize } from './placeholders';

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
