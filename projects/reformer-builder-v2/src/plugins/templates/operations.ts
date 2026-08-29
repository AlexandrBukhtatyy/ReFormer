/**
 * Операции над шаблонами: собрать шаблон из каталога проекта, создать форму по шаблону,
 * переименовать, удалить.
 *
 * ## Что здесь не повторяется
 *
 * В v1 это был `app/template-actions.ts`, и каждая из четырёх функций начиналась с одного
 * и того же: достать `dirHandle` из стора, проверить «а проект-то открыт», развилку
 * `if (source === 'project') … else …` и свой тост на каждый исход. Здесь развилки нет вовсе:
 * куда писать, знает ХРАНИЛИЩЕ, а операция знает только интерфейс.
 *
 * ## Исход — данные, а не тост
 *
 * Каждая операция возвращает {@link OperationResult} с ключом словаря. Показывает его панель.
 * Причина та же, что у кодогена: сообщения службы уведомлений разрешаются словарём Host,
 * а не плагина, поэтому ключ плагина показался бы сырым.
 *
 * @module plugins/templates/operations
 */

import type { ResourceId, ResourceRef } from '@/sdk';
import {
  canRemove,
  canSave,
  canUpdate,
  type FormTemplate,
  type TemplateSource,
  type TemplateStore,
} from './contract';
import {
  buildTemplateFiles,
  formSchemaFileOf,
  isTextFile,
  materializeFiles,
  templateSlug,
  type SourceFile,
} from './files';
import type { TemplatesHost } from './host';

/** Чем кончилась операция. `params` подставляются в сообщение. */
export interface OperationResult {
  readonly ok: boolean;
  /** Ключ словаря ПЛАГИНА. */
  readonly messageKey: string;
  readonly params?: Record<string, unknown>;
}

const fail = (messageKey: string, params?: Record<string, unknown>): OperationResult => ({
  ok: false,
  messageKey,
  ...(params === undefined ? {} : { params }),
});

const done = (messageKey: string, params?: Record<string, unknown>): OperationResult => ({
  ok: true,
  messageKey,
  ...(params === undefined ? {} : { params }),
});

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Рекурсивный обход каталога: пути относительно корня проекта. */
async function readDirectory(
  host: TemplatesHost,
  dir: ResourceId,
  prefix: string
): Promise<{ readonly files: readonly SourceFile[]; readonly skipped: number }> {
  let entries: readonly ResourceRef[];
  try {
    entries = await host.list(dir);
  } catch {
    return { files: [], skipped: 0 };
  }
  const files: SourceFile[] = [];
  let skipped = 0;
  for (const entry of entries) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.kind === 'directory') {
      const inner = await readDirectory(host, entry.id, relative);
      files.push(...inner.files);
      skipped += inner.skipped;
      continue;
    }
    if (!isTextFile(relative)) {
      skipped += 1;
      continue;
    }
    const content = await host.readText(entry.id);
    if (content !== null) files.push({ path: relative, content });
  }
  return { files, skipped };
}

export interface CreateTemplateOptions {
  readonly name: string;
  readonly description?: string;
  /** Имя, которое заменяется плейсхолдерами; пустое — берётся из имени каталога. */
  readonly baseName?: string;
}

/**
 * Собрать шаблон из каталога проекта и сохранить в выбранное хранилище.
 *
 * Каталог, а не произвольный набор путей: канал «что выделено в дереве» в v2 отсутствует —
 * дерево принадлежит Host и своего выделения наружу не отдаёт. Каталог формы при этом ровно
 * то, из чего шаблон и делают, поэтому потеря не выдуманная, а названная.
 */
export async function createTemplateFromDirectory(
  host: TemplatesHost,
  store: TemplateStore,
  dir: ResourceId,
  options: CreateTemplateOptions
): Promise<OperationResult> {
  if (!canSave(store)) return fail('error.store-read-only');
  const name = options.name.trim();
  if (name === '') return fail('error.no-name');

  try {
    const { files, skipped } = await readDirectory(host, dir, '');
    if (files.length === 0) return fail('error.nothing-to-save');

    // Базовое имя по умолчанию — имя КАТАЛОГА, а не производное списка файлов.
    // `suggestBaseName` умеет выводить его из путей, но ей нужны пути от корня проекта;
    // здесь они уже относительны каталогу, и она бы предложила имя первого файла («model»),
    // после чего токенизация съела бы слово `model` во всех путях и текстах.
    const baseName = (options.baseName ?? '').trim() || dir.slice(dir.lastIndexOf('/') + 1);
    const template: FormTemplate = {
      id: templateSlug(name),
      name,
      description: options.description?.trim() || undefined,
      source: store.source,
      files: buildTemplateFiles(files, baseName),
      createdAt: new Date().toISOString(),
    };
    const saved = await store.save(template, baseName);
    return done('result.created', {
      name: saved.name,
      count: saved.files.length,
      skipped,
    });
  } catch (error) {
    return fail('error.create-failed', { message: messageOf(error) });
  }
}

