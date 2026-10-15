/**
 * Вид генерации: поток шагов, валидация, отправка и импорты между папками ролей.
 *
 * Тексты файлов удерживают побайтовые снимки (`plugins/reformer/codegen/golden.test.ts`). Здесь
 * проверяются решения вида и то, что шаблон раскладывает их без потерь: `id` шага потока — это
 * селектор узла шага, псевдоним правил — имя шага, а правила формы и визарда уходят в сборку
 * разными полями.
 *
 * @module plugins/reformer/core/codegen/view/view.test
 */

import { describe, expect, it } from 'vitest';
import { renderTemplate } from '@reformer/builder-toolkit';
import {
  builtinKit,
  plainSchema,
  seededRules,
  wizardRules,
  wizardRulesSchema,
  wizardSchema,
  wizardSlugsSchema,
  wizardSplitSource,
} from '../__fixtures__/kit';
import { prepare, type CodegenInput } from '../context';
import { createTemplate, flowTemplate, submitTemplate, validationTemplate } from '../templates';
import { buildView, stepView } from './index';

function ctxOf(input: Partial<CodegenInput> = {}) {
  return prepare({
    schema: input.schema ?? plainSchema(),
    formName: 'Анкета',
    kit: builtinKit(),
    ...input,
  });
}

function viewOf(input: Partial<CodegenInput> = {}) {
  return buildView(ctxOf(input));
}

describe('поток шагов', () => {
  it('id шага — селектор узла шага в схеме, псевдоним правил — по имени шага', () => {
    const view = viewOf({ schema: wizardRulesSchema() });
    expect(
      view.layout.steps.map((step) => ({
        id: step.id,
        alias: step.rulesAlias,
        from: step.rulesImport,
      }))
    ).toEqual([
      { id: 'dannye-section', alias: 'dannyeRules', from: '../validation/dannye' },
      { id: 'kontakty-section', alias: 'kontaktyRules', from: '../validation/kontakty' },
    ]);
  });

  it('id шага совпадает с селектором, который уйдёт в документ формы', () => {
    // Поток связывает шаг с разметкой по селектору: разойдись они, визард не нашёл бы шаг.
    const ctx = ctxOf({ schema: wizardSlugsSchema() });
    const selectors = JSON.stringify(ctx.schema);
    const steps = buildView(ctx).layout.steps;
    expect(steps.map((step) => step.id)).toEqual([
      'kontakty-section',
      'kontakty-section-2',
      'step-3',
    ]);
    for (const step of steps) expect(selectors).toContain(`"selector":"${step.id}"`);
  });

  it('шаблон потока печатает шаги по порядку с их правилами', () => {
    const code = renderTemplate('test.flow', flowTemplate, viewOf({ schema: wizardSlugsSchema() }));
    expect(code).toContain("import type { AnketaForm } from '../types/anketa';");
    expect(code).toContain("import { stepRules as kontaktyRules } from '../validation/kontakty';");
    expect(code).toContain(
      "import { stepRules as kontakty2Rules } from '../validation/kontakty-2';"
    );
    expect(code).toContain("import { stepRules as step3Rules } from '../validation/step-3';");
    expect(code).toContain('export const formFlow: FormFlowConfig<AnketaForm> = {');
    expect(code).toContain(
      [
        "    { id: 'kontakty-section', rules: kontaktyRules },",
        "    { id: 'kontakty-section-2', rules: kontakty2Rules },",
        "    { id: 'step-3', rules: step3Rules },",
      ].join('\n')
    );
  });
});

