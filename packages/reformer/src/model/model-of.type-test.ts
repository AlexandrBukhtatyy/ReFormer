/**
 * Compile-time тест типизации {@link modelOf}. Проверяется `tsc` (файл под `src`,
 * `include: ["src"]`); vitest его НЕ запускает — нет суффикса `.test.`.
 *
 * Убеждается, что тип фасада выводится из ручки без явных generic-ов: группа → под-модель,
 * массив → фасад массива, а лист ручкой контейнера не считается.
 */

import type { FormModel, ModelArray } from './types';
import { modelOf } from './model-value-proxy';

interface Address {
  city: string;
}
interface Phone {
  number: string;
}
interface Shape {
  title: string;
  address: Address;
  phones: Phone[];
  tags: string[];
}

export function modelOfTypeChecks(model: FormModel<Shape>): void {
  const address: FormModel<Address> = modelOf(model.$.address);
  const phones: ModelArray<Phone> = modelOf(model.$.phones);
  const firstPhone: FormModel<Phone> = modelOf(model.$.phones[0]);
  const tags: ModelArray<string> = modelOf(model.$.tags);
  const root: FormModel<Shape> = modelOf(model.$);

  // @ts-expect-error — лист: у строки под-модели нет
  modelOf(model.$.title);
  // @ts-expect-error — под-модель адреса не подходит туда, где ждут телефон
  const wrong: FormModel<Phone> = modelOf(model.$.address);

  void [address, phones, firstPhone, tags, root, wrong];
}
