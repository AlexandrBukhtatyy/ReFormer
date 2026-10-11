import { describe, expect, it } from 'vitest';
import {
  buildBehaviorTs,
  buildValidationSchemaTs,
} from '@reformer/mcp/dist/core/generate/builders.js';
import { normalizeIntent } from '@reformer/mcp/dist/core/generate/form-intent.js';
import { seededRules, wizardRules, wizardRulesSchema, builtinKit } from '../__fixtures__/kit';
import { prepare } from '../context';
import type { FormRules } from '../../form-model/rules';
import { makeNames } from '../naming';
import {
  behaviorFromRules,
  crossStepRulesFromRules,
  formRulesFromRules,
  parseEmittedModule,
  stepOfRule,
  stepRulesFromRules,
} from './rules-bridge';

function wizardCtx() {
  return prepare({
    schema: wizardRulesSchema(),
    formName: 'Анкета',
    kit: builtinKit(),
    rules: wizardRules(),
  });
}

const NAMES = makeNames('Анкета');

describe('разбор вывода билдеров @reformer/mcp', () => {
  // Разбор держится на ФОРМЕ вывода MCP: шапка, импорты, одно объявление
  // `export const … = define…<T>(… => {` и закрывающая `});` на нулевой колонке. Входом здесь
  // служит настоящий вывод билдера, а не его пересказ: поменяет билдер форму — упадёт этот тест.

  const behaviorRules: FormRules = {
    validation: [],
    behavior: [
      {
        kind: 'compute',
        target: 'total',
        sources: ['price', 'qty'],
        expr: 'model.price * model.qty',
      },
      {
        kind: 'computeFrom',
        target: 'fullName',
        sources: ['person.lastName', 'person.firstName'],
        expr: '`${lastName} ${firstName}`.trim()',
      },
      { kind: 'enableWhen', target: 'city', sources: ['country'], expr: 'model.country !== null' },
    ],
    render: [],
  };

  it('поведение: настоящий вывод buildBehaviorTs разбирается на импорт операторов и строки тела', () => {
    const raw = buildBehaviorTs(
      normalizeIntent({
        formName: NAMES.title,
        interfaceName: NAMES.TypeName,
        validation: [],
        behavior: [...behaviorRules.behavior],
        visibility: [],
      })
    );
    // Посылка разбора — на месте: объявление открывается и закрывается так, как ждёт разбор.
    expect(raw).toContain(
      'export const formBehavior = defineFormBehavior<AnketaForm>(({ model }) => {'
    );
    expect(raw.trimEnd().endsWith('});')).toBe(true);

    const parsed = parseEmittedModule(raw);
    expect(parsed.imports).toEqual([
      "import { defineFormBehavior, compute, computeFrom, enableWhen } from '@reformer/core/behaviors';",
    ]);
    // Строки тела — без отступа первого уровня; пояснение билдера о переименованных параметрах
    // остаётся строкой тела, а не теряется.
    expect(parsed.body).toEqual([
      'compute(model.$.total, () => model.price * model.qty);',
      expect.stringMatching(/^\/\/ параметры названы по последнему сегменту/),
      'computeFrom([model.$.person.lastName, model.$.person.firstName], model.$.fullName, (lastName, firstName) => `${lastName} ${firstName}`.trim());',
      'enableWhen(model.$.city, () => model.country !== null);',
    ]);
  });

  it('поведение: в обвязку уходят имена операторов (без объявителя) и строки связей', () => {
    const code = behaviorFromRules(behaviorRules, NAMES);
    // `defineFormBehavior` печатает шаблон — в списке операторов тела его нет.
    expect(code.operators).toEqual(['compute', 'computeFrom', 'enableWhen']);
    expect(code.lines).toHaveLength(4);
    expect(code.lines[0]).toBe('compute(model.$.total, () => model.price * model.qty);');
  });

  it('валидация: настоящий вывод buildValidationSchemaTs — импорты значений и тело с вложенными блоками', () => {
    const raw = buildValidationSchemaTs(seededRules().validation, {
      interfaceName: 'AnketaForm',
      exportName: 'rules',
      typeImport: './types',
      header: 'Шапка, которую разбор обязан пропустить.',
    });
    const parsed = parseEmittedModule(raw);
    // Импорт типа формы в разбор не попадает: его печатает шаблон — со своим путём.
    expect(parsed.imports).toEqual([
      "import { validate, defineValidation, validateWhen } from '@reformer/core/validation';",
      "import { minLength, required } from '@reformer/core/validators';",
    ]);
    // Вложенный блок сохраняет СВОЙ отступ: снимается только отступ первого уровня.
    expect(parsed.body).toEqual([
      'validate(model.$.fullName, [required(), minLength(2)]);',
      'validateWhen(() => model.fullName !== null, () => {',
      '  validate(model.$.agreed, [required()]);',
      '});',
    ]);
  });

  it('текст без объявления — отказ, а не пустое тело', () => {
    // Молча отдать пустое тело значило бы напечатать форму без правил, которые человек
    // считает действующими.
    expect(() => parseEmittedModule("import { a } from 'b';\n")).toThrow(/не разбирается/);
    expect(() => parseEmittedModule('')).toThrow(/не разбирается/);
  });
});

