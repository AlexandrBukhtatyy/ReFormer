/**
 * Compile-time тест типа узла схемы. Проверяется `tsc` (файл под `src`, `include: ["src"]`);
 * vitest его НЕ запускает — нет суффикса `.test.`.
 *
 * Убеждается, что узел — один из четырёх видов и вид проверяется по привязке: поле привязано к
 * листу или массиву, массив под-форм — к массиву вместе с `item`, подформа — к группе вместе с
 * `part`. Опечатка в ключе и узлы под произвольными ключами — ошибки компиляции.
 */

import type { FormModel } from '../../model/types';
import type { FormSchemaNode } from './schema-node';

interface Address {
  city: string;
}
interface Phone {
  number: string;
}
interface Shape {
  title: string;
  amount: number | null;
  tags: string[];
  files: File[] | null;
  address: Address;
  phones: Phone[];
}

const Input = (): null => null;

const address = (model: FormModel<Address>): FormSchemaNode => ({
  children: [{ model: model.$.city, component: Input }],
});
const phone = (model: FormModel<Phone>): FormSchemaNode => ({
  children: [{ model: model.$.number, component: Input }],
});

export function schemaNodeTypeChecks(model: FormModel<Shape>): FormSchemaNode[] {
  // Четыре вида узла.
  const field: FormSchemaNode = {
    model: model.$.title,
    component: Input,
    componentProps: { label: 'Название' },
    disabled: true,
  };
  const nullableField: FormSchemaNode = { model: model.$.amount, component: Input };
  // Массив целиком — одно значение поля: мультивыбор, теги, файлы.
  const arrayValueField: FormSchemaNode = { model: model.$.tags, component: Input };
  const nullableArrayField: FormSchemaNode = { model: model.$.files, component: Input };
  const array: FormSchemaNode = {
    model: model.$.phones,
    component: Input,
    item: phone,
    initialValue: { number: '' },
  };
  const part: FormSchemaNode = { model: model.$.address, part: address };
  const container: FormSchemaNode = {
    selector: 'contacts',
    component: 'section',
    componentProps: { className: 'grid' },
    children: ['Телефоны: ', model.$.title, 42, field, array, part],
  };
  const empty: FormSchemaNode = {};

  // @ts-expect-error — опечатка в ключе
  const typo: FormSchemaNode = { model: model.$.title, componnet: Input };
  // @ts-expect-error — прежний ключ привязки поля
  const legacyValue: FormSchemaNode = { value: model.$.title, component: Input };
  // @ts-expect-error — прежний ключ привязки массива
  const legacyArray: FormSchemaNode = { array: model.phones, item: phone };
  // @ts-expect-error — узлы под произвольными ключами: дети пишутся в `children`
  const record: FormSchemaNode = { title: { model: model.$.title, component: Input } };
  // @ts-expect-error — группа без `part` полем не бывает
  const groupWithoutPart: FormSchemaNode = { model: model.$.address, component: Input };
  // @ts-expect-error — `item` не на массиве
  const itemOnLeaf: FormSchemaNode = { model: model.$.title, item: phone };
  // @ts-expect-error — `item` на группе
  const itemOnGroup: FormSchemaNode = { model: model.$.address, item: phone };
  // @ts-expect-error — `part` на листе
  const partOnLeaf: FormSchemaNode = { model: model.$.title, part: address };
  // @ts-expect-error — `part` на массиве
  const partOnArray: FormSchemaNode = { model: model.$.phones, part: address };
  // @ts-expect-error — привязка value-фасадом вместо ручки `model.$.<path>`
  const facadeBinding: FormSchemaNode = { model: model.title, component: Input };
  // @ts-expect-error — у поля нет детей: дети есть только у контейнера
  const fieldWithChildren: FormSchemaNode = { model: model.$.title, children: [] };
  // @ts-expect-error — узел либо массив под-форм, либо подформа
  const itemAndPart: FormSchemaNode = { model: model.$.phones, item: phone, part: address };

  return [
    field,
    nullableField,
    arrayValueField,
    nullableArrayField,
    array,
    part,
    container,
    empty,
    typo,
    legacyValue,
    legacyArray,
    record,
    groupWithoutPart,
    itemOnLeaf,
    itemOnGroup,
    partOnLeaf,
    partOnArray,
    facadeBinding,
    fieldWithChildren,
    itemAndPart,
  ];
}
