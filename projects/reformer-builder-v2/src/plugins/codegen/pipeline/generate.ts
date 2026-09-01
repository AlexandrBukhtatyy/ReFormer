/**
 * Прогон целей: контекст эмиссии — набор файлов модуля.
 *
 * Чистая часть плагина: ни рабочей области, ни источника, ни оболочки. Единственная
 * необязательная связь с внешним миром — форматтер, и он передаётся функцией.
 *
 * ## Что здесь охраняется
 *
 * Точка расширения открыта, а значит цели приходят от кого угодно, и три отказа обязаны быть
 * названы, а не приводить к падению:
 *
 * - **бросок цели** — файл не появляется, остальные печатаются; в v1 такого не могло быть,
 *   потому что список был свой, а теперь может;
 * - **две цели на один путь** — вклады уникальны по `id`, но не по `path`; побеждает первая
 *   по порядку, вторая называется в отчёте (молчаливая перезапись означала бы, что состав
 *   модуля зависит от порядка активации плагинов);
 * - **путь наружу каталога** (`../`, абсолютный) — цель отбрасывается: она печатает файл
 *   МОДУЛЯ, и запись куда-то ещё была бы обходом границы прав.
 *
 * @module plugins/codegen/pipeline/generate
 */

import {
  prepare,
  withFiles,
  acceptsMarker,
  buildView,
  renderTemplate,
  withLocal,
  withMarker,
  withViewFiles,
  type CodegenInput,
  type CodegenView,
  type EmitContext,
  type EmittedFileRef,
  type FileClass,
} from '@/lib/codegen';
import type { CodegenTarget } from '../contract';

/** Файл модуля вместе с тем, что доставке нужно знать о его происхождении. */
export interface ModuleFile {
  readonly path: string;
  readonly content: string;
  readonly cls: FileClass;
  /** `user`-файл, который производится из правил: перезаписывается, если его не правили. */
  readonly regenerable: boolean;
  /** Кто напечатал — для отчёта и диагностики. */
  readonly targetId: string;
  /**
   * Откуда цель приехала.
   *
   * Панели это нужно, чтобы сказать: `registry.ts` печатает ФАЙЛ ЧЕЛОВЕКА, а не наш.
   * Без пометки замена встроенной цели выглядела бы как её отсутствие.
   */
  readonly origin: 'builtin' | 'user' | 'plugin';
}

/** Отказ одной цели. Данные, а не исключение: генерация продолжается. */
export interface CodegenProblem {
  readonly targetId: string;
  readonly path: string;
  readonly reason:
    | 'threw'
    | 'duplicate-path'
    | 'escaping-path'
    | 'no-body'
    | 'both-bodies'
    /** Файл цели из проекта не разбирается: битый заголовок либо `applies`. */
    | 'template-invalid';
  readonly message: string;
}

export interface GeneratedModule {
  /** Имя каталога модуля — производное имени формы. */
  readonly dir: string;
  readonly files: readonly ModuleFile[];
  readonly problems: readonly CodegenProblem[];
  /** Контекст прогона: панель показывает по нему имена и селекторы. */
  readonly context: EmitContext;
  /**
   * Вид, который видели шаблоны, — тот самый `it`.
   *
   * Отдаётся наружу ради инспектора в панели: первый вопрос автора шаблона — «что лежит
   * в `it`?», и ответом не может быть «читай исходники». Собран один раз здесь, а не
   * пересобран панелью: второй вызов `buildView` дал бы ДРУГОЙ объект, и инспектор
   * показывал бы не то, чем печатали.
   */
  readonly view: CodegenView;
}

/** Форматирование: тексты в порядке входа. Без него файлы уезжают как напечатаны. */
export type Formatter = (
  files: readonly { path: string; content: string }[]
) => Promise<readonly string[]>;

/** Путь остаётся внутри каталога модуля. */
function isInsideModule(path: string): boolean {
  if (path === '' || path.startsWith('/') || path.includes('\\')) return false;
  return !path.split('/').some((segment) => segment === '..' || segment === '.' || segment === '');
}

