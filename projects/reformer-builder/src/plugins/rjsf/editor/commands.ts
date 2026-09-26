/**
 * Команды редактора RJSF: новая форма, новое поле, отмена и повтор, экспорт `Form.tsx`.
 *
 * Всё — возможностями оболочки, ни одного порта: рабочая область (`DocumentsService`,
 * `WorkspaceFilesService`), ручка модели (`DocumentModelsService`) и дверь наружу
 * (`WorkspaceSaveService`, право `workspace.save` в манифесте).
 *
 * @module plugins/rjsf/editor/commands
 */

import {
  newField,
  nextFieldName,
  printFormModule,
  printRjsfForm,
  RJSF_PROVIDER_ID,
  sampleForm,
  type RjsfForm,
  type RjsfOp,
} from '@/plugins/rjsf/core';
import type {
  CommandContribution,
  DocumentModelsService,
  DocumentsService,
  ModelDocumentHandle,
  ResourceId,
  WorkspaceFilesService,
  WorkspaceSaveService,
} from '@reformer/builder-plugin-api';
import {
  RJSF_ADD_FIELD_COMMAND_ID,
  RJSF_EXPORT_COMMAND_ID,
  RJSF_FILE_SUFFIX,
  RJSF_NEW_COMMAND_ID,
  RJSF_REDO_COMMAND_ID,
  RJSF_UNDO_COMMAND_ID,
} from './contract';

/**
 * Условие клавиш отмены: активна вкладка документа ЭТОГО домена. История — у ручки модели
 * документа, а условие по виду документа делает сочетания доменов непересекающимися: `mod+z`
 * схемы ReFormer и `mod+z` формы RJSF не спорят за одну вкладку.
 */
const IN_RJSF = `activeResourceKind == ${RJSF_PROVIDER_ID}`;

/** Службы, которыми живут команды. Функции: службы спрашиваются в момент вызова. */
export interface RjsfServices {
  readonly documents: () => DocumentsService | undefined;
  readonly files: () => WorkspaceFilesService | undefined;
  readonly models: () => DocumentModelsService | undefined;
  readonly save: () => WorkspaceSaveService | undefined;
}

/** Исход экспорта: куда записан файл — или почему не записан. */
export type ExportOutcome =
  | { readonly status: 'written'; readonly id: ResourceId; readonly saved: boolean }
  | { readonly status: 'refused'; readonly reason: 'no-document' | 'read-only' };

/** Ручка документа ЭТОГО домена; чужую модель под своим типом не отдаём. */
export function rjsfHandleOf(
  services: RjsfServices,
  id: ResourceId
): ModelDocumentHandle<RjsfForm> | null {
  const handle = services.models()?.handleOf(id) ?? null;
  if (handle === null || handle.document.providerId !== RJSF_PROVIDER_ID) return null;
  return handle as ModelDocumentHandle<RjsfForm>;
}

function documentIdOf(args: unknown): ResourceId | null {
  if (typeof args !== 'object' || args === null) return null;
  const value = (args as { documentId?: unknown }).documentId;
  return typeof value === 'string' ? value : null;
}

/** Имя компонента из имени файла: `contact.rjsf.json` → `ContactForm`. */
export function componentNameOf(fileName: string): string {
  const base = fileName
    .replace(/\.rjsf\.json$|\.json$/, '')
    .replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (typeof c === 'string' ? c.toUpperCase() : ''));
  return `${base.charAt(0).toUpperCase()}${base.slice(1)}Form`;
}

/** Создать форму из заготовки рядом с активным файлом (или в корне) и открыть её. */
export async function createRjsfForm(services: RjsfServices): Promise<ResourceId | null> {
  const documents = services.documents();
  const files = services.files();
  if (documents === undefined || files === undefined) return null;
  const active = documents.activeResource();
  const dir = active !== null ? files.parentOf(active) : files.projectRoot();
  if (dir === null) return null;
  // Свободное имя: `contact.rjsf.json`, `contact-2.rjsf.json`, …
  let id = files.resolve(dir, `contact${RJSF_FILE_SUFFIX}`);
  for (let n = 2; await files.exists(id); n += 1) {
    id = files.resolve(dir, `contact-${n}${RJSF_FILE_SUFFIX}`);
  }
  await documents.writeText(id, printRjsfForm(sampleForm()));
  await files.refresh(dir);
  await documents.open(id, { preview: false });
  return id;
}

