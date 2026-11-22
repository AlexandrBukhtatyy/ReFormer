/**
 * Синтетическая точка входа: один граф модулей на все файлы ролей формы.
 *
 * ## Почему граф обязан быть ОДИН
 *
 * `ModuleLoader.load` строит свежий граф на каждый вызов — и это правильно: правка исходника
 * обязана привести к повторному исполнению, иначе превью показывает прошлый код. Но отсюда
 * следует, что позвать `load` по разу на каждый файл НЕЛЬЗЯ: `validation/form.ts`, который
 * импортирует ещё и `application/submit.ts`, исполнился бы дважды и дал бы ДВА разных набора
 * правил — сборка проверяла бы одним, отправка другим. Это ровно тот класс ошибок идентичности,
 * ради которого существует реестр модулей.
 *
 * Поэтому набору дописывается сгенерированный файл, который требует все нужные файлы разом.
 * Один `load` — один граф — каждый модуль исполнен один раз, как в настоящем CommonJS.
 *
 * ## Что требовать, решает не точка входа
 *
 * Список приходит аргументом — его составляет план модуля (`./module`): у раскладки «папки по
 * ролям» это файлы ролей, у прежней плоской — файлы корня. Всё остальное в наборе есть, но
 * исполняется, только если его импортировали: требовать файл напрямую значило бы исполнять то,
 * что форма не импортирует (страницу, сборку приложения, брошенную папку переименованного шага).
 *
 * ## Почему изоляция ошибок внутри энтри, а не снаружи
 *
 * Битый `validation/form.ts` не должен лишать превью работающего `behavior/index.ts` — это
 * правило v1, и оно верное: «форма не отрабатывает» без указания, какой именно файл лёг, было
 * главной жалобой. Но линковщик бросает первым же отказом и рвёт весь граф. Поэтому `require`
 * каждого файла обёрнут в `try` ВНУТРИ энтри: сбой одного файла становится записью в списке,
 * а не концом загрузки. Файл, который импортирует упавший, падёт следом — и это правда, а не
 * потеря изоляции.
 *
 * ## Почему `.js`, а не `.ts`
 *
 * Файл без подходящего движка идёт через линковщик как есть (см. `host/modules/loader`).
 * Расширение `.js` экономит вызов транспилятора на файле, который мы сами и напечатали,
 * — и заодно снимает вопрос, что будет, если движок TypeScript не загрузился: набор без
 * единого `.ts` не требует движка вовсе.
 *
 * @module plugins/reformer/render/compiling/entry
 */

/**
 * Имя синтетического файла.
 *
 * Двойные подчёркивания с обеих сторон — чтобы столкновение с настоящим файлом каталога было
 * невозможно на практике; проверку на столкновение всё равно делает {@link assertEntryNameFree},
 * потому что «на практике невозможно» — не то же самое, что «невозможно».
 */
export const PREVIEW_ENTRY_FILE = '__preview-entry__.js';

/** Сбой одного файла, как его записал энтри. */
export interface PreviewEntryFailure {
  /**
   * Файл, на котором споткнулись: тот, что назвала ошибка линковщика, — импортёр не виноват,
   * что его `../api` не собрался, — либо сам затребованный файл, если ошибка файла не называет.
   */
  readonly file: string;
  readonly message: string;
  /** Фаза из ошибки линковщика; без неё — исполнение. */
  readonly phase?: 'resolve' | 'transpile' | 'evaluate';
  /** Место первой находки движка, если ошибка его несёт (`cause.findings`). */
  readonly range?: { readonly start: number; readonly end: number };
}

/** Что синтетический энтри отдаёт наружу. Разбирается {@link './compile'}. */
export interface PreviewEntryExports {
  /** Путь файла от корня модуля → его экспорты. Только то, что исполнилось. */
  readonly modules: Record<string, unknown>;
  /** Файлы, которые исполниться не смогли. */
  readonly errors: readonly PreviewEntryFailure[];
}

/**
 * Проверяет, что имя синтетической точки входа свободно.
 *
 * @throws если среди файлов уже есть {@link PREVIEW_ENTRY_FILE} — молча перезаписать чужой файл
 *   значило бы исполнить не то, что лежит в рабочей копии.
 */
export function assertEntryNameFree(files: Iterable<string>): void {
  for (const file of files) {
    if (file !== PREVIEW_ENTRY_FILE) continue;
    throw new Error(
      `в каталоге формы уже есть «${PREVIEW_ENTRY_FILE}»: имя синтетической точки входа занято`
    );
  }
}

/**
 * Печатает исходник синтетической точки входа.
 *
 * Требуются ровно переданные файлы — пути от корня модуля (`validation/form.ts`), они же ключи
 * результата. Порядок `require` — порядок аргумента: он определяет, в каком порядке исполнятся
 * файлы, не связанные импортами. Детерминированность здесь не косметика — от неё зависит
 * воспроизводимость превью между запусками.
 *
 * @throws если среди файлов уже есть {@link PREVIEW_ENTRY_FILE} (см. {@link assertEntryNameFree}).
 */
export function buildEntrySource(files: readonly string[]): string {
  assertEntryNameFree(files);

  const lines = files.map((file) => {
    const specifier = JSON.stringify(`./${file}`);
    const key = JSON.stringify(file);
    return (
      `try { modules[${key}] = require(${specifier}); } ` +
      `catch (error) { errors.push(failure(${key}, error)); }`
    );
  });

  // Ошибка линковщика знает больше, чем её текст: файл, фазу и — через находки движка —
  // место. Энтри исполняется чужим кодом и импортировать класс ошибки не может, поэтому читает
  // поля по форме: чего нет — того и не будет, а текст останется в любом случае.
  return [
    'var modules = {};',
    'var errors = [];',
    'function describe(error) {',
    '  return error && error.message ? String(error.message) : String(error);',
    '}',
    'function rangeOf(error) {',
    '  var findings = error && error.cause && error.cause.findings;',
    '  if (!Array.isArray(findings)) return undefined;',
    '  for (var i = 0; i < findings.length; i += 1) {',
    '    var range = findings[i] && findings[i].range;',
    "    if (range && typeof range.start === 'number' && typeof range.end === 'number') {",
    '      return { start: range.start, end: range.end };',
    '    }',
    '  }',
    '  return undefined;',
    '}',
    'function failure(file, error) {',
    '  var out = { file: file, message: describe(error) };',
    "  if (error && typeof error.file === 'string' && error.file !== '') out.file = error.file;",
    "  if (error && (error.phase === 'resolve' || error.phase === 'transpile' || error.phase === 'evaluate')) {",
    '    out.phase = error.phase;',
    '  }',
    '  var range = rangeOf(error);',
    '  if (range !== undefined) out.range = range;',
    '  return out;',
    '}',
    ...lines,
    'module.exports = { modules: modules, errors: errors };',
    '',
  ].join('\n');
}

/**
 * Разбирает то, что вернул энтри.
 *
 * Проверка формы, а не приведение: энтри печатаем мы сами, но `entry` приходит из `unknown`
 * и мог оказаться `undefined`, если граф не собрался вовсе. Тихое приведение превратило бы
 * это в ошибку на первом обращении к полю.
 */
export function readEntryExports(entry: unknown): PreviewEntryExports | null {
  if (entry === null || typeof entry !== 'object') return null;
  const candidate = entry as Partial<PreviewEntryExports>;
  if (typeof candidate.modules !== 'object' || candidate.modules === null) return null;
  if (!Array.isArray(candidate.errors)) return null;
  return { modules: candidate.modules, errors: candidate.errors };
}
