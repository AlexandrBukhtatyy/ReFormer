/**
 * Цели генерации из проекта: `<project>/.ui_builder/codegen/*.eta`.
 *
 * ## Ради чего всё
 *
 * Изменить то, что кодоген печатает в проект, до сих пор можно было единственным способом —
 * написать плагин. Плагин — это манифест, точка входа, включение в каталоге и код, который
 * исполняется в realm приложения. Для «хочу, чтобы `registry.ts` импортировал из нашего
 * пакета» это несоразмерная цена, и платить её никто не станет.
 *
 * Здесь цена другая: положить файл рядом с проектом. Файл — это заголовок и шаблон, тот же
 * язык, на котором написаны встроенные цели, и команда выгрузки отдаёт встроенный шаблон
 * ровно в этой форме — «скопируй и правь».
 *
 * ## Сосед, а не потомок каталога шаблонов
 *
 * `.ui_builder/templates/` — это СНИМКИ файлов для «новая форма по шаблону». Положи мы цели
 * туда же, список шаблонов стал бы неоднозначным, а `requires` у цели не значит ничего.
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
 * @module plugins/codegen/user-targets
 */

import { buildView, parseTargetFile, type EmitContext } from '@/lib/codegen';
import type { ResourceId } from '@/sdk';
import type { CodegenTarget } from './contract';
import type { CodegenProblem } from './generate';
import type { CodegenHost } from './host';

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
 * применимость обязана спрашиваться в тех же словах, что и печать.
 */
function compileApplies(expression: string): (ctx: EmitContext) => boolean {
  const fn = new Function('it', `return (${expression});`) as (view: object) => unknown;
  return (ctx: EmitContext) => fn(buildView(ctx)) === true;
}

/** Прочитать одну цель. `null` — файл не про нас. */
function targetOf(name: string, text: string): UserTarget | CodegenProblem {
  const parsed = parseTargetFile(text);
  if (!parsed.ok) return problem(name, parsed.message);

  const { meta, body } = parsed;
  let applies: ((ctx: EmitContext) => boolean) | undefined;
  if (meta.applies !== undefined) {
    try {
      applies = compileApplies(meta.applies);
    } catch (error) {
      return problem(name, `«applies» не компилируется: ${(error as Error).message}`);
    }
  }

  return {
    id: meta.id,
    path: meta.path,
    cls: meta.cls,
    template: body,
    origin: 'user',
    ...(meta.order === undefined ? {} : { order: meta.order }),
    ...(meta.title === undefined ? {} : { title: meta.title }),
    ...(meta.overrides === undefined ? {} : { overrides: meta.overrides }),
    ...(meta.regenerable === undefined ? {} : { regenerable: meta.regenerable }),
    ...(applies === undefined ? {} : { applies }),
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

/**
 * Снять цели, которые кто-то переопределил.
 *
 * Победитель — тот, кто объявил `overrides`. Забыть его нельзя незаметно: тогда обе цели
 * претендуют на один `path`, и отбор назовёт это `duplicate-path` с именем победителя.
 */
export function applyOverrides(targets: readonly CodegenTarget[]): readonly CodegenTarget[] {
  const overridden = new Set(
    targets.flatMap((target) => (target.overrides === undefined ? [] : [target.overrides]))
  );
  return overridden.size === 0 ? targets : targets.filter((target) => !overridden.has(target.id));
}
