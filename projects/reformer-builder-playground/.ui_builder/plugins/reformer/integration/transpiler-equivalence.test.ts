/**
 * Эквивалентность движков транспиляции на настоящих формах (эксперимент ReFormer-ydh8).
 *
 * Превью исполняет код формы тем движком, который выбрала композиция: `typescript` по умолчанию
 * или `sucrase` за флагом `rb-transpiler`. Замена движка безопасна, только если форма после неё
 * та же самая, а «та же» проверяется здесь на двух уровнях:
 *
 * 1. **Каждый файл модуля** — оба движка его читают или оба отказывают, и набор `require`
 *    в выводе совпадает. Расхождение здесь — это импорт, который один движок убрал как
 *    «только для типов», а другой оставил: линковщик пошёл бы искать файл, которого нет.
 * 2. **Модуль целиком через настоящий загрузчик оболочки** — те же находки, те же модули с теми же
 *    экспортами и те же начальные значения из фабрики.
 *
 * Формы — шаблоны проекта-образца (то, что человек открывает в билдере) и вывод кодогена
 * (то, что билдер печатает сам).
 *
 * @module plugins/reformer/integration/transpiler-equivalence.test
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RUNTIME_MODULES } from '@/application/composer/runtime-modules';
import { createPluginModules } from '@/shell/boot/plugin-modules';
import {
  SUCRASE_ENGINE,
  TYPESCRIPT_ENGINE,
  type TranspilerEngine,
} from '@/shell/platform/plugin/transpiler-engines';
import { builtinKit, subpathSchema, wizardSchema } from '../core/testing';
import { BUILTIN_TARGETS, generateModule } from '../codegen/src';
import type { PreviewModules } from '../render/src/host';
import { compileForm } from '../render/src/compiling/compile';
import { extractContract, runFactories } from '../render/src/compiling/exports';
import { moduleFilesFor, planModule } from '../render/src/compiling/module';

/** Модуль формы: файлы от его корня и путь документа — по нему план узнаёт имена файлов. */
interface FormModule {
  readonly name: string;
  readonly schemaPath: string;
  readonly files: ReadonlyMap<string, string>;
}

const PROJECT = fileURLToPath(new URL('../../../../', import.meta.url));

/** Шаблон проекта-образца — все его файлы, как их прочитала бы рабочая копия. */
function templateModule(dir: string): FormModule {
  const root = join(PROJECT, 'forms/templates', dir);
  const files = new Map<string, string>();
  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    files.set(relative(root, path).split('\\').join('/'), readFileSync(path, 'utf8'));
  }
  return { name: dir, schemaPath: `forms/templates/${dir}/schema/form.schema.json`, files };
}

/** Вывод кодогена — ровно то, что получит человек, создав форму. */
async function generatedModule(
  name: string,
  formName: string,
  schema: Parameters<typeof generateModule>[1]['schema'],
  splitSteps = false
): Promise<FormModule> {
  const module = await generateModule(BUILTIN_TARGETS, {
    schema,
    formName,
    kit: builtinKit(),
    splitSteps,
  });
  expect(module.problems, name).toEqual([]);
  return {
    name,
    schemaPath: 'schema/form.schema.json',
    files: new Map(module.files.map((file) => [file.path, file.content])),
  };
}

async function formModules(): Promise<readonly FormModule[]> {
  return [
    templateModule('reformer-simple-form'),
    templateModule('reformer-multi-step-form'),
    await generatedModule('кодоген: визард по шагам', 'Заявка', wizardSchema(), true),
    await generatedModule('кодоген: подпути кита', 'Анкета', subpathSchema()),
  ];
}

/** Спецификаторы `require` в выводе движка — отсортированные и без повторов. */
function requiredSpecifiers(js: string): string[] {
  const found = new Set<string>();
  for (const match of js.matchAll(/\brequire\(\s*(['"])([^'"]+)\1\s*\)/g)) found.add(match[2]);
  return [...found].sort();
}

/** Порт превью над настоящими модулями оболочки — как его собирает `boot`, только без кэша. */
function previewModules(engine: TranspilerEngine): {
  readonly port: PreviewModules;
  dispose(): void;
} {
  const modules = createPluginModules({ modules: RUNTIME_MODULES, transpiler: engine });
  return {
    port: {
      load: (files, entry, options) => modules.modules.load(files, entry, options),
      prepare: async (files) => {
        const [primed] = await Promise.all([modules.prepareCached(files), modules.warm(files)]);
        return primed;
      },
    },
    dispose: () => modules.dispose(),
  };
}

/** Экспорты модуля как «имя → тип значения»: сравнимо, в отличие от самих функций. */
function exportShape(exports: unknown): Record<string, string> {
  if (exports === null || typeof exports !== 'object') return { '': typeof exports };
  const shape: Record<string, string> = {};
  for (const key of Object.keys(exports).sort()) {
    shape[key] = typeof (exports as Record<string, unknown>)[key];
  }
  return shape;
}

/** Модуль формы, собранный превью тем движком, — в сравнимом виде. */
async function compiledWith(engine: TranspilerEngine, form: FormModule) {
  const { port, dispose } = previewModules(engine);
  try {
    const plan = planModule(form.files.keys(), moduleFilesFor(form.schemaPath));
    const compiled = await compileForm(form.files, port, {}, plan);
    const values = runFactories(extractContract(compiled.modules, plan));
    return {
      problems: compiled.problems,
      modules: Object.fromEntries(
        [...compiled.modules].map(([path, exports]) => [path, exportShape(exports)])
      ),
      initial: values.initial,
      factoryProblems: values.problems,
    };
  } finally {
    dispose();
  }
}

describe('sucrase и typescript на настоящих формах', () => {
  it('каждый файл модуля оба движка читают одинаково, и импорты в выводе те же', async () => {
    const [typescript, sucrase] = await Promise.all([
      TYPESCRIPT_ENGINE.load(),
      SUCRASE_ENGINE.load(),
    ]);
    let checked = 0;

    for (const form of await formModules()) {
      for (const [path, source] of form.files) {
        if (!typescript.applies(path)) continue;
        const where = `${form.name}: ${path}`;
        const ts = typescript.transpile(source, path).js;
        const sc = sucrase.transpile(source, path).js;
        expect(requiredSpecifiers(sc), where).toEqual(requiredSpecifiers(ts));
        checked += 1;
      }
    }

    // Пустой прогон проверял бы ничего: файлов в модулях форм — десятки.
    expect(checked).toBeGreaterThan(40);
  });

  it('превью собирает из модулей ту же форму', async () => {
    for (const form of await formModules()) {
      const viaTypescript = await compiledWith(TYPESCRIPT_ENGINE, form);
      const viaSucrase = await compiledWith(SUCRASE_ENGINE, form);

      // Опора сравнения — что сама форма под `typescript` собирается чисто: иначе совпадение
      // двух одинаково сломанных сборок ничего бы не доказывало.
      expect(viaTypescript.problems, form.name).toEqual([]);
      expect(viaTypescript.factoryProblems, form.name).toEqual([]);
      expect(Object.keys(viaTypescript.modules).length, form.name).toBeGreaterThan(2);

      expect(viaSucrase, form.name).toEqual(viaTypescript);
    }
  });
});
