/**
 * Модуль на диске против напечатанного: что проверить до записи и что назвать после.
 *
 * Запись модуля — дело хозяина генерации, и она общая для любого стека: маркер происхождения,
 * перенос прежнего имени, право источника. Здесь — то, что знает только раскладка ReFormer:
 *
 * - **кит модуля** — производные файлы (реестр, страница) запись переписывает всегда, и без
 *   проверки «Сгенерировать» под чужим активным китом молча перепечатало бы форму HexaUI под
 *   ui-kit: кит — одна настройка на проект, а не свойство формы. Отказ честнее частичной записи:
 *   модуль, напечатанный наполовину под другой кит, не собрался бы;
 * - **сироты шагов** — папка схемы шага и файл его правил, оставшиеся после переименования или
 *   удаления шага;
 * - **файлы прежней плоской раскладки** (`index.tsx`, `form.render.ts`, `wizard.tsx`,
 *   `steps/<шаг>/form.validation.ts`, …) — код ПРЕЖНЕГО контракта сборки. Под новые имена он не
 *   переносится: контракт другой (`createJsonForm` и слой рендера против `createForm` и единого
 *   поведения), и правленный файл, положенный на новое место, не собрался бы. Новый модуль их не
 *   импортирует; перенести свои правки и удалить их — решение человека.
 *
 * Сирот и файлы прежней раскладки запись не трогает — только называет заметками.
 *
 * @module plugins/reformer/codegen/stack/disk
 */

import {
  FLAT_LAYOUT_FILES,
  FLAT_STEPS_DIR,
  FLAT_STEPS_INDEX,
  FLAT_STEP_FILES,
  FORM_RULES_NAME,
  SCHEMA_FILE,
  STEP_SCHEMAS_DIR,
  VALIDATION_DIR,
  schemaDirOf,
} from '../../../core/codegen';
import { originOf } from '@reformer/builder-toolkit';
import type {
  CodegenFile,
  CodegenNote,
  CodegenReader,
  CodegenRefusal,
  ResourceId,
} from '@reformer/builder-plugin-api';

/** Цель, печатающая реестр компонентов: по нему узнаётся кит модуля. */
const REGISTRY_TARGET_ID = 'codegen.registry';

