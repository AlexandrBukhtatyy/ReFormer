/**
 * Реестр JSON Schema для языковой службы JSON: какая схема подсказывает в каком документе.
 *
 * ## Один владелец `setDiagnosticsOptions`
 *
 * Метод ЗАМЕЩАЕТ набор схем целиком, а не дополняет его. Два места, которые его зовут, затирали
 * бы друг друга, поэтому набор собирает этот реестр и только он отдаёт его службе. Настройки
 * проверки при этом не меняются: `validate: false` и `enableSchemaRequest: false` ставит
 * `monaco-runtime`, и их смысл описан там.
 *
 * ## Список документов растёт, но не сжимается
 *
 * Каждая смена набора перезапускает воркер JSON, и схема с ветками пропсов по всему каталогу
 * кита разбирается заново. Если бы закрытие вкладки убирало документ из набора, перезапуск был
 * бы на каждом переключении. Поэтому документ, однажды получивший схему, её и держит; адрес
 * модели Monaco — строка, и цена такого «хранения» — строка в массиве.
 *
 * ## `$schema` в документе перебивает сопоставление по адресу
 *
 * Служба сначала смотрит `$schema` в самом документе и, если он есть, берёт ТОЛЬКО его
 * (`jsonSchemaService.getSchemaForResource`), а сопоставление по `fileMatch` молча игнорирует.
 * В файлах схемы формы `"$schema": "./form-schema.schema.json"` — обычное дело, а скачивать его
 * служба не станет (`enableSchemaRequest: false`), — и подсказок не было бы как раз на настоящих
 * файлах. Поэтому та же схема регистрируется ещё и под адресом, в который разрешается
 * объявленный `$schema`: схема одна, адресов два.
 *
 * @module plugins/base/editor-monaco/hints/json-schemas
 */

import type { JsonSchemaHint } from '@reformer/builder-plugin-api';

/** Запись набора в той форме, которую принимает `jsonDefaults.setDiagnosticsOptions`. */
export interface SchemaEntry {
  readonly uri: string;
  readonly fileMatch?: string[];
  readonly schema: unknown;
}

export interface JsonSchemaRegistry {
  /**
   * Документ с адресом модели `modelUri` подсказывается схемой `hint`.
   *
   * `declared` — адрес, в который разрешается `$schema` документа, или `null`, если его нет.
   * Повторный вызов с тем же ответом набор не трогает — воркер не перезапускается.
   */
  associate(modelUri: string, hint: JsonSchemaHint, declared: string | null): void;
}

interface Binding {
  readonly schemaUri: string;
  readonly declared: string | null;
}

export function createJsonSchemaRegistry(
  apply: (schemas: SchemaEntry[]) => void
): JsonSchemaRegistry {
  /** Схемы по адресу: сама схема и документы, которые она подсказывает. */
  const schemas = new Map<string, { schema: unknown; documents: Set<string> }>();
  /** Что сейчас назначено документу. */
  const bindings = new Map<string, Binding>();

  const publish = (): void => {
    const out: SchemaEntry[] = [];
    for (const [uri, entry] of schemas) {
      out.push({ uri, fileMatch: [...entry.documents], schema: entry.schema });
    }
    // Второй адрес схемы — для документов, объявивших `$schema`. Без `fileMatch`: к нему
    // служба придёт сама, прочитав `$schema` из текста.
    const aliases = new Set<string>();
    for (const binding of bindings.values()) {
      if (binding.declared === null || aliases.has(binding.declared)) continue;
      if (schemas.has(binding.declared)) continue;
      aliases.add(binding.declared);
      const schema = schemas.get(binding.schemaUri)?.schema;
      if (schema !== undefined) out.push({ uri: binding.declared, schema });
    }
    apply(out);
  };

  return {
    associate(modelUri, hint, declared) {
      const previous = bindings.get(modelUri);
      const known = schemas.get(hint.uri);
      if (
        previous !== undefined &&
        previous.schemaUri === hint.uri &&
        previous.declared === declared &&
        known !== undefined &&
        known.schema === hint.schema
      ) {
        return;
      }

      if (previous !== undefined && previous.schemaUri !== hint.uri) {
        const old = schemas.get(previous.schemaUri);
        old?.documents.delete(modelUri);
        // Схема, которую больше никто не подсказывает (сменили кит), уходит из набора —
        // иначе воркер разбирал бы все прежние каталоги на каждом перезапуске.
        if (old !== undefined && old.documents.size === 0) schemas.delete(previous.schemaUri);
      }

      const entry = known ?? { schema: hint.schema, documents: new Set<string>() };
      entry.schema = hint.schema;
      entry.documents.add(modelUri);
      schemas.set(hint.uri, entry);
      bindings.set(modelUri, { schemaUri: hint.uri, declared });
      publish();
    },
  };
}

/**
 * Значение `$schema` верхнего уровня, если текст разбирается и оно строка.
 *
 * Разбор целиком, а не поиск подстрокой: `"$schema"` встречается и внутри значений, а смотрит
 * служба только на ключ корня. Неразборчивый текст — `null`: служба в этот момент тоже не
 * разберёт документ, и назначать псевдоним не к чему.
 */
export function declaredSchema(text: string): string | null {
  try {
    const value: unknown = JSON.parse(text);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const schema = (value as Record<string, unknown>).$schema;
    return typeof schema === 'string' && schema.length > 0 ? schema : null;
  } catch {
    return null;
  }
}

/** Склеивает сегменты пути: `.` выбрасывается, `..` снимает предыдущий. */
function normalizePath(path: string): string {
  const parts = path.split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  const trailing = parts.length > 1 && parts[parts.length - 1] === '' ? '/' : '';
  return `/${out.join('/')}${trailing}`;
}

/** Минимум от `monaco.Uri`, нужный для разрешения адреса. */
export interface UriLike {
  readonly path: string;
  with(change: { path: string }): { toString(): string };
}

/**
 * Адрес, в который служба JSON разрешит `$schema` документа.
 *
 * Повторяет `resolveRelativePath` воркера (`jsonWorker.js`): значение со схемой берётся как есть,
 * относительное клеится к каталогу документа, и склейку делает тот же класс адреса, что у
 * воркера (`monaco.Uri` — это `vscode-uri`). Разойдись склейка хоть в кодировании — псевдоним
 * лёг бы мимо, и подсказок на таком файле не было бы без единой ошибки в консоли.
 */
export function resolveDeclaredSchema(
  declared: string,
  modelUri: string,
  parse: (uri: string) => UriLike
): string {
  if (/^\w[\w\d+.-]*:/.test(declared)) return declared;
  const base = parse(modelUri);
  const dir = base.path.slice(0, base.path.lastIndexOf('/') + 1);
  const path = declared.startsWith('/') ? declared : `${dir}${declared}`;
  return base.with({ path: normalizePath(path) }).toString();
}
