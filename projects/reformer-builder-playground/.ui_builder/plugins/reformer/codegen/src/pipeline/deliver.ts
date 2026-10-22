/**
 * Доставка модуля формы в рабочую область.
 *
 * ## Чем это отличается от v1
 *
 * Там `deliver.ts` звал СВОЙ `showDirectoryPicker()` и писал файлы в выбранный каталог — мимо
 * рабочей копии и мимо источника. Здесь ни диалога, ни файловых ручек нет вовсе: адреса строит
 * порт, запись идёт через рабочую область, а куда именно — решает открытый источник. Отказ
 * источника от записи — законный ответ, а не исключение.
 *
 * ## Предикат перезаписи — маркер, а не факт существования
 *
 * Существующий авторский файл перезаписывается, только если он наш и его не правили. Иначе
 * пропускается, и пропуск ОБЯЗАН доехать до человека: в v1 это был молчаливый skip-if-exists,
 * из-за которого агент менял правила, отчитывался об этом, а файл валидации на диске оставался
 * прежним.
 *
 * ## Доставка ничего не удаляет и ничего не переносит между контрактами
 *
 * Три вида файлов, которых в модуле нет, она только НАЗЫВАЕТ:
 *
 * - **сироты шагов** — папка схемы шага и файл его правил, оставшиеся после переименования или
 *   удаления шага;
 * - **прежнее имя документа** (`renderer.schema.json`) — единственный случай, когда содержимое
 *   переносится: документ под новым именем печатается заново, старый остаётся;
 * - **файлы прежней плоской раскладки** (`index.tsx`, `form.render.ts`, `wizard.tsx`,
 *   `steps/<шаг>/form.validation.ts`, …) — код ПРЕЖНЕГО контракта сборки. Под новые имена он не
 *   переносится: контракт другой (`createJsonForm` и слой рендера против `createForm` и единого
 *   поведения), и правленный файл, положенный на новое место, не собрался бы. Новый модуль их не
 *   импортирует; перенести свои правки и удалить их — решение человека.
 *
 * @module plugins/reformer/codegen/pipeline/deliver
 */

