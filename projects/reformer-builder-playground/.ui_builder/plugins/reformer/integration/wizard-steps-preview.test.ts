/**
 * Модуль формы в раскладке «папки по ролям» в компилирующем превью — целиком, без двойников
 * движка.
 *
 * Стык четырёх мест, и разойтись они могут только здесь: кодоген печатает модуль по папкам ролей
 * (документ и файл шага — в `schema/`, правила шага — в `validation/<шаг>.ts`, поток —
 * в `flow/<форма>-flow.ts`); превью читает каталог МОДУЛЯ (`readSidecars`), а не каталог
 * документа, и требует файлы ролей (`planModule`); линковщик оболочки резолвит `../validation/…`
 * из файла потока; единая сборка получает поток и проверяет шаг на «Далее». Любое звено,
 * оставшееся при прежней раскладке, даёт визард, у которого «Далее» не проверяет шаг, — и снимок
 * текста файла этого не ловит: он сверяет строку с собой же.
 *
 * @module shell/boot/integration/wizard-steps-preview.test
 */

import { describe, expect, it, vi } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { builtinKit, plainSchema, seededRules, wizardSchema } from '../core/testing';
import { joinFormSchema, stepRefsOf } from '../core/form-model';
import type { ResourceId } from '@reformer/builder-plugin-api';
import { BUILTIN_TARGETS, generateModule } from '../codegen/src';
import type { PreviewModules } from '../render/src/host';
import { compileForm } from '../render/src/compiling/compile';
import {
  appliedArtifacts,
  extractContract,
  runFactories,
  type FormContract,
} from '../render/src/compiling/exports';
import { alignFlow } from '../render/src/compiling/flow';
import { moduleFilesFor, planModule } from '../render/src/compiling/module';
import { readSidecars } from '../render/src/compiling/read';
import { buildRuntimeBundle, type PreviewForm } from '../render/src/runtime/build';
import { createFakeHost } from '../render/src/testing';
import { createPluginModules } from '@/shell/boot/plugin-modules';
import { RUNTIME_MODULES } from '@/application/composer/runtime-modules';

/** Каталог модуля в проекте и документ формы в нём — там, куда его кладёт кодоген. */
const MODULE_DIR = 'forms/zayavka';
const DOCUMENT_PATH = `${MODULE_DIR}/schema/form.schema.json`;
const DOCUMENT = `fake:${DOCUMENT_PATH}` as ResourceId;

type GenerateInput = Parameters<typeof generateModule>[1];

/** Модуль, напечатанный кодогеном: путь от корня модуля → текст. */
async function printedModule(input: GenerateInput): Promise<ReadonlyMap<string, string>> {
  const module = await generateModule(BUILTIN_TARGETS, input);
  expect(module.problems).toEqual([]);
  return new Map(module.files.map((file) => [file.path, file.content]));
}

/** Живая схема редактора: корневой документ, собранный с файлами шагов. */
function liveSchema(files: ReadonlyMap<string, string>): JsonFormSchema {
  const root = JSON.parse(files.get('schema/form.schema.json') ?? '') as JsonFormSchema;
  const parts = new Map<string, unknown>(
    stepRefsOf(root).map((ref) => [
      ref,
      // Ссылка шага записана ОТ КОРНЕВОГО ДОКУМЕНТА, поэтому файл шага лежит рядом с ним.
      JSON.parse(files.get(`schema/${ref.replace(/^\.\//, '')}`) ?? '') as unknown,
    ])
  );
  return joinFormSchema(root, parts).schema;
}

interface Previewed {
  /** Пути файлов набора, который увидел линковщик. */
  readonly set: readonly string[];
  /** Файлы, экспорты которых точка входа выставила в разбор. */
  readonly executed: readonly string[];
  readonly contract: FormContract;
  readonly form: PreviewForm;
  /** Итоги отправки, которые сообщила форма. */
  readonly results: [string, boolean][];
}

