/**
 * Создание формы по заказу другого плагина: тот же путь, что у окна «Создать форму», но шаблон,
 * имя и каталог приходят параметрами, а исход — значением.
 *
 * Заведено ради ассистента: «сделай анкету на кредит» без открытой формы — законная просьба, и
 * модуль формы обязан лечь ровно так, как его кладёт окно: каталогом `<каталог>/<имя>/`, всеми
 * файлами шаблона, с сохранением и перечитыванием дерева.
 *
 * ## Пустая форма
 *
 * Встроенные шаблоны — образцы: в «Простой форме» по полю каждого вида, что есть в ките. Форме по
 * описанию они мешают — каждое лишнее поле пришлось бы убрать. Поэтому без шаблона создаётся
 * пустая форма: один документ `schema/form.schema.json` с пустым корнем. Код модуля по нему
 * печатает генерация — тогда, когда форма собрана.
 *
 * @module plugins/reformer/templates/content/create-for
 */

import { resourceNameOf, type ResourceId } from '@reformer/builder-plugin-api';
import { emptySchema } from '../../../core/form-model';
import { printJson } from '../../../core/codegen/print/js';
import type { FormTemplate, TemplateSource, TemplateStore } from '../contract';
import type { TemplatesHost } from '../host';
import { isUsableFormName } from '../render/placeholders';
import { generateFormFromTemplate, listTemplates, suggestedFolderOf } from './operations';

/** Шаблон в списке для заказчика: то, по чему его выбирают. */
export interface TemplateSummary {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly source: TemplateSource;
}

export interface CreateFormRequest {
  /** Имя формы — оно же имя каталога модуля. */
  readonly formName: string;
  /** Шаблон: идентификатор или имя. Без него — пустая форма. */
  readonly template?: string;
  /** Каталог для модуля — путь от корня проекта. Без него — рядом с `near` или каталог форм. */
  readonly folder?: string;
  /** Документ, рядом с которым кладётся форма, когда каталог не назван. */
  readonly near?: ResourceId;
}

export type CreateFormReport =
  | {
      readonly ok: true;
      /** Документ новой формы — его открывают. */
      readonly documentId: ResourceId;
      /** Путь документа от корня проекта. */
      readonly path: string;
      /** Имя шаблона; `null` — пустая форма. */
      readonly template: string | null;
    }
  | {
      readonly ok: false;
      /** Ключ словаря шаблонов либо `error.unknown-template`. */
      readonly error: string;
      /** Тот же отказ словами действующей локали. */
      readonly message: string;
    };

/** Где лежат формы, если каталог не назван и открытого документа нет. */
const FORMS_DIR = 'forms';

/** Пустая форма — шаблон из одного документа. */
function emptyTemplate(): FormTemplate {
  return {
    id: 'empty',
    name: 'empty',
    source: 'builtin',
    files: [{ path: 'schema/form.schema.json', content: printJson(emptySchema()) }],
  };
}

/** Шаблоны всех хранилищ сводкой — без файлов: заказчику они не нужны. */
export async function templateSummaries(
  stores: readonly TemplateStore[]
): Promise<readonly TemplateSummary[]> {
  return (await listTemplates(stores)).map(({ id, name, description, source }) => ({
    id,
    name,
    ...(description === undefined ? {} : { description }),
    source,
  }));
}

export interface CreateForDeps {
  readonly host: TemplatesHost;
  readonly stores: () => readonly TemplateStore[];
  readonly translate: (key: string, params?: Record<string, unknown>) => string;
}

/** Создать форму по заказу. Ничего не бросает: отказ — в отчёте. */
export async function createFormFor(
  deps: CreateForDeps,
  request: CreateFormRequest
): Promise<CreateFormReport> {
  const { host, translate } = deps;
  const refuse = (error: string, params?: Record<string, unknown>): CreateFormReport => ({
    ok: false,
    error,
    message: translate(error, params),
  });

  if (!isUsableFormName(request.formName)) return refuse('error.no-form-name');
  const root = host.projectRoot();
  if (root === null) return refuse('error.no-project');

  let template: FormTemplate;
  if (request.template === undefined) {
    template = emptyTemplate();
  } else {
    const wanted = request.template.trim().toLowerCase();
    const all = await listTemplates(deps.stores());
    const found =
      all.find((item) => item.id.toLowerCase() === wanted) ??
      all.find((item) => item.name.toLowerCase() === wanted);
    if (found === undefined) {
      return refuse('error.unknown-template', { template: request.template });
    }
    template = found;
  }

  const parent = await parentOf(host, root, request);
  const created = await generateFormFromTemplate(
    host,
    parent,
    request.formName,
    template,
    template.files.map((file) => file.path)
  );
  if (!created.ok) return refuse(created.messageKey, created.params);
  if (created.openId === null) return refuse('error.nothing-picked');
  return {
    ok: true,
    documentId: created.openId,
    path: pathOf(host, created.openId),
    template: request.template === undefined ? null : template.name,
  };
}

/**
 * Путь документа от корня проекта. Ссылку рабочая область знает только у открытого документа, а
 * новую форму ещё не открывали — тогда путь берётся из адреса правилом SDK.
 */
function pathOf(host: TemplatesHost, id: ResourceId): string {
  const ref = host.refOf(id);
  if (ref !== null) return ref.path;
  try {
    return resourceNameOf(id).path;
  } catch {
    return String(id);
  }
}

/** Каталог для модуля: названный, рядом с документом или каталог форм — иначе корень проекта. */
async function parentOf(
  host: TemplatesHost,
  root: ResourceId,
  request: CreateFormRequest
): Promise<ResourceId> {
  const segments = (path: string): string[] => path.split('/').filter((part) => part !== '');
  if (request.folder !== undefined) return host.resolve(root, ...segments(request.folder));
  if (request.near !== undefined && host.refOf(request.near) !== null) {
    return suggestedFolderOf(host, request.near);
  }
  const forms = host.resolve(root, FORMS_DIR);
  return (await host.exists(forms).catch(() => false)) ? forms : root;
}
