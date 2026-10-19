/**
 * Затравки встроенных шаблонов не спорят с каталогом кита.
 *
 * Здесь ловится расхождение, которое иначе видит только человек в открытой форме: затравка задаёт
 * `componentProps`, каталог объявляет их закрытым списком (`additionalProperties: false`), и проп,
 * которого кит не заявил, превращается в диагностику поверх только что созданной формы. Ровно так
 * и вышло с `readOnly` у вычисляемого «Полного имени»: поведение `computeFrom` требует поля,
 * которое не заполняют руками, а схемы полей ui-kit такого пропа не объявляли.
 *
 * Находок на затравке не должно быть ВОВСЕ — ни про пропсы, ни про правила. Раньше полного нуля
 * не выходило: правило узла адресовало селектор, который проставлял только кодоген при печати,
 * и до неё указывало в никуда. Теперь селектор проставляет сама затравка, и сырая затравка
 * проходит ту же проверку, что и открытая в редакторе форма.
 *
 * То же — под внешним китом (HexaUI): затравка подгоняется под его каталог и обязана пройти
 * проверку ПРОТИВ НЕГО, а не против встроенного. Каталог HexaUI сгенерирован из типов кита и
 * объявляет пропсы закрытым списком у каждой записи — проп затравки, которого обёртка HexaUI не
 * знает, из затравки уходит, а не всплывает диагностикой.
 *
 * ## Почему тест лежит в композиции, а не рядом с затравками
 *
 * Он сверяет ДВА плагина: затравки шаблонов проверяются проверкой редактора схемы
 * (`plugins/reformer/validator`) против каталога кита. Плагину чужой плагин не виден — это
 * держит линтер, — поэтому единственное место, где обе стороны встречаются, есть композиция.
 * Лёжа рядом с затравками, тест два месяца валил `npm run lint` пакета двумя ошибками
 * `no-restricted-imports`, и это было видно только в полном прогоне линтера.
 *
 * @module shell/boot/integration/templates-seeds-validate.test
 */

import { describe, expect, it } from 'vitest';

import { validateFormSchema } from '@reformer/renderer-json/validate';
import hexaCatalog from '../../kit-hexa-ui/catalog.json';
import { projectCatalog } from '../core/catalog';
import { ARRAY_COMPONENT_NAME, collectOperatorNames } from '../core/form-model';
import { builtinCatalog } from '../core/testing';
import { checkForm } from '../validator/src/check';
import {
  hasWizard,
  seedKitOf,
  simpleRules,
  simpleSeed,
  wizardRules,
  wizardSeed,
} from '../templates/src';

const BUILTIN = builtinCatalog();
/**
 * НАСТОЯЩИЙ кит HexaUI проекта-образца: полный каталог из типов кита — все поля анкеты и адаптер
 * визарда, но без компонента массива.
 */
const HEXA = projectCatalog(hexaCatalog as never);

const BUILTIN_KIT = seedKitOf(BUILTIN.entries, BUILTIN.descriptor);
const HEXA_KIT = seedKitOf(HEXA.entries, HEXA.descriptor);

const CASES = [
  {
    name: 'простая форма, встроенный кит',
    catalog: BUILTIN.entries,
    schema: simpleSeed(BUILTIN_KIT),
    rules: simpleRules(BUILTIN_KIT),
  },
  {
    name: 'пошаговая форма, встроенный кит',
    catalog: BUILTIN.entries,
    schema: wizardSeed(BUILTIN_KIT),
    rules: wizardRules(BUILTIN_KIT),
  },
  {
    name: 'простая форма, HexaUI',
    catalog: HEXA.entries,
    schema: simpleSeed(HEXA_KIT),
    rules: simpleRules(HEXA_KIT),
  },
  {
    name: 'пошаговая форма, HexaUI',
    catalog: HEXA.entries,
    schema: wizardSeed(HEXA_KIT),
    rules: wizardRules(HEXA_KIT),
  },
];

describe('затравки встроенных шаблонов', () => {
  it.each(CASES)('$name: проверка редактора схемы не находит ничего', (seed) => {
    const diagnostics = checkForm(
      {
        resource: 'fs:forms/seed.json',
        text: JSON.stringify(seed.schema, null, 2),
        model: seed.schema,
      },
      { catalog: seed.catalog, rules: seed.rules, validateSchema: validateFormSchema }
    );
    expect(diagnostics).toEqual([]);
  });

  it('под встроенным китом затравка — анкета целиком', () => {
    // Подгонка под кит не должна ничего отнять у кита, в котором есть всё.
    expect(simpleSeed(BUILTIN_KIT)).toEqual(simpleSeed());
    expect(wizardSeed(BUILTIN_KIT)).toEqual(wizardSeed());
    expect(hasWizard(BUILTIN_KIT)).toBe(true);
  });

  it('под HexaUI в затравке только то, что кит поставляет', () => {
    const known = new Set(HEXA.entries.map((entry) => entry.name));

    for (const seed of [simpleSeed(HEXA_KIT), wizardSeed(HEXA_KIT)]) {
      const used = collectOperatorNames(seed).components;
      for (const component of used) expect(known.has(component), component).toBe(true);
      // Полный каталог: маска, радиогруппа, дата, комбобоксы и загрузка файлов у кита есть.
      for (const present of [
        'InputMask',
        'RadioGroup',
        'DatePicker',
        'Combobox',
        'ComboboxMulti',
        'FileUploadDropzone',
      ]) {
        expect(used, present).toContain(present);
      }
      // Компонента массива у кита нет — нет и массива рекомендателей.
      expect(used).not.toContain(ARRAY_COMPONENT_NAME);
    }
    // Адаптер визарда у кита есть (`kit.adapters.wizard`): пошаговая форма собирается.
    expect(hasWizard(HEXA_KIT)).toBe(true);
  });
});
