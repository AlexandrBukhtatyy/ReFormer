import { describe, expect, it } from 'vitest';
import type { FormRules } from '../form-model/rules';
import { emptyRules } from '../form-model/rules';
import { builtinKit, foreignKit, plainSchema, wizardSchema } from './__fixtures__/kit';
import { prepare, withFiles, type CodegenInput, type EmitContext } from './context';
import { emitApi } from './emit/api';
import { emitDataSources } from './emit/data-sources';
import { emitFormBehavior } from './emit/form-behavior';
import { emitIndex } from './emit/index-tsx';
import { emitModel } from './emit/model';
import { emitReadme } from './emit/readme';
import { emitRegistry } from './emit/registry';
import { emitRenderBehavior } from './emit/render-behavior';
import { emitSchema } from './emit/schema';
import { emitTypes } from './emit/types';
import { emitValidation } from './emit/validation';
import { emitWizard, wizardShimOf } from './emit/wizard';

function ctxOf(input: Partial<CodegenInput> = {}): EmitContext {
  return prepare({
    schema: input.schema ?? plainSchema(),
    formName: input.formName ?? 'Заявка на кредит',
    kit: input.kit ?? builtinKit(),
    rules: input.rules,
  });
}

describe('эмиссия под активный кит', () => {
  it('registry импортирует из спецификатора КИТА, а не из литерала', () => {
    expect(emitRegistry(ctxOf())).toContain("from '@reformer/ui-kit'");
    expect(emitRegistry(ctxOf({ kit: foreignKit() }))).toContain("from '@hexa/ui'");
  });

  it('враппер поля берётся из infra кита', () => {
    expect(emitRegistry(ctxOf())).toContain('reg.component(FIELD_WRAPPER, FormField)');
    expect(emitRegistry(ctxOf({ kit: foreignKit() }))).toContain(
      'reg.component(FIELD_WRAPPER, HexField)'
    );
  });

  it('символы компонентов — из каталога кита', () => {
    expect(emitRegistry(ctxOf())).toContain("reg.component('Input', InputField)");
    expect(emitRegistry(ctxOf({ kit: foreignKit() }))).toContain(
      "reg.component('Input', HexInput)"
    );
  });

  it('неизвестное киту имя регистрируется заглушкой с причиной', () => {
    const code = emitRegistry(ctxOf({ kit: foreignKit() }));
    // `Checkbox` есть в схеме, но не в каталоге чужого кита.
    expect(code).toContain("reg.component('Checkbox', Placeholder); // TODO:");
    expect(code).toContain('HexaUI');
  });
});

describe('шим визарда', () => {
  it('печатается по адаптеру кита: символ и subpath оттуда', () => {
    const code = emitWizard(ctxOf({ schema: wizardSchema() }));
    expect(code).toContain("from '@reformer/ui-kit/form-wizard'");
    expect(code).toContain('FormWizard');
  });

  it('чужой кит даёт чужой адаптер', () => {
    const code = emitWizard(ctxOf({ schema: wizardSchema(), kit: foreignKit() }));
    expect(code).toContain("from '@hexa/ui/wizard'");
    expect(code).toContain('HexWizard');
  });

  it('кит без адаптера визарда шима не получает вовсе', () => {
    const kit = foreignKit();
    const noWizard = { ...kit, kit: { ...kit.kit, adapters: { wizard: null, step: null } } };
    const ctx = ctxOf({ schema: wizardSchema(), kit: noWizard });
    expect(wizardShimOf(ctx)).toBeNull();
    // И тогда визард регистрируется заглушкой, а не импортом из пакета, которого у кита нет.
    expect(emitRegistry(ctx)).toContain("reg.component('Wizard', Placeholder)");
  });

  it('форма без визарда шима не требует', () => {
    expect(wizardShimOf(ctxOf())).toBeNull();
  });
});