/** Добавить поле в конец формы. Операцией — чтобы отмена его сняла. Вернёт имя поля. */
export function addRjsfField(services: RjsfServices, id: ResourceId): string | null {
  const handle = rjsfHandleOf(services, id);
  if (handle === null) return null;
  const name = nextFieldName(handle.document.getModel());
  const op: RjsfOp = { type: 'add-field', params: { name, field: newField(name) } };
  return handle.apply(op).status === 'applied' ? name : null;
}

/** Напечатать `Form.tsx` рядом со схемой и сохранить его в источник. */
export async function exportRjsfForm(
  services: RjsfServices,
  id: ResourceId
): Promise<ExportOutcome> {
  const handle = rjsfHandleOf(services, id);
  const documents = services.documents();
  const files = services.files();
  if (handle === null || documents === undefined || files === undefined) {
    return { status: 'refused', reason: 'no-document' };
  }
  const dir = files.parentOf(id);
  const target = files.resolve(dir, 'Form.tsx');
  if (!files.canWrite(target)) return { status: 'refused', reason: 'read-only' };
  await documents.writeText(
    target,
    printFormModule(handle.document.getModel(), {
      componentName: componentNameOf(handle.document.ref.name),
    })
  );
  // Наружу — только через привилегированную службу: без права файл остаётся в рабочей копии,
  // и человек сохранит его сам.
  const saved = (await services.save()?.save([target])) ?? false;
  await files.refresh(dir);
  return { status: 'written', id: target, saved };
}

export function rjsfCommands(services: RjsfServices): readonly CommandContribution[] {
  const target = (args: unknown): ResourceId | null =>
    documentIdOf(args) ?? services.documents()?.activeResource() ?? null;
  const isRjsf = (id: ResourceId | null): boolean =>
    id !== null && rjsfHandleOf(services, id) !== null;
  const activeHandle = (): ModelDocumentHandle<RjsfForm> | null => {
    const id = services.documents()?.activeResource() ?? null;
    return id === null ? null : rjsfHandleOf(services, id);
  };

  return [
    {
      id: RJSF_NEW_COMMAND_ID,
      titleKey: 'command.new',
      enabled: () => services.files()?.projectRoot() != null,
      run: () => createRjsfForm(services),
    },
    {
      id: RJSF_ADD_FIELD_COMMAND_ID,
      titleKey: 'command.addField',
      enabled: () => isRjsf(services.documents()?.activeResource() ?? null),
      run: (args) => {
        const id = target(args);
        return id === null ? null : addRjsfField(services, id);
      },
    },
    {
      id: RJSF_UNDO_COMMAND_ID,
      titleKey: 'command.undo',
      keybinding: 'mod+z',
      when: IN_RJSF,
      enabled: () => activeHandle()?.canUndo() === true,
      run: () => activeHandle()?.undo() ?? false,
    },
    {
      id: RJSF_REDO_COMMAND_ID,
      titleKey: 'command.redo',
      keybinding: 'mod+shift+z',
      when: IN_RJSF,
      enabled: () => activeHandle()?.canRedo() === true,
      run: () => activeHandle()?.redo() ?? false,
    },
    {
      id: RJSF_EXPORT_COMMAND_ID,
      titleKey: 'command.export',
      enabled: () => isRjsf(services.documents()?.activeResource() ?? null),
      run: (args) => {
        const id = target(args);
        return id === null
          ? Promise.resolve<ExportOutcome>({ status: 'refused', reason: 'no-document' })
          : exportRjsfForm(services, id);
      },
    },
  ];
}
