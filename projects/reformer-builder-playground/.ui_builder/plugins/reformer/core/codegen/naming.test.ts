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
