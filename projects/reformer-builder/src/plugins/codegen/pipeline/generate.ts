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
  withStep,
  buildView,
  withLocal,
  withViewFiles,
  withStepView,
  stepView,
  type StepInfo,
  type CodegenInput,
  type CodegenView,
  type EmitContext,
  type EmittedFileRef,
  type FileClass,
} from '@reformer/builder-stack-reformer/codegen';
import { acceptsMarker, renderTemplate, withMarker } from '@reformer/builder-toolkit';
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
  /** Номер шага визарда (с единицы) у файлов, размноженных по шагам. */
  readonly step?: number;
  /** Прежние имена этого файла — для переноса правленного под старым именем. */
  readonly legacyPaths?: readonly string[];
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
    /** Шаблон пути у цели `each` без сегмента `{step}` либо `{step}` у цели без `each`. */
    | 'bad-pattern'
    /** Файл цели из проекта не разбирается: битый заголовок либо `applies`. */
    | 'template-invalid'
    /**
     * Цель заменяет встроенную, но печатает под ДРУГИМ путём (обычно — прежним,
     * `renderer.behavior.ts`). Предупреждение, а не отказ: файл печатается, но модуль
     * импортирует уже новое имя. Ставит `overrideDrift` из `./user-targets`.
     */
    | 'override-path-drift';
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

/** Сегмент пути, на место которого встаёт имя папки шага. */
const STEP_SEGMENT = '{step}';

/** Экземпляр цели: сама цель, фактический путь и шаг, если цель размножена. */
interface TargetInstance {
  readonly target: CodegenTarget;
  readonly path: string;
  readonly step?: StepInfo;
}

/** Шаблон пути корректен: у `each`-цели ровно один сегмент `{step}`, у прочих — ни одного. */
function patternProblem(target: CodegenTarget): string | null {
  const segments = target.path.split('/').filter((segment) => segment === STEP_SEGMENT).length;
  const inline = target.path.split(STEP_SEGMENT).length - 1;
  if (target.each === 'step') {
    return segments === 1 && inline === 1
      ? null
      : 'шаблон пути обязан содержать ровно один сегмент {step}';
  }
  return inline > 0 ? 'сегмент {step} допустим только у цели с each: step' : null;
}

/** Раскрыть цель в экземпляры: одна цель — один путь, `each`-цель — путь на шаг. */
function instancesOf(target: CodegenTarget, ctx: EmitContext): readonly TargetInstance[] {
  if (target.each !== 'step') return [{ target, path: target.path }];
  return ctx.layout.steps.map((step) => ({
    target,
    path: target.path.split(STEP_SEGMENT).join(step.dir),
    step,
  }));
}

/** Отобрать применимые цели, раскрыть их по шагам, отбросив пути наружу и дубликаты. */
function selectTargets(
  targets: readonly CodegenTarget[],
  ctx: EmitContext
): { readonly selected: readonly TargetInstance[]; readonly problems: readonly CodegenProblem[] } {
  const problems: CodegenProblem[] = [];
  const selected: TargetInstance[] = [];
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
    const pattern = patternProblem(target);
    if (pattern !== null) {
      problems.push({
        targetId: target.id,
        path: target.path,
        reason: 'bad-pattern',
        message: pattern,
      });
      continue;
    }
    // Путь и дубли проверяются на КАЖДОМ экземпляре: имя папки шага приходит из схемы, и шаблон,
    // безопасный на вид, после подстановки мог бы выйти за каталог или столкнуться с соседом.
    // Применимость — тоже: у цели шага её спрашивают про шаг (схема есть не у каждого шага).
    for (const instance of instancesOf(target, ctx)) {
      let applies = true;
      try {
        const at = instance.step === undefined ? ctx : withStep(ctx, instance.step);
        applies = target.applies === undefined ? true : target.applies(at);
      } catch (error) {
        problems.push({
          targetId: target.id,
          path: instance.path,
          reason: 'threw',
          message: messageOf(error),
        });
        continue;
      }
      if (!applies) continue;
      if (!isInsideModule(instance.path)) {
        problems.push({
          targetId: target.id,
          path: instance.path,
          reason: 'escaping-path',
          message: 'путь выходит за каталог модуля',
        });
        continue;
      }
      const owner = claimed.get(instance.path);
      if (owner !== undefined) {
        problems.push({
          targetId: target.id,
          path: instance.path,
          reason: 'duplicate-path',
          message: `файл уже печатает цель «${owner}»`,
        });
        continue;
      }
      claimed.set(instance.path, target.id);
      selected.push(instance);
    }
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
function bodyOf(instance: TargetInstance, base: EmitContext, baseView: CodegenView): string {
  const { target, step } = instance;
  const ctx = step === undefined ? base : withStep(base, step);
  if (target.template !== undefined) {
    const view = step === undefined ? baseView : withStepView(baseView, stepView(ctx, step));
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

  const refs: readonly EmittedFileRef[] = selected.map((instance) => ({
    path: instance.path,
    cls: instance.target.cls,
    ...(instance.step === undefined ? {} : { step: instance.step.index }),
  }));
  const ctx = withFiles(base, refs);
  // Вид для шаблонов собирается ОДИН раз на прогон и по тем же данным, что видит код:
  // два способа узнать состав модуля разошлись бы на первой же цели, читающей `files`.
  const view = withViewFiles(buildView(base), refs);

  const printed: ModuleFile[] = [];
  const emitProblems: CodegenProblem[] = [];
  for (const instance of selected) {
    const { target } = instance;
    try {
      printed.push({
        path: instance.path,
        content: bodyOf(instance, ctx, view),
        cls: target.cls,
        regenerable: target.regenerable === true,
        targetId: target.id,
        ...(instance.step === undefined ? {} : { step: instance.step.index }),
        legacyPaths: target.legacyPaths ?? [],
        origin: target.origin ?? 'builtin',
      });
    } catch (error) {
      emitProblems.push({
        targetId: target.id,
        path: instance.path,
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
    // И только там, где строка `//` — комментарий: в `form.schema.json` она делала файл
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
