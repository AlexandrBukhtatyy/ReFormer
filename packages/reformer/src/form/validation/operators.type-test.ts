/**
 * Compile-time тест типизации схемы валидации. Проверяется `tsc` (файл под `src`,
 * `include: ["src"]`); vitest его НЕ запускает — нет суффикса `.test.`.
 *
 * Убеждается, что:
 *  - тип под-модели выводится из ручки: схема подформы обязана подходить группе, схема элемента —
 *    элементу массива; композиция схем над одной моделью остаётся перегрузкой;
 *  - правило подходит полю, чей тип не шире типа правила, и не подходит чужому типу;
 *  - `cross` области получает снимок модели схемы без указания типа.
 */

import type { FormModel } from '../../model/types';
import { email, min, minLength, required } from '../validators';
import { apply, applyEach, validate } from './operators';
import { defineValidationSchema } from './run';
import type { Rule, ValidationSchema } from './types';

interface Address {
  city: string;
}
interface Phone {
  number: string;
}
interface Shape {
  title: string;
  address: Address;
  spare: Address | null;
  phones: Phone[];
  tags: string[];
}

declare const addressRules: ValidationSchema<Address>;
declare const phoneRules: ValidationSchema<Phone>;
declare const shapeRules: ValidationSchema<Shape>;

export function validationOperatorTypeChecks(model: FormModel<Shape>): void {
  // Подформа: ручка группы + схема её типа; несколько групп — массивом.
  apply(model.$.address, addressRules);
  apply([model.$.address, model.$.address], addressRules);
  // Массив под-форм: ручкой и, для совместимости, фасадом.
  applyEach(model.$.phones, phoneRules);
  applyEach(model.phones, phoneRules);
  // Схема строки, записанная на месте: тип элемента выводится из ручки массива.
  applyEach(model.$.phones, ({ model: phone }) => {
    validate(phone.$.number, [required()]);
  });
  // Композиция схем над той же моделью.
  apply(shapeRules, shapeRules);

  // @ts-expect-error — схема телефона не подходит группе адреса
  apply(model.$.address, phoneRules);
  // @ts-expect-error — схема адреса не подходит элементу массива телефонов
  applyEach(model.$.phones, addressRules);
  // @ts-expect-error — массив примитивов под-форм не содержит
  applyEach(model.$.tags, phoneRules);
}

type LoanType = 'consumer' | 'mortgage';
interface Loan {
  loanType: LoanType;
  /** Пустое числовое поле — `null`. */
  amount: number | null;
  term: number;
  purpose: string;
  address: Address;
}

export function ruleTypeChecks(): void {
  // Правило «для любого значения» подходит полю-объединению литералов.
  const loanTypeRules: Rule<LoanType>[] = [required()];
  // Числовое правило принимает и пустое значение: набор годится полю `number | null`…
  const amountRules: Rule<number | null>[] = [required(), min(1)];
  // …и полю `number` — без переписывания.
  const termRules: Rule<number>[] = [...amountRules, min(6)];
  // Строковое правило подходит полю-объединению строковых литералов.
  const loanTypeLength: Rule<LoanType>[] = [minLength(2)];
  // Своё правило — функция одного аргумента; тип значения выведен из типа поля.
  const purposeRules: Rule<string>[] = [(value) => (value.length > 3 ? null : { code: 'short' })];

  // @ts-expect-error — правило для строки на числовом поле
  const stringOnNumber: Rule<number>[] = [email()];
  // @ts-expect-error — числовое правило на строковом поле
  const numberOnString: Rule<string>[] = [min(1)];
  // @ts-expect-error — набор для строки не подходит полю, которое бывает числом
  const narrowOnWide: Rule<string | number>[] = [email()];

  void [
    loanTypeRules,
    amountRules,
    termRules,
    loanTypeLength,
    purposeRules,
    stringOnNumber,
    numberOnString,
    narrowOnWide,
  ];
}

export const loanRules = defineValidationSchema<Loan>(({ model, cross }) => {
  validate(model.$.loanType, [required()]);
  validate(model.$.amount, [required(), min(1)]);
  validate(model.$.term, [required(), min(6)]);
  // @ts-expect-error — правило для строки на числовом поле
  validate(model.$.amount, [email()]);

  // Снимок области выведен из схемы: тип указывать не нужно.
  cross(model.$.amount, (loan) => {
    const amount: number | null = loan.amount;
    const city: string = loan.address.city;
    // @ts-expect-error — в снимке нет такого поля
    void loan.missing;
    return amount === null && city === '' ? { code: 'empty' } : null;
  });
});

// Схема подформы получает свою область: снимок `cross` — под-модель, а не вся форма.
export const addressScopeRules = defineValidationSchema<Address>(({ model, cross }) => {
  cross(model.$.city, (address) => {
    // @ts-expect-error — у адреса нет полей заявки
    void address.loanType;
    return address.city ? null : { code: 'required' };
  });
});
