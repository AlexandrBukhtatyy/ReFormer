/**
 * Затравки встроенных шаблонов не спорят с каталогом кита.
 *
 * Здесь ловится расхождение, которое иначе видит только человек в открытой форме: затравка задаёт
 * `componentProps`, каталог объявляет их закрытым списком (`additionalProperties: false`), и проп,
 * которого кит не заявил, превращается в диагностику поверх только что созданной формы. Ровно так
 * и вышло с `readOnly` у вычисляемого «Полного имени»: поведение `computeFrom` требует поля,
 * которое не заполняют руками, а схемы полей ui-kit такого пропа не объявляли.
 *
 * Проверяются именно диагностики про свойства компонентов. Полного нуля диагностик на СЫРОЙ
 * затравке не бывает: селекторы render-правил проставляет кодоген из пути поля (builtin.ts:150),
 * поэтому до печати модуля правило указывает на ещё не существующий селектор.
 *
 * @module plugins/templates/stores/seeds-validate.test
 */

import { describe, expect, it } from 'vitest';

import { validateFormSchema } from '@reformer/renderer-json/validate';
import { builtinEntries } from '@/lib/catalog/__fixtures__/builtin-catalog';
import { checkForm } from '@/plugins/validator-schema/check';
import { CODES } from '@/plugins/validator-schema/codes';
import { simpleSeed, simpleRules, wizardSeed, wizardRules } from './builtin';

const PROPERTY_CODES: string[] = [CODES.UNKNOWN_PROPERTY, CODES.UNKNOWN_COMPONENT];

const SEEDS = [
  { name: 'простая форма', schema: simpleSeed(), rules: simpleRules() },
  { name: 'пошаговая форма', schema: wizardSeed(), rules: wizardRules() },
];

describe('затравки встроенных шаблонов', () => {
  it.each(SEEDS)('$name: каталог знает каждый заданный проп', ({ schema, rules }) => {
    const diagnostics = checkForm(
      { resource: 'fs:forms/seed.json', text: JSON.stringify(schema, null, 2), model: schema },
      { catalog: builtinEntries(), rules, validateSchema: validateFormSchema }
    );
    expect(diagnostics.filter((d) => PROPERTY_CODES.includes(d.code))).toEqual([]);
  });
});
