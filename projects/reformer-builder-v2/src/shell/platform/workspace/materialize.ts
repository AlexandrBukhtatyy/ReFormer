/**
 * Догрузка замыкания импортов с бюджетом.
 *
 * Открытие документа тянет за собой соседей: схема формы ссылается на сайдкар, сайдкар —
 * на общие правила. Без ограничителя импорт из файла-реэкспорта втягивает весь проект,
 * и рабочий набор перестаёт быть рабочим набором.
 *
 * | Ограничение | Значение | Почему                                                        |
 * | ----------- | -------- | ------------------------------------------------------------- |
 * | Глубина     | 8        | Реальные формы укладываются в 2–3; 8 ловит цикл через барель  |
 * | Файлов      | 200      | Каталог формы — единицы файлов; 200 значит, что зацепили чужое |
 * | Байт        | 8 МБ     | Отсекает случайное втягивание сборочных артефактов            |
 *
 * **Только относительные спецификаторы.** Бэйр-спецификаторы (`react`, `@reformer/core`)
 * не догружаются вовсе: они резолвятся на модули оболочки. Это не оптимизация — это то же
 * ограничение, которое защищает идентичность сигналов и React: догруженная из источника
 * копия `@reformer/core` дала бы второй рантайм, и `instanceof Signal` перестал бы работать.
 *
 * **При превышении — остановиться и сказать.** Молчаливое усечение недопустимо: оно выглядит
 * как «всё загрузилось», а форма потом не собирается без объяснимой причины. Поэтому обход
 * останавливается на первом же превышении и сообщает, ГДЕ он остановился и сколько осталось
 * ({@link ClosureStop}), а диагностика несёт код и параметры, а не готовую фразу.
 *
 * **Бюджет считается по посещённым файлам, а не по свежедогруженным.** Иначе второе открытие
 * того же документа проходило бы бюджет, который первое не прошло, — и «форма не собирается»
 * зависело бы от того, что лежит в кэше.
 *
 * @module host/workspace/materialize
 */

import type { Diagnostic } from '@/shell/platform/diagnostics/types';
import { dirname, extname, joinPath } from '@/shell/platform/primitives/resource';

/** Потолки догрузки замыкания. */
export interface ClosureBudget {
  /** Сколько уровней импортов разворачивать. Корень — уровень 0. */
  readonly depth: number;
  /** Сколько файлов (вместе с корнем) допускается в замыкании. */
  readonly files: number;
  /** Суммарный объём замыкания в байтах. */
  readonly bytes: number;
}

/** Значения из контракта Э2. */
export const DEFAULT_CLOSURE_BUDGET: ClosureBudget = Object.freeze({
  depth: 8,
  files: 200,
  bytes: 8 * 1024 * 1024,
});

/** Под каким именем догрузка публикует свои диагностики. */
export const CLOSURE_DIAGNOSTIC_SOURCE = 'workspace.closure';

/**
 * Извлекатель спецификаторов из текста.
 *
 * Подменяемый, потому что «что такое импорт» зависит от формата, а Host форматов не знает.
 * Умолчание ({@link extractRelativeImports}) покрывает ES-модули, `require` и JSON-ссылки;
 * плагин формата (Э6) сможет отдать точный список из разобранной модели вместо регулярок.
 */
export type ImportExtractor = (path: string, text: string) => readonly string[];

/** Файл, доведённый до рабочей области. */
export interface ClosureFile {
  readonly path: string;
  /** Размер рабочей копии — им и считается бюджет по объёму. */
  readonly bytes: number;
  /** `true` — сходили в источник прямо сейчас; `false` — уже лежал в рабочей области. */
  readonly fresh: boolean;
}

/**
 * То, что догрузка просит у Workspace.
 *
 * Узкий интерфейс, а не сам Workspace: обход проверяется отдельно от хранилища, а Workspace
 * не обязан открывать догрузке ничего сверх этих трёх операций.
 */
export interface ClosureHost {
  /** Доводит ресурс до рабочей области. `null` — в источнике его нет. */
  materialize(path: string): Promise<ClosureFile | null>;
  /** Текст материализованного ресурса; `null` — нечитаем (двоичный или пропал). */
  textOf(path: string): Promise<string | null>;
  /** Существует ли такой файл — для перебора кандидатов при резолве спецификатора. */
  resolves(path: string): Promise<boolean>;
}

/** Из-за чего обход остановился. */
export type ClosureStopReason = 'depth' | 'files' | 'bytes';

/** Где именно обход упёрся в потолок. Это и есть «сказать, а не усечь». */
export interface ClosureStop {
  readonly reason: ClosureStopReason;
  /** Ресурс, на котором остановились. */
  readonly at: string;
  /** Потолок, который не пустил. */
  readonly limit: number;
  /** Значение, которого достигли к моменту остановки. */
  readonly reached: number;
  /** Что осталось недогруженным — очередь на момент остановки. */
  readonly pending: readonly string[];
}

/** Импорт, который не удалось привязать к файлу. */
export interface UnresolvedImport {
  readonly from: string;
  readonly specifier: string;
}

