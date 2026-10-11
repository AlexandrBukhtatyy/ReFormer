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
 * @module plugins/reformer/codegen/pipeline/user-targets
 */

import {
  buildView,
  isFlatLayoutPath,
  parseTargetFile,
  type EmitContext,
} from '../../../core/codegen';
import type { ResourceId } from '@reformer/builder-plugin-api';
import type { CodegenTarget } from '../contract';
import type { CodegenProblem } from './generate';
import type { CodegenHost } from '../host';
import { RETIRED_TARGETS } from './targets';

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
    ...(meta.each === undefined ? {} : { each: meta.each }),
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
 * Почему замена устарела: написана под ПРЕЖНИЙ контракт кода — либо `null`.
 *
 * Шаблон, выгруженный до перехода на единый контракт и папки ролей, узнаётся по заголовку:
 *
 * - `retired` — заменяет цель, которой больше нет (шим визарда, агрегатор шагов, слой рендера);
 * - `flat` — заменяет живую цель, но печатает по пути плоской раскладки (`registry.ts` вместо
 *   `schema/registry.ts`).
 *
 * В обоих случаях его тело писалось под прежний вид (`it.wizard`, `it.layout.imports`,
 * `it.renderBehavior`) и под прежний контракт сборки: отрисовать его нечем, а напечатанный им
 * файл модуль не импортирует. Применить такую замену значило бы ещё и снять встроенную цель — то
 * есть оставить модуль без файла, который он импортирует.
 */
function staleReason(
  target: CodegenTarget,
  byId: ReadonlyMap<string, CodegenTarget>
): 'retired' | 'flat' | null {
  if (target.overrides === undefined) return null;
  if (Object.hasOwn(RETIRED_TARGETS, target.overrides)) return 'retired';
  const replaced = byId.get(target.overrides);
  if (replaced === undefined || replaced.path === target.path) return null;
  return isFlatLayoutPath(target.path) ? 'flat' : null;
}

/**
 * Снять цели, которые кто-то переопределил.
 *
 * Победитель — тот, кто объявил `overrides`. Забыть его нельзя незаметно: тогда обе цели
 * претендуют на один `path`, и отбор назовёт это `duplicate-path` с именем победителя.
 *
 * Замена, написанная под прежний контракт ({@link staleReason}), не побеждает и не печатается:
 * модуль печатается встроенными целями целиком, а о шаблоне говорит {@link overrideDrift}.
 */
export function applyOverrides(targets: readonly CodegenTarget[]): readonly CodegenTarget[] {
  if (targets.every((target) => target.overrides === undefined)) return targets;
  const byId = new Map(targets.map((target) => [target.id, target]));
  const live = targets.filter((target) => staleReason(target, byId) === null);
  const overridden = new Set(
    live.flatMap((target) => (target.overrides === undefined ? [] : [target.overrides]))
  );
  return live.filter((target) => !overridden.has(target.id));
}

/**
 * Замены, которые печатают НЕ то и НЕ туда, что печатала заменённая цель.
 *
 * Типичный случай — шаблон, выгруженный до перехода на папки ролей: встроенная
 * `codegen.registry` теперь печатает `schema/registry.ts`, а выгруженная копия так и осталась с
 * `"path": "registry.ts"` и телом под прежний контракт. Генерация от этого не падает: модуль
 * печатается встроенными целями, а шаблон не применяется — но человек обязан узнать, что его
 * правки перестали действовать, и что с этим делать.
 *
 * Отдельной функцией рядом с {@link applyOverrides}, а не внутри неё: та отвечает на вопрос
 * «кто печатает», и её результат — список целей; предупреждение — другой канал, и его
 * показывает панель наравне с отказами разбора. Смотрит на полный список ДО снятия замен:
 * после {@link applyOverrides} заменённой цели в нём уже нет, и сравнивать было бы не с чем.
 */
export function overrideDrift(targets: readonly CodegenTarget[]): readonly CodegenProblem[] {
  const byId = new Map(targets.map((target) => [target.id, target]));
  const problems: CodegenProblem[] = [];
  const report = (target: CodegenTarget, message: string): void => {
    problems.push({
      targetId: target.id,
      path: target.path,
      reason: 'override-path-drift',
      message,
    });
  };

  for (const target of targets) {
    if (target.overrides === undefined) continue;
    const stale = staleReason(target, byId);
    if (stale === 'retired') {
      report(
        target,
        `«${target.id}» заменяет цель «${target.overrides}», которой больше нет: ` +
          `${RETIRED_TARGETS[target.overrides]}. Шаблон не применён — перенесите правки и удалите его.`
      );
      continue;
    }
    const replaced = byId.get(target.overrides);
    if (replaced === undefined) continue;
    if (stale === 'flat') {
      report(
        target,
        `«${target.id}» заменяет «${replaced.id}», но написан под прежнюю плоскую раскладку: ` +
          `печатает «${target.path}», а модуль теперь импортирует «${replaced.path}». Шаблон не ` +
          'применён — модуль напечатан встроенным. Выгрузите шаблон заново и перенесите в него правки.'
      );
      continue;
    }
    const samePath = replaced.path === target.path;
    const sameEach = (replaced.each ?? null) === (target.each ?? null);
    if (samePath && sameEach) continue;
    report(
      target,
      !samePath
        ? `«${target.id}» заменяет «${replaced.id}», но печатает «${target.path}» вместо ` +
            `«${replaced.path}» — модуль импортирует второе. Поправьте «path» в заголовке шаблона.`
        : `«${target.id}» заменяет «${replaced.id}», но ` +
            (replaced.each === 'step'
              ? 'печатается один раз, а заменённая — по файлу на шаг: добавьте «"each": "step"».'
              : 'печатается по шагам, а заменённая — один раз.')
    );
  }
  return problems;
}
