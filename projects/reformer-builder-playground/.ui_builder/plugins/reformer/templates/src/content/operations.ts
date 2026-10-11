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
 * @module plugins/reformer/templates/content/operations
 */

import type { ResourceId, ResourceRef } from '@reformer/builder-plugin-api';
import {
  canRemove,
  canSave,
  canUpdate,
  type FormTemplate,
  type TemplateFile,
  type TemplateSource,
  type TemplateStore,
} from '../contract';
import {
  buildTemplateFiles,
  formSchemaFileOf,
  isTextFile,
  materializeFiles,
  templateSlug,
  type SourceFile,
} from './files';
import type { TemplatesHost } from '../host';
import { modulePlacementOf } from '../../../core/codegen';
import { fixtureDirOf } from '../../../core/form-fixture';

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

/**
 * Сказать дереву, что уровни изменились: по одному разу на КАТАЛОГ записанного.
 *
 * Адрес непрозрачен, поэтому родителя считает платформа ({@link TemplatesHost.parentOf}),
 * а не разбор строки. Отказ одного уровня не отменяет остальных и не отменяет саму
 * операцию: файлы уже записаны, и «не перечитали дерево» — не повод сообщить о неудаче.
 */
async function invalidateParents(host: TemplatesHost, ids: readonly ResourceId[]): Promise<void> {
  if (host.invalidate === undefined) return;
  for (const dir of new Set(ids.map((id) => host.parentOf(id)))) {
    try {
      await host.invalidate(dir);
    } catch (error) {
      console.warn(`[templates] уровень «${dir}» не перечитан`, error);
    }
  }
}

/** Один каталог проекта в списке выбора: адрес и путь, каким его видит человек. */
export interface FolderChoice {
  readonly id: ResourceId;
  /** Путь от корня проекта; пустая строка — сам корень. */
  readonly path: string;
}

/**
 * Каталоги, которые в списке выбора не нужны никогда.
 *
 * Не «скрытые вообще»: `.reformer`, `.ui_builder` и прочие каталоги настроек проекта человек
 * открывает осознанно, и прятать их — решать за него. Здесь перечислено то, куда форму
 * не кладут ни при каких обстоятельствах: чужие пакеты и вывод сборки. Заодно это главная
 * экономия обхода — `node_modules` один стоит дороже всего проекта.
 */
const SKIPPED_FOLDERS: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.next',
  '.turbo',
  '.vite',
]);

/** Предел обхода: столько каталогов человек всё равно не просматривает глазами. */
const FOLDER_LIMIT = 300;

/** Предел глубины. Форму кладут в осмысленное место, а не на десятый уровень вложенности. */
const FOLDER_DEPTH = 6;

/**
 * Каталоги проекта для выбора места новой формы — обходом вширь.
 *
 * Вширь, а не вглубь, потому что при упоре в предел показать полезнее ВЕРХНИЕ уровни:
 * `src/pages` человеку нужнее, чем полный перечень листьев одной ветки. По той же причине
 * пределы жёсткие: список — поле выбора, а не карта проекта, и обход, растянувшийся
 * на тысячу листингов, сделал бы открытие окна ожиданием.
 */
