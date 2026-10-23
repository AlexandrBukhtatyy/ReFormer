/**
 * Стек ReFormer в генерации кода: что такое форма документа и как из неё печатается модуль.
 *
 * Хозяин генерации (панель, запись, цели из проекта, генерация по заказу) общий для любого
 * формата формы и спрашивает стек точкой `CodegenStackPoint`. Здесь — всё, что знает ReFormer:
 *
 * - **форма документа** — схема формата 2 из модели или текста, визард, разбитый по файлам шагов,
 *   файл правил рядом с документом;
 * - **кит** — без него неизвестно, откуда импортировать компоненты, и умолчание вернуло бы ровно
 *   тот дефект, ради которого дескриптор кита и заводился, только молча;
 * - **место модуля** — функция адреса документа (раскладка домена), а не введённого имени формы:
 *   `<модуль>/schema/form.schema.json` — модуль на месте, в родителе папки `schema`;
 *   `<каталог>/form.schema.json` (прежняя плоская раскладка) — в каталоге документа; документ со
 *   свободным именем (`forms/credit.schema.json`) — подкаталог по имени ДОКУМЕНТА рядом с ним.
 *   Введённое имя меняет только имена в коде: модуль под ним искали бы там, где его нет;
 * - **печать** — цели контекстом эмиссии ReFormer (`./generate`), сниппет регистрации;
 * - **модуль на диске** — кит модуля до записи, сироты шагов и прежняя раскладка после (`./disk`).
 *
 * ## Отказы названы, а не брошены
 *
 * Документ не разбирается в схему — `null` («не моя форма»); файлы шагов не собираются, кита нет,
 * файл правил битый — отказ ключом словаря стека. Битый файл правил — именно отказ, а не
 * заготовки на месте правил, которые человек видит в файле: это была бы молчаливая потеря.
 * Исключением наружу уходит только то, чего мы не предвидели.
 *
 * @module plugins/reformer/codegen/stack/stack
 */

import {
  appSnippet,
  formNameOfSchemaPath,
  modulePlacementOf,
  moduleRootOfDocument,
  moduleRootPathOf,
} from '../../../core/codegen';
import type { CatalogEntry } from '../../../core/catalog';
import type { FormRules } from '../../../core/form-model';
import type {
  CodegenDocument,
  CodegenForm,
  CodegenModule,
  CodegenOpenResult,
  CodegenPrintRequest,
  CodegenReader,
  CodegenRefusal,
  CodegenStack,
  KitDescriptor,
  ResourceId,
} from '@reformer/builder-plugin-api';
import { kitMismatchOf, notesOf } from './disk';
import { findSchemaIn, schemaOf } from './find';
import { generateModule } from '../pipeline/generate';
import { readFormRules, RulesFileError } from '../pipeline/rules';
import { formSourceOf, loadFormSource, StepPartsError, type FormSource } from '../pipeline/source';
import { CODEGEN_STACK_ID, staleOverride } from '../pipeline/targets';

/**
 * Виды ресурса, чьи документы печатает стек.
 *
 * `form.schema` — идентификатор провайдера модели схемы. `application/json` — то, что оболочка
 * кладёт туда, пока композиция не подключила модель документа; вторая строка уйдёт вместе
 * с этим «пока».
 */
export const CODEGEN_STACK_KINDS: readonly string[] = Object.freeze([
  'form.schema',
  'application/json',
]);

/** Что стеку нужно от своего плагина: кит, каталог и словарь. */
export interface CodegenStackOptions {
  /** Дескриптор активного кита. `null` — кита нет, и печать отказывается работать. */
  readonly kit: () => KitDescriptor | null;
  /** Каталог активного кита: из него берутся символы экспорта для `schema/registry.ts`. */
  readonly catalog: () => readonly CatalogEntry[];
  /** Перевод ключа словаря стека. */
  readonly translate: (key: string, params?: Readonly<Record<string, unknown>>) => string;
}

/** Отказ ключом словаря стека. */
function refused(key: string, detail?: string): CodegenRefusal {
  return detail === undefined ? { refusal: { key } } : { refusal: { key }, detail };
}

/** Форма, готовая к печати: прочитана, кит есть, правила разобраны. */
interface PreparedForm {
  readonly reader: CodegenReader;
  readonly source: FormSource;
  readonly kit: KitDescriptor;
  readonly rules: FormRules | undefined;
  readonly root: ResourceId;
  readonly rootPath: string;
  readonly formName: string;
  /** Путь документа внутри модуля — от него считаются импорты и место файлов шагов. */
  readonly schemaPath: string;
}