describe('правила простой формы', () => {
  it('все правила валидации — одним набором', () => {
    const code = formRulesFromRules(seededRules(), NAMES);
    expect(code?.body.join('\n')).toContain('model.$.fullName');
    expect(code?.body.join('\n')).toContain('model.$.agreed');
  });

  it('без правил валидации отдаёт null — заготовку печатает шаблон', () => {
    expect(formRulesFromRules({ ...seededRules(), validation: [] }, NAMES)).toBeNull();
  });

  it('правило строки массива печатается от строки, как бы ни была записана его цель', () => {
    // Правила формы пишут цель полным путём (`references.name`): так её принимает проверка
    // целостности правил. Подставленная как есть, она давала `item.$.references.name` — путь,
    // которого у строки нет, и модуль не компилировался.
    const rows = (target: string) =>
      formRulesFromRules(
        {
          ...seededRules(),
          validation: [{ target, each: 'references', rules: ['required'] }],
        },
        NAMES
      );
    const expected = [
      'applyEach(model.$.references, ({ model: item }) => {',
      '  validate(item.$.name, [required()]);',
      '});',
    ];

    expect(rows('references.name')?.body).toEqual(expected);
    // Цель, уже записанная от строки, печатается так же.
    expect(rows('name')?.body).toEqual(expected);
    expect(rows('references.name')?.imports).toEqual([
      "import { validate, defineValidation, applyEach } from '@reformer/core/validation';",
      "import { required } from '@reformer/core/validators';",
    ]);
  });

  it('вложенное поле строки сохраняет свой путь внутри неё', () => {
    const code = formRulesFromRules(
      {
        ...seededRules(),
        validation: [{ target: 'items.price.amount', each: 'items', rules: ['min(1)'] }],
      },
      NAMES
    );
    expect(code?.body.join('\n')).toContain('validate(item.$.price.amount, [min(1)]);');
  });
});

describe('правила визарда по шагам', () => {
  it('правило идёт к шагу по своей цели; вне шагов — никуда', () => {
    const ctx = wizardCtx();
    const [fullName, email, phone, comment] = ctx.rules.validation;
    expect(stepOfRule(fullName!, ctx.layout)?.dir).toBe('dannye');
    expect(stepOfRule(email!, ctx.layout)?.dir).toBe('kontakty');
    // Условие читает другое поле шага — принадлежность решает цель.
    expect(stepOfRule(phone!, ctx.layout)?.dir).toBe('kontakty');
    expect(stepOfRule(comment!, ctx.layout)).toBeUndefined();
  });

  it('набор шага несёт только свои правила и импортирует ровно свои валидаторы', () => {
    const ctx = wizardCtx();
    const code = stepRulesFromRules(ctx.rules, ctx.names, ctx.layout, ctx.layout.steps[1]!);
    const body = code?.body.join('\n') ?? '';
    expect(body).toContain('model.$.contacts.email');
    expect(body).not.toContain('model.$.fullName');
    // Импорт считается по правилам ШАГА: `minLength` нужен первому шагу, а здесь его нет —
    // лишний импорт у пользователя стал бы ошибкой `noUnusedLocals`.
    expect(code?.imports).toEqual([
      "import { validate, defineValidation, validateWhen } from '@reformer/core/validation';",
      "import { email, required } from '@reformer/core/validators';",
    ]);
  });

  it('шаг без своих правил отдаёт null — заготовку печатает шаблон', () => {
    const ctx = wizardCtx();
    const rules = { ...ctx.rules, validation: ctx.rules.validation.slice(1) };
    expect(stepRulesFromRules(rules, ctx.names, ctx.layout, ctx.layout.steps[0]!)).toBeNull();
  });

  it('корень: только правила вне шагов — правил шагов в нём нет', () => {
    // Прежде корень собирал шаги сам (`apply(...stepValidations, restValidation)`) и печатал
    // пошаговый контракт `makeStepCheck`. В едином контракте это делает сборка: правила шагов
    // уходят в неё потоком, а корню остаются правила вне шагов (`crossStepRules` → `extras`).
    const ctx = wizardCtx();
    const code = crossStepRulesFromRules(ctx.rules, ctx.names, ctx.layout);
    const body = code?.body.join('\n') ?? '';
    expect(body).toContain('model.$.comment');
    expect(body).not.toContain('model.$.fullName');
    expect(body).not.toContain('model.$.contacts');
    expect(code?.imports).toEqual([
      "import { validate, defineValidation } from '@reformer/core/validation';",
      "import { maxLength } from '@reformer/core/validators';",
    ]);
  });

  it('все правила в шагах — правил вне шагов нет (null)', () => {
    const ctx = wizardCtx();
    const rules = { ...ctx.rules, validation: ctx.rules.validation.slice(0, 3) };
    expect(crossStepRulesFromRules(rules, ctx.names, ctx.layout)).toBeNull();
  });
});
