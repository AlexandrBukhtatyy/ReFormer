/**
 * Один прогон генерации: документ → файлы → рабочая область → отчёт.
 *
 * Отдельно от панели и от команды, потому что запускают обе, а результат обязан быть один
 * и тот же. Отдельно от `generate`/`deliver`, потому что те не знают ни документов, ни кита:
 * здесь собирается вход и разбираются отказы.
 *
 * ## Отказы названы, а не брошены
 *
 * Их три, и все три — законные состояния, а не ошибки программы: документ не разбирается
 * в схему, кита нет, источник не принимает запись. Каждый превращается в ключ словаря плагина
 * и показывается в панели. Исключением наружу уходит только то, чего мы не предвидели.
 *
 * @module plugins/reformer/codegen/pipeline/run
 */

import { appSnippet, formNameOfSchemaPath } from '@/plugins/reformer/core/codegen';
import { isFormSchema } from '@/plugins/reformer/core/form-model';
import type { JsonFormSchema } from '@reformer/renderer-json';
import type { ResourceId } from '@reformer/builder-plugin-api';
import type { CodegenTarget } from '../contract';
import { deliverModule, SourceReadOnlyError } from './deliver';
import { generateModule, type CodegenProblem } from './generate';
import type { CodegenDocument, CodegenHost } from '../host';
import type { CodegenStore } from './state';
import { formSourceOf, StepPartsError, type FormSource } from './source';

/**
 * Имя формы по умолчанию — из пути файла схемы ({@link formNameOfSchemaPath}).
 *
 * Для канонического имени (`form.schema.json`, прежнее `renderer.schema.json`) это имя ПАПКИ:
 * срез по точке дал бы `form` (или `renderer`) для любой формы проекта. Для прочих — имя
 * файла до ПЕРВОЙ точки: каноничное имя схемы двусоставное (`credit.schema.json`), и отрезание
 * одного расширения оставило бы `credit.schema` — из чего `kebab` делает `creditschema`,
 * то есть каталог `creditschema/` и тип `CreditschemaForm`.
 */
export function defaultFormName(document: CodegenDocument): string {
  return formNameOfSchemaPath(document.ref.path);
}

/**
 * Схема документа: сначала модель, потом текст.
 *
 * Модель предпочтительнее, потому что она СОГЛАСОВАНА с буфером по контракту, а разбор текста
 * даст схему даже тогда, когда редактор считает буфер незаконченным. `null` — документ схемой
 * не является; это законное состояние (в схему открыт не тот файл), а не поломка.
 */
export function schemaOf(document: CodegenDocument): JsonFormSchema | null {
  const model = document.model();
  if (isFormSchema(model)) return model;
  try {
    const parsed: unknown = JSON.parse(document.getText());
    return isFormSchema(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export interface RunOptions {
  readonly host: CodegenHost;
  readonly targets: readonly CodegenTarget[];
  readonly documentId: ResourceId;
  readonly store: CodegenStore;
  /** Имя формы; пустое — берётся из имени файла. */
  readonly formName?: string;
  /**
   * Отказы, случившиеся ДО прогона, — разбор пользовательских целей.
   *
   * Показываются там же, где отказы печати, и по той же причине: человек смотрит
   * в панель после нажатия «Сгенерировать», и «мой шаблон не подхватился» обязан
   * объясниться именно там, а не в исчезнувшем тосте.
   */
  readonly problems?: readonly CodegenProblem[];
}

/**
 * Напечатать и записать модуль формы. Ничего не бросает при предвиденных отказах: они
 * приземляются в состояние ключом словаря.
 */
export async function runCodegen(options: RunOptions): Promise<void> {
  const { host, targets, documentId, store } = options;
  const document = host.documentOf(documentId);
  if (document === null) {
    store.patch({ phase: 'idle', errorKey: 'error.no-document' });
    return;
  }

  const schema = schemaOf(document);
  if (schema === null) {
    store.patch({ phase: 'idle', errorKey: 'error.not-a-schema' });
    return;
  }

  let source: FormSource;
  try {
    source = await formSourceOf(host, document, schema);
  } catch (error) {
    if (!(error instanceof StepPartsError)) throw error;
    store.patch({ phase: 'idle', errorKey: 'error.step-parts', errorDetail: error.message });
    return;
  }

  const kit = host.kit();
  if (kit === null) {
    // Без кита неизвестно, откуда импортировать компоненты. Умолчание здесь вернуло бы
    // ровно тот дефект, ради которого дескриптор и заводился, только молча.
    store.patch({ phase: 'idle', errorKey: 'error.no-kit' });
    return;
  }

  const formName = (options.formName ?? '').trim() || defaultFormName(document);
  store.patch({ phase: 'running', errorKey: null, errorDetail: undefined, delivery: null });

  const module = await generateModule(
    targets,
    {
      schema: source.schema,
      origins: source.origins,
      formName,
      kit: { kit, catalog: host.catalog() },
      rules: host.rulesOf?.(documentId) ?? undefined,
    },
    host.format
  );

  const problems = [...(options.problems ?? []), ...module.problems];
  const files = module.files.map((file) => ({
    path: file.path,
    cls: file.cls,
    targetId: file.targetId,
    origin: file.origin,
  }));
  // Сниппет регистрации — не файл модуля: он вставляется в ЧУЖОЕ приложение, и записать его
  // за человека нельзя. Поэтому он не цель, а часть отчёта.
  const snippet = appSnippet(module.context.names);

  try {
    const delivery = await deliverModule(host, host.parentOf(documentId), module.dir, module.files);
    store.patch({
      phase: 'idle',
      formName,
      files,
      snippet,
      problems,
      view: module.view,
      delivery,
      errorKey: null,
    });
  } catch (error) {
    store.patch({
      phase: 'idle',
      formName,
      files,
      snippet,
      problems,
      view: module.view,
      delivery: null,
      errorKey: error instanceof SourceReadOnlyError ? 'error.read-only' : 'error.failed',
    });
    if (!(error instanceof SourceReadOnlyError)) throw error;
  }
}
