/**
 * Compile-time тест контрактов нод: доступ к полям {@link FormGroup}, сокращённый набор
 * затеняемых имён и удалённые члены. Проверяется `tsc` (файл под `src`); vitest его НЕ запускает.
 */

import type { ReadonlySignal } from '@preact/signals-core';
import type { FormArray, FormControl, FormGroup } from './nodes';

interface Item {
  title: string;
}

interface Order {
  // Члены FormNode — затенены, доступны через `$`.
  value: number;
  issues: string;
  // Прочие имена — поля данных.
  id: string;
  status: 'new' | 'paid';
  fields: string;
  submit: boolean;
  address: { city: string };
  items: Item[];
  tags: string[];
  note?: string;
}

declare const form: FormGroup<Order>;

export function formGroupTypeChecks(): void {
  // Поля данных с прежде занятыми именами — ноды полей.
  const id: FormControl<string> = form.id;
  const status: FormControl<'new' | 'paid'> = form.status;
  const fields: FormControl<string> = form.fields;
  const submit: FormControl<boolean> = form.submit;

  // Затенённые членами FormNode — через `$`.
  const total: ReadonlySignal<Order> = form.value;
  const valueField: FormControl<number> = form.$.value;
  const issuesField: FormControl<string> = form.$.issues;

  // Вложенная группа, массив под-форм, массив примитивов, необязательное поле.
  const city: FormControl<string> = form.address.city;
  const items: FormArray<Item> = form.items;
  const count: number = form.items.length;
  const row: FormGroup<Item> | undefined = form.items.at(0);
  const key: string = form.items.keyAt(0);
  const tags: FormControl<string[]> = form.tags;
  const note: FormControl<string | undefined> = form.note;

  // Удалённые члены ноды больше не компилируются.
  // @ts-expect-error — markAsDirty удалён: dirty ставит setValue
  form.markAsDirty();
  // @ts-expect-error — patchValue удалён: частичную запись делает модель (model.patch)
  form.patchValue({ id: 'x' });
  // @ts-expect-error — getProxy удалён: группа и есть своё лицо
  form.getProxy();
  // @ts-expect-error — у поля нет статуса строкой: valid, invalid, pending, disabled
  void form.address.city.status;
  // @ts-expect-error — validate() ноды удалён: проверяет сборка (bundle.validate())
  void form.items.validate();
  // @ts-expect-error — длина массива — число, а не сигнал
  void form.items.length.value;

  void [id, status, fields, submit, total, valueField, issuesField, city, items, count, row, key];
  void [tags, note];
}
