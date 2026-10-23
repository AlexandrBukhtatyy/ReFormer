/**
 * Где форма: схема открытого документа и схема в каталоге формы.
 *
 * Два входа генерации — панель (от документа) и дерево (от каталога), — и оба сначала отвечают
 * на вопрос «какая здесь схема ReFormer». Ответ — схема формата 2 либо `null`: в схему открыт не
 * тот файл, в каталоге схемы нет. Это законные состояния, а не поломка.
 *
 * @module plugins/reformer/codegen/stack/find
 */

import {
  isCanonicalSchemaName,
  schemaPathInModule,
  LEGACY_SCHEMA_FILE,
  SCHEMA_DIR,
  SCHEMA_FILE,
} from '../../../core/codegen';
import type { JsonFormSchema } from '@reformer/renderer-json';
import type {
  CodegenDocument,
  CodegenReader,
  ResourceId,
  ResourceRef,
} from '@reformer/builder-plugin-api';
import { asFormSchema } from './source';

/**
 * Схема документа: сначала модель, потом текст.
 *
 * Модель предпочтительнее, потому что она СОГЛАСОВАНА с буфером по контракту, а разбор текста
 * даст схему даже тогда, когда редактор считает буфер незаконченным. `null` — документ схемой
 * не является; это законное состояние (в схему открыт не тот файл), а не поломка.
 *
 * Отдаётся всегда формат 2 ({@link asFormSchema}): в буфере может лежать текст прежнего формата,
 * а модель приходит из чужого документа. Схема формата 2 возвращается той же ссылкой.
 */
export function schemaOf(document: CodegenDocument): JsonFormSchema | null {
  const model = asFormSchema(document.model());
  if (model !== null) return model;
  try {
    return asFormSchema(JSON.parse(document.getText()));
  } catch {
    return null;
  }
}

/**
 * Имена, под которыми в каталоге формы лежит её схема, — в порядке предпочтения.
 *
 * Список, а не «любой .json»: перебрать все json-файлы каталога значит прочитать их все,
 * и цена такого поиска зависела бы от того, что ещё лежит рядом. Канон раскладки называет
 * файл схемы однозначно (`form.schema.json`, затем прежнее `renderer.schema.json`), два
 * остальных шаблона — то, чем схему называют, когда форм в каталоге несколько.
 */
const SCHEMA_SUFFIXES: readonly string[] = ['.schema.json', '.form.json'];

/** Похоже ли имя на файл схемы формы. Порядок ответа задаёт {@link schemaCandidates}. */
function looksLikeSchema(name: string): boolean {
  return isCanonicalSchemaName(name) || SCHEMA_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

/** Ранг имени: канон — 0, прежнее имя — 1, прочие — после них. */
function schemaRank(name: string): number {
  if (name === SCHEMA_FILE) return 0;
  return name === LEGACY_SCHEMA_FILE ? 1 : 2;
}

/**
 * Кандидаты в схему, канон первым.
 *
 * Порядок важнее полноты: в каталоге может лежать и `form.schema.json`, и прежний
 * `renderer.schema.json` (форма, перегенерированная по новой раскладке, старый файл не
 * удаляет), и черновик `old.schema.json` — и «первый попавшийся» тогда зависел бы от того,
 * в каком порядке источник отдал листинг. Канон первым, затем прежнее имя, затем по алфавиту.
 */
export function schemaCandidates(entries: readonly ResourceRef[]): readonly ResourceRef[] {
  const files = entries.filter((entry) => entry.kind === 'file' && looksLikeSchema(entry.name));
  return [...files].sort((a, b) => {
    const byRank = schemaRank(a.name) - schemaRank(b.name);
    return byRank !== 0 ? byRank : a.name.localeCompare(b.name);
  });
}

/** Документ формы, найденный в одном каталоге. */
interface FoundDocument {
  readonly ref: ResourceRef;
  /** Всегда формата 2: файл прежнего формата переводится при чтении. */
  readonly schema: JsonFormSchema;
  /** Открытый документ, из которого взята схема; нет — прочитана с диска. */
  readonly document?: CodegenDocument;
}

/** Схема, найденная в каталоге формы: адрес нужен для имени формы и для отчёта. */
export interface FoundSchema extends FoundDocument {
  /**
   * Корень модуля формы — куда ложатся файлы. Выбранный каталог, а если выбрана сама папка
   * `schema/` — её родитель.
   */
  readonly root: ResourceId;
  /** Путь документа внутри модуля: `schema/<имя файла>` либо просто имя файла. */
  readonly schemaPath: string;
}

/**
 * Найти схему формы в каталоге формы.
 *
 * Ищет в папке `schema/` каталога (раскладка «папки по ролям»), затем в нём самом (форма прежней
 * плоской раскладки: документ в корне модуля). Выбрана сама папка `schema/` — документ в ней, а
 * корень модуля — её родитель.
 *
 * Открытый документ ПРЕДПОЧТИТЕЛЬНЕЕ файла на диске: у него текст, который человек видит
 * прямо сейчас, а у файла — тот, что успели сохранить. Сгенерировать по сохранённой копии
 * форму, которой в редакторе уже нет, — молчаливо неверный результат, и он выглядел бы как
 * работающий.
 *
 * Файл на диске может быть прежнего формата (`value` / `array`, шаги в `componentProps.steps`):
 * проба формы его узнаёт, а работать с ним генерация не умеет. Поэтому найденное переводится
 * в формат 2 здесь же ({@link asFormSchema}), до того как станет схемой.
 */
export async function findSchemaIn(
  reader: CodegenReader,
  dir: ResourceId
): Promise<FoundSchema | null> {
  if (reader.list === undefined) return null;

  const nested = await findDocumentIn(reader, reader.resolve(dir, SCHEMA_DIR));
  if (nested !== null) {
    return { ...nested, root: dir, schemaPath: schemaPathInModule(nested.ref.path) };
  }

  const own = await findDocumentIn(reader, dir);
  if (own === null) return null;
  const schemaPath = schemaPathInModule(own.ref.path);
  // Щелчок по самой папке `schema/`: документ в ней, а модуль — её родитель.
  const inSchemaDir = schemaPath.startsWith(`${SCHEMA_DIR}/`);
  return { ...own, root: inSchemaDir ? reader.parentOf(dir) : dir, schemaPath };
}

/** Первая схема формы среди кандидатов одного каталога. */
async function findDocumentIn(
  reader: CodegenReader,
  dir: ResourceId
): Promise<FoundDocument | null> {
  if (reader.list === undefined) return null;
  const entries = await reader.list(dir).catch(() => null);
  if (entries === null) return null;

  for (const ref of schemaCandidates(entries)) {
    const document = reader.documentOf(ref.id);
    if (document !== null) {
      const fromDocument = schemaOf(document);
      if (fromDocument !== null) return { ref, schema: fromDocument, document };
      continue;
    }
    const text = await reader.readText(ref.id).catch(() => null);
    if (text === null) continue;
    try {
      const fromFile = asFormSchema(JSON.parse(text));
      if (fromFile !== null) return { ref, schema: fromFile };
    } catch {
      // Не JSON — не схема; следующий кандидат.
    }
  }
  return null;
}