import {
  DEFAULT_SCHEMA_PATH,
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
import { isGenerated, originOf } from '@reformer/builder-toolkit';
import type { ResourceId } from '@reformer/builder-plugin-api';
import type { ModuleFile } from './generate';
import type { CodegenHost } from '../host';

/** Почему файл не записан. */
export type SkipReason =
  /** Авторский файл: перевыводить его не из чего, и правки в нём — работа человека. */
  | 'authored'
  /** Файл наш, но его правили руками: маркер не сходится с телом. */
  | 'edited';

export interface DeliveryResult {
  /** Каталог модуля в рабочей области. */
  readonly dir: ResourceId;
  readonly written: readonly string[];
  readonly skipped: readonly { readonly path: string; readonly reason: SkipReason }[];
  readonly failed: readonly { readonly path: string; readonly message: string }[];
  /**
   * Отправлено ли записанное в источник: `null` — композиция не дала `save`, и файлы остались
   * несохранённой рабочей копией.
   */
  readonly saved: boolean | null;
  /**
   * Файлы шагов на диске, которых в модуле больше нет: папка схемы шага
   * (`schema/steps/<шаг>`) и файл его правил (`validation/<шаг>.ts`), если тот напечатан билдером.
   *
   * Шаг переименовали — у него новое имя и новые файлы, а старые остались со всем, что человек
   * в них правил. Удалять их доставка не вправе (там может лежать единственная копия правленной
   * валидации), переносить — не умеет: соответствие «старое имя → новое» по одной раскладке не
   * восстановить. Поэтому только называет — удалять или переносить решает человек.
   */
  readonly orphans: readonly string[];
  /** Документ под прежним именем (`renderer.schema.json`), рядом с которым появился новый. */
  readonly legacy: readonly LegacyFile[];
  /**
   * Файлы прежней плоской раскладки, оставшиеся в каталоге модуля, — пути от его корня.
   *
   * Код прежнего контракта: модуль их не импортирует, доставка не трогает (см. шапку модуля).
   */
  readonly flat: readonly string[];
}

/**
 * Файл под прежним именем, замещённый новым.
 *
 * Старый файл остаётся на месте: доставка не удаляет ничего и никогда, а сгенерированный
 * модуль его больше не импортирует — то есть лишний файл безвреден, а удалённый по ошибке — нет.
 * Уведомление предлагает удалить его руками.
 */
export interface LegacyFile {
  /** Прежний путь внутри модуля — `renderer.schema.json`. */
  readonly path: string;
  /** Новый путь — `form.schema.json`. */
  readonly replacedBy: string;
  /**
   * Перенесено ли СОДЕРЖИМОЕ старого файла под новое имя.
   *
   * `true` — старый был авторским файлом, правленным руками: печать свежего текста выбросила
   * бы эти правки из модуля. `false` — под новым именем напечатан свежий текст (так всегда у
   * производного файла, каким является документ формы).
   */
  readonly carried: boolean;
}

/**
 * Документ формы ли это — по имени файла: он лежит и в `schema/`, и в корне модуля.
 *
 * Нужен интерфейсу: у прежнего имени ДОКУМЕНТА есть действие «открыть новый файл» — редактор
 * держит открытым старый, и дальнейшие правки ушли бы в него.
 */
export function isSchemaDocumentPath(path: string): boolean {
  return path.slice(path.lastIndexOf('/') + 1) === SCHEMA_FILE;
}

/** Необязательные сведения доставки. */
export interface DeliveryOptions {
  /**
   * Весь модуль, а не только доставляемое.
   *
   * Нужен поиску «сирот»: при записи одной цели (типы из контекстного меню) среди доставляемых
   * файлов шагов нет вовсе, и без полного состава КАЖДЫЙ файл шага выглядел бы брошенным. По
   * умолчанию — сами доставляемые файлы.
   */
  readonly module?: readonly ModuleFile[];
  /**
   * Путь корневого документа внутри модуля: рядом с ним лежат папки схем шагов, среди которых
   * ищутся сироты. По умолчанию — `schema/form.schema.json`.
   */
  readonly schemaPath?: string;
}

/** Источник не принимает запись — доставка не начинается. */
export class SourceReadOnlyError extends Error {
  constructor() {
    super('источник не принимает запись');
    this.name = 'SourceReadOnlyError';
  }
}

/**
 * Модуль на диске напечатан другим китом, чем печатается сейчас, — доставка не начинается.
 *
 * Производные файлы (реестр, страница) доставка переписывает всегда, и без этой проверки
 * «Сгенерировать» под чужим активным китом молча перепечатало бы форму HexaUI под ui-kit: кит —
 * одна настройка на проект, а не свойство формы. Отказ честнее частичной записи: модуль,
 * напечатанный наполовину под другой кит, не собрался бы.
 */
export class KitMismatchError extends Error {
  constructor(
    /** Пакет кита, которым напечатан модуль на диске. */
    readonly moduleKit: string,
    /** Пакет кита, под который модуль печатается сейчас. */
    readonly activeKit: string
  ) {
    super(`модуль напечатан китом «${moduleKit}», а печатается под «${activeKit}»`);
    this.name = 'KitMismatchError';
  }
}

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

/**
 * Отказ, если модуль на диске напечатан другим китом. Сравниваются пакеты обёртки поля в
 * реестре на диске и в свежем — то есть кит модуля и кит, под который он печатается сейчас.
 */
async function assertSameKit(
  host: CodegenHost,
  dir: ResourceId,
  module: readonly ModuleFile[]
): Promise<void> {
  const registry = module.find((file) => file.targetId === REGISTRY_TARGET_ID);
  if (registry === undefined) return;
  const activeKit = registryKitOf(registry.content);
  if (activeKit === null) return;
  const id = at(host, dir, registry.path);
  if (!(await host.exists(id))) return;
  const current = await host.readText(id).catch(() => null);
  const moduleKit = current === null ? null : registryKitOf(current);
  if (moduleKit !== null && moduleKit !== activeKit) {
    throw new KitMismatchError(moduleKit, activeKit);
  }
}

/**
 * Записать модуль в каталог `<parent>/<dir>`.
 *
 * Каталог не создаётся отдельным шагом: рабочая область адресует ресурсы путями, и запись
 * по адресу внутри несуществующего каталога создаёт его сама. Отдельный `mkdir` был бы вторым
 * способом сказать то же самое — и разошёлся бы с первым на источнике, у которого каталогов нет.
 */
export async function deliverModule(
  host: CodegenHost,
  parent: ResourceId,
  dirName: string,
  files: readonly ModuleFile[],
  options: DeliveryOptions = {}
): Promise<DeliveryResult> {
  return deliverInto(host, host.resolve(parent, dirName), files, options);
}

/** Адрес файла модуля по его пути от корня. */
function at(host: CodegenHost, dir: ResourceId, path: string): ResourceId {
  return host.resolve(dir, ...path.split('/'));
}

/**
 * Файлы шагов на диске, которых нет в модуле.
 *
 * Без листинга — пусто: сирота — подсказка, а не условие доставки, и порт без `list`
 * не обязан её давать.
 */
async function orphansOf(
  host: CodegenHost,
  dir: ResourceId,
  module: readonly ModuleFile[],
  schemaPath: string
): Promise<readonly string[]> {
  if (host.list === undefined) return [];
  const current = new Set(module.map((file) => file.path));
  const orphans: string[] = [];

  // Папки схем шагов — рядом с корневым документом. Сиротой считается папка со схемой шага:
  // у формы с документом в корне модуля та же `steps/` держала код шагов прежней раскладки, и
  // такая папка — не сирота шага, а файлы прежнего контракта (их называет `flatOf`).
  //
  // Листинг, а не `exists` + листинг: отсутствующий каталог источник отдаёт пустым списком
  // или отказом, и оба ответа здесь значат одно — сирот нет.
  const stepsDir = `${schemaDirOf(schemaPath)}${STEP_SCHEMAS_DIR}`;
  for (const entry of await host.list(at(host, dir, stepsDir)).catch(() => [])) {
    if (entry.kind !== 'directory') continue;
    const schema = `${stepsDir}/${entry.name}/${SCHEMA_FILE}`;
    if (current.has(schema)) continue;
    if (await host.exists(at(host, dir, schema))) orphans.push(`${stepsDir}/${entry.name}`);
  }

  // Файлы правил шагов. Только напечатанные билдером (с маркером, пусть и правленные): свой
  // файл человека в `validation/` — общие правила, сообщения — шагом не является.
  for (const entry of await host.list(at(host, dir, VALIDATION_DIR)).catch(() => [])) {
    if (entry.kind === 'directory' || !entry.name.endsWith('.ts')) continue;
    if (entry.name === `${FORM_RULES_NAME}.ts`) continue;
    const path = `${VALIDATION_DIR}/${entry.name}`;
    if (current.has(path)) continue;
    const text = await host.readText(entry.id).catch(() => null);
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
  host: CodegenHost,
  dir: ResourceId,
  module: readonly ModuleFile[]
): Promise<readonly string[]> {
  const current = new Set(module.map((file) => file.path));
  const found: string[] = [];
  const probe = async (path: string): Promise<void> => {
    if (!current.has(path) && (await host.exists(at(host, dir, path)))) found.push(path);
  };

  for (const path of FLAT_LAYOUT_FILES) await probe(path);
  await probe(FLAT_STEPS_INDEX);
  if (host.list !== undefined) {
    for (const entry of await host.list(at(host, dir, FLAT_STEPS_DIR)).catch(() => [])) {
      if (entry.kind !== 'directory') continue;
      for (const file of FLAT_STEP_FILES) await probe(`${FLAT_STEPS_DIR}/${entry.name}/${file}`);
    }
  }
  return found;
}

/**
 * Файл под прежним именем, если новый ещё не появился.
 *
 * Ищется только при отсутствии нового: если форма уже переехала, старый файл — прошлое,
 * и повторно предлагать перенос на каждом прогоне значило бы переносить устаревшую копию
 * поверх актуальной.
 */
async function legacyOf(
  host: CodegenHost,
  dir: ResourceId,
  file: ModuleFile,
  id: ResourceId
): Promise<{ readonly path: string; readonly text: string } | null> {
  if (file.legacyPaths === undefined || file.legacyPaths.length === 0) return null;
  if (await host.exists(id)) return null;
  for (const path of file.legacyPaths) {
    const legacyId = at(host, dir, path);
    if (!(await host.exists(legacyId))) continue;
    const text = await host.readText(legacyId);
    if (text !== null) return { path, text };
  }
  return null;
}

/**
 * Записать модуль В САМ каталог, без подпапки под ним.
 *
 * Второй вход, а не флаг у первого, потому что вопросы разные. {@link deliverModule} отвечает
 * «рядом с этой схемой заведи модуль формы» — имя каталога там ПРОИЗВОДНОЕ имени формы, и
 * решает его генерация. Здесь каталог НАЗВАН: это корень модуля формы — его выбрал человек,
 * щёлкнув по строке дерева, либо на него указывает место документа (`<модуль>/schema/…`), — и
 * выводить внутри него ещё один по имени формы значило бы получить
 * `credit-application/credit-application/`.
 *
 * Всё остальное общее и живёт здесь: право источника на запись, предикат перезаписи,
 * отправка записанного. Разница ровно в одном адресе.
 */
export async function deliverInto(
  host: CodegenHost,
  dir: ResourceId,
  files: readonly ModuleFile[],
  options: DeliveryOptions = {}
): Promise<DeliveryResult> {
  const capabilities = host.sourceOf(dir);
  if (capabilities === null || !capabilities.write) throw new SourceReadOnlyError();
  // По полному модулю: запись одной цели (типы из меню дерева) реестра среди доставляемых не несёт,
  // а кит у модуля тот же.
  await assertSameKit(host, dir, options.module ?? files);

  const written: string[] = [];
  const skipped: { path: string; reason: SkipReason }[] = [];
  const failed: { path: string; message: string }[] = [];
  const legacy: LegacyFile[] = [];
  const touched: ResourceId[] = [];

  for (const file of files) {
    const id = at(host, dir, file.path);
    try {
      const previous = await legacyOf(host, dir, file, id);
      if (previous !== null) {
        // Переносится только авторский файл, правленный руками (маркер не сходится или его
        // нет вовсе): это работа человека, и под новым именем она обязана остаться в модуле.
        // Нетронутый наш файл переносить незачем — свежий текст и есть его новая версия.
        const carried = file.cls === 'user' && !isGenerated(previous.text);
        legacy.push({ path: previous.path, replacedBy: file.path, carried });
        await host.writeText(id, carried ? previous.text : file.content);
        written.push(file.path);
        touched.push(id);
        continue;
      }
      if (file.cls === 'user' && (await host.exists(id))) {
        if (!file.regenerable) {
          skipped.push({ path: file.path, reason: 'authored' });
          continue;
        }
        const current = await host.readText(id);
        if (!isGenerated(current)) {
          skipped.push({ path: file.path, reason: 'edited' });
          continue;
        }
      }
      await host.writeText(id, file.content);
      written.push(file.path);
      touched.push(id);
    } catch (error) {
      failed.push({
        path: file.path,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const saved = host.save === undefined || touched.length === 0 ? null : await host.save(touched);
  const module = options.module ?? files;
  const orphans = await orphansOf(host, dir, module, options.schemaPath ?? DEFAULT_SCHEMA_PATH);
  const flat = await flatOf(host, dir, module);

  return { dir, written, skipped, failed, saved, orphans, legacy, flat };
}
