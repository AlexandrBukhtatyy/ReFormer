/**
 * Команды демо-стека: новая форма, новое поле, экспорт `Form.tsx`.
 *
 * Всё — возможностями оболочки, ни одного порта: рабочая область (`DocumentsService`,
 * `WorkspaceFilesService`), ручка модели (`DocumentModelsService`) и дверь наружу
 * (`WorkspaceSaveService`, право `workspace.save` в манифесте). Ровно так же мог бы быть
 * устроен плагин стека из каталога проекта.
 *
 * @module plugins/plain/demo/commands
 */

import {
  nextFieldName,
  printFormModule,
  printPlainForm,
  sampleForm,
  type PlainForm,
  type PlainOp,
} from '@reformer/builder-stack-plain';
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
  PLAIN_ADD_FIELD_COMMAND_ID,
  PLAIN_EXPORT_COMMAND_ID,
  PLAIN_FILE_SUFFIX,
  PLAIN_NEW_COMMAND_ID,
  PLAIN_PROVIDER_ID,
  PLAIN_REDO_COMMAND_ID,
  PLAIN_UNDO_COMMAND_ID,
} from './contract';

/**
 * Условие клавиш отмены: активна вкладка документа ЭТОГО стека.
 *
 * Отмена принадлежит документу, а историю держит его ручка модели (`undo`/`redo`), поэтому
 * клавиши вносит редактор стека, а не оболочка: у каждого стека свой вид документа, и условие
 * по нему делает сочетания стеков непересекающимися — `mod+z` схемы ReFormer и `mod+z` простой
 * формы не спорят за одну вкладку.
 */
const IN_PLAIN = `activeResourceKind == ${PLAIN_PROVIDER_ID}`;

/** Службы, которыми живут команды. Функции: службы спрашиваются в момент вызова. */
export interface PlainServices {
  readonly documents: () => DocumentsService | undefined;
  readonly files: () => WorkspaceFilesService | undefined;
  readonly models: () => DocumentModelsService | undefined;
  readonly save: () => WorkspaceSaveService | undefined;
}

/** Исход экспорта: куда записан файл — или почему не записан. */
export type ExportOutcome =
  | { readonly status: 'written'; readonly id: ResourceId; readonly saved: boolean }
  | { readonly status: 'refused'; readonly reason: 'no-document' | 'read-only' };

/** Ручка документа ЭТОГО стека; чужую модель под своим типом не отдаём. */
export function plainHandleOf(
  services: PlainServices,
  id: ResourceId
): ModelDocumentHandle<PlainForm> | null {
  const handle = services.models()?.handleOf(id) ?? null;
  if (handle === null || handle.document.providerId !== PLAIN_PROVIDER_ID) return null;
  return handle as ModelDocumentHandle<PlainForm>;
}

function documentIdOf(args: unknown): ResourceId | null {
  if (typeof args !== 'object' || args === null) return null;
  const value = (args as { documentId?: unknown }).documentId;
  return typeof value === 'string' ? value : null;
}

/** Имя компонента из имени файла: `contact.plain.json` → `ContactForm`. */
export function componentNameOf(fileName: string): string {
  const base = fileName
    .replace(/\.plain\.json$|\.json$/, '')
    .replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (typeof c === 'string' ? c.toUpperCase() : ''));
  return `${base.charAt(0).toUpperCase()}${base.slice(1)}Form`;
}

/** Создать форму из заготовки рядом с активным файлом (или в корне) и открыть её. */
export async function createPlainForm(services: PlainServices): Promise<ResourceId | null> {
  const documents = services.documents();
  const files = services.files();
  if (documents === undefined || files === undefined) return null;
  const active = documents.activeResource();
  const dir = active !== null ? files.parentOf(active) : files.projectRoot();
  if (dir === null) return null;
  // Свободное имя: `contact.plain.json`, `contact-2.plain.json`, …
  let id = files.resolve(dir, `contact${PLAIN_FILE_SUFFIX}`);
  for (let n = 2; await files.exists(id); n += 1) {
    id = files.resolve(dir, `contact-${n}${PLAIN_FILE_SUFFIX}`);
  }
  await documents.writeText(id, printPlainForm(sampleForm()));
  await files.refresh(dir);
  await documents.open(id, { preview: false });
  return id;
}

