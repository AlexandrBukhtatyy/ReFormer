/**
 * Шаблоны в каталоге проекта: `<проект>/.ui_builder/templates/<slug>/`.
 *
 * Источник истины по составу — сам каталог, поэтому шаблон можно править руками в IDE и
 * шарить через git. Метаданные лежат рядом отдельным файлом-манифестом; отсутствие манифеста
 * не делает шаблон нечитаемым — имя берётся из имени каталога.
 *
 * Каталог назван `.ui_builder`, а не `.reformer` (как было в v1): он принадлежит инструменту,
 * а не библиотеке форм, и разведение имён избавляет от вопроса, чей это конфиг, когда рядом
 * лежат оба.
 *
 * @module plugins/templates/stores/project
 */

import type { ResourceId, ResourceRef } from '@/sdk';
import {
  TEMPLATE_MANIFEST,
  TEMPLATE_MANIFEST_VERSION,
  type FormTemplate,
  type TemplateFile,
  type TemplateManifest,
  type TemplateStore,
} from '../contract';
import { isTextFile } from '../files';
import type { TemplatesHost } from '../host';

/** Каталог шаблонов внутри проекта. */
export const TEMPLATES_DIR = '.ui_builder/templates';

function parseManifest(text: string): Partial<TemplateManifest> {
  try {
    const json: unknown = JSON.parse(text);
    return json !== null && typeof json === 'object' ? (json as Partial<TemplateManifest>) : {};
  } catch {
    return {};
  }
}

/** Рекурсивный обход каталога: пути относительно него, порядок обхода — как отдал источник. */
async function listFilesDeep(
  host: TemplatesHost,
  dir: ResourceId,
  prefix = ''
): Promise<readonly string[]> {
  let entries: readonly ResourceRef[];
  try {
    entries = await host.list(dir);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.kind === 'directory') {
      out.push(...(await listFilesDeep(host, entry.id, relative)));
    } else {
      out.push(relative);
    }
  }
  return out;
}

export function createProjectStore(host: TemplatesHost): TemplateStore {
  const rootDir = (): ResourceId | null => {
    const project = host.projectRoot();
    return project === null ? null : host.resolve(project, ...TEMPLATES_DIR.split('/'));
  };

  const readTemplate = async (dir: ResourceId, slug: string): Promise<FormTemplate | null> => {
    const paths = await listFilesDeep(host, dir);
    if (paths.length === 0) return null;

    let manifest: Partial<TemplateManifest> = {};
    if (paths.includes(TEMPLATE_MANIFEST)) {
      const text = await host.readText(host.resolve(dir, TEMPLATE_MANIFEST));
      if (text !== null) manifest = parseManifest(text);
    }

    const files: TemplateFile[] = [];
    for (const path of paths) {
      if (path === TEMPLATE_MANIFEST || !isTextFile(path)) continue;
      const content = await host.readText(host.resolve(dir, ...path.split('/')));
      if (content !== null) files.push({ path, content });
    }
    if (files.length === 0) return null;

    return {
      id: slug,
      name: manifest.name?.trim() ?? slug,
      description: manifest.description,
      source: 'project',
      files,
      requires: manifest.requires,
      createdAt: manifest.createdAt,
    };
  };

  const manifestOf = (template: FormTemplate, baseName?: string): string => {
    const manifest: TemplateManifest = {
      version: TEMPLATE_MANIFEST_VERSION,
      name: template.name,
      description: template.description,
      baseName,
      createdAt: template.createdAt,
      requires: template.requires as Record<string, string[]> | undefined,
    };
    return `${JSON.stringify(manifest, null, 2)}\n`;
  };

  /** Свободный slug: `credit-form`, `credit-form-2`, … */
  const freeSlug = async (dir: ResourceId, desired: string): Promise<string> => {
    let slug = desired;
    let index = 2;
    while (await host.exists(host.resolve(dir, slug))) {
      slug = `${desired}-${index}`;
      index += 1;
    }
    return slug;
  };

  const store: TemplateStore = {
    source: 'project',
    available: () => host.projectRoot() !== null,

    async list(): Promise<readonly FormTemplate[]> {
      const dir = rootDir();
      if (dir === null) return [];
      let entries: readonly ResourceRef[];
      try {
        entries = await host.list(dir);
      } catch {
        // Каталога нет — это норма: шаблонов в проекте просто не заводили.
        return [];
      }
      const out: FormTemplate[] = [];
      for (const entry of entries) {
        if (entry.kind !== 'directory') continue;
        try {
          const template = await readTemplate(entry.id, entry.name);
          if (template !== null) out.push(template);
        } catch (error) {
          // Один нечитаемый шаблон не должен прятать остальные.
          console.warn(`[templates] шаблон «${entry.name}» не прочитан`, error);
        }
      }
      return out;
    },

    async save(template: FormTemplate, baseName?: string): Promise<FormTemplate> {
      const root = rootDir();
      if (root === null) throw new Error('проект не открыт: каталог шаблонов неизвестен');
      const slug = await freeSlug(root, template.id);
      const dir = host.resolve(root, slug);
      const ids: ResourceId[] = [];

      const manifestId = host.resolve(dir, TEMPLATE_MANIFEST);
      await host.writeText(manifestId, manifestOf(template, baseName));
      ids.push(manifestId);

      for (const file of template.files) {
        const id = host.resolve(dir, ...file.path.split('/'));
        await host.writeText(id, file.content);
        ids.push(id);
      }
      await host.save?.(ids);
      return { ...template, id: slug, source: 'project' };
    },

    async update(template: FormTemplate): Promise<void> {
      const root = rootDir();
      if (root === null) throw new Error('проект не открыт: каталог шаблонов неизвестен');
      // Переписывается ТОЛЬКО манифест: переименование не двигает каталог и не трогает файлы,
      // иначе безобидная правка подписи ломала бы ссылки и историю git.
      const id = host.resolve(root, template.id, TEMPLATE_MANIFEST);
      await host.writeText(id, manifestOf(template));
      await host.save?.([id]);
    },
  };

  // Удаление объявляется, только если платформа его отдала: `isWritable` смотрит на наличие
  // методов, и объявить `remove`, который бросает, значило бы соврать проверке.
  if (host.remove !== undefined) {
    const remove = host.remove.bind(host);
    store.remove = async (id: string): Promise<void> => {
      const root = rootDir();
      if (root === null) throw new Error('проект не открыт: каталог шаблонов неизвестен');
      await remove(host.resolve(root, id));
    };
  }

  return store;
}