/** Отобрать применимые цели, отбросив пути наружу и дубликаты. */
function selectTargets(
  targets: readonly CodegenTarget[],
  ctx: EmitContext
): { readonly selected: readonly CodegenTarget[]; readonly problems: readonly CodegenProblem[] } {
  const problems: CodegenProblem[] = [];
  const selected: CodegenTarget[] = [];
  const claimed = new Map<string, string>();

  for (const target of targets) {
    // Тело ровно одно. Предпочесть одно другому молча значило бы, что цель, объявившая оба,
    // работает — и её автор узнает о лишнем поле только когда правка в нём ничего не изменит.
    const hasEmit = target.emit !== undefined;
    const hasTemplate = target.template !== undefined;
    if (hasEmit === hasTemplate) {
      problems.push({
        targetId: target.id,
        path: target.path,
        reason: hasEmit ? 'both-bodies' : 'no-body',
        message: hasEmit
          ? 'цель объявила и emit, и template'
          : 'цель не объявила ни emit, ни template',
      });
      continue;
    }
    if (!isInsideModule(target.path)) {
      problems.push({
        targetId: target.id,
        path: target.path,
        reason: 'escaping-path',
        message: 'путь выходит за каталог модуля',
      });
      continue;
    }
    let applies = true;
    try {
      applies = target.applies === undefined ? true : target.applies(ctx);
    } catch (error) {
      problems.push({
        targetId: target.id,
        path: target.path,
        reason: 'threw',
        message: messageOf(error),
      });
      continue;
    }
    if (!applies) continue;

    const owner = claimed.get(target.path);
    if (owner !== undefined) {
      problems.push({
        targetId: target.id,
        path: target.path,
        reason: 'duplicate-path',
        message: `файл уже печатает цель «${owner}»`,
      });
      continue;
    }
    claimed.set(target.path, target.id);
    selected.push(target);
  }

  return { selected, problems };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Текст цели: напечатанный кодом или отрисованный шаблоном.
 *
 * Выбор уже сделан отбором — здесь его остаётся исполнить. Имя шаблона в кэше — это `id`
 * цели: оно уникально в пределах точки расширения по построению и попадает в сообщение
 * об ошибке, а значит человек видит, КАКОЙ шаблон сломался, а не только чем.
 */
function bodyOf(target: CodegenTarget, ctx: EmitContext, view: CodegenView): string {
  if (target.template !== undefined) {
    const local = target.view?.(ctx);
    const data = local === undefined ? view : withLocal(view, local);
    return renderTemplate(target.id, target.template, data);
  }
  if (target.emit !== undefined) return target.emit(ctx);
  // Недостижимо: цель без тела отвергается отбором. Бросок, а не пустая строка — молчаливый
  // пустой файл в модуле хуже названного отказа.
  throw new Error(`цель «${target.id}» без тела дошла до печати`);
}

/**
 * Напечатать модуль формы.
 *
 * Маркер происхождения ставится ЗДЕСЬ, после форматирования: он считается от тела файла, и если
 * отформатировать текст после маркера, хэш перестанет сходиться с телом — то есть первый же
 * повторный экспорт объявил бы наш собственный файл «правленным руками».
 */
export async function generateModule(
  targets: readonly CodegenTarget[],
  input: CodegenInput,
  format?: Formatter
): Promise<GeneratedModule> {
  const base = prepare(input);
  const { selected, problems } = selectTargets(targets, base);

  const refs: readonly EmittedFileRef[] = selected.map((t) => ({ path: t.path, cls: t.cls }));
  const ctx = withFiles(base, refs);
  // Вид для шаблонов собирается ОДИН раз на прогон и по тем же данным, что видит код:
  // два способа узнать состав модуля разошлись бы на первой же цели, читающей `files`.
  const view = withViewFiles(buildView(base), refs);

  const printed: ModuleFile[] = [];
  const emitProblems: CodegenProblem[] = [];
  for (const target of selected) {
    try {
      printed.push({
        path: target.path,
        content: bodyOf(target, ctx, view),
        cls: target.cls,
        regenerable: target.regenerable === true,
        targetId: target.id,
        origin: target.origin ?? 'builtin',
      });
    } catch (error) {
      emitProblems.push({
        targetId: target.id,
        path: target.path,
        reason: 'threw',
        message: messageOf(error),
      });
    }
  }

  const formatted = format === undefined ? null : await format(printed);
  const files = printed.map((file, index) => {
    const content = formatted?.[index] ?? file.content;
    // Маркер получают производные файлы и те авторские, что выводятся из правил. `api.ts`
    // и `data-sources.ts` его не получают: перевыводить их не из чего, и маркер обещал бы
    // перезапись, которой не будет.
    //
    // И только там, где строка `//` — комментарий: в `renderer.schema.json` она делала файл
    // неразбираемым, а читают его и редактор схемы билдера, и сгенерированный `index.tsx`.
    const wanted = file.cls === 'derived' || file.regenerable;
    const marked = wanted && acceptsMarker(file.path) ? withMarker(content) : content;
    return { ...file, content: marked };
  });

  return {
    dir: ctx.names.dir,
    files,
    problems: [...problems, ...emitProblems],
    context: ctx,
    view,
  };
}