/** Итог догрузки. */
export interface MaterializeResult {
  readonly root: string;
  /** Всё, что оказалось в замыкании, включая корень, в порядке обхода. */
  readonly files: readonly string[];
  /** Суммарный объём замыкания. */
  readonly bytes: number;
  /** Наибольшая достигнутая глубина. */
  readonly depth: number;
  /** Заполнено, если упёрлись в потолок. Отсутствие означает, что замыкание полное. */
  readonly stopped?: ClosureStop;
  readonly unresolved: readonly UnresolvedImport[];
  /** Коды и параметры, а не готовые строки: по коду ассистент чинится сам. */
  readonly diagnostics: readonly Diagnostic[];
}

export interface MaterializeOptions {
  readonly budget?: ClosureBudget;
  readonly imports?: ImportExtractor;
}

/*
 * ──────────────────────────  разбор спецификаторов  ──────────────────────────
 */

/** `import … from '…'`, `export … from '…'`. */
const FROM_PATTERN = /\bfrom\s*['"]([^'"\n]+)['"]/g;
/** `import '…'` — импорт ради побочного эффекта (стили, полифилы). */
const BARE_IMPORT_PATTERN = /\bimport\s+['"]([^'"\n]+)['"]/g;
/** `import('…')` — динамический импорт. */
const DYNAMIC_PATTERN = /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g;
/** `require('…')` — сайдкары, пришедшие из CommonJS. */
const REQUIRE_PATTERN = /\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g;
/** `"$ref": "./…"` — ссылка JSON Reference, а не знание про формы: ключ стандартный. */
const JSON_REF_PATTERN = /"\$ref"\s*:\s*"([^"\n]+)"/g;

const SPECIFIER_PATTERNS: readonly RegExp[] = [
  FROM_PATTERN,
  BARE_IMPORT_PATTERN,
  DYNAMIC_PATTERN,
  REQUIRE_PATTERN,
  JSON_REF_PATTERN,
];

/** Относительный ли спецификатор. Всё остальное — модуль оболочки, и его не догружают. */
function isRelative(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

/**
 * Достаёт из текста относительные спецификаторы, в порядке появления и без повторов.
 *
 * Регулярки, а не разбор: полный разбор TypeScript ради списка импортов означал бы тянуть
 * компилятор в Host, а ошибка регулярки здесь дёшева — лишний кандидат не резолвится
 * и попадает в `unresolved`, пропущенный кандидат не догружается и всплывёт как отсутствующий
 * модуль при сборке. Точный список отдаст плагин формата, когда у него появится разобранная
 * модель ({@link ImportExtractor}).
 *
 * Ограничение, которое надо знать: спецификатор внутри строки или комментария будет найден
 * тоже. Это осознанный перекос в сторону лишней догрузки — недогруженный сосед ломает форму,
 * лишний файл всего лишь занимает место в рабочем наборе.
 */
export const extractRelativeImports: ImportExtractor = (_path, text) => {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const pattern of SPECIFIER_PATTERNS) {
    // Общий `lastIndex` у глобальной регулярки между вызовами — классический источник
    // пропусков через раз; сбрасываем явно.
    pattern.lastIndex = 0;
    let match = pattern.exec(text);
    while (match !== null) {
      const specifier = match[1];
      if (isRelative(specifier) && !seen.has(specifier)) {
        seen.add(specifier);
        found.push(specifier);
      }
      match = pattern.exec(text);
    }
  }
  return found;
};

/** Расширения, которые дописываются к спецификатору без расширения. */
const IMPLICIT_EXTENSIONS: readonly string[] = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
];

/** Расширения, при которых спецификатор считается уже полным. */
const EXPLICIT_EXTENSIONS: ReadonlySet<string> = new Set([
  ...IMPLICIT_EXTENSIONS,
  '.css',
  '.md',
  '.svg',
  '.yaml',
  '.yml',
]);

/** `.js` в исходнике на TypeScript означает соседний `.ts` — соглашение NodeNext. */
const JS_TO_TS: Readonly<Record<string, readonly string[]>> = {
  '.js': ['.ts', '.tsx'],
  '.jsx': ['.tsx'],
  '.mjs': ['.mts'],
  '.cjs': ['.cts'],
};

/** Кандидаты для пути без гарантии расширения, в порядке проверки. */
function candidatesFor(base: string): readonly string[] {
  const extension = extname(base).toLowerCase();
  if (EXPLICIT_EXTENSIONS.has(extension)) {
    const swapped = JS_TO_TS[extension] ?? [];
    const stem = base.slice(0, base.length - extension.length);
    return [base, ...swapped.map((ext) => `${stem}${ext}`)];
  }
  return [
    ...IMPLICIT_EXTENSIONS.map((ext) => `${base}${ext}`),
    // Барель каталога проверяется последним: `./rules.ts` важнее, чем `./rules/index.ts`,
    // и обратный порядок втягивал бы целый каталог там, где хватило одного файла.
    ...IMPLICIT_EXTENSIONS.map((ext) => `${base}/index${ext}`),
    base,
  ];
}