/**
 * Путь компилирующей поверхности над напечатанным модулем: прочитать каталог модуля → исполнить
 * файлы ролей настоящим линковщиком оболочки → разобрать контракт → собрать форму.
 */
async function preview(files: ReadonlyMap<string, string>): Promise<Previewed> {
  const tree = Object.fromEntries(
    [...files].map(([path, text]) => [`${MODULE_DIR}/${path}`, text])
  );
  const host = createFakeHost({ tree, source: { executesCode: true } });

  const sources = await readSidecars(host, DOCUMENT);
  expect(sources.problems).toEqual([]);
  const plan = planModule(sources.resources.keys(), moduleFilesFor(DOCUMENT_PATH));
  expect(plan.layout).toBe('roles');

  const plugin = createPluginModules({ modules: RUNTIME_MODULES });
  const loader: PreviewModules = {
    load: plugin.modules.load,
    prepare: async (set) => {
      const [primed] = await Promise.all([plugin.prepareCached(set), plugin.warm(set)]);
      return primed;
    },
  };
  const compiled = await compileForm(sources.files, loader, {}, plan);
  plugin.dispose();
  expect(compiled.problems).toEqual([]);

  const contract = extractContract(compiled.modules, plan);
  const { behaviorRules, wireSubmit } = contract;
  if (behaviorRules === undefined || wireSubmit === undefined) {
    throw new Error('модуль не отдал половины поведения');
  }
  const values = runFactories(contract);
  expect(values.problems).toEqual([]);

  const schema = liveSchema(files);
  const kit = builtinKit();
  const results: [string, boolean][] = [];
  const bundle = buildRuntimeBundle({
    schema,
    catalog: kit.catalog,
    descriptor: kit.kit,
    // Рисовать здесь нечего: компоненты уезжают в подписанные стабы, а собирается форма так же.
    namespace: {},
    mock: null,
    extraRegistry: values.registry,
    initialOverride: values.initial,
    behavior: contract.behavior,
    moduleBehavior: {
      rules: behaviorRules,
      wireSubmit,
      onResult: (message, ok) => {
        results.push([message, ok]);
      },
    },
    validation: contract.validation,
    flow: alignFlow(contract.flow, schema),
    files: contract.files,
  });
  // Отправка привязалась к узлу живой схемы: его `selector` проставил тот же кодоген.
  expect(bundle.problems).toEqual([]);
  if (bundle.form === null) throw new Error('форма не собралась');

  return {
    set: [...sources.files.keys()],
    executed: [...compiled.modules.keys()],
    contract,
    form: bundle.form,
    results,
  };
}

