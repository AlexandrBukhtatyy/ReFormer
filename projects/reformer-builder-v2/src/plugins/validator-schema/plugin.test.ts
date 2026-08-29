import { describe, expect, it, vi } from 'vitest';

import type { JsonFormSchema } from '@reformer/renderer-json';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import { builtinEntries } from '@/lib/catalog/__fixtures__/builtin-catalog';
import type { CatalogEntry } from '@/lib/catalog/types';
import { ensureNodeIds } from '@/lib/form-model/node-id';
import { emptyRules, type FormRules } from '@/lib/form-model/rules';
import {
  ValidatorPoint,
  type DocumentRef,
  type PluginContext,
  type ValidateContext,
  type ValidatorContribution,
} from '@/sdk';
import { CODES, COMMANDS, SCHEMA_VALIDATOR_ID } from './codes';
import {
  createDeferredSchemaCheck,
  createSchemaValidator,
  createSchemaValidatorPlugin,
  isFormSchemaDocument,
  SCHEMA_VALIDATOR_PLUGIN_ID,
} from './plugin';
import type { ValidateFormSchema } from './check';

function docRef(kind: 'text' | 'model', mediaType = 'application/json'): DocumentRef {
  return {
    id: 'fs:forms/credit.json',
    kind,
    ref: {
      id: 'fs:forms/credit.json',
      sourceId: 'fs',
      path: 'forms/credit.json',
      name: 'credit.json',
      kind: 'file',
      mediaType,
    },
  };
}

const schema: JsonFormSchema = ensureNodeIds(
  {
    version: '1.0',
    root: {
      component: '$component(Box)',
      children: [
        { value: '$model(loanAmount)', component: '$component(Inpt)', componentProps: {} },
      ],
    },
  } as unknown as JsonFormSchema,
  (() => {
    let seq = 0;
    return () => {
      seq += 1;
      return `node${String(seq).padStart(4, '0')}`;
    };
  })()
);

function contextOf(model: unknown, doc = docRef('model')): ValidateContext {
  return { doc, text: () => JSON.stringify(schema), model: () => model };
}

describe('за какие документы валидатор берётся', () => {
  it('модельный JSON — да: провайдер модели взялся, значит это схема формы', () => {
    expect(isFormSchemaDocument(docRef('model'))).toBe(true);
  });

  it('текстовый JSON — нет: за него не взялся никто, и это может быть любой конфиг', () => {
    expect(isFormSchemaDocument(docRef('text'))).toBe(false);
  });

  it('модельный документ другого формата — нет', () => {
    expect(isFormSchemaDocument(docRef('model', 'text/typescript'))).toBe(false);
  });

  it('круг документов сужается снаружи', () => {
    const validator = createSchemaValidator({
      catalog: () => [],
      applies: (doc) => doc.ref.path.startsWith('forms/'),
    });

    expect(validator.applies(docRef('text'))).toBe(true);
  });
});

describe('вклад валидатора', () => {
  it('находки уходят от имени валидатора: по нему замещаются прошлые', () => {
    const validator = createSchemaValidator({ catalog: () => builtinEntries() });

    const found = validator.validate?.(contextOf(schema)) ?? [];

    expect(found.map((item) => item.source)).toEqual([SCHEMA_VALIDATOR_ID]);
    expect(found[0].code).toBe(CODES.UNKNOWN_COMPONENT);
  });

  it('каталог читается в момент проверки: кит переключают', () => {
    let catalog: CatalogEntry[] = [];
    const validator = createSchemaValidator({ catalog: () => catalog });

    expect(validator.validate?.(contextOf(schema))).toEqual([]);

    catalog = builtinEntries();

    expect(validator.validate?.(contextOf(schema))).toHaveLength(1);
  });

  it('правила-сайдкар спрашиваются про КОНКРЕТНЫЙ документ', () => {
    const asked: DocumentRef[] = [];
    const rules: FormRules = {
      ...emptyRules(),
      validation: [{ target: 'нет-такого-поля', rules: ['required'] }],
    };
    const validator = createSchemaValidator({
      catalog: () => builtinEntries(),
      rules: (doc) => {
        asked.push(doc);
        return rules;
      },
    });

    const found = validator.validate?.(contextOf(schema)) ?? [];

    expect(asked.map((doc) => doc.id)).toEqual(['fs:forms/credit.json']);
    expect(found.map((item) => item.code)).toContain(CODES.RULE_VALIDATION_TARGET_MISSING);
  });

  it('без модели валидатор разбирает текст сам — и сам отвечает за ошибку разбора', () => {
    const validator = createSchemaValidator({ catalog: () => builtinEntries() });
    const broken: ValidateContext = {
      doc: docRef('model'),
      text: () => '{"root":{,}}',
      model: () => undefined,
    };

    const found = validator.validate?.(broken) ?? [];

    expect(found.map((item) => item.code)).toEqual([CODES.PARSE_FAILED]);
    expect(found[0].target.kind).toBe('range');
  });

  it('дорогого уровня нет: вся проверка синхронна, и на ней стоит гейт', () => {
    const validator = createSchemaValidator({ catalog: () => [] });

    expect(validator.validateAsync).toBeUndefined();
  });
});

