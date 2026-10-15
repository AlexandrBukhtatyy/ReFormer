import { describe, expect, it } from 'vitest';
import { camel, humanize, makeNames, pascal, stepRulesAlias } from './naming';

describe('makeNames', () => {
  it('выводит все имена из свободного имени формы', () => {
    const names = makeNames('Заявка на кредит');
    expect(names.dir).toBe('zayavka-na-kredit');
    expect(names.TypeName).toBe('ZayavkaNaKreditForm');
    expect(names.routePath).toBe('/examples/zayavka-na-kredit');
    expect(names.modelFactory).toBe('createZayavkaNaKreditFormModel');
    expect(names.formFactory).toBe('createZayavkaNaKreditForm');
    expect(names.entryConst).toBe('zayavkaNaKreditFormEntry');
  });

  it('компонент страницы называется типом формы — им же называется её файл', () => {
    // Прежде страница была `<Имя>Page` в `index.tsx`; в раскладке «папки по ролям» страница —
    // файл `<Тип>.tsx`, и компонент назван так же (тип формы в него не импортируется).
    expect(makeNames('Заявка на кредит').pageComponent).toBe('ZayavkaNaKreditForm');
    expect(makeNames('user profile form').pageComponent).toBe('UserProfileForm');
  });

  it('не задваивает суффикс Form', () => {
    expect(makeNames('user profile form').TypeName).toBe('UserProfileForm');
    expect(makeNames('user profile form').formFactory).toBe('createUserProfileForm');
  });

  it('пустое имя даёт рабочие умолчания, а не пустые строки', () => {
    const names = makeNames('');
    expect(names.dir).toBe('form');
    expect(names.TypeName).toBe('Form');
    expect(names.entryConst).toBe('formEntry');
  });

  it('имя формы, начинающееся с цифры, даёт идентификаторы; каталог остаётся как есть', () => {
    // `2024Form` не идентификатор: файл с таким типом не разбирается вовсе. Приставка `Form`
    // достаётся типу, а от него — всем производным именам кода.
    const names = makeNames('2024 анкета');
    expect(names.dir).toBe('2024-anketa');
    expect(names.TypeName).toBe('Form2024AnketaForm');
    expect(names.pageComponent).toBe('Form2024AnketaForm');
    expect(names.modelFactory).toBe('createForm2024AnketaFormModel');
    expect(names.formFactory).toBe('createForm2024AnketaForm');
    expect(names.entryConst).toBe('form2024AnketaFormEntry');
    expect(makeNames('1').TypeName).toBe('Form1Form');
  });

  it('любое имя формы даёт идентификаторы', () => {
    const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
    for (const name of ['', '7', '2024-год', '3d-модель', 'форма №5', '--', '9 to 5', 'a']) {
      const names = makeNames(name);
      for (const value of [
        names.TypeName,
        names.pageComponent,
        names.modelFactory,
        names.formFactory,
        names.entryConst,
      ]) {
        expect(value, `${JSON.stringify(name)} → ${value}`).toMatch(identifier);
      }
    }
  });

  it('сборка формы с типом `Form` не занимает имя библиотечной сборки', () => {
    // `application/create.ts` импортирует `createForm` из `@reformer/core`: одноимённая сборка
    // формы объявила бы его второй раз, и модуль не собрался бы.
    expect(makeNames('form').TypeName).toBe('Form');
    expect(makeNames('form').formFactory).toBe('createFormBundle');
    expect(makeNames('').formFactory).toBe('createFormBundle');
    expect(makeNames('loan').formFactory).toBe('createLoanForm');
  });

  it('pascal, camel и humanize работают на kebab, camel и пробелах одинаково', () => {
    expect(pascal('loan-application')).toBe('LoanApplication');
    expect(pascal('loanApplication')).toBe('LoanApplication');
    expect(camel('loan-application')).toBe('loanApplication');
    expect(humanize('loan-application')).toBe('Loan application');
  });
});

describe('stepRulesAlias', () => {
  it('camelCase имени шага и суффикс Rules', () => {
    expect(stepRulesAlias('kontakty')).toBe('kontaktyRules');
    expect(stepRulesAlias('kontakty-2')).toBe('kontakty2Rules');
    expect(stepRulesAlias('lichnye-dannye')).toBe('lichnyeDannyeRules');
  });

  it('имя, начинающееся с цифры, идентификатором быть не может — получает приставку', () => {
    expect(stepRulesAlias('2024-god')).toBe('step2024GodRules');
  });
});
