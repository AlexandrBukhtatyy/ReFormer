/**
 * Доставка сгенерированного примера: `showDirectoryPicker()` → запись файлов в выбранную папку.
 * Безопасная регенерация: derived-файлы перезаписываются, user-owned — пропускаются, если уже есть.
 * Открывать проект в билдере не нужно (пишем в любую выбранную папку). zip-фолбэк — Фаза 3.
 *
 * @module reformer-builder/codegen/deliver
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type { MockData } from '../preview-runtime/mock-synth';
import type { FormRules } from '../model/rules';
import { createDirectory, createFile, existsIn, readTextFile } from '../io/fs-ops';
import { isGenerated, withMarker } from './regenerate';
import { appSnippet, buildExampleFiles, makeNames } from './index';
import { formatFiles } from './format';

export interface ExportResult {
  /** Имя созданной папки примера. */
  dir: string;
  /** Записанные файлы. */
  written: string[];
  /**
   * Пропущенные файлы — те, что пользователь правил руками.
   *
   * Раньше сюда попадал ЛЮБОЙ существующий `user`-файл, и это был молчаливый отказ: агент менял
   * правила, отчитывался об этом, а `validation.ts` на диске оставался прежним. Теперь пропуск
   * означает ровно «ваши правки не тронуты», и вызывающий обязан это показать.
   */
  skipped: string[];
  /** Сниппет для вставки в App.tsx. */
  snippet: string;
}

/**
 * `user`-файлы, которые всё-таки производятся из правил и потому маркируются.
 *
 * `api.ts` и `data-sources.ts` сюда не входят: это заготовки, которые пользователь дописывает
 * под свой бэкенд, и регенерировать их не из чего.
 */
const GENERATED_USER_FILES = new Set(['validation.ts', 'form.behavior.ts', 'renderer.behavior.ts']);

/** Текст файла либо `null`, если его нет. */
async function safeRead(root: FileSystemDirectoryHandle, path: string): Promise<string | null> {
  try {
    return await readTextFile(root, path);
  } catch {
    return null;
  }
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
  formName: string,
  rules?: FormRules
): Promise<ExportResult> {
  const picker = getPicker();
  if (!picker) throw new Error('File System Access API недоступен — нужен Chromium-браузер');

  const names = makeNames(formName);
  // Правила идут сюда же, а не отдельным шагом: без них `validation.ts` и
  // `form.behavior.ts` уедут пользователю заглушками с TODO — то есть форма, которую агент
  // считает провалидированной, в его проекте не проверяет ничего.
  const files = (await formatFiles(buildExampleFiles(schema, mock, formName, rules))).map((f) =>
    // Маркер несут все перезаписываемые файлы: по нему следующий экспорт отличит «наш, можно
    // обновить» от «правили руками, трогать нельзя».
    f.cls === 'derived' || GENERATED_USER_FILES.has(f.path)
      ? { ...f, content: withMarker(f.content) }
      : f
  );

  const root = await picker({ mode: 'readwrite' });
  await createDirectory(root, '', names.dir);

  const written: string[] = [];
  const skipped: string[] = [];
  for (const f of files) {
    if (f.cls === 'user' && (await existsIn(root, names.dir, f.path))) {
      // Существующий файл перезаписывается, только если он наш и его не правили: предикат —
      // маркер происхождения, а не сам факт существования.
      const current = await safeRead(root, `${names.dir}/${f.path}`);
      if (!GENERATED_USER_FILES.has(f.path) || !isGenerated(current)) {
        skipped.push(f.path);
        continue;
      }
    }
    await createFile(root, names.dir, f.path, f.content);
    written.push(f.path);
  }

  return { dir: names.dir, written, skipped, snippet: appSnippet(names) };
}
