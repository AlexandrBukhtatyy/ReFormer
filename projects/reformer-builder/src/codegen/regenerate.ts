/**
 * Материализация модуля формы: правила и схема → набор файлов рабочей копии.
 *
 * **Маркер происхождения.** Каждый сгенерированный файл несёт первой строкой
 * `// @reformer-generated <хэш тела>`. Из неё выводится состояние файла — сгенерирован он или
 * правлен руками, — и выводится ОДНИМ механизмом для формы из проекта и для формы, собранной с
 * нуля. Хранить это отдельным флагом значило бы завести второй источник истины и получить класс
 * багов «флаг разошёлся с текстом»; кроме того, флаг не пережил бы перезагрузку в Mode B — вкладка
 * формы из проекта в IndexedDB не попадает вовсе (`isDraft` для неё `false`).
 *
 * Маркер переживает перезагрузку, смену браузера и `git clone`, читается человеком и `git diff`.
 * Он же — предикат перезаписи при экспорте: «перезаписать, если хэш сходится; иначе пропустить и
 * СКАЗАТЬ об этом», вместо прежнего молчаливого skip-if-exists.
 *
 * **Стабильность.** Форматирование — часть генерации, а не доставки: иначе дифф считался бы не от
 * того текста, что лежит на диске. Дата синтеза мока фиксируется, иначе форма с полем-датой давала
 * бы новый `model.ts` при каждой регенерации.
 *
 * @module reformer-builder/codegen/regenerate
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type { FormRules } from '../model/rules';
import { synthMock, type MockData } from '../preview-runtime/mock-synth';
import { buildExampleFiles, type FileOut } from './index';
import { formatFiles } from './format';

/** Префикс строки-маркера. */
const MARK = '// @reformer-generated';

/**
 * Дата для синтеза мока при регенерации.
 *
 * Фиксирована сознательно: `synthMock` по умолчанию берёт `new Date()`, и форма с полем-датой
 * давала бы отличающийся `model.ts` при каждом вызове — то есть «правок не было, а дифф есть».
 */
const STABLE_NOW = new Date('2026-01-01T00:00:00Z');

/** Файлы модуля, которые пользователь правит как схемы формы. */
export const FORM_SCHEMA_FILES = [
  'validation.ts',
  'form.behavior.ts',
  'renderer.behavior.ts',
] as const;

export type FormSchemaFile = (typeof FORM_SCHEMA_FILES)[number];

/** Подписи вкладок нижней панели. */
export const FORM_SCHEMA_LABELS: Record<FormSchemaFile, string> = {
  'validation.ts': 'Валидация',
  'form.behavior.ts': 'Поведение формы',
  'renderer.behavior.ts': 'Поведение UI',
};

/**
 * Хэш тела файла — 12 hex-символов FNV-1a.
 *
 * Криптостойкость здесь не нужна и вредна: считается на каждой регенерации в главном потоке, а
 * задача — отличить «текст тот же» от «текст правили», а не защититься от подделки.
 */
function digest(body: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < body.length; i += 1) {
    h ^= body.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // 32 бита мало для 12 знаков — добавляем вторую свёртку с другим сидом.
  let g = 0x9dc5811c;
  for (let i = body.length - 1; i >= 0; i -= 1) {
    g ^= body.charCodeAt(i);
    g = Math.imul(g, 0x01000193) >>> 0;
  }
  return (h.toString(16).padStart(8, '0') + g.toString(16).padStart(8, '0')).slice(0, 12);
}

/** Текст без строки-маркера — то, от чего считается хэш. */
function body(text: string): string {
  return text.startsWith(MARK) ? text.slice(text.indexOf('\n') + 1) : text;
}

/** Приписать маркер к сгенерированному тексту. */
export function withMarker(text: string): string {
  const clean = body(text);
  return `${MARK} ${digest(clean)}\n${clean}`;
}

/** Состояние файла относительно генерации. */
export type FileOrigin = 'generated' | 'edited' | 'handwritten';

/**
 * Откуда взялся файл.
 *
 * `handwritten` — маркера нет: файл написан человеком (в том числе «открыли существующий проект»).
 * `generated` — маркер есть и хэш сходится. `edited` — маркер есть, а тело изменили.
 */
export function originOf(text: string | null | undefined): FileOrigin {
  if (!text || !text.startsWith(MARK)) return 'handwritten';
  const line = text.slice(0, text.indexOf('\n'));
  const stamped = line.slice(MARK.length).trim();
  return stamped === digest(body(text)) ? 'generated' : 'edited';
}

/** Можно ли перезаписывать файл без спроса. */
export function isGenerated(text: string | null | undefined): boolean {
  return originOf(text) === 'generated';
}

/**
 * Полный модуль формы, отформатированный и помеченный.
 *
 * Маркер получают только `derived`-файлы и три схемы: `api.ts` и `data-sources.ts` — заготовки,
 * которые пользователь дописывает и регенерировать которые незачем.
 */
export async function regenerateModule(
  schema: JsonFormSchema,
  rules: FormRules,
  formName: string,
  mock?: MockData
): Promise<FileOut[]> {
  const data = mock ?? synthMock(schema, { now: STABLE_NOW });
  const files = await formatFiles(buildExampleFiles(schema, data, formName, rules));
  const marked = new Set<string>([...FORM_SCHEMA_FILES]);
  return files.map((f) =>
    f.cls === 'derived' || marked.has(f.path) ? { ...f, content: withMarker(f.content) } : f
  );
}

/** Один файл модуля — для «вернуть к правилам» в панели. */
export async function regenerateFile(
  file: FormSchemaFile,
  schema: JsonFormSchema,
  rules: FormRules,
  formName: string,
  mock?: MockData
): Promise<string | null> {
  const files = await regenerateModule(schema, rules, formName, mock);
  return files.find((f) => f.path === file)?.content ?? null;
}

/** Набор «имя → текст» для записи в рабочую копию. */
export function asRecord(files: readonly FileOut[]): Record<string, string> {
  return Object.fromEntries(files.map((f) => [f.path, f.content]));
}
