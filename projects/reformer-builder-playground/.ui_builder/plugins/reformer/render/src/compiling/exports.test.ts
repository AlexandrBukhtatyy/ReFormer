/**
 * Контракт модуля формы: экспорты по ролям, имена прежней раскладки, склейка валидации.
 *
 * @module plugins/reformer/render/compiling/exports.test
 */

import { describe, expect, it } from 'vitest';
import {
  appliedArtifacts,
  composeValidation,
  extractContract,
  isValidationConfig,
  runFactories,
  wiresSubmit,
} from './exports';
import { moduleFilesFor, planModule } from './module';

const rules = { email: [] };

function modules(entries: Record<string, unknown>): ReadonlyMap<string, unknown> {
  return new Map(Object.entries(entries));
}

describe('extractContract — раскладка «папки по ролям»', () => {
  const behaviorRules = (): void => undefined;
  const wireSubmit = (): void => undefined;
  const createRegistry = (): unknown => ({});
  const createInitialValues = (): unknown => ({ a: 1 });
  const formFlow = { steps: [{ id: 'dannye-section' }] };
  const formBehavior = {};
  const formValidation = { extras: rules };

  /** Исполненные файлы ролей — как их отдаёт точка входа для модуля из кодогена. */
  const ROLES = {
    'model/initial-value.ts': { createInitialValues },
    'validation/form.ts': { formValidation },
    'flow/zayavka-flow.ts': { formFlow },
    'behavior/index.ts': { behaviorRules, formBehavior },
    'application/submit.ts': { wireSubmit },
    'schema/registry.ts': { createRegistry },
  };

  it('каждый экспорт берётся из файла своей роли', () => {
    const contract = extractContract(modules(ROLES));

    expect(contract.createInitialValues).toBe(createInitialValues);
    expect(contract.validation).toBe(formValidation);
    expect(contract.flow).toBe(formFlow);
    expect(contract.behavior).toBe(formBehavior);
    expect(contract.behaviorRules).toBe(behaviorRules);
    expect(contract.wireSubmit).toBe(wireSubmit);
    expect(contract.createRegistry).toBe(createRegistry);
    expect(appliedArtifacts(contract)).toEqual([
      'model',
      'validation',
      'flow',
      'behavior',
      'submit',
      'registry',
    ]);
  });

  it('помнит, из какого файла взят артефакт: этим именем называется находка', () => {
    expect(extractContract(modules(ROLES)).files).toEqual({
      initial: 'model/initial-value.ts',
      validation: 'validation/form.ts',
      flow: 'flow/zayavka-flow.ts',
      behavior: 'behavior/index.ts',
      submit: 'application/submit.ts',
      registry: 'schema/registry.ts',
    });
  });

  it('экспорт с верным именем в чужом файле не считается: роль — это место', () => {
    // Сборка приложения реэкспортирует половину модуля; попади она в разбор — превью взяло бы
    // поведение, уже сложенное с отправкой страницы.
    const contract = extractContract(
      modules({
        ...ROLES,
        'behavior/index.ts': {},
        'application/create.ts': { formBehavior: {}, behaviorRules, createRegistry },
      })
    );
    expect(contract.behavior).toBeUndefined();
    expect(contract.behaviorRules).toBeUndefined();
  });

  it('отправка подключается только двумя половинами; иначе остаётся formBehavior', () => {
    const withoutRules = extractContract(
      modules({ ...ROLES, 'behavior/index.ts': { formBehavior } })
    );
    expect(wiresSubmit(withoutRules)).toBe(false);
    expect(withoutRules.behavior).toBe(formBehavior);
    expect(appliedArtifacts(withoutRules)).not.toContain('submit');

    const withoutSubmit = extractContract(modules({ ...ROLES, 'application/submit.ts': {} }));
    expect(wiresSubmit(withoutSubmit)).toBe(false);
    expect(appliedArtifacts(withoutSubmit)).toContain('behavior');

    expect(wiresSubmit(extractContract(modules(ROLES)))).toBe(true);
  });

  it('поток берётся по ПАПКЕ роли: файл с ожидаемым именем — первым', () => {
    const stale = { steps: [{ id: 'staryy' }] };
    const executed = modules({
      ...ROLES,
      'flow/a-staryy-flow.ts': { formFlow: stale },
    });
    // Имя формы известно — её файл побеждает, хотя по алфавиту он второй.
    const known = planModule(
      executed.keys(),
      moduleFilesFor('forms/zayavka/schema/form.schema.json')
    );
    expect(extractContract(executed, known).flow).toBe(formFlow);
    // Папку переименовали: ожидаемого имени нет, поток всё равно найден.
    const renamed = planModule(
      ['flow/zayavka-flow.ts', 'validation/form.ts'],
      moduleFilesFor('forms/credit/schema/form.schema.json')
    );
    expect(extractContract(modules(ROLES), renamed).flow).toBe(formFlow);
  });

  it('значение не того вида потоком не считается: сборку оно уронило бы целиком', () => {
    const contract = extractContract(
      modules({ ...ROLES, 'flow/zayavka-flow.ts': { formFlow: () => undefined } })
    );
    expect(contract.flow).toBeUndefined();
    expect(appliedArtifacts(contract)).not.toContain('flow');
  });

  it('пустая конфигурация валидации — тоже конфигурация: правила даёт поток шагов', () => {
    const empty = {};
    const contract = extractContract(
      modules({ ...ROLES, 'validation/form.ts': { formValidation: empty } })
    );
    expect(contract.validation).toBe(empty);
  });

  it('файлы прежнего контракта, оставшиеся в корне, в контракт не попадают', () => {
    const legacy = (): string => 'прежний слой';
    const contract = extractContract(
      modules({ ...ROLES, 'form.render.ts': { createJsonRenderBehavior: legacy } })
    );
    expect(Object.values(contract.files)).not.toContain('form.render.ts');
  });

  it('словарь замечаний берётся из validation/messages.ts — экспорт formMessages', () => {
    const formMessages = { required: 'Заполните поле', 'email.email': () => 'Неверная почта' };
    const contract = extractContract(
      modules({ ...ROLES, 'validation/messages.ts': { formMessages } })
    );

    expect(contract.messages).toBe(formMessages);
    expect(contract.files.messages).toBe('validation/messages.ts');
    // В сводке — сразу за валидацией: это её тексты.
    expect(appliedArtifacts(contract)).toEqual([
      'model',
      'validation',
      'messages',
      'flow',
      'behavior',
      'submit',
      'registry',
    ]);
  });

  it('язык формы — formLocale того же файла; отказ от него (undefined) — законен', () => {
    const formLocale = { code: 'ru', messages: { 'validation.required': 'Обязательное поле' } };
    const contract = extractContract(
      modules({ ...ROLES, 'validation/messages.ts': { formLocale, formMessages: {} } })
    );
    expect(contract.locale).toBe(formLocale);
    expect(contract.files.messages).toBe('validation/messages.ts');

    const without = extractContract(
      modules({ ...ROLES, 'validation/messages.ts': { formLocale: undefined, formMessages: {} } })
    );
    expect(without.locale).toBeUndefined();
    expect(appliedArtifacts(without)).toContain('messages');
  });

  it.each([
    ['строка', 'ru'],
    ['без кода', { messages: {} }],
    ['без словаря', { code: 'ru' }],
  ])('значение не того вида (%s) языком не считается', (_, value) => {
    const contract = extractContract(
      modules({ ...ROLES, 'validation/messages.ts': { formLocale: value } })
    );
    expect(contract.locale).toBeUndefined();
  });

  it('модуль без словаря работает как раньше: записи о нём в контракте нет', () => {
    const contract = extractContract(modules(ROLES));
    expect(contract.messages).toBeUndefined();
    expect(Object.hasOwn(contract.files, 'messages')).toBe(false);
  });

  it('словарь — это место: одноимённый экспорт другого файла им не считается', () => {
    const contract = extractContract(
      modules({ ...ROLES, 'validation/form.ts': { formValidation, formMessages: { a: 'b' } } })
    );
    expect(contract.messages).toBeUndefined();
  });

  it.each([
    ['null', null],
    ['функция', () => ({})],
    ['массив', ['required']],
    ['строка', 'Заполните поле'],
  ])('значение не того вида (%s) словарём не считается: провайдер упал бы на нём', (_, value) => {
    const contract = extractContract(
      modules({ ...ROLES, 'validation/messages.ts': { formMessages: value } })
    );
    expect(contract.messages).toBeUndefined();
    expect(appliedArtifacts(contract)).not.toContain('messages');
  });

  it('файл словаря без экспорта formMessages — это файл правил шага с таким именем', () => {
    // Шаг визарда «Messages» дал бы `validation/messages.ts` с правилами шага: словаря в нём нет.
    const contract = extractContract(
      modules({ ...ROLES, 'validation/messages.ts': { stepRules: rules } })
    );
    expect(contract.messages).toBeUndefined();
  });
});

