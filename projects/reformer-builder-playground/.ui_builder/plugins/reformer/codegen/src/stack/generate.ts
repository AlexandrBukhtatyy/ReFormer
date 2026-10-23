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
 * ## Путь цели — шаблон
 *
 * Модуль разложен по папкам ролей, и часть имён зависит от формы, поэтому путь цели — шаблон с
 * токенами ({@link PATH_TOKENS}): `{Type}.tsx`, `types/{dir}.ts`, `validation/{step}.ts`,
 * `{schemaDir}steps/{stepDir}/form.schema.json`. Токен стоит в ЛЮБОМ месте пути, не обязательно
 * целым сегментом. Те же токены действуют в заголовке пользовательского шаблона и в прежних
 * именах цели (`legacyPaths`).
 *
 * ## Цели — контракта SDK
 *
 * Цели приходят от хозяина генерации (свои, чужие, из проекта — заменённые уже сняты) типом SDK
 * `CodegenTarget`; печатает их здесь стек, его контекстом эмиссии. Цель из проекта несёт
 * применимость над ВИДОМ (`appliesView`) — её спрашивают тем видом, который увидел бы шаблон.
 *
 * @module plugins/reformer/codegen/stack/generate
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
  schemaDirOf,
  type StepInfo,
  type CodegenInput,
  type CodegenView,
  type EmitContext,
  type EmittedFileRef,
} from '../../../core/codegen';
import { acceptsMarker, renderTemplate, withMarker } from '@reformer/builder-toolkit';
import type {
  CodegenFile,
  CodegenFormatter,
  CodegenProblem,
  CodegenTarget as SdkTarget,
} from '@reformer/builder-plugin-api';

/** Цель стека: контекст эмиссии — ReFormer. */
export type CodegenTarget = SdkTarget<EmitContext>;

/** Файл модуля — тот, что уходит хозяину на запись. */
export type ModuleFile = CodegenFile;

export type { CodegenProblem };

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
export type Formatter = CodegenFormatter;

/** Путь остаётся внутри каталога модуля. */
function isInsideModule(path: string): boolean {
  if (path === '' || path.startsWith('/') || path.includes('\\')) return false;
  return !path.split('/').some((segment) => segment === '..' || segment === '.' || segment === '');
}

/**
 * Токены шаблона пути цели и что на их место встаёт.
 *
 * | токен         | значение                                                              |
 * | ------------- | --------------------------------------------------------------------- |
 * | `{Type}`      | тип формы — `LoanApplicationForm`                                     |
 * | `{dir}`       | kebab-имя формы — `loan-application`                                  |
 * | `{schema}`    | путь корневого документа в модуле — `schema/form.schema.json`         |
 * | `{schemaDir}` | его каталог с завершающим `/` либо пусто (документ в корне модуля)    |
 * | `{step}`      | имя шага в путях кода — `kontakty` (только у цели `each: 'step'`)     |
 * | `{stepDir}`   | папка схемы шага — почти всегда то же, что `{step}` (только у `each`) |
 *
 * `{step}` и `{stepDir}` расходятся в одном случае: шаг вынесен в папку с занятым именем
 * (`steps/form/`), и его код получает разведённое имя (`validation/form-2.ts`) — см. раскладку
 * шагов в `core/codegen/steps`.
 */
export const PATH_TOKENS: readonly string[] = Object.freeze([
  'Type',
  'dir',
  'schema',
  'schemaDir',
  'step',
  'stepDir',
]);

/** Токены, у которых есть значение только для шага. */
const STEP_TOKENS: ReadonlySet<string> = new Set(['step', 'stepDir']);

/** Токен в шаблоне пути: `{имя}`. */
const TOKEN = /\{([^{}/]*)\}/g;

/** Имена токенов шаблона пути, в порядке появления. */
function tokensOf(pattern: string): readonly string[] {
  return [...pattern.matchAll(TOKEN)].map((match) => match[1] ?? '');
}

/** Подставить токены в шаблон пути. Неизвестный токен остаётся как есть — его называет отбор. */
function expandPath(pattern: string, ctx: EmitContext, step?: StepInfo): string {
  const schema = ctx.paths.schema;
  return pattern.replace(TOKEN, (whole: string, name: string) => {
    switch (name) {
      case 'Type':
        return ctx.names.TypeName;
      case 'dir':
        return ctx.names.dir;
      case 'schema':
        return schema;
      case 'schemaDir':
        return schemaDirOf(schema);
      case 'step':
        return step?.slug ?? whole;
      case 'stepDir':
        return step?.dir ?? whole;
      default:
        return whole;
    }
  });
}

/** Экземпляр цели: сама цель, фактический путь и шаг, если цель размножена. */
interface TargetInstance {
  readonly target: CodegenTarget;
  readonly path: string;
  readonly step?: StepInfo;
}

/**
 * Шаблон пути корректен: токены известны, у `each`-цели есть токен шага (иначе все её
 * экземпляры легли бы в один файл), у прочих — ни одного.
 */
function patternProblem(target: CodegenTarget): string | null {
  const tokens = [target.path, ...(target.legacyPaths ?? [])].flatMap(tokensOf);
  const unknown = tokens.find((name) => !PATH_TOKENS.includes(name));
  if (unknown !== undefined) {
    const known = PATH_TOKENS.map((name) => `{${name}}`).join(', ');
    return `неизвестный токен {${unknown}} в пути; известные: ${known}`;
  }
  if (target.each === 'step') {
    return tokensOf(target.path).some((name) => STEP_TOKENS.has(name))
      ? null
      : 'шаблон пути обязан содержать токен шага: {step} либо {stepDir}';
  }
  return tokens.some((name) => STEP_TOKENS.has(name))
    ? 'токены {step} и {stepDir} допустимы только у цели с each: step'
    : null;
}

/** Раскрыть цель в экземпляры: одна цель — один путь, `each`-цель — путь на шаг. */
function instancesOf(target: CodegenTarget, ctx: EmitContext): readonly TargetInstance[] {
  if (target.each !== 'step') return [{ target, path: expandPath(target.path, ctx) }];
  return ctx.layout.steps.map((step) => ({
    target,
    path: expandPath(target.path, ctx, step),
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
        applies =
          (target.applies === undefined || target.applies(at)) &&
          (target.appliesView === undefined || target.appliesView(buildView(at)));
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
        legacyPaths: (target.legacyPaths ?? []).map((path) => expandPath(path, ctx, instance.step)),
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
    // Маркер получают производные файлы и те авторские, что выводятся из правил. Отправка,
    // запросы и константы источников его не получают: перевыводить их не из чего, и маркер
    // обещал бы перезапись, которой не будет.
    //
    // И только там, где строка `//` — комментарий: в `form.schema.json` она делала файл
    // неразбираемым, а читают его и редактор схемы билдера, и сборка формы.
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
