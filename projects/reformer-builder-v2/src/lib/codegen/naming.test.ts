import { describe, expect, it } from 'vitest';
import { humanize, makeNames, pascal } from './naming';

describe('makeNames', () => {
  it('выводит все имена из свободного имени формы', () => {
    const names = makeNames('Заявка на кредит');
    expect(names.dir).toBe('zayavka-na-kredit');
    expect(names.TypeName).toBe('ZayavkaNaKreditForm');
    expect(names.pageComponent).toBe('ZayavkaNaKreditPage');
    expect(names.routePath).toBe('/examples/zayavka-na-kredit');
    expect(names.modelFactory).toBe('createZayavkaNaKreditFormModel');
    expect(names.entryConst).toBe('zayavkaNaKreditFormEntry');
  });

  it('не задваивает суффикс Form', () => {
    expect(makeNames('user profile form').TypeName).toBe('UserProfileForm');
    expect(makeNames('user profile form').pageComponent).toBe('UserProfilePage');
  });

  it('пустое имя даёт рабочие умолчания, а не пустые строки', () => {
    const names = makeNames('');
    expect(names.dir).toBe('form');
    expect(names.TypeName).toBe('Form');
    expect(names.entryConst).toBe('formEntry');
  });

  it('pascal и humanize работают на kebab, camel и пробелах одинаково', () => {
    expect(pascal('loan-application')).toBe('LoanApplication');
    expect(pascal('loanApplication')).toBe('LoanApplication');
    expect(humanize('loan-application')).toBe('Loan application');
  });
});
