/**
 * Хранилища шаблонов форм: каталог проекта (`.reformer/templates/<slug>/`, шарится через git) и
 * локальное IndexedDB-хранилище (не зависит от открытого проекта). Оба отдают и принимают один и
 * тот же {@link FormTemplate}; выбор источника — за вызывающим (`app/template-actions`).
 *
 * Проектный шаблон = папка с файлами как есть + `template.json` с метаданными. Источник истины по
 * составу — сам каталог, поэтому шаблон можно править руками в IDE.
 *
 * @module reformer-builder/io/template-repo
 */

import { getRuntimeConfig } from '../config/state';
import {
  TEMPLATE_MANIFEST,
  TEMPLATE_MANIFEST_VERSION,
  type FormTemplate,
  type TemplateManifest,
} from '../templates';
import { isTextFile } from '../templates/collect';
import {
  createFileDeep,
  deletePath,
  listFilesDeep,
  listSubdirectories,
  readTextFile,
  uniqueName,
} from './fs-ops';
import { TEMPLATES_STORE, idbTx } from './idb';

type Root = FileSystemDirectoryHandle;

/** Каталог шаблонов по умолчанию (скрытая служебная папка проекта). */
const DEFAULT_TEMPLATES_DIR = '.reformer/templates';

/** Каталог шаблонов в проекте: из `project.templatesDir` конфига, иначе дефолтный. */
export function templatesDir(): string {
  const dir = getRuntimeConfig().project?.templatesDir?.trim();
  return dir ? dir.replace(/^\/+|\/+$/g, '') : DEFAULT_TEMPLATES_DIR;
}

function parseManifest(text: string): Partial<TemplateManifest> {
  try {
    const json: unknown = JSON.parse(text);
    return json && typeof json === 'object' ? (json as Partial<TemplateManifest>) : {};
  } catch {
    return {};
  }
}

/** Прочитать один шаблон из каталога `<templatesDir>/<slug>`; `null`, если файлов нет. */
async function readProjectTemplate(root: Root, slug: string): Promise<FormTemplate | null> {
  const dir = `${templatesDir()}/${slug}`;
  const paths = await listFilesDeep(root, dir);
  if (!paths.length) return null;

  let manifest: Partial<TemplateManifest> = {};
  if (paths.includes(TEMPLATE_MANIFEST)) {
    manifest = parseManifest(await readTextFile(root, `${dir}/${TEMPLATE_MANIFEST}`));
  }

  const files = [];
  for (const path of paths) {
    if (path === TEMPLATE_MANIFEST || !isTextFile(path)) continue;
    files.push({ path, content: await readTextFile(root, `${dir}/${path}`) });
  }
  if (!files.length) return null;

  return {
    id: slug,
    name: manifest.name?.trim() || slug,
    description: manifest.description,
    source: 'project',
    files,
    requires: manifest.requires,
    createdAt: manifest.createdAt,
  };
}

/** Все шаблоны из каталога проекта. Нечитаемый шаблон пропускается, остальные загружаются. */
export async function loadProjectTemplates(root: Root): Promise<FormTemplate[]> {
  const slugs = await listSubdirectories(root, templatesDir());
  const out: FormTemplate[] = [];
  for (const slug of slugs) {
    try {
      const t = await readProjectTemplate(root, slug);
      if (t) out.push(t);
    } catch (e) {
      console.warn('[reformer-builder] шаблон не прочитан:', slug, e);
    }
  }
  return out;
}

/**
 * Записать шаблон в каталог проекта. Slug берётся из `template.id`; при занятом имени подбирается
 * свободное (`credit-form-2`). Возвращает итоговый шаблон с фактическим id.
 */
export async function saveProjectTemplate(
  root: Root,
  template: FormTemplate,
  baseName?: string
): Promise<FormTemplate> {
  const slug = await uniqueName(root, templatesDir(), template.id);
  const dir = `${templatesDir()}/${slug}`;
  const manifest: TemplateManifest = {
    version: TEMPLATE_MANIFEST_VERSION,
    name: template.name,
    description: template.description,
    baseName,
    createdAt: template.createdAt,
    requires: template.requires,
  };
  await createFileDeep(root, dir, TEMPLATE_MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  for (const f of template.files) await createFileDeep(root, dir, f.path, f.content);
  return { ...template, id: slug, source: 'project' };
}

/** Переписать только манифест проектного шаблона (переименование/описание). */
export async function updateProjectManifest(root: Root, template: FormTemplate): Promise<void> {
  const dir = `${templatesDir()}/${template.id}`;
  const manifest: TemplateManifest = {
    version: TEMPLATE_MANIFEST_VERSION,
    name: template.name,
    description: template.description,
    createdAt: template.createdAt,
    requires: template.requires,
  };
  await createFileDeep(root, dir, TEMPLATE_MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
}

/** Удалить каталог шаблона из проекта. */
export async function deleteProjectTemplate(root: Root, id: string): Promise<void> {
  await deletePath(root, `${templatesDir()}/${id}`);
}

// ── локальное хранилище (IndexedDB) ──────────────────────────────────────────

/** Все локальные шаблоны (пустой список, если IndexedDB недоступна). */
export async function loadLocalTemplates(): Promise<FormTemplate[]> {
  try {
    const all = await idbTx<FormTemplate[]>(TEMPLATES_STORE, 'readonly', (s) => s.getAll());
    return all.map((t) => ({ ...t, source: 'local' }));
  } catch (e) {
    console.warn('[reformer-builder] локальные шаблоны недоступны:', e);
    return [];
  }
}

/** Сохранить локальный шаблон; при занятом id подбирается свободный (`credit-form-2`). */
export async function saveLocalTemplate(template: FormTemplate): Promise<FormTemplate> {
  const taken = new Set((await loadLocalTemplates()).map((t) => t.id));
  let id = template.id;
  for (let n = 2; taken.has(id); n++) id = `${template.id}-${n}`;
  const stored: FormTemplate = { ...template, id, source: 'local' };
  await idbTx(TEMPLATES_STORE, 'readwrite', (s) => s.put(stored, id));
  return stored;
}

/** Перезаписать существующий локальный шаблон (переименование/описание). */
export async function updateLocalTemplate(template: FormTemplate): Promise<void> {
  await idbTx(TEMPLATES_STORE, 'readwrite', (s) => s.put(template, template.id));
}

/** Удалить локальный шаблон. */
export async function deleteLocalTemplate(id: string): Promise<void> {
  await idbTx(TEMPLATES_STORE, 'readwrite', (s) => s.delete(id));
}