describe('разбитый визард в раскладке по ролям в компилирующем превью', () => {
  it('собирается из каталога модуля, и «Далее» не пускает пустой обязательный шаг', async () => {
    // Обязательное поле шага — флагом в схеме: из него шаблон правил шага печатает `required`
    // в `validation/<шаг>.ts` (правила сайдкара разносит по шагам другой слой).
    const source = wizardSchema();
    const json = JSON.stringify(source).replace(
      '"componentProps":{"label":"Почта"}',
      '"componentProps":{"label":"Почта","required":true}'
    );
    expect(json).toContain('"required":true');
    const files = await printedModule({
      schema: JSON.parse(json) as typeof source,
      formName: 'Заявка',
      kit: builtinKit(),
      splitSteps: true,
    });
    // Раскладка: документ и файл шага — в `schema/`, правила шага и поток — в своих папках.
    expect([...files.keys()]).toEqual(
      expect.arrayContaining([
        'schema/form.schema.json',
        expect.stringMatching(/^schema\/steps\/[^/]+\/form\.schema\.json$/),
        expect.stringMatching(/^validation\/(?!form\.ts$)[^/]+\.ts$/),
        'flow/zayavka-flow.ts',
        'application/create.ts',
        'ZayavkaForm.tsx',
        'index.ts',
      ])
    );

    const { set, executed, contract, form, results } = await preview(files);

    // Читается каталог модуля — родитель `schema/`: от каталога документа набор состоял бы из
    // одного реестра и файла шага.
    expect(set).toEqual(expect.arrayContaining(['flow/zayavka-flow.ts', 'validation/form.ts']));
    expect(set).not.toContain('index.ts');
    expect(set).not.toContain('schema/form.schema.json');
    // Исполнены файлы ролей — и только они. Страница, реэкспорты модуля, сборка приложения и
    // запись реестра форм в разбор не выставлены: превью собирает форму само. Словарь замечаний
    // (`validation/messages.ts`) исполняется сразу за валидацией: страница, которая подключает
    // его у пользователя, в превью не исполняется, и тексты замечаний превью берёт у файла само.
    expect(executed).toEqual([
      'model/initial-value.ts',
      'validation/form.ts',
      'validation/messages.ts',
      'flow/zayavka-flow.ts',
      'behavior/index.ts',
      'application/submit.ts',
      'schema/registry.ts',
    ]);
    expect(appliedArtifacts(contract)).toEqual([
      'model',
      'validation',
      'messages',
      'flow',
      'behavior',
      'submit',
      'registry',
    ]);
    expect(form.model.get()).toEqual({ email: '' });

    // Проверка шага идёт потоком сборки: `required` поля шага доехал из `validation/<шаг>.ts`
    // через `flow/zayavka-flow.ts`. Останься превью при каталоге документа — потока не было бы
    // вовсе, и пустой шаг прошёл бы.
    const flow = form.flow;
    if (flow === undefined) throw new Error('поток шагов не дошёл до сборки');
    expect(flow.steps).toHaveLength(1);
    await expect(flow.next()).resolves.toMatchObject({ status: 'stayed', reason: 'invalid' });
    expect(flow.completed.value.size).toBe(0);

    // Заполненный шаг проходит; шаг единственный, поэтому дальше идти некуда.
    form.form.email.setValue('anya@example.com');
    await expect(flow.next()).resolves.toMatchObject({ status: 'stayed', reason: 'edge' });
    expect(flow.completed.value.has(flow.steps[0] ?? '')).toBe(true);
    // Итог отправки никто не сообщал: кнопку здесь нажать нечем.
    expect(results).toEqual([]);
  }, 60_000);
});

describe('простая форма с правилами в компилирующем превью', () => {
  it('правила модуля складываются с отправкой в одно поведение и работают в сборке', async () => {
    const files = await printedModule({
      schema: plainSchema(),
      formName: 'Заявка',
      kit: builtinKit(),
      rules: seededRules(),
    });

    const { executed, contract, form } = await preview(files);

    // Потока шагов у простой формы нет — и файла потока тоже. Словарь замечаний есть у любой.
    expect(executed).toEqual([
      'model/initial-value.ts',
      'validation/form.ts',
      'validation/messages.ts',
      'behavior/index.ts',
      'application/submit.ts',
      'schema/registry.ts',
    ]);
    expect(appliedArtifacts(contract)).toEqual([
      'model',
      'validation',
      'messages',
      'behavior',
      'submit',
      'registry',
    ]);
    expect(form.flow).toBeUndefined();

    // Связь над моделью из `behavior/index.ts` (`computeFrom`) живёт: её операторы исполнились
    // внутри поведения, которое сложило превью, — тем же экземпляром ядра, что собирает форму.
    // Второй экземпляр дал бы здесь «оператор вызван вне defineFormBehavior».
    expect(form.model.get()).toMatchObject({ agreed: false });
    form.form.fullName.setValue('Иван');
    await vi.waitFor(() => {
      expect(form.model.get()).toMatchObject({ agreed: true });
    });

    // Правила формы из `validation/form.ts` — полный набор сборки: пустое имя не проходит.
    form.form.fullName.setValue('');
    await expect(form.validate()).resolves.toMatchObject({ status: 'invalid' });
  }, 60_000);
});
