/**
 * Compile-time тест типизации схемы (#5, §4). Проверяется `tsc` (файл под `src`, include:["src"]),
 * НЕ запускается vitest (нет суффикса `.test.`/`.spec.`). Убеждается, что `defineJsonSchema<T>`
 * сужает пути `$model(...)` до Path<T>: валидные пути компилируются, опечатка — ошибка компиляции.
 * Проверяются оба формата документа: формат 2 (основные имена) и прежний (суффикс `V1`).
 */
import { defineJsonSchema } from './json-schema';
import { defineJsonSchemaV1 } from './json-schema-v1';

interface CreditFormShape {
  loanType: string;
  personalData: { firstName: string; lastName: string };
  registrationAddress: { city: string };
  coBorrowers: { name: string }[];
}

// ── Формат 2 ────────────────────────────────────────────────────────────────

// Валидные пути (в т.ч. вложенные), подформа и оба вида шаблона строки компилируются.
export const okSchema = defineJsonSchema<CreditFormShape>({
  format: 2,
  parts: {
    address: {
      component: '$component(Box)',
      // Внутри части пути относительны группе → нетипизированы (Path<unknown> = string).
      children: [{ model: '$model(city)', component: '$component(Input)' }],
    },
    coBorrower: { model: '$model(name)', component: '$component(Input)' },
  },
  root: {
    component: '$component(Box)',
    children: [
      { model: '$model(loanType)', component: '$component(Select)' },
      { model: '$model(personalData.firstName)', component: '$component(Input)' },
      { model: '$model(registrationAddress)', part: '$part(address)' },
      { model: '$model(coBorrowers)', item: '$part(coBorrower)' },
      {
        model: '$model(coBorrowers)',
        // Запасной шаблон нового элемента необязателен.
        item: { $template: { model: '$model(name)', component: '$component(Input)' } },
      },
    ],
  },
});

// Опечатка в пути — ошибка компиляции (директива обязана «сработать», иначе tsc падает
// на "unused @ts-expect-error" — значит типизация ослабла).
export const badSchema = defineJsonSchema<CreditFormShape>({
  format: 2,
  root: {
    component: '$component(Box)',
    children: [
      {
        // @ts-expect-error — нет пути 'loanTyp' в CreditFormShape
        model: '$model(loanTyp)',
        component: '$component(Input)',
      },
    ],
  },
});

// Без `format: 2` документ — не формат 2.
// @ts-expect-error — поле `format` обязательно
export const noFormat = defineJsonSchema({ root: { component: '$component(Box)' } });

// Без параметра T путь — любая строка (схема-строкой-с-сервера).
export const untypedSchema = defineJsonSchema({
  format: 2,
  root: { component: '$component(Box)', children: [{ model: '$model(anything.goes.here)' }] },
});

// ── Прежний формат (v1) ─────────────────────────────────────────────────────

export const okSchemaV1 = defineJsonSchemaV1<CreditFormShape>({
  version: '1.0',
  root: {
    component: '$component(Box)',
    children: [
      { value: '$model(loanType)', component: '$component(Select)' },
      { value: '$model(personalData.firstName)', component: '$component(Input)' },
      {
        array: '$model(coBorrowers)',
        initialValue: { name: '' },
        // Внутри шаблона пути относительны ЭЛЕМЕНТУ → нетипизированы (Path<unknown> = string).
        item: { $template: { value: '$model(name)', component: '$component(Input)' } },
      },
    ],
  },
});

export const badSchemaV1 = defineJsonSchemaV1<CreditFormShape>({
  version: '1.0',
  root: {
    component: '$component(Box)',
    children: [
      {
        // @ts-expect-error — нет пути 'loanTyp' в CreditFormShape
        value: '$model(loanTyp)',
        component: '$component(Input)',
      },
    ],
  },
});