describe('валидация: простая форма против визарда', () => {
  it('простая форма без правил — заготовка formRules из required схемы, поле rules', () => {
    const { validation } = viewOf().rules;
    expect(validation).toMatchObject({ rulesName: 'formRules', field: 'rules' });
    expect(validation.block?.body).toEqual(['validate(model.$.fullName, [required()]);']);
  });

  it('простая форма с правилами — тело из правил; required из схемы не дублируется', () => {
    const { validation } = viewOf({ rules: seededRules() }).rules;
    expect(validation.block?.body[0]).toBe(
      'validate(model.$.fullName, [required(), minLength(2)]);'
    );
    expect(validation.block?.usesModel).toBe(true);
  });

  it('визард: корню — только правила вне шагов, и уходят они полем extras', () => {
    const view = viewOf({ schema: wizardRulesSchema(), rules: wizardRules() });
    expect(view.rules.validation).toMatchObject({ rulesName: 'crossStepRules', field: 'extras' });
    expect(view.rules.validation.block?.body).toEqual([
      'validate(model.$.comment, [maxLength(500)]);',
    ]);
    const code = renderTemplate('test.validation', validationTemplate, view);
    expect(code).toContain('export const crossStepRules = defineValidation<AnketaForm>(');
    // Живая проверка включена стратегией: замечание уходит, когда исправленное поле теряет фокус.
    expect(code).toContain(
      [
        'export const formValidation: FormValidation<AnketaForm> = {',
        '  extras: crossStepRules,',
        "  strategy: 'change',",
        '};',
      ].join('\n')
    );
    // Прежний контракт из вывода ушёл: шаги собирает сборка, а не корневой файл.
    expect(code).not.toContain('makeStepCheck');
    expect(code).not.toContain('stepValidations');
  });

  it('визард без правил вне шагов — пустая валидация, объявлять нечего', () => {
    const view = viewOf({ schema: wizardSchema() });
    expect(view.rules.validation.block).toBeNull();
    const code = renderTemplate('test.validation', validationTemplate, view);
    // Правил вне шагов нет, а стратегия живой проверки есть: полный набор сборка собирает из шагов.
    expect(code).toContain(
      "export const formValidation: FormValidation<AnketaForm> = { strategy: 'change' };"
    );
    expect(code).not.toContain('defineValidation');
  });

  it('шаг: правила из правил формы, а без них у шага — пустая заготовка', () => {
    const ctx = ctxOf({ schema: wizardRulesSchema(), rules: wizardRules() });
    const second = stepView(ctx, ctx.layout.steps[1]!);
    expect(second.files.validation).toBe('validation/kontakty.ts');
    expect(second.imports.types).toBe('../types/anketa');
    expect(second.validation.body[0]).toBe(
      'validate(model.$.contacts.email, [required(), email()]);'
    );

    // С правилами формы обязательность задают правила: шаг без своих правил печатает пустое
    // тело, а не `required` из схемы.
    const rules = { ...wizardRules(), validation: wizardRules().validation.slice(1) };
    const bare = ctxOf({ schema: wizardRulesSchema(), rules });
    expect(stepView(bare, bare.layout.steps[0]!).validation).toMatchObject({
      body: [],
      usesModel: false,
    });
  });
});

describe('отправка', () => {
  it('простую форму отправляет кнопка: проверка всех правил — в самой отправке', () => {
    const view = viewOf();
    expect(view.submit).toEqual({ selector: 'submit', event: 'onClick', byWizard: false });
    const code = renderTemplate('test.submit', submitTemplate, view);
    expect(code).toContain("import { formRules } from '../validation/form';");
    expect(code).toContain('validateModel(model, formRules, { touch: true })');
  });

  it('визард отправляет сам — после полной проверки; набора правил формы отправке не нужно', () => {
    const view = viewOf({ schema: wizardSchema() });
    expect(view.submit).toEqual({ selector: 'wizard', event: 'onSubmit', byWizard: true });
    const code = renderTemplate('test.submit', submitTemplate, view);
    expect(code).toContain(
      "onComponentEvent(schema.node('wizard'), 'onSubmit', async (values: AnketaForm) => {"
    );
    expect(code).not.toContain('formRules');
    expect(code).not.toContain('validateModel');
  });
});

describe('импорты между папками ролей', () => {
  it('it.rel считает спецификатор по ролям файлов', () => {
    const view = viewOf();
    expect(view.rel('create', 'types')).toBe('../types/anketa');
    expect(view.rel('create', 'behavior')).toBe('../behavior');
    expect(view.rel('page', 'create')).toBe('./application/create');
    expect(view.rel('registry', 'constants')).toBe('../constants/anketa');
  });

  it('документ в корне модуля: сборка импортирует его оттуда', () => {
    const view = viewOf({ schemaPath: 'form.schema.json' });
    expect(view.rel('create', 'schema')).toBe('../form.schema.json');
    expect(view.layout.schemaDir).toBe('');
  });

  it('разбитый визард: сборка импортирует схемы шагов и собирает форму по ссылкам', () => {
    const view = viewOf(wizardSplitSource());
    expect(
      view.layout.splitSteps.map((step) => ({ ref: step.schemaRef, from: step.schemaImport }))
    ).toEqual([
      { ref: './steps/anketa/form.schema.json', from: '../schema/steps/anketa/form.schema.json' },
      {
        ref: './steps/kontakty/form.schema.json',
        from: '../schema/steps/kontakty/form.schema.json',
      },
    ]);
    const code = renderTemplate('test.create', createTemplate, view);
    // Словарь шагов объявлен в самой сборке: агрегатора `steps/index.ts` больше нет.
    expect(code).toContain('const stepSchemas: Record<string, JsonFormStep> = {');
    expect(code).toContain(
      "'./steps/anketa/form.schema.json': step1Schema as unknown as JsonFormStep,"
    );
    expect(code).toContain('composeJsonFormSchema(');
    expect(code).toContain('flow: formFlow,');
  });

  it('простая форма собирается без потока и без сборки схемы из частей', () => {
    const code = renderTemplate('test.create', createTemplate, viewOf());
    expect(code).not.toContain('formFlow');
    expect(code).not.toContain('composeJsonFormSchema');
    expect(code).toContain('export function createAnketaForm(');
  });
});
