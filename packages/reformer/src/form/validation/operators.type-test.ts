/**
 * Compile-time тест типизации `apply` / `applyEach` валидации. Проверяется `tsc` (файл под `src`,
 * `include: ["src"]`); vitest его НЕ запускает — нет суффикса `.test.`.
 *
 * Убеждается, что тип под-модели выводится из ручки: схема подформы обязана подходить группе,
 * схема элемента — элементу массива. Композиция схем над одной моделью остаётся перегрузкой.
 */

import type { FormModel } from '../../index';
import { apply, applyEach, each } from './operators';
import type { ValidationSchema } from './types';

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
  each(model.$.phones, (phone) => void phone.$.number);
  each(model.phones, (phone) => void phone.$.number);
  // Композиция схем над той же моделью.
  apply(shapeRules, shapeRules);

  // @ts-expect-error — схема телефона не подходит группе адреса
  apply(model.$.address, phoneRules);
  // @ts-expect-error — схема адреса не подходит элементу массива телефонов
  applyEach(model.$.phones, addressRules);
  // @ts-expect-error — массив примитивов под-форм не содержит
  applyEach(model.$.tags, phoneRules);
}