describe('эмиссия из правил', () => {
  const rules: FormRules = {
    ...emptyRules(),
    validation: [{ target: 'fullName', rules: ['required'] }],
    behavior: [
      { kind: 'computeFrom', target: 'total', sources: ['price', 'qty'], expr: 'price * qty' },
    ],
  };

  it('validation при наличии правил печатается билдерами MCP, а не заглушкой', () => {
    const code = emitValidation(ctxOf({ rules }));
    expect(code).toContain('defineValidationSchema');
    // Импорт типа перенацелен с `./model` (раскладка MCP) на `./types` (раскладка билдера).
    expect(code).toContain("from './types'");
    expect(code).not.toContain("from './model'");
  });

  it('без правил validation выводит required из схемы', () => {
    const code = emitValidation(ctxOf());
    expect(code).toContain('validate(model.$.fullName');
    expect(code).toContain('required(');
  });

  it('form.behavior из правил печатает оператор, а не пустое тело', () => {
    expect(emitFormBehavior(ctxOf({ rules }))).toContain('computeFrom');
    expect(emitFormBehavior(ctxOf())).toContain(
      'defineFormBehavior<ZayavkaNaKreditForm>(() => {})'
    );
  });

  it('render-правила попадают в поведение, а секции без правил — подсказкой', () => {
    const withRender: FormRules = {
      ...emptyRules(),
      render: [
        { kind: 'hideWhen', selector: 'lichnye-dannye-section', condition: 'form.agreed.value' },
      ],
    };
    const code = emitRenderBehavior(ctxOf({ rules: withRender }));
    expect(code).toContain(
      "hideWhen(schema.node('lichnye-dannye-section'), () => form.agreed.value)"
    );
    // Подсказки на ту же секцию быть не должно: она стала бы дублем работающей строки.
    expect(code).not.toContain("// hideWhen(schema.node('lichnye-dannye-section')");
  });

  it('без render-правил секция получает закомментированную подсказку с реальным адресом', () => {
    expect(emitRenderBehavior(ctxOf())).toContain(
      "// hideWhen(schema.node('lichnye-dannye-section')"
    );
  });

  it('визард подписывается на onSubmit и получает инъекцию формы', () => {
    const code = emitRenderBehavior(ctxOf({ schema: wizardSchema() }));
    expect(code).toContain("onComponentEvent(wizard, 'onSubmit'");
    expect(code).toContain('onInit(wizard');
  });
});

describe('остальные эмиттеры', () => {
  it('types объявляет тип формы из дерева типов', () => {
    const code = emitTypes(ctxOf());
    expect(code).toContain('export type ZayavkaNaKreditForm = {');
    expect(code).toContain('fullName: string;');
    expect(code).toContain('agreed: boolean;');
  });

  it('model печатает начальные значения и фабрику', () => {
    const code = emitModel(ctxOf());
    expect(code).toContain('"fullName": ""');
    expect(code).toContain('export function createZayavkaNaKreditFormModel(');
  });

  it('schema проставляет шапку, если её не было', () => {
    const json: unknown = JSON.parse(emitSchema(ctxOf()));
    expect(json).toMatchObject({ $schema: './form-schema.schema.json', version: '1.0' });
  });

  it('index печатает запись реестра форм с идентификатором формы', () => {
    const code = emitIndex(ctxOf());
    expect(code).toContain('export const zayavkaNaKreditFormEntry: FormEntry<ZayavkaNaKreditForm>');
    expect(code).toContain("id: 'zayavka-na-kredit'");
  });

  it('api называет форму в логе', () => {
    expect(emitApi(ctxOf())).toContain("console.info('[zayavka-na-kredit] submit'");
  });

  it('data-sources отдаёт опции массивом, а подпись элемента — функцией', () => {
    const schema = plainSchema();
    (schema.root as { children: unknown[] }).children.push({
      value: '$model(city)',
      component: '$component(Select)',
      componentProps: { label: 'Город', options: '$dataSource(CITIES)' },
    });
    const code = emitDataSources(ctxOf({ schema }));
    expect(code).toContain('export const CITIES: SelectOption[] = [');
  });

  it('README перечисляет ФАКТИЧЕСКИЙ состав модуля, а не литерал', () => {
    const base = ctxOf();
    const ctx = withFiles(base, [
      { path: 'types.ts', cls: 'derived' },
      { path: 'api.ts', cls: 'user' },
      { path: 'мой-файл.ts', cls: 'derived' },
    ]);
    const code = emitReadme(ctx);
    expect(code).toContain('`types.ts`, `мой-файл.ts`');
    expect(code).toContain('`api.ts`');
  });

  it('README называет кит, под который сгенерирован модуль', () => {
    expect(emitReadme(withFiles(ctxOf({ kit: foreignKit() }), []))).toContain('@hexa/ui');
  });
});