/** Пакет по спецификатору импорта: `@scope/name/sub` → `@scope/name`, `name/sub` → `name`. */
function packageOf(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/**
 * Кит, которым напечатан реестр формы, — пакет, из которого импортирована обёртка поля
 * (`reg.component(FIELD_WRAPPER, …)`). Её даёт главный вход кита в любом реестре: в отличие от
 * символов записей, она есть и у формы без единого поля кита. `null` — реестр не наш либо
 * напечатан прежней раскладкой: судить не по чему.
 */
export function registryKitOf(text: string): string | null {
  const wrapper = /reg\.component\(\s*FIELD_WRAPPER\s*,\s*([A-Za-z_$][\w$]*)\s*\)/.exec(text)?.[1];
  if (wrapper === undefined) return null;
  for (const match of text.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
    const locals = match[1].split(',').map((name) => {
      const parts = name.trim().split(/\s+as\s+/);
      return parts[parts.length - 1].replace(/^type\s+/, '').trim();
    });
    if (locals.includes(wrapper)) return packageOf(match[2]);
  }
  return null;
}

/** Адрес файла модуля по его пути от корня. */
function at(reader: CodegenReader, dir: ResourceId, path: string): ResourceId {
  return reader.resolve(dir, ...path.split('/'));
}

/**
 * Отказ, если модуль на диске напечатан другим китом. Сравниваются пакеты обёртки поля в
 * реестре на диске и в свежем — то есть кит модуля и кит, под который он печатается сейчас.
 *
 * По полному модулю: запись одной цели (типы из меню дерева) реестра среди доставляемых не
 * несёт, а кит у модуля тот же. Заказ части модуля (`GenerateRequest.only`) — другое дело: файлы
 * правил кит не импортируют, и запись правил хода в модуль другого кита ему не мешает. Поэтому
 * хозяин подаёт сюда то, что пишется, и без реестра среди них проверять нечего.
 */
export async function kitMismatchOf(
  reader: CodegenReader,
  dir: ResourceId,
  module: readonly CodegenFile[]
): Promise<CodegenRefusal | null> {
  const registry = module.find((file) => file.targetId === REGISTRY_TARGET_ID);
  if (registry === undefined) return null;
  const activeKit = registryKitOf(registry.content);
  if (activeKit === null) return null;
  const id = at(reader, dir, registry.path);
  if (!(await reader.exists(id))) return null;
  const current = await reader.readText(id).catch(() => null);
  const moduleKit = current === null ? null : registryKitOf(current);
  if (moduleKit === null || moduleKit === activeKit) return null;
  return {
    refusal: { key: 'error.kit-mismatch', params: { module: moduleKit, active: activeKit } },
  };
}

/**
 * Файлы шагов на диске, которых нет в модуле.
 *
 * Без листинга — пусто: сирота — подсказка, а не условие записи, и среда без `list` не обязана
 * её давать.
 */
async function orphansOf(
  reader: CodegenReader,
  dir: ResourceId,
  module: readonly CodegenFile[],
  schemaPath: string
): Promise<readonly string[]> {
  if (reader.list === undefined) return [];
  const current = new Set(module.map((file) => file.path));
  const orphans: string[] = [];

  // Папки схем шагов — рядом с корневым документом. Сиротой считается папка со схемой шага:
  // у формы с документом в корне модуля та же `steps/` держала код шагов прежней раскладки, и
  // такая папка — не сирота шага, а файлы прежнего контракта (их называет `flatOf`).
  //
  // Листинг, а не `exists` + листинг: отсутствующий каталог источник отдаёт пустым списком
  // или отказом, и оба ответа здесь значат одно — сирот нет.
  const stepsDir = `${schemaDirOf(schemaPath)}${STEP_SCHEMAS_DIR}`;
  for (const entry of await reader.list(at(reader, dir, stepsDir)).catch(() => [])) {
    if (entry.kind !== 'directory') continue;
    const schema = `${stepsDir}/${entry.name}/${SCHEMA_FILE}`;
    if (current.has(schema)) continue;
    if (await reader.exists(at(reader, dir, schema))) orphans.push(`${stepsDir}/${entry.name}`);
  }

  // Файлы правил шагов. Только напечатанные билдером (с маркером, пусть и правленные): свой
  // файл человека в `validation/` — общие правила, сообщения — шагом не является.
  for (const entry of await reader.list(at(reader, dir, VALIDATION_DIR)).catch(() => [])) {
    if (entry.kind === 'directory' || !entry.name.endsWith('.ts')) continue;
    if (entry.name === `${FORM_RULES_NAME}.ts`) continue;
    const path = `${VALIDATION_DIR}/${entry.name}`;
    if (current.has(path)) continue;
    const text = await reader.readText(entry.id).catch(() => null);
    if (originOf(text) !== 'handwritten') orphans.push(path);
  }

  return orphans.sort((a, b) => a.localeCompare(b));
}

/**
 * Файлы прежней плоской раскладки в каталоге модуля.
 *
 * Имена — из раскладки стека, а не листингом каталога: рядом с модулем может лежать что угодно,
 * и «всё лишнее в корне» назвало бы прежним контрактом чужой файл. Файл, который модуль печатает
 * сам (чужая цель вправе положить в корень `api.ts`), прежним не считается.
 */
async function flatOf(
  reader: CodegenReader,
  dir: ResourceId,
  module: readonly CodegenFile[]
): Promise<readonly string[]> {
  const current = new Set(module.map((file) => file.path));
  const found: string[] = [];
  const probe = async (path: string): Promise<void> => {
    if (!current.has(path) && (await reader.exists(at(reader, dir, path)))) found.push(path);
  };

  for (const path of FLAT_LAYOUT_FILES) await probe(path);
  await probe(FLAT_STEPS_INDEX);
  if (reader.list !== undefined) {
    for (const entry of await reader.list(at(reader, dir, FLAT_STEPS_DIR)).catch(() => [])) {
      if (entry.kind !== 'directory') continue;
      for (const file of FLAT_STEP_FILES) await probe(`${FLAT_STEPS_DIR}/${entry.name}/${file}`);
    }
  }
  return found;
}

/**
 * Заметки о модуле на диске после записи: сироты шагов, файлы прежней раскладки и прежний файл
 * правил.
 *
 * `module` — весь модуль, а не только записанное: при записи одной цели (типы из меню дерева)
 * среди записанного файлов шагов нет вовсе, и без полного состава КАЖДЫЙ файл шага выглядел бы
 * брошенным. `schemaPath` — путь корневого документа в модуле: рядом с ним лежат папки схем шагов.
 */
export async function notesOf(
  reader: CodegenReader,
  dir: ResourceId,
  module: readonly CodegenFile[],
  schemaPath: string,
  legacyRules: string | null = null
): Promise<readonly CodegenNote[]> {
  const notes: CodegenNote[] = [];
  const orphans = await orphansOf(reader, dir, module, schemaPath);
  if (orphans.length > 0) {
    notes.push({
      id: 'orphans',
      paths: orphans,
      title: { key: 'orphans.title' },
      detail: { key: 'orphans.detail' },
      notify: {
        key: 'notify.orphans',
        params: { count: orphans.length, dirs: orphans.join(', ') },
      },
    });
  }
  const flat = await flatOf(reader, dir, module);
  if (flat.length > 0) {
    notes.push({
      id: 'flat',
      paths: flat,
      title: { key: 'flat.title' },
      detail: { key: 'flat.detail' },
      notify: { key: 'notify.flat', params: { count: flat.length, files: flat.join(', ') } },
    });
  }
  // Прежний файл правил: правила живут в коде модуля, и файл больше не нужен.
  if (legacyRules !== null) {
    notes.push({
      id: 'legacy-rules',
      paths: [legacyRules],
      title: { key: 'legacy-rules.title' },
      detail: { key: 'legacy-rules.detail' },
      notify: { key: 'notify.legacy-rules', params: { file: legacyRules } },
    });
  }
  return notes;
}