export async function listFolders(
  host: TemplatesHost,
  root: ResourceId,
  limit = FOLDER_LIMIT
): Promise<readonly FolderChoice[]> {
  const out: FolderChoice[] = [{ id: root, path: '' }];
  let level: readonly FolderChoice[] = out.slice();

  for (let depth = 0; depth < FOLDER_DEPTH && level.length > 0 && out.length < limit; depth += 1) {
    const next: FolderChoice[] = [];
    for (const folder of level) {
      if (out.length >= limit) break;
      let entries: readonly ResourceRef[];
      try {
        entries = await host.list(folder.id);
      } catch {
        // Нечитаемый каталог — не повод оборвать выбор: пропускаем его вместе с ветвью.
        continue;
      }
      for (const entry of entries) {
        if (entry.kind !== 'directory' || SKIPPED_FOLDERS.has(entry.name)) continue;
        const child = {
          id: entry.id,
          path: folder.path === '' ? entry.name : `${folder.path}/${entry.name}`,
        };
        next.push(child);
        out.push(child);
        if (out.length >= limit) break;
      }
    }
    level = next;
  }

  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Каталог, который предлагается для новой формы, когда открыт документ.
 *
 * Форму почти всегда кладут рядом с тем, над чем работают, — но «рядом» зависит от того, что
 * открыто. Свободно названный документ (`forms/credit.schema.json`) лежит среди форм, и его
 * каталог и есть нужное место. Документ МОДУЛЯ формы (`form.schema.json` в папке `schema/` либо,
 * у формы прежней раскладки, в корне модуля) лежит ВНУТРИ своего модуля: его каталог — это
 * `<модуль>/schema` или сам модуль, и новая форма там оказалась бы частью чужой. Ей место рядом
 * с модулем — в каталоге, где модуль лежит.
 *
 * Где модуль относительно документа, решает раскладка кодогена ({@link modulePlacementOf}), а не
 * разбор пути здесь: правило у них обязано быть одно.
 */
export function suggestedFolderOf(
  host: Pick<TemplatesHost, 'refOf' | 'parentOf' | 'projectRoot'>,
  documentId: ResourceId
): ResourceId {
  const dir = host.parentOf(documentId);
  const path = host.refOf(documentId)?.path;
  if (path === undefined) return dir;

  const placement = modulePlacementOf(path);
  if (placement.kind === 'detached') return dir;
  const moduleDir = placement.kind === 'nested' ? host.parentOf(dir) : dir;
  // Модуль в корне проекта: подниматься выше некуда — новая форма встаёт в сам корень.
  return moduleDir === host.projectRoot() ? moduleDir : host.parentOf(moduleDir);
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

/** Файлы модуля формы: всё, кроме тех, у кого своё место. */
function moduleFilesOf(files: readonly TemplateFile[]): readonly TemplateFile[] {
  return files.filter((file) => (file.scope ?? 'form') === 'form');
}

/**
 * Файлы фикстуры — те, что идут СВЕРХ вывода кодогена.
 *
 * Ложатся в корень модуля формы. Отдельным `scope` они помечены не ради адреса, а ради
 * происхождения — контракт каталога модуля (`06-form-directory-layout`) фикстуру не перечисляет,
 * и генерация модуля её не пишет.
 */
function fixtureFilesOf(files: readonly TemplateFile[]): readonly TemplateFile[] {
  return files.filter((file) => file.scope === 'fixture');
}

/**
 * Каталог фикстуры внутри каталога формы — корень МОДУЛЯ, которому принадлежит схема.
 *
 * Считается от пути схемы тем же правилом, каким фикстуру ищет превью (`fixtureDirOf`): схема
 * в `schema/form.schema.json` даёт корень формы, схема в корне — его же. Без схемы в наборе
 * считать не от чего, и фикстура ложится в корень формы.
 */
function fixtureDirIn(schemaPath: string | null): readonly string[] {
  const dir = schemaPath === null ? null : fixtureDirOf(schemaPath);
  return dir === null || dir === '' ? [] : dir.split('/');
}

/**
 * Создать форму по шаблону: каталог `<parent>/<formName>/` — он же каталог МОДУЛЯ формы, —
 * отобранные файлы (с добором зависимостей) и подстановкой имени.
 *
 * Свободное имя каталога подбирается так же, как для шаблона: занятое имя не перезаписывается
 * молча — форма рядом лучше, чем стёртая чужая.
 *
 * Имя подставляется ПО КАТАЛОГУ, а не по введённому: билдер называет форму именем каталога её
 * модуля, и генерация из билдера обязана лечь в те же файлы, что разложил шаблон. Каталог
 * `Профиль-2` с файлами под имя «Профиль» дал бы после первой же генерации два набора файлов.
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

  let folder = name;
  try {
    for (let index = 2; await host.exists(host.resolve(parent, folder)); index += 1) {
      folder = `${name}-${index}`;
    }
  } catch (error) {
    return { ...fail('error.generate-failed', { message: messageOf(error) }), openId: null };
  }

  // Кит нужен шаблону с движком: без него он не увидит вида формы, даже неся схему.
  // Токенному шаблону кит безразличен, поэтому его отсутствие — не отказ операции.
  const kit = host.kit();
  let files: readonly TemplateFile[];
  try {
    files = materializeFiles(template, picked, folder, {
      kit: kit === null ? null : { kit, catalog: host.catalog() },
    });
  } catch (error) {
    // Новый класс отказа: у токенной подстановки его не могло быть, а шаблон на движке
    // бросает — и сообщение Eta несёт номер строки, то есть ответ «где чинить».
    return { ...fail('error.template-failed', { message: messageOf(error) }), openId: null };
  }
  if (files.length === 0) return { ...fail('error.nothing-picked'), openId: null };

  try {
    const dir = host.resolve(parent, folder);
    const schema = formSchemaFileOf(files);
    const ids: ResourceId[] = [];
    let openId: ResourceId | null = null;

    for (const file of moduleFilesOf(files)) {
      const id = host.resolve(dir, ...file.path.split('/'));
      await host.writeText(id, file.content);
      ids.push(id);
      if (schema !== null && file.path === schema.file.path) openId = id;
    }

    // Фикстура — в корень модуля, которому принадлежит схема. Отдельным проходом её пишем
    // потому, что происхождение у неё другое — не вывод кодогена (см. `fixtureFilesOf`).
    const fixtureDir = fixtureDirIn(schema === null ? null : schema.file.path);
    for (const file of fixtureFilesOf(files)) {
      const id = host.resolve(dir, ...fixtureDir, ...file.path.split('/'));
      await host.writeText(id, file.content);
      ids.push(id);
    }
    const stored = await host.save?.(ids);
    // Каталог формы создан ЗАПИСЬЮ, а не операциями над записями, поэтому дерево о нём
    // не знает: у него лежит прошлый листинг родителя, и «форма создана» без строки
    // в дереве выглядит как несделанная работа.
    await invalidateParents(host, [dir, ...ids]);

    // Отправка в источник не удалась — форма осталась рабочей копией и не переживёт
    // перезагрузку. Сообщать об успехе здесь нельзя: именно так дефект и выглядел
    // снаружи — «создано», а в проекте пусто. Отсутствие `save` у порта — другое дело:
    // это законная сборка без отправки, а не отказ.
    if (stored === false) return { ...fail('error.save-failed'), openId: null };

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