describe('быстрые исправления отбираются по реестру команд', () => {
  /** Находка про неизвестный компонент — единственная, которая несёт исправление на этой схеме. */
  const fixesOf = (found: readonly { fixes?: readonly unknown[] }[]): readonly unknown[] =>
    found.flatMap((item) => item.fixes ?? []);

  it('без реестра сверять не с чем — исправления уходят как есть', () => {
    const validator = createSchemaValidator({ catalog: () => builtinEntries() });

    expect(fixesOf(validator.validate?.(contextOf(schema)) ?? [])).toHaveLength(1);
  });

  it('команды нет — исправления нет, а сама находка остаётся', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const validator = createSchemaValidator({
      catalog: () => builtinEntries(),
      hasCommand: () => false,
    });

    const found = validator.validate?.(contextOf(schema)) ?? [];

    expect(found.map((item) => item.code)).toEqual([CODES.UNKNOWN_COMPONENT]);
    expect(fixesOf(found)).toEqual([]);
    warn.mockRestore();
  });

  it('реестр спрашивается НА КАЖДОМ проходе: команда могла появиться позже', () => {
    // Это и есть довод против проверки на активации: порядок активации плагинов объявлен
    // незначимым, и валидатор вправе подняться раньше редактора, который владеет командой.
    let registered = false;
    const validator = createSchemaValidator({
      catalog: () => builtinEntries(),
      hasCommand: () => registered,
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(fixesOf(validator.validate?.(contextOf(schema)) ?? [])).toEqual([]);

    registered = true;

    expect(fixesOf(validator.validate?.(contextOf(schema)) ?? [])).toHaveLength(1);
    warn.mockRestore();
  });

  it('о несуществующей команде предупреждают ОДИН раз, а не на каждый набранный символ', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const validator = createSchemaValidator({
      catalog: () => builtinEntries(),
      hasCommand: () => false,
    });

    validator.validate?.(contextOf(schema));
    validator.validate?.(contextOf(schema));
    validator.validate?.(contextOf(schema));

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('schema.set-component');
    warn.mockRestore();
  });
});

describe('плагин', () => {
  /** Контекст плагина в объёме, который нужен активации: реестр вкладов и список подписок. */
  function fakeContext(commands: Set<string> = new Set()): {
    ctx: PluginContext;
    contributed: { point: string; id: string | undefined; value: unknown }[];
  } {
    const contributed: { point: string; id: string | undefined; value: unknown }[] = [];
    const ctx = {
      id: SCHEMA_VALIDATOR_PLUGIN_ID,
      subscriptions: [],
      extensions: {
        contribute: (point: { id: string }, value: unknown, meta?: { id?: string }) => {
          contributed.push({ point: point.id, id: meta?.id, value });
          return { dispose: () => {} };
        },
      },
      // Реестр команд в объёме, которым пользуется активация: по нему отбираются быстрые
      // исправления. Множество мутируемое — тем и проверяется, что реестр спрашивают позже.
      commands: { get: (id: string) => (commands.has(id) ? { id } : undefined) },
    } as unknown as PluginContext;
    return { ctx, contributed };
  }

  it('вносит валидатор в точку расширения и кладёт снятие в подписки', () => {
    const plugin = createSchemaValidatorPlugin({ catalog: () => [] });
    const { ctx, contributed } = fakeContext();

    plugin.activate(ctx);

    expect(contributed.map(({ point, id }) => ({ point, id }))).toEqual([
      { point: ValidatorPoint.id, id: SCHEMA_VALIDATOR_ID },
    ]);
    expect(ctx.subscriptions).toHaveLength(1);
  });

  it('идентификатор плагина — пространство имён во всех реестрах', () => {
    expect(createSchemaValidatorPlugin({ catalog: () => [] }).id).toBe(SCHEMA_VALIDATOR_PLUGIN_ID);
  });

  it('команда, зарегистрированная ПОСЛЕ активации, возвращает исправление на экран', () => {
    // Порядок активации плагинов объявлен незначимым и закреплён тестом (Э4). Проверка
    // «есть ли команда» на активации сделала бы его значимым: валидатор поднимается раньше
    // редактора схемы, который эту команду и вносит.
    const commands = new Set<string>();
    const { ctx, contributed } = fakeContext(commands);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    createSchemaValidatorPlugin({ catalog: () => builtinEntries() }).activate(ctx);
    const validator = contributed[0].value as ValidatorContribution;

    const before = validator.validate?.(contextOf(schema)) ?? [];
    expect(before.flatMap((item) => item.fixes ?? [])).toEqual([]);

    commands.add(COMMANDS.SET_COMPONENT);

    const after = validator.validate?.(contextOf(schema)) ?? [];
    expect(after.flatMap((item) => item.fixes ?? [])).toHaveLength(1);
    warn.mockRestore();
  });
});

