/**
 * Доставка сгенерированного примера: `showDirectoryPicker()` → запись файлов в выбранную папку.
 * Безопасная регенерация: derived-файлы перезаписываются, user-owned — пропускаются, если уже есть.
 * Открывать проект в билдере не нужно (пишем в любую выбранную папку). zip-фолбэк — Фаза 3.
 *
 * @module reformer-builder/codegen/deliver
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type { MockData } from '../preview-runtime/mock-synth';
import { createDirectory, createFile, existsIn } from '../io/fs-ops';
import { appSnippet, buildExampleFiles, makeNames } from './index';
import { formatFiles } from './format';

export interface ExportResult {
  /** Имя созданной папки примера. */
  dir: string;
  /** Записанные файлы. */
  written: string[];
  /** Пропущенные user-owned файлы (уже существовали). */
  skipped: string[];
  /** Сниппет для вставки в App.tsx. */
  snippet: string;
}

type Picker = (opts?: { mode?: string }) => Promise<FileSystemDirectoryHandle>;

const getPicker = (): Picker | undefined =>
  (window as unknown as { showDirectoryPicker?: Picker }).showDirectoryPicker;

/** Доступен ли File System Access API (Chromium). */
export function dirPickerAvailable(): boolean {
  return typeof getPicker() === 'function';
}

/**
 * Построить пример, отформатировать и записать в выбранную пользователем папку. Бросает `AbortError`,
 * если пользователь отменил выбор папки (обрабатывается вызывающим).
 */
export async function exportExampleToDirectory(
  schema: JsonFormSchema,
  mock: MockData,
  formName: string
): Promise<ExportResult> {
  const picker = getPicker();
  if (!picker) throw new Error('File System Access API недоступен — нужен Chromium-браузер');

  const names = makeNames(formName);
  const files = await formatFiles(buildExampleFiles(schema, mock, formName));

  const root = await picker({ mode: 'readwrite' });
  await createDirectory(root, '', names.dir);

  const written: string[] = [];
  const skipped: string[] = [];
  for (const f of files) {
    if (f.cls === 'user' && (await existsIn(root, names.dir, f.path))) {
      skipped.push(f.path);
      continue;
    }
    await createFile(root, names.dir, f.path, f.content);
    written.push(f.path);
  }

  return { dir: names.dir, written, skipped, snippet: appSnippet(names) };
}