describe('runFactories', () => {
  it('исполняет фабрики модуля: начальные значения и реестр', () => {
    const registry = {};
    const values = runFactories(
      extractContract(
        modules({
          'model/initial-value.ts': { createInitialValues: () => ({ city: 'Казань' }) },
          'schema/registry.ts': { createRegistry: () => registry },
        })
      )
    );
    expect(values).toEqual({ initial: { city: 'Казань' }, registry, problems: [] });
  });

  it('отказ фабрики — находка с именем её файла, вторая фабрика при этом работает', () => {
    const values = runFactories(
      extractContract(
        modules({
          'model/initial-value.ts': { createInitialValues: () => ({ city: 'Казань' }) },
          'schema/registry.ts': {
            createRegistry: () => {
              throw new Error('нет компонента');
            },
          },
        })
      )
    );
    expect(values.initial).toEqual({ city: 'Казань' });
    expect(values.registry).toBeUndefined();
    expect(values.problems).toEqual([
      { file: 'schema/registry.ts', phase: 'evaluate', message: 'нет компонента' },
    ]);
  });

  it('фабрика значений, вернувшая не объект, поверх мока не кладётся', () => {
    const values = runFactories(
      extractContract(modules({ 'model/initial-value.ts': { createInitialValues: () => 42 } }))
    );
    expect(values.initial).toBeUndefined();
    expect(values.problems).toEqual([]);
  });

  it('пустой контракт — нечего исполнять', () => {
    expect(runFactories(extractContract(modules({})))).toEqual({ problems: [] });
  });
});

