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
 * @module plugins/codegen/run
 */

import { appSnippet } from '@/lib/codegen';
import { isFormSchema } from '@/lib/form-model/normalize';
import type { JsonFormSchema } from '@reformer/renderer-json';
import type { ResourceId } from '@/sdk';
import type { CodegenTarget } from './contract';
import { deliverModule, SourceReadOnlyError } from './deliver';
import { generateModule } from './generate';
import type { CodegenDocument, CodegenHost } from './host';
import type { CodegenStore } from './state';

/**
 * Имя формы по умолчанию — имя файла схемы до ПЕРВОЙ точки.
 *
 * До первой, а не до последней: каноничное имя схемы двусоставное (`credit.schema.json`),
 * и отрезание одного расширения оставило бы `credit.schema` — из чего `kebab` делает
 * `creditschema`, то есть каталог `creditschema/` и тип `CreditschemaForm`.
 */
export function defaultFormName(document: CodegenDocument): string {
  const name = document.ref.name;
  const dot = name.indexOf('.');
  return dot <= 0 ? name : name.slice(0, dot);
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

  const kit = host.kit();
  if (kit === null) {
    // Без кита неизвестно, откуда импортировать компоненты. Умолчание здесь вернуло бы
    // ровно тот дефект, ради которого дескриптор и заводился, только молча.
    store.patch({ phase: 'idle', errorKey: 'error.no-kit' });
    return;
  }

  const formName = (options.formName ?? '').trim() || defaultFormName(document);
  store.patch({ phase: 'running', errorKey: null, delivery: null });

  const module = await generateModule(
    targets,
    {
      schema,
      formName,
      kit: { kit, catalog: host.catalog() },
      rules: host.rulesOf?.(documentId) ?? undefined,
    },
    host.format
  );

  const files = module.files.map((file) => ({ path: file.path, cls: file.cls }));
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
      problems: module.problems,
      delivery,
      errorKey: null,
    });
  } catch (error) {
    store.patch({
      phase: 'idle',
      formName,
      files,
      snippet,
      problems: module.problems,
      delivery: null,
      errorKey: error instanceof SourceReadOnlyError ? 'error.read-only' : 'error.failed',
    });
    if (!(error instanceof SourceReadOnlyError)) throw error;
  }
}