export interface GenerateFormResult extends OperationResult {
  /** Схема, которую стоит открыть; `null` — в наборе схемы не было. */
  readonly openId: ResourceId | null;
}

/**
 * Создать форму по шаблону: каталог `<parent>/<formName>/`, отобранные файлы (с добором
 * зависимостей) и подстановкой имени.
 *
 * Свободное имя каталога подбирается так же, как для шаблона: занятое имя не перезаписывается
 * молча — форма рядом лучше, чем стёртая чужая.
 */
export async function generateFormFromTemplate(
  host: TemplatesHost,
  parent: ResourceId,
  formName: string,
  template: FormTemplate,
  picked: Iterable<string>
): Promise<GenerateFormResult> {
  const name = formName.trim();
  if (name === '') return { ...fail('error.no-form-name'), openId: null };

  const capabilities = host.sourceOf(parent);
  if (capabilities === null || !capabilities.write) {
    return { ...fail('error.read-only'), openId: null };
  }

  const files = materializeFiles(template, picked, name);
  if (files.length === 0) return { ...fail('error.nothing-picked'), openId: null };

  try {
    let folder = name;
    for (let index = 2; await host.exists(host.resolve(parent, folder)); index += 1) {
      folder = `${name}-${index}`;
    }
    const dir = host.resolve(parent, folder);
    const schema = formSchemaFileOf(files);
    const ids: ResourceId[] = [];
    let openId: ResourceId | null = null;

    for (const file of files) {
      const id = host.resolve(dir, ...file.path.split('/'));
      await host.writeText(id, file.content);
      ids.push(id);
      if (schema !== null && file.path === schema.file.path) openId = id;
    }
    await host.save?.(ids);

    return {
      ...done('result.generated', { folder, template: template.name }),
      openId,
    };
  } catch (error) {
    return { ...fail('error.generate-failed', { message: messageOf(error) }), openId: null };
  }
}

/** Переименовать шаблон: правится только манифест или запись, файлы остаются на месте. */
export async function renameTemplate(
  store: TemplateStore,
  template: FormTemplate,
  name: string
): Promise<OperationResult> {
  const next = name.trim();
  if (next === '') return fail('error.no-name');
  if (!canUpdate(store)) return fail('error.store-read-only');
  try {
    await store.update({ ...template, name: next });
    return done('result.renamed', { name: next });
  } catch (error) {
    return fail('error.rename-failed', { message: messageOf(error) });
  }
}

/** Удалить шаблон. */
export async function removeTemplate(
  store: TemplateStore,
  template: FormTemplate
): Promise<OperationResult> {
  if (!canRemove(store)) return fail('error.no-remove');
  try {
    await store.remove(template.id);
    return done('result.removed', { name: template.name });
  } catch (error) {
    return fail('error.remove-failed', { message: messageOf(error) });
  }
}

/** Все шаблоны всех доступных хранилищ, в порядке видов. */
export async function listTemplates(
  stores: readonly TemplateStore[]
): Promise<readonly FormTemplate[]> {
  const out: FormTemplate[] = [];
  for (const store of stores) {
    if (!store.available()) continue;
    try {
      out.push(...(await store.list()));
    } catch (error) {
      // Отказ одного хранилища не должен прятать остальные.
      console.warn(`[templates] хранилище «${store.source}» не отдало список`, error);
    }
  }
  return out;
}

/** Порядок видов в панели: от неизменяемого к личному. */
export const SOURCE_ORDER: readonly TemplateSource[] = ['builtin', 'project', 'local'];

/** Хранилище выбранного вида среди внесённых. */
export function storeOf(
  stores: readonly TemplateStore[],
  source: TemplateSource
): TemplateStore | null {
  return stores.find((store) => store.source === source) ?? null;
}