/** Добавить поле в конец формы. Операцией — чтобы отмена его сняла. */
export function addPlainField(services: PlainServices, id: ResourceId): boolean {
  const handle = plainHandleOf(services, id);
  if (handle === null) return false;
  const form = handle.document.getModel();
  const name = nextFieldName(form);
  const op: PlainOp = {
    type: 'add-field',
    params: { field: { name, label: name, type: 'text' } },
  };
  return handle.apply(op).status === 'applied';
}

/** Напечатать `Form.tsx` рядом со схемой и сохранить его в источник. */
export async function exportPlainForm(
  services: PlainServices,
  id: ResourceId
): Promise<ExportOutcome> {
  const handle = plainHandleOf(services, id);
  const documents = services.documents();
  const files = services.files();
  if (handle === null || documents === undefined || files === undefined) {
    return { status: 'refused', reason: 'no-document' };
  }
  const dir = files.parentOf(id);
  const target = files.resolve(dir, 'Form.tsx');
  if (!files.canWrite(target)) return { status: 'refused', reason: 'read-only' };
  const source = handle.document.ref.name;
  await documents.writeText(
    target,
    printFormModule(handle.document.getModel(), {
      componentName: componentNameOf(source),
    })
  );
  // Наружу — только через привилегированную службу: без права файл остаётся в рабочей копии,
  // и человек сохранит его сам.
  const saved = (await services.save()?.save([target])) ?? false;
  await files.refresh(dir);
  return { status: 'written', id: target, saved };
}

export function plainCommands(services: PlainServices): readonly CommandContribution[] {
  const target = (args: unknown): ResourceId | null =>
    documentIdOf(args) ?? services.documents()?.activeResource() ?? null;
  const isPlain = (id: ResourceId | null): boolean =>
    id !== null && plainHandleOf(services, id) !== null;
  const activeHandle = (): ModelDocumentHandle<PlainForm> | null => {
    const id = services.documents()?.activeResource() ?? null;
    return id === null ? null : plainHandleOf(services, id);
  };

  return [
    {
      id: PLAIN_NEW_COMMAND_ID,
      titleKey: 'command.new',
      enabled: () => services.files()?.projectRoot() != null,
      run: () => createPlainForm(services),
    },
    {
      id: PLAIN_ADD_FIELD_COMMAND_ID,
      titleKey: 'command.addField',
      enabled: () => isPlain(services.documents()?.activeResource() ?? null),
      run: (args) => {
        const id = target(args);
        return id === null ? false : addPlainField(services, id);
      },
    },
    {
      id: PLAIN_UNDO_COMMAND_ID,
      titleKey: 'command.undo',
      keybinding: 'mod+z',
      when: IN_PLAIN,
      enabled: () => activeHandle()?.canUndo() === true,
      run: () => activeHandle()?.undo() ?? false,
    },
    {
      id: PLAIN_REDO_COMMAND_ID,
      titleKey: 'command.redo',
      keybinding: 'mod+shift+z',
      when: IN_PLAIN,
      enabled: () => activeHandle()?.canRedo() === true,
      run: () => activeHandle()?.redo() ?? false,
    },
    {
      id: PLAIN_EXPORT_COMMAND_ID,
      titleKey: 'command.export',
      enabled: () => isPlain(services.documents()?.activeResource() ?? null),
      run: (args) => {
        const id = target(args);
        return id === null
          ? Promise.resolve<ExportOutcome>({ status: 'refused', reason: 'no-document' })
          : exportPlainForm(services, id);
      },
    },
  ];
}
