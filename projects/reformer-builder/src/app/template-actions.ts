/**
 * Оркестрация шаблонов форм: собрать шаблон из выбранных в дереве файлов, сгенерировать по шаблону
 * новую форму, переименовать/удалить шаблон. Мост между `templates/` (чистая логика), `io/` (диск и
 * IndexedDB) и сторами; здесь же тосты — как в `save-actions`.
 *
 * @module reformer-builder/app/template-actions
 */

import { toast } from '@reformer/ui-kit/sonner';
import { createFileDeep, joinPath, listFilesDeep, readTextFile, uniqueName } from '../io/fs-ops';
import {
  deleteLocalTemplate,
  deleteProjectTemplate,
  saveLocalTemplate,
  saveProjectTemplate,
  updateLocalTemplate,
  updateProjectManifest,
} from '../io/template-repo';
import {
  buildTemplateFiles,
  formSchemaFileOf,
  isTextFile,
  materializeFiles,
  templateSlug,
  type FormTemplate,
  type SourceFile,
} from '../templates';
import { ensureSchema } from '../model';
import { editorActions } from '../store';
import { projectStore } from '../store/project-store';
import { reloadTemplates } from '../store/templates-store';
import { openCreatedFile, rescanProject } from './save-actions';

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Имя формы, подставляемое в плейсхолдеры при предпросмотре шаблона. */
const PREVIEW_FORM_NAME = 'sample-form';

/** Корень открытого проекта или `null` (все операции требуют Mode B). */
function projectRoot(): FileSystemDirectoryHandle | null {
  return projectStore.getState().dirHandle;
}

/** Куда сохранять новый шаблон. */
export type TemplateTarget = 'project' | 'local';

/** Параметры создания шаблона из выбранных файлов. */
export interface CreateTemplateOptions {
  name: string;
  description?: string;
  /** Имя, которое заменяется плейсхолдерами; пустое — содержимое остаётся как есть. */
  baseName: string;
  target: TemplateTarget;
}

/** Развернуть выбор дерева в список файлов: папки — рекурсивно, дубли схлопываются. */
async function expandPaths(root: FileSystemDirectoryHandle, paths: string[]): Promise<string[]> {
  const kinds = new Map(projectStore.getState().tree.map((e) => [e.path, e.kind]));
  const out: string[] = [];
  for (const path of paths) {
    if (kinds.get(path) === 'directory') {
      const inner = await listFilesDeep(root, path);
      out.push(...inner.map((rel) => joinPath(path, rel)));
    } else {
      out.push(path);
    }
  }
  return [...new Set(out)];
}

/**
 * Создать шаблон из выбранных путей проекта: читает файлы (бинарные пропускает), делает пути
 * относительными общего каталога, заменяет базовое имя плейсхолдерами и сохраняет в проект или
 * локально. Список шаблонов перечитывается.
 */
export async function createTemplateFrom(
  paths: string[],
  opts: CreateTemplateOptions
): Promise<void> {
  const root = projectRoot();
  if (!root) {
    toast('Проект не открыт');
    return;
  }
  const name = opts.name.trim();
  if (!name) {
    toast('Укажите имя шаблона');
    return;
  }
  try {
    const all = await expandPaths(root, paths);
    const textual = all.filter(isTextFile);
    const skipped = all.length - textual.length;
    if (!textual.length) {
      toast('Нечего сохранять: выбраны только бинарные файлы');
      return;
    }

    const sources: SourceFile[] = [];
    for (const path of textual) sources.push({ path, content: await readTextFile(root, path) });

    const template: FormTemplate = {
      id: templateSlug(name),
      name,
      description: opts.description?.trim() || undefined,
      source: opts.target,
      files: buildTemplateFiles(sources, opts.baseName.trim()),
      createdAt: new Date().toISOString(),
    };
    const saved =
      opts.target === 'project'
        ? await saveProjectTemplate(root, template, opts.baseName.trim() || undefined)
        : await saveLocalTemplate(template);

    if (opts.target === 'project') await rescanProject();
    await reloadTemplates();
    toast(
      `Шаблон «${saved.name}» сохранён (файлов: ${saved.files.length}` +
        (skipped ? `, пропущено бинарных: ${skipped})` : ')')
    );
  } catch (e) {
    toast('Не удалось создать шаблон: ' + msg(e));
  }
}