describe('проверка по мета-схеме грузится по требованию', () => {
  /** Загрузчик под управлением теста: видно и когда его позвали, и когда он ответил. */
  function deferredLoader() {
    let calls = 0;
    let deliver!: () => void;
    let refuse!: () => void;
    const arrival = new Promise<{ validateFormSchema: ValidateFormSchema }>((resolve, reject) => {
      deliver = () => resolve({ validateFormSchema });
      refuse = () => reject(new Error('чанк не доехал'));
    });
    return {
      calls: () => calls,
      deliver,
      refuse,
      loader: () => {
        calls += 1;
        return arrival;
      },
    };
  }

  /** Форма со структурной ошибкой, которую видит ТОЛЬКО мета-схема. */
  const brokenSchema = {
    version: '1.0',
    root: { component: '$component(Box)', children: [{ componentProps: {} }] },
  } as unknown as JsonFormSchema;

  const ctxFor = (schema: JsonFormSchema): ValidateContext =>
    ({
      doc: { id: 'fs:forms/a.json', kind: 'model', ref: { mediaType: 'application/json' } },
      text: () => JSON.stringify(schema),
      model: () => schema,
    }) as unknown as ValidateContext;

  it('до загрузки не выдумывает находок мета-схемы, но остальные фазы отвечают', () => {
    const source = deferredLoader();
    const validator = createSchemaValidator(
      { catalog: () => builtinEntries() },
      createDeferredSchemaCheck(source.loader)
    );

    const found = validator.validate!(ctxFor(brokenSchema));

    expect(found).toEqual([]);
    // Разбор и имена компонентов работают и без мета-схемы — иначе цена была бы не в двух фазах.
    const unknown = validator.validate!(
      ctxFor({
        version: '1.0',
        root: { component: '$component(Инпут)', value: '$model(a)' },
      } as unknown as JsonFormSchema)
    );
    expect(unknown.map((item) => item.code)).toContain(CODES.UNKNOWN_COMPONENT);
  });

  it('подходящий документ заводит загрузку: applies зовут раньше validate', () => {
    const source = deferredLoader();
    const validator = createSchemaValidator(
      { catalog: () => builtinEntries() },
      createDeferredSchemaCheck(source.loader)
    );

    expect(source.calls()).toBe(0);
    validator.applies({
      id: 'fs:forms/a.json',
      kind: 'model',
      ref: { mediaType: 'application/json' },
    } as unknown as DocumentRef);

    expect(source.calls()).toBe(1);
  });

  it('чужой документ загрузку не заводит: платить за него незачем', () => {
    const source = deferredLoader();
    const validator = createSchemaValidator(
      { catalog: () => builtinEntries() },
      createDeferredSchemaCheck(source.loader)
    );

    validator.applies({
      id: 'fs:readme.md',
      kind: 'text',
      ref: { mediaType: 'text/markdown' },
    } as unknown as DocumentRef);

    expect(source.calls()).toBe(0);
  });

  it('после загрузки находки мета-схемы появляются — и это ГЛАВНОЕ: окно закрывается', async () => {
    const source = deferredLoader();
    const deferred = createDeferredSchemaCheck(source.loader);
    const validator = createSchemaValidator({ catalog: () => builtinEntries() }, deferred);

    const ready = deferred.load();
    source.deliver();
    await ready;

    const found = validator.validate!(ctxFor(brokenSchema));
    expect(found.length).toBeGreaterThan(0);
  });

  it('загрузчик зовут один раз, сколько бы документов ни открыли', async () => {
    const source = deferredLoader();
    const deferred = createDeferredSchemaCheck(source.loader);
    const validator = createSchemaValidator({ catalog: () => builtinEntries() }, deferred);
    const doc = {
      id: 'fs:forms/a.json',
      kind: 'model',
      ref: { mediaType: 'application/json' },
    } as unknown as DocumentRef;

    validator.applies(doc);
    validator.applies(doc);
    const ready = deferred.load();
    source.deliver();
    await ready;
    validator.applies(doc);

    expect(source.calls()).toBe(1);
  });

  it('отказ загрузки не роняет проход и не отвергается наружу', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const source = deferredLoader();
    const deferred = createDeferredSchemaCheck(source.loader);
    const validator = createSchemaValidator({ catalog: () => builtinEntries() }, deferred);

    const ready = deferred.load();
    source.refuse();
    await expect(ready).resolves.toBeUndefined();

    expect(validator.validate!(ctxFor(brokenSchema))).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('не загрузилась'),
      expect.any(Error)
    );
    error.mockRestore();
  });

  it('активация плагина заказывает загрузку, а не ждёт её', () => {
    const source = deferredLoader();
    const contributed: unknown[] = [];
    const ctx = {
      id: SCHEMA_VALIDATOR_PLUGIN_ID,
      subscriptions: [] as { dispose(): void }[],
      extensions: {
        contribute: (_point: unknown, value: unknown) => {
          contributed.push(value);
          return { dispose: () => {} };
        },
      },
    } as unknown as PluginContext;

    // Настоящий плагин грузит настоящий модуль; проверяем то, что можно проверить синхронно:
    // активация возвращает управление сразу и вклад уже на месте.
    createSchemaValidatorPlugin({ catalog: () => [] }).activate(ctx);

    expect(contributed).toHaveLength(1);
    expect(source.calls()).toBe(0);
  });
});