describe('extractContract — прежняя плоская раскладка', () => {
  it('находит все четыре артефакта по каноничным именам; слой правил узлов не исполняется', () => {
    const behavior = {};
    const createRegistry = (): unknown => ({});
    const contract = extractContract(
      modules({
        'model.ts': { initialFormModel: { a: 1 } },
        'validation.ts': { formValidation: rules },
        'form.behavior.ts': { formBehavior: behavior },
        // Правила узлов прежнего контракта переносятся в поведение формы — превью их не берёт.
        'form.render.ts': { formRenderBehavior: (): unknown => undefined },
        'registry.ts': { createRegistry },
      })
    );
    expect(appliedArtifacts(contract)).toEqual(['model', 'validation', 'behavior', 'registry']);
  });

  it('легаси-имена файлов поведения тоже оживают: старая форма не должна оставаться без превью', () => {
    const contract = extractContract(modules({ 'form-behavior.ts': { formBehavior: {} } }));
    expect(appliedArtifacts(contract)).toEqual(['behavior']);
  });

  it('пустые модули дают пустой контракт, а не выдуманные артефакты', () => {
    expect(appliedArtifacts(extractContract(modules({ 'model.ts': {} })))).toEqual([]);
  });

  it('начальные значения: фабрика кодогена и объект ранних шаблонов дают один вид входа', () => {
    const printed = extractContract(
      modules({ 'model.ts': { createInitialValues: () => ({ a: 1 }) } })
    );
    const early = extractContract(modules({ 'model.ts': { initialFormModel: { a: 2 } } }));
    expect(runFactories(printed).initial).toEqual({ a: 1 });
    expect(runFactories(early).initial).toEqual({ a: 2 });
    expect(printed.files.initial).toBe('model.ts');
  });
});

describe('composeValidation', () => {
  it('стратегия из validationOptions приклеивается к правилам — в ключах единой сборки', () => {
    // Сборка читает `rules`: конфигурация с правилами под `schema` для неё пуста.
    expect(composeValidation(rules, { strategy: 'change' })).toEqual({
      rules,
      strategy: 'change',
    });
  });

  it('готовую конфигурацию не переспоривают', () => {
    const config = { rules, strategy: 'submit' };
    expect(composeValidation(config, { strategy: 'change' })).toBe(config);
  });

  it('прежняя конфигурация переводится: schema становится rules, правила шагов уходят', () => {
    // Иначе форма собралась бы и молча не проверялась. Правила шагов принадлежат потоку шагов.
    expect(composeValidation({ schema: rules, steps: {}, strategy: 'submit' }, undefined)).toEqual({
      rules,
      strategy: 'submit',
    });
  });

  it('без правил ничего не собирается', () => {
    expect(composeValidation(undefined, { strategy: 'change' })).toBeUndefined();
  });
});

describe('isValidationConfig', () => {
  it('конфигурацию узнают по её ключам, а не по форме объекта', () => {
    expect(isValidationConfig({ steps: {} })).toBe(true);
    expect(isValidationConfig({ schema: {} })).toBe(true);
    expect(isValidationConfig(rules)).toBe(false);
  });
});