/**
 * Сгенерировать форму по шаблону: папка `<formName>/` в `parentPath`, выбранные файлы (с добором
 * зависимостей) и подстановкой имени. Схема формы из набора открывается в canvas.
 */
export async function generateFromTemplate(
  parentPath: string,
  formName: string,
  template: FormTemplate,
  picked: Iterable<string>
): Promise<void> {
  const root = projectRoot();
  if (!root) {
    toast('Проект не открыт');
    return;
  }
  const name = formName.trim();
  const files = materializeFiles(template, picked, name);
  if (!files.length) {
    toast('Не выбрано ни одного файла');
    return;
  }
  try {
    const folder = await uniqueName(root, parentPath, name);
    const dirPath = joinPath(parentPath, folder);
    const schema = formSchemaFileOf(files);
    let schemaHandle: FileSystemFileHandle | null = null;

    for (const f of files) {
      const handle = await createFileDeep(root, dirPath, f.path, f.content);
      if (schema && f.path === schema.path) schemaHandle = handle;
    }

    await rescanProject();
    if (schema && schemaHandle) {
      const path = joinPath(dirPath, schema.path);
      await openCreatedFile(path, path.slice(path.lastIndexOf('/') + 1), schemaHandle, true);
    }
    toast(`Форма «${folder}» создана по шаблону «${template.name}»`);
  } catch (e) {
    toast('Не удалось создать форму: ' + msg(e));
  }
}

/**
 * Открыть схему шаблона временной вкладкой в рабочей области: посмотреть/покрутить форму до её
 * генерации. Файлы не создаются, вкладка помечена `kind: 'template'`; повторный клик по тому же
 * шаблону активирует уже открытую.
 */
export function openTemplatePreview(template: FormTemplate): void {
  // Имя-заглушка вместо плейсхолдеров: превью — про layout, а не про конкретную форму.
  const files = materializeFiles(
    template,
    template.files.map((f) => f.path),
    PREVIEW_FORM_NAME
  );
  const file = formSchemaFileOf(files);
  if (!file) {
    toast(`В шаблоне «${template.name}» нет схемы формы`);
    return;
  }
  try {
    const schema = ensureSchema(JSON.parse(file.content));
    editorActions.openTab(
      `template:${template.source}:${template.id}`,
      { kind: 'template', name: template.name },
      schema
    );
  } catch (e) {
    toast('Не удалось открыть шаблон: ' + msg(e));
  }
}

/** Удалить шаблон (встроенный удалить нельзя). */
export async function deleteTemplate(template: FormTemplate): Promise<void> {
  if (template.source === 'builtin') return;
  const root = projectRoot();
  try {
    if (template.source === 'project') {
      if (!root) {
        toast('Проект не открыт');
        return;
      }
      await deleteProjectTemplate(root, template.id);
      await rescanProject();
    } else {
      await deleteLocalTemplate(template.id);
    }
    await reloadTemplates();
    toast(`Шаблон «${template.name}» удалён`);
  } catch (e) {
    toast('Не удалось удалить шаблон: ' + msg(e));
  }
}

/** Переименовать шаблон (правится только манифест/запись — каталог и файлы остаются на месте). */
export async function renameTemplate(template: FormTemplate, name: string): Promise<void> {
  if (template.source === 'builtin') return;
  const next = name.trim();
  if (!next) return;
  const root = projectRoot();
  try {
    const updated: FormTemplate = { ...template, name: next };
    if (template.source === 'project') {
      if (!root) {
        toast('Проект не открыт');
        return;
      }
      await updateProjectManifest(root, updated);
      await rescanProject();
    } else {
      await updateLocalTemplate(updated);
    }
    await reloadTemplates();
  } catch (e) {
    toast('Не удалось переименовать шаблон: ' + msg(e));
  }
}
