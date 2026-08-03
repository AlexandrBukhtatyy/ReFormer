/**
 * Compile-time тест типизации схемы (#5, §4). Проверяется `tsc` (файл под `src`, include:["src"]),
 * НЕ запускается vitest (нет суффикса `.test.`/`.spec.`). Убеждается, что `defineJsonSchema<T>`
 * сужает пути `$model(...)` до Path<T>: валидные пути компилируются, опечатка — ошибка компиляции.
 */
import { defineJsonSchema } from './json-schema';

interface CreditFormShape {
  loanType: string;
  personalData: { firstName: string; lastName: string };
  coBorrowers: { name: string }[];
}

// Валидные пути (в т.ч. вложенные) компилируются.
export const okSchema = defineJsonSchema<CreditFormShape>({
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

// Опечатка в пути — ошибка компиляции (директива обязана «сработать», иначе tsc падает
// на "unused @ts-expect-error" — значит типизация ослабла).
export const badSchema = defineJsonSchema<CreditFormShape>({
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

// Без параметра T путь — любая строка (обратная совместимость / схема-строкой-с-сервера).
export const untypedSchema = defineJsonSchema({
  version: '1.0',
  root: { component: '$component(Box)', children: [{ value: '$model(anything.goes.here)' }] },
});
