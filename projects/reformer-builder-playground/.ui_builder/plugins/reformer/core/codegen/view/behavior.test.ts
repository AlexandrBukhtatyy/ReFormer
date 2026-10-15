/**
 * Поведение формы: одна модель вида на `behavior/index.ts`.
 *
 * Текст файла удерживают побайтовые снимки (`plugins/reformer/codegen/golden.test.ts`, комбинации
 * `plain-rules` и `wizard-rules`). Здесь — РЕШЕНИЯ, которые снимок показывает только следствием:
 * какие параметры области деструктурировать, какие операторы импортировать и к какому шагу
 * относится правило узла.
 *
 * @module plugins/reformer/core/codegen/view/behavior.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import type { FormRules } from '../../form-model/rules';
import {
  builtinKit,
  partsRules,
  partsSchema,
  partsWizardSchema,
  plainSchema,
  rowRules,
  rowRulesSchema,
  seededRules,
  wizardRules,
  wizardRulesSchema,
} from '../__fixtures__/kit';
import { prepare, type CodegenInput } from '../context';
import { behaviorView, mentions, scopeParamsOf } from './behavior';

function viewOf(input: Partial<CodegenInput> = {}) {
  return behaviorView(
    prepare({
      schema: input.schema ?? plainSchema(),
      formName: 'Анкета',
      kit: builtinKit(),
      rules: input.rules,
    })
  );
}

describe('параметры области поведения — по тексту тела', () => {
  it('имя читается как слово: часть другого имени и свойство не считаются', () => {
    expect(mentions('model.price * 2', 'model')).toBe(true);
    expect(mentions('`${model.lastName}`.trim()', 'model')).toBe(true);
    expect(mentions('formData.total', 'form')).toBe(false);
    expect(mentions('event.model', 'model')).toBe(false);
    expect(mentions('reform()', 'form')).toBe(false);
  });

  it('строковый литерал не делает имя читаемым', () => {
    // Подпись «Contact form» в пропсах — текст, а не обращение к форме: деструктурированный и
    // неиспользованный `form` стал бы у пользователя ошибкой `noUnusedParameters`.
    expect(mentions('schema.node(\'x\').patchProps({ label: "Contact form" });', 'form')).toBe(
      false
    );
    expect(mentions("schema.node('model-section')", 'model')).toBe(false);
    expect(mentions("schema.node('model-section')", 'schema')).toBe(true);
  });

  it('порядок параметров постоянный и не зависит от порядка появления в теле', () => {
    expect(
      scopeParamsOf(["hideWhen(schema.node('a'), () => form.x.value.value && model.y);"])
    ).toEqual(['model', 'form', 'schema']);
    expect(scopeParamsOf([])).toEqual([]);
  });
});

describe('модель файла поведения', () => {
  it('без правил: исполняемых строк нет, область не читается, импорт — только объявитель', () => {
    const view = viewOf();
    expect(view.hasCode).toBe(false);
    expect(view.scope).toEqual([]);
    expect(view.imports).toEqual(['defineFormBehavior']);
    expect(view.links).toEqual([]);
    // Заготовка `hideWhen` для секции — комментарий, а не код: ни импорта, ни параметра она
    // не требует.
    expect(view.groups).toEqual([
      {
        step: null,
        rules: [],
        scaffold: [{ selector: 'lichnye-dannye-section', label: 'Личные данные' }],
      },
    ]);
  });

  it('связи и правила узлов — в одном теле: импорты и область считаются по обоим', () => {
    const view = viewOf({ rules: seededRules() });
    expect(view.hasCode).toBe(true);
    expect(view.imports).toEqual([
      'computeFrom',
      'defineFormBehavior',
      'hideWhen',
      'onComponentEvent',
    ]);
    // `model` — из связей, `form` — из условий правил узлов, `schema` — из адресов узлов.
    expect(view.scope).toEqual(['model', 'form', 'schema']);
    // Связь длиннее строки: аргументы уходят по одному на строку — так её оставит форматтер.
    expect(view.links).toEqual([
      'computeFrom(',
      '  [model.$.fullName],',
      '  model.$.agreed,',
      '  (fullName) => fullName !== null && fullName.length > 1',
      ');',
    ]);
    // Секция с правилом видимости заготовку не получает — правило уже есть.
    expect(view.groups).toHaveLength(1);
    expect(view.groups[0]?.scaffold).toEqual([]);
    expect(view.groups[0]?.rules.map((rule) => rule.lines[0])).toEqual([
      "hideWhen(schema.node('lichnye-dannye-section'), () => !form.agreed.value.value);",
      "schema.node('full-name').patchProps({",
      "onComponentEvent(schema.node('full-name'), 'onBlur', (...args: unknown[]) => {",
      "onComponentEvent(schema.node('full-name'), 'onFocus', async (...args: unknown[]) => {",
    ]);
    // Пропсы, не поместившиеся в строку, разворачиваются по одному; `$expr(...)` — выражением,
    // остальное — литералом в стиле проекта (одинарные кавычки, хвостовая запятая).
    expect(view.groups[0]?.rules[1]?.lines).toEqual([
      "schema.node('full-name').patchProps({",
      "  placeholder: 'Иванов Иван',",
      '  maxLength: 64,',
      '  disabled: !form.agreed.value.value,',
      '});',
    ]);
  });

  it('визард: правила узлов сгруппированы — вне шагов, затем по шагам', () => {
    const view = viewOf({ schema: wizardRulesSchema(), rules: wizardRules() });
    expect(view.groups.map((group) => group.step?.title ?? null)).toEqual([
      null,
      'Данные',
      'Контакты',
    ]);
    // Узел вне шагов — в первой группе, узел шага — в группе своего шага.
    expect(view.groups[0]?.rules[0]?.lines).toEqual([
      "hideWhen(schema.node('dopolnitelno-section'), () => false);",
    ]);
    expect(view.groups[2]?.rules[0]?.lines).toEqual([
      "hideWhen(schema.node('kontakty-section'), () => !form.fullName.value.value);",
    ]);
    // Шаг без правила видимости получает заготовку, шаг с правилом — нет.
    expect(view.groups[1]).toMatchObject({
      rules: [],
      scaffold: [{ selector: 'dannye-section', label: 'Данные' }],
    });
    expect(view.groups[2]?.scaffold).toEqual([]);
    // Связей над моделью нет, поэтому `model` не деструктурируется.
    expect(view.scope).toEqual(['form', 'schema']);
    expect(view.imports).toEqual(['defineFormBehavior', 'hideWhen']);
  });
});

describe('правила узлов — в области своего узла', () => {
  const view = () => viewOf({ schema: rowRulesSchema(), rules: rowRules() });

  it('правило по узлу шаблона строки уходит в поведение строки, а не в корень', () => {
    const { groups, rows } = view();
    const rootCode = groups.flatMap((group) => group.rules.flatMap((rule) => rule.lines));
    // Корню остаётся только сам узел-массив: его рисует родительская область.
    expect(rootCode).toEqual(["hideWhen(schema.node('references'), () => !model.hasReferences);"]);

    const row = rows.find((candidate) => candidate.name === 'referencesRow');
    expect(row?.rules.flatMap((rule) => rule.lines)).toEqual([
      "hideWhen(schema.node('ref-phone'), () => model.noPhone);",
      "schema.node('ref-name').patchProps({ placeholder: 'Имя рекомендателя' });",
    ]);
  });

  it('тип строки берётся от типа родительской области, вложенной — от типа внешней строки', () => {
    const { rows } = view();
    expect(rows.map((row) => [row.typeName, row.typeExpr, row.path])).toEqual([
      // Вложенная строка объявлена раньше внешней: внешняя на неё ссылается.
      ['ReferencesContactsRow', "ReferencesRow['contacts'][number]", 'references[].contacts'],
      ['ReferencesRow', "AnketaForm['references'][number]", 'references'],
    ]);
  });

  it('области подключаются цепочкой: корень — строку, строка — вложенную строку', () => {
    const { applies, rows, imports } = view();
    expect(applies).toEqual(['applyEach(model.$.references, referencesRow);']);
    expect(rows.find((row) => row.name === 'referencesRow')?.applies).toEqual([
      'applyEach(model.$.contacts, referencesContactsRow);',
    ]);
    expect(imports).toContain('applyEach');
  });

  it('параметры области считаются по коду своей области', () => {
    const { scope, rows } = view();
    // Корень читает модель формы и свои узлы; строка — свою модель и свои узлы.
    expect(scope).toEqual(['model', 'schema']);
    expect(rows.map((row) => row.scope)).toEqual([
      ['model', 'schema'],
      ['model', 'schema'],
    ]);
  });

  it('строка без правил поведения не получает — подключать нечего', () => {
    const quiet = viewOf({
      schema: rowRulesSchema(),
      rules: {
        validation: [],
        behavior: [],
        render: [{ kind: 'hideWhen', selector: 'references', condition: '!model.hasReferences' }],
      },
    });
    expect(quiet.rows).toEqual([]);
    expect(quiet.applies).toEqual([]);
    expect(quiet.imports).not.toContain('applyEach');
  });

  it('правило только у вложенной строки: внешняя строка печатается ради подключения', () => {
    const nested = viewOf({
      schema: rowRulesSchema(),
      rules: {
        validation: [],
        behavior: [],
        render: [{ kind: 'hideWhen', selector: 'contact-value', condition: 'model.hidden' }],
      },
    });
    expect(nested.rows.map((row) => row.name)).toEqual(['referencesContactsRow', 'referencesRow']);
    const outer = nested.rows[1];
    expect(outer?.rules).toEqual([]);
    // Внешней строке узлы не нужны — только модель, чтобы дотянуться до вложенного массива.
    expect(outer?.scope).toEqual(['model']);
    // Корню правил узлов не досталось, но подключение строки — исполняемый код.
    expect(nested.hasCode).toBe(true);
    expect(nested.scope).toEqual(['model']);
  });
});

describe('правила узлов именованных частей документа', () => {
  const hide = (selector: string, condition = 'false'): FormRules['render'][number] => ({
    kind: 'hideWhen',
    selector,
    condition,
  });
  const rules = (...render: FormRules['render']): FormRules => ({
    validation: [],
    behavior: [],
    render,
  });

  it('правило по узлу части уходит в поведение части, а не в корень', () => {
    const view = viewOf({ schema: partsSchema(), rules: partsRules() });
    expect(view.rows.map((row) => [row.kind, row.part, row.name, row.typeName])).toEqual([
      ['part', 'address', 'addressPart', 'AddressPart'],
      ['part', 'guest', 'guestPart', 'GuestPart'],
    ]);
    const address = view.rows[0];
    expect(address.rules.flatMap((rule) => rule.lines)).toEqual([
      "hideWhen(schema.node('address-apartment'), () => model.noApartment);",
    ]);
    // Корню остаётся только свой узел.
    expect(view.groups.flatMap((group) => group.rules.flatMap((rule) => rule.lines))).toEqual([
      "hideWhen(schema.node('work-section'), () => model.sameAddress);",
    ]);
  });

  it('тип области части — от ПЕРВОГО подключения: группа либо строка массива', () => {
    const view = viewOf({ schema: partsSchema(), rules: partsRules() });
    expect(view.rows.map((row) => [row.typeExpr, row.path])).toEqual([
      ["AnketaForm['home']", 'home'],
      ["AnketaForm['guests'][number]", 'guests'],
    ]);
  });

  it('подформы одной части в одной области — одним вызовом со списком; массив — applyEach', () => {
    const view = viewOf({ schema: partsSchema(), rules: partsRules() });
    expect(view.applies).toEqual([
      'apply([model.$.home, model.$.work], addressPart);',
      'applyEach(model.$.guests, guestPart);',
    ]);
    expect(view.appliesParts).toBe(true);
    expect(view.appliesRows).toBe(false);
    expect(view.imports).toEqual(['apply', 'applyEach', 'defineFormBehavior', 'hideWhen']);
  });

  it('часть внутри части подключается из поведения внешней — уже объявленной константой', () => {
    const guest = viewOf({ schema: partsSchema(), rules: partsRules() }).rows[1];
    expect(guest.applies).toEqual(['apply(model.$.address, addressPart);']);
    expect(guest.appliesParts).toBe(true);
    expect(guest.scope).toEqual(['model', 'schema']);
  });

  it('единственная подформа — без списка', () => {
    const schema = partsSchema();
    (schema.root as { children: unknown[] }).children.splice(2, 1);
    (schema.parts as Record<string, unknown>).guest = { component: '$component(Box)' };
    const view = viewOf({ schema, rules: rules(hide('address-apartment')) });
    expect(view.applies).toEqual(['apply(model.$.home, addressPart);']);
    expect(view.imports).toEqual(['apply', 'defineFormBehavior', 'hideWhen']);
  });

  it('часть без правил не печатается и не подключается', () => {
    const view = viewOf({ schema: partsSchema(), rules: rules(hide('work-section')) });
    expect(view.rows).toEqual([]);
    expect(view.applies).toEqual([]);
    expect(view.imports).toEqual(['defineFormBehavior', 'hideWhen']);
  });

  it('правило только у вложенной части: внешняя печатается ради подключения', () => {
    // Из корня `address` в этом документе не подключена: тип — от подключения из части `guest`.
    const schema = partsSchema();
    (schema.root as { children: unknown[] }).children.splice(1, 2);
    const view = viewOf({ schema, rules: rules(hide('address-apartment')) });
    expect(view.rows.map((row) => [row.name, row.typeExpr, row.path])).toEqual([
      ['addressPart', "GuestPart['address']", 'guests[].address'],
      ['guestPart', "AnketaForm['guests'][number]", 'guests'],
    ]);
    expect(view.rows[1].rules).toEqual([]);
    expect(view.applies).toEqual(['applyEach(model.$.guests, guestPart);']);
  });

  it('строка, вписанная в узел части, — своя область внутри области части', () => {
    const schema = partsSchema();
    (schema.parts as Record<string, { children: unknown[] }>).address.children.push({
      model: '$model(phones)',
      component: '$component(FieldArray)',
      item: {
        $template: {
          component: '$component(Box)',
          children: [
            { selector: 'phone-number', model: '$model(number)', component: '$component(Input)' },
          ],
        },
      },
    });
    const view = viewOf({ schema, rules: rules(hide('phone-number')) });
    expect(view.rows.map((row) => [row.kind, row.name, row.typeExpr, row.path])).toEqual([
      ['row', 'addressPhonesRow', "AddressPart['phones'][number]", 'home.phones'],
      ['part', 'addressPart', "AnketaForm['home']", 'home'],
      ['part', 'guestPart', "AnketaForm['guests'][number]", 'guests'],
    ]);
    expect(view.rows[1].applies).toEqual(['applyEach(model.$.phones, addressPhonesRow);']);
    expect(view.rows[1].appliesParts).toBe(false);
    expect(view.appliesRows).toBe(false);
  });

  it('часть, подключающая саму себя: поведение подключает само себя и не зацикливает сборку', () => {
    const schema = {
      format: 2,
      parts: {
        category: {
          component: '$component(Box)',
          children: [
            { selector: 'category-title', model: '$model(title)', component: '$component(Input)' },
            { model: '$model(children)', item: '$part(category)' },
          ],
        },
      },
      root: {
        component: '$component(Box)',
        children: [{ model: '$model(catalog)', item: '$part(category)' }],
      },
    } as unknown as JsonFormSchema;
    const view = viewOf({ schema, rules: rules(hide('category-title')) });
    expect(view.rows.map((row) => row.name)).toEqual(['categoryPart']);
    expect(view.rows[0].applies).toEqual(['applyEach(model.$.children, categoryPart);']);
    expect(view.applies).toEqual(['applyEach(model.$.catalog, categoryPart);']);
  });

  it('узел части, которая нигде не подключена: правило остаётся в корне, как и раньше', () => {
    const schema = partsSchema();
    (schema.parts as Record<string, unknown>).orphan = {
      selector: 'orphan-box',
      component: '$component(Box)',
    };
    const view = viewOf({ schema, rules: rules(hide('orphan-box')) });
    expect(view.rows).toEqual([]);
    expect(view.groups.flatMap((group) => group.rules.flatMap((rule) => rule.lines))).toEqual([
      "hideWhen(schema.node('orphan-box'), () => false);",
    ]);
  });

  it('части в шагах визарда: узел шага — в группе шага, узел части — в поведении части', () => {
    const view = viewOf({ schema: partsWizardSchema(), rules: partsRules() });
    expect(view.groups.map((group) => group.step?.title ?? null)).toEqual(['Адреса', 'Гости']);
    expect(view.groups[0].rules.flatMap((rule) => rule.lines)).toEqual([
      "hideWhen(schema.node('work-section'), () => model.sameAddress);",
    ]);
    expect(view.rows.map((row) => row.name)).toEqual(['addressPart', 'guestPart']);
  });

  it('строки и части вместе: вид подключений назван обоими флагами', () => {
    const schema = partsSchema();
    (schema.root as { children: unknown[] }).children.push({
      model: '$model(tags)',
      component: '$component(FieldArray)',
      item: {
        $template: {
          component: '$component(Box)',
          children: [
            { selector: 'tag-label', model: '$model(label)', component: '$component(Input)' },
          ],
        },
      },
    });
    const view = viewOf({ schema, rules: rules(hide('address-apartment'), hide('tag-label')) });
    expect(view.appliesParts).toBe(true);
    expect(view.appliesRows).toBe(true);
    expect(view.applies).toEqual([
      'apply([model.$.home, model.$.work], addressPart);',
      'applyEach(model.$.guests, guestPart);',
      'applyEach(model.$.tags, tagsRow);',
    ]);
  });
});