/**
 * Правила формы — файл правил рядом с документом. Читаются на каждый прогон, кэша нет: их правят
 * ассистент, человек и быстрые исправления, и прогон обязан видеть последний текст.
 */
async function rulesOf(
  reader: CodegenReader,
  id: ResourceId,
  path: string
): Promise<{ readonly rules: FormRules | undefined } | CodegenRefusal> {
  try {
    return { rules: (await readFormRules(reader, id, path)) ?? undefined };
  } catch (error) {
    if (!(error instanceof RulesFileError)) throw error;
    return refused('error.rules-file', error.message);
  }
}

/** Форма в объёме контракта: печать и всё, что знает модуль на диске. */
function formOf(options: CodegenStackOptions, prepared: PreparedForm): CodegenForm {
  const { reader, source, kit, rules, root, schemaPath } = prepared;
  return {
    root,
    rootPath: prepared.rootPath,
    formName: prepared.formName,
    async print(request: CodegenPrintRequest): Promise<CodegenModule> {
      const module = await generateModule(
        request.targets,
        {
          schema: source.schema,
          origins: source.origins,
          formName: request.formName,
          schemaPath,
          kit: { kit, catalog: options.catalog() },
          rules,
        },
        request.format
      );
      return {
        files: module.files,
        problems: module.problems,
        view: module.view,
        // Сниппет регистрации — не файл модуля: он вставляется в ЧУЖОЕ приложение, и записать
        // его за человека нельзя. Поэтому он не цель, а часть отчёта.
        snippet: appSnippet(module.context.names),
        check: () => kitMismatchOf(reader, root, module.files),
        inspect: () => notesOf(reader, root, module.files, schemaPath),
      };
    },
  };
}

/** Собрать стек ReFormer. */
export function createCodegenStack(options: CodegenStackOptions): CodegenStack {
  return {
    id: CODEGEN_STACK_ID,
    kinds: CODEGEN_STACK_KINDS,
    translate: options.translate,

    // Для канонического имени (`form.schema.json`) это имя каталога МОДУЛЯ, для прочих — имя
    // файла до ПЕРВОЙ точки (см. `formNameOfSchemaPath`).
    formNameOf: formNameOfSchemaPath,

    async open(document: CodegenDocument, reader: CodegenReader): Promise<CodegenOpenResult> {
      const schema = schemaOf(document);
      if (schema === null) return null;

      let source: FormSource;
      try {
        source = await formSourceOf(reader, document, schema);
      } catch (error) {
        if (!(error instanceof StepPartsError)) throw error;
        return refused('error.step-parts', error.message);
      }

      const kit = options.kit();
      if (kit === null) return refused('error.no-kit');

      const path = document.ref.path;
      const rules = await rulesOf(reader, document.id, path);
      if ('refusal' in rules) return rules;

      return formOf(options, {
        reader,
        source,
        kit,
        rules: rules.rules,
        root: moduleRootOfDocument(reader, document.id, path),
        rootPath: moduleRootPathOf(path),
        formName: formNameOfSchemaPath(path),
        schemaPath: modulePlacementOf(path).schemaPath,
      });
    },

    async find(dir: ResourceId, reader: CodegenReader): Promise<CodegenOpenResult> {
      const found = await findSchemaIn(reader, dir);
      if (found === null) return null;

      const kit = options.kit();
      if (kit === null) return refused('error.no-kit');

      let source: FormSource;
      try {
        source =
          found.document === undefined
            ? await loadFormSource(reader, found.ref.id, found.schema)
            : await formSourceOf(reader, found.document, found.schema);
      } catch (error) {
        if (!(error instanceof StepPartsError)) throw error;
        return refused('error.step-parts', error.message);
      }

      const rules = await rulesOf(reader, found.ref.id, found.ref.path);
      if ('refusal' in rules) return rules;

      return formOf(options, {
        reader,
        source,
        kit,
        rules: rules.rules,
        root: found.root,
        rootPath: moduleRootPathOf(found.ref.path),
        formName: formNameOfSchemaPath(found.ref.path),
        schemaPath: found.schemaPath,
      });
    },

    staleOverride,
  };
}
