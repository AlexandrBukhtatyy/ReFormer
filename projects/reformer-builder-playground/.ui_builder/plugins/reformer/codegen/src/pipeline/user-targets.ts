/**
 * Цели генерации из проекта: `<project>/.ui_builder/codegen/*.eta`.
 *
 * ## Ради чего всё
 *
 * Изменить то, что кодоген печатает в проект, до сих пор можно было единственным способом —
 * написать плагин. Плагин — это манифест, точка входа, включение в каталоге и код, который
 * исполняется в realm приложения. Для «хочу, чтобы `schema/registry.ts` импортировал из нашего
 * пакета» это несоразмерная цена, и платить её никто не станет.
 *
 * Здесь цена другая: положить файл рядом с проектом. Файл — это заголовок и шаблон, тот же
 * язык, на котором написаны встроенные цели, и команда выгрузки отдаёт встроенный шаблон
 * ровно в этой форме — «скопируй и правь». Формат файла — `parseTargetFile` из toolkit.
 *
 * ## Сосед, а не потомок каталога шаблонов
 *
 * `.ui_builder/templates/` — это СНИМКИ файлов для «новая форма по шаблону». Положи мы цели
 * туда же, список шаблонов стал бы неоднозначным, а `requires` у цели не значит ничего.
 *
 * ## Чей вид видит шаблон
 *
 * Тело шаблона пишется по виду (`it`) стека, чей модуль печатается, и применимость (`applies`
 * заголовка) спрашивается на том же виде: хозяин компилирует выражение в `appliesView`, а вид
 * подаёт стек. Стек шаблона — `stack` заголовка, а без него — стек заменённой цели
 * (`targetsOfStack` toolkit); шаблон без того и другого годится любому стеку.
 *
 * ## Чего здесь нет
 *
 * **Слежения за файлами.** File System Access его не даёт (тот же названный пробел, что у
 * шаблонов форм), поэтому перечитывание — по команде и при открытии проекта.
 *
 * **Пофайлового включения.** Плагин требует явного включения человеком, и это правильно:
 * он исполняется при СТАРТЕ. Шаблон исполняется только когда нажали «Сгенерировать», то есть
 * согласие уже выражено действием. Требовать второго значило бы вернуть ровно то трение,
 * ради снятия которого всё и сделано. Право источника исполнять код при этом соблюдается.
 *
 * @module plugins/reformer/codegen/pipeline/user-targets
 */

import { parseTargetFile } from '@reformer/builder-toolkit';
import type { CodegenProblem, CodegenTarget, ResourceId } from '@reformer/builder-plugin-api';
import type { CodegenHost } from '../host';

/** Каталог целей внутри проекта. Рядом с `templates/` и `plugins/`, не внутри них. */
export const USER_TARGETS_DIR = ['.ui_builder', 'codegen'] as const;

/** Расширение файла цели. */
const EXTENSION = '.eta';

/**
 * Цель из проекта.
 *
 * Порядок несёт САМА цель, а не только метаданные вклада: плагину он нужен ДО внесения —
 * чтобы цель, заменяющая встроенную, унаследовала её место, а не уехала в конец списка.
 */
export type UserTarget = CodegenTarget & { readonly order?: number };

export interface UserTargets {
  readonly targets: readonly UserTarget[];
  /** Отказы разбора — их показывает панель наравне с отказами печати. */
  readonly problems: readonly CodegenProblem[];
}

const EMPTY: UserTargets = Object.freeze({ targets: [], problems: [] });

function problem(path: string, message: string): CodegenProblem {
  return { targetId: path, path, reason: 'template-invalid', message };
}

/**
 * Скомпилировать выражение применимости.
 *
 * `new Function`, а не разбор мини-языка: прецедент в оболочке тотален (`host/modules/linker`
 * собирает CommonJS-конверт ровно так), CSP в проекте нет, а код приезжает из источника,
 * который человек открыл сам и явно разрешил исполнять.
 *
 * Выражение видит ВИД, а не контекст эмиссии: вид — публичная поверхность шаблонов, и
 * применимость обязана спрашиваться в тех же словах, что и печать. Не-булев ответ читается как
 * «не применяется».
 */
function compileApplies(expression: string): (view: object) => boolean {
  const fn = new Function('it', `return (${expression});`) as (view: object) => unknown;
  return (view: object) => fn(view) === true;
}

/** Прочитать одну цель. */
function targetOf(name: string, text: string): UserTarget | CodegenProblem {
  const parsed = parseTargetFile(text);
  if (!parsed.ok) return problem(name, parsed.message);

  const { meta, body } = parsed;
  let appliesView: ((view: object) => boolean) | undefined;
  if (meta.applies !== undefined) {
    try {
      appliesView = compileApplies(meta.applies);
    } catch (error) {
      return problem(name, `«applies» не компилируется: ${(error as Error).message}`);
    }
  }

  return {
    id: meta.id,
    path: meta.path,
    cls: meta.cls,
    ...(meta.each === undefined ? {} : { each: meta.each }),
    template: body,
    origin: 'user',
    ...(meta.order === undefined ? {} : { order: meta.order }),
    ...(meta.title === undefined ? {} : { title: meta.title }),
    ...(meta.overrides === undefined ? {} : { overrides: meta.overrides }),
    ...(meta.stack === undefined ? {} : { stack: meta.stack }),
    ...(meta.regenerable === undefined ? {} : { regenerable: meta.regenerable }),
    ...(appliesView === undefined ? {} : { appliesView }),
  };
}

function isProblem(value: UserTarget | CodegenProblem): value is CodegenProblem {
  return 'reason' in value;
}

/**
 * Прочитать цели из каталога проекта.
 *
 * Отсутствие каталога — обычный ответ, а не авария: целей у проекта может не быть, и это
 * не то же самое, что сломанный источник.
 */
export async function discoverUserTargets(host: CodegenHost): Promise<UserTargets> {
  const root = host.projectRoot?.() ?? null;
  if (root === null || host.list === undefined) return EMPTY;

  const dir: ResourceId = host.resolve(root, ...USER_TARGETS_DIR);
  const entries = await host.list(dir).catch(() => []);
  const files = entries
    .filter((entry) => entry.kind !== 'directory' && entry.name.endsWith(EXTENSION))
    // По имени: порядок листинга источника не обещан, а состав модуля обязан быть
    // воспроизводимым между запусками.
    .sort((a, b) => a.name.localeCompare(b.name));

  const targets: UserTarget[] = [];
  const problems: CodegenProblem[] = [];

  for (const entry of files) {
    const text = await host.readText(entry.id).catch(() => null);
    if (text === null) {
      problems.push(problem(entry.name, 'файл не читается'));
      continue;
    }
    const result = targetOf(entry.name, text);
    if (isProblem(result)) problems.push(result);
    else targets.push(result);
  }

  // Повтор `id` реестр вкладов встречает броском, поэтому ловим его здесь и называем файлом,
  // а не даём упасть активации.
  const seen = new Set<string>();
  const unique: UserTarget[] = [];
  for (const target of targets) {
    if (seen.has(target.id)) {
      problems.push(problem(target.path, `цель с id «${target.id}» уже объявлена другим файлом`));
      continue;
    }
    seen.add(target.id);
    unique.push(target);
  }

  return { targets: unique, problems };
}