/**
 * Путь соседа по относительному спецификатору.
 *
 * База — каталог ФАЙЛА, в котором импорт написан: `../shared/rules` в
 * `src/forms/credit/schema.json` означает `src/forms/shared/rules`.
 *
 * @returns `null`, если ни один кандидат не существует или путь уводит за корень источника.
 */
export async function resolveRelative(
  from: string,
  specifier: string,
  exists: (path: string) => Promise<boolean>
): Promise<string | null> {
  let base: string;
  try {
    base = joinPath(dirname(from), specifier);
  } catch {
    // Побег за корень источника — не резолвится, и это не авария обхода.
    return null;
  }
  if (base === '') return null;
  for (const candidate of candidatesFor(base)) {
    if (await exists(candidate)) return candidate;
  }
  return null;
}

/*
 * ──────────────────────────────  обход  ──────────────────────────────
 */

/** Диагностика превышения бюджета: где остановились и сколько не догружено. */
function stopDiagnostic(root: string, stop: ClosureStop, materialized: number): Diagnostic {
  return {
    source: CLOSURE_DIAGNOSTIC_SOURCE,
    severity: 'error',
    code: `workspace.closure-budget-${stop.reason}`,
    params: {
      root,
      at: stop.at,
      limit: stop.limit,
      reached: stop.reached,
      materialized,
      pending: stop.pending.length,
    },
    target: { kind: 'resource' },
  };
}

/** Диагностика нерезолвнутого импорта: предупреждение, а не отказ — файл мог быть удалён. */
function unresolvedDiagnostic(item: UnresolvedImport): Diagnostic {
  return {
    source: CLOSURE_DIAGNOSTIC_SOURCE,
    severity: 'warning',
    code: 'workspace.import-unresolved',
    params: { from: item.from, specifier: item.specifier },
    target: { kind: 'resource' },
  };
}

/**
 * Материализует ресурс вместе с замыканием его относительных импортов.
 *
 * Обход — в ширину: при упоре в потолок недогруженным остаётся самое дальнее, а не случайное
 * поддерево, и `pending` тогда действительно перечисляет то, чего не хватает.
 */
export async function materializeClosure(
  root: string,
  host: ClosureHost,
  options: MaterializeOptions = {}
): Promise<MaterializeResult> {
  const budget = options.budget ?? DEFAULT_CLOSURE_BUDGET;
  const imports = options.imports ?? extractRelativeImports;

  const queue: { path: string; depth: number }[] = [{ path: root, depth: 0 }];
  const seen = new Set<string>([root]);
  const files: string[] = [];
  const unresolved: UnresolvedImport[] = [];
  let bytes = 0;
  let maxDepth = 0;
  let stopped: ClosureStop | undefined;

  const pendingOf = (from: number): readonly string[] => queue.slice(from).map((item) => item.path);

  while (queue.length > 0) {
    const { path, depth } = queue[0];

    if (files.length >= budget.files) {
      stopped = {
        reason: 'files',
        at: path,
        limit: budget.files,
        reached: files.length,
        pending: pendingOf(0),
      };
      break;
    }

    queue.shift();
    const file = await host.materialize(path);
    if (file === null) {
      // Файл был при резолве и исчез к моменту чтения — для вызывающего это тот же
      // нерезолвнутый импорт, а не отдельный вид беды.
      unresolved.push({ from: path, specifier: path });
      continue;
    }

    if (bytes + file.bytes > budget.bytes) {
      stopped = {
        reason: 'bytes',
        at: path,
        limit: budget.bytes,
        reached: bytes + file.bytes,
        pending: [path, ...pendingOf(0)],
      };
      break;
    }

    files.push(path);
    bytes += file.bytes;
    maxDepth = Math.max(maxDepth, depth);

    const text = await host.textOf(path);
    // Двоичный ресурс импортов не несёт — разбирать нечего.
    if (text === null) continue;

    const specifiers = imports(path, text);
    if (specifiers.length === 0) continue;

    if (depth >= budget.depth) {
      // Дальше не разворачиваем: у файла на предельной глубине есть свои зависимости,
      // а значит замыкание неполно — и об этом надо сказать, а не тихо остановиться.
      stopped = {
        reason: 'depth',
        at: path,
        limit: budget.depth,
        reached: depth + 1,
        pending: pendingOf(0),
      };
      break;
    }

    for (const specifier of specifiers) {
      const resolved = await resolveRelative(path, specifier, (candidate) =>
        host.resolves(candidate)
      );
      if (resolved === null) {
        unresolved.push({ from: path, specifier });
        continue;
      }
      if (seen.has(resolved)) continue;
      seen.add(resolved);
      queue.push({ path: resolved, depth: depth + 1 });
    }
  }

  const diagnostics: Diagnostic[] = unresolved.map(unresolvedDiagnostic);
  if (stopped !== undefined) diagnostics.unshift(stopDiagnostic(root, stopped, files.length));

  return {
    root,
    files,
    bytes,
    depth: maxDepth,
    stopped,
    unresolved,
    diagnostics,
  };
}
