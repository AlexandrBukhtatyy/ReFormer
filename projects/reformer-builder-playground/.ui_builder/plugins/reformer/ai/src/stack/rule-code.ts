/**
 * Правила формы глазами хода: на начало хода — из кода модуля, в конце — генерацией кода.
 *
 * Правила живут в коде модуля формы (`core/codegen/rules-code`): валидация — в `validation/*.ts`,
 * поведение и правила узлов — в `behavior/index.ts`, тексты замечаний — в словаре, значения
 * источников — в константах. Ход читает их оттуда каждый раз заново: их правят и мимо
 * ассистента — руками, режимом файлов, генерацией.
 *
 * Пишет их не ход, а генерация кода (`ModuleGeneratorCapability`): ход заказывает у неё печать с
 * правилами черновика (`stackInput`) своей дверью записи, с пометкой хода, — и записанное
 * становится сопутствующими файлами хода: отмена вернёт их вместе с формой. Своего принтера
 * правил у хода нет намеренно: второй принтер разошёлся бы с генерацией, и следующая генерация
 * переписала бы файлы правил по-своему.
 *
 * ## Объём записи — модуль целиком
 *
 * После хода, изменившего форму, генерация печатает модуль ЦЕЛИКОМ, а не только файлы правил:
 * производные файлы (`create.ts`, поток шагов, реестр, типы, модель) зависят от схемы, и модуль,
 * в котором обновлены одни правила, собирался бы из устаревших частей — новый шаг визарда ронял
 * приложение. Авторские файлы генерация правит точечно, правленные руками не трогает; файлы с
 * тем же текстом не пишутся вовсе.
 *
 * ## Отмена созданных файлов
 *
 * Удаления у плагинов нет, и созданный ходом файл отмена оставляет. Чтобы правила хода не пережили
 * отмену (следующий ход прочёл бы их из кода), стек после отмены и «Восстановить» печатает модуль
 * заново — с правилами снимка (`./structured`, `rewind`). Поэтому «до хода» у созданного файла —
 * честная пустота, и сухой прогон ради неё не нужен.
 *
 * @module plugins/reformer/ai/stack/rule-code
 */

import type {
  FormLandCode,
  FormLandedCompanion,
  FormStackFiles,
  FormWriteMark,
  GenerateReport,
  ModuleGeneratorService,
  ResourceId,
} from '@reformer/builder-plugin-api';
import {
  FORM_RULES_NAME,
  legacyRulesNameOf,
  moduleRootOfDocument,
  VALIDATION_DIR,
} from '../../../core/codegen/layout';
import { parseRulesText } from '../../../core/codegen/rules-file';
import {
  isRuleCodePath,
  loadRulesFromModule,
  lockedRuleFiles,
  normalizeRules,
  rulesStackInput,
} from '../../../core/codegen/rules-code';
import { hasRules, type FormRules } from '../../../core/form-model';
import type { RulesLock, RulesRefusal } from '../model/types';

/** Файл правил формы — по нему видно, что код модуля уже генерировали. */
const FORM_RULES_FILE = `${VALIDATION_DIR}/${FORM_RULES_NAME}.ts`;
const BEHAVIOR_FILE = 'behavior/index.ts';

/** Код правил модуля на начало хода: с чем сверять расхождение и как писать. */
export interface RuleCodeBase {
  /** Корень модуля формы. */
  readonly root: ResourceId;
  /** Путь корня модуля от корня проекта. */
  readonly rootPath: string;
  /** Тексты файлов правил, прочитанных на начало хода; `null` — файла не было. */
  readonly texts: ReadonlyMap<ResourceId, string | null>;
  /** Код модуля уже генерировали: есть файл правил формы. */
  readonly hasCode: boolean;
  /** Файлы правил, правленные руками или написанные человеком, — пути от корня модуля. */
  readonly locked: readonly string[];
}

/** Прочитанный код правил: база и правила формы. */
export interface RuleCodeRead extends RuleCodeBase {
  readonly rules: FormRules;
}

/** Правила одни и те же — в канонической форме, в которой их возвращает чтение кода. */
export function sameRules(a: FormRules, b: FormRules): boolean {
  return JSON.stringify(normalizeRules(a)) === JSON.stringify(normalizeRules(b));
}

/**
 * Прочитать правила формы из кода её модуля.
 *
 * В коде правил нет, а рядом с документом лежит прежний файл правил (`form.rules.json`) — правила
 * хода начинаются с него, как и у генерации: иначе первая же запись правил кодом потеряла бы их.
 */
export async function readRuleCode(
  files: FormStackFiles,
  document: ResourceId,
  documentPath: string
): Promise<RuleCodeRead> {
  const root = moduleRootOfDocument(files, document, documentPath);
  const at = (path: string) => files.resolve(root, ...path.split('/'));
  const texts = new Map<ResourceId, string | null>();
  const code = await loadRulesFromModule(
    {
      read: async (path) => {
        const id = at(path);
        const text = await files.read(id).catch(() => null);
        texts.set(id, text);
        return text;
      },
      list: async (dir) => {
        const entries = await files.list(at(dir)).catch(() => null);
        return entries === null
          ? null
          : entries.filter((entry) => entry.kind !== 'directory').map((entry) => entry.name);
      },
    },
    { validation: [FORM_RULES_FILE] }
  );
  const base: RuleCodeBase = {
    root,
    rootPath: files.pathOf(root),
    texts,
    hasCode: typeof texts.get(at(FORM_RULES_FILE)) === 'string',
    locked: lockedRuleFiles(code).map((file) => file.path),
  };
  const { validation, behavior, render } = code.rules;
  if (validation.length + behavior.length + render.length === 0) {
    const legacy = await legacyRulesOf(files, document, documentPath);
    if (legacy !== null) return { ...base, rules: legacy };
  }
  return { ...base, rules: code.rules };
}

/** Правила прежнего файла правил рядом с документом; нет, битый или пустой — `null`. */
async function legacyRulesOf(
  files: Pick<FormStackFiles, 'read' | 'resolve' | 'parentOf'>,
  document: ResourceId,
  documentPath: string
): Promise<FormRules | null> {
  const id = files.resolve(files.parentOf(document), legacyRulesNameOf(documentPath));
  const text = await files.read(id).catch(() => null);
  if (text === null) return null;
  const parsed = parseRulesText(text);
  return parsed.ok && hasRules(parsed.rules) ? parsed.rules : null;
}

/** Не правили ли файлы правил с начала хода. */
export async function ruleFilesUnchanged(
  files: Pick<FormStackFiles, 'read'>,
  base: RuleCodeBase
): Promise<boolean> {
  for (const [id, text] of base.texts) {
    if ((await files.read(id).catch(() => null)) !== text) return false;
  }
  return true;
}

/**
 * Какие правила ход не сможет записать: инструменты правил отказывают в них сразу, а не тем, что
 * правила тихо не лягут в конце хода.
 *
 * @param generator - Есть ли генерация кода: без неё правила записать нечем.
 */
export function rulesLockOf(base: RuleCodeBase, generator: boolean): RulesLock | undefined {
  if (!generator) {
    const refusal: RulesRefusal = {
      code: 'UNAVAILABLE',
      message:
        'Form rules live in the module code and are written by code generation, which is not ' +
        'available in this builder: rules cannot be changed here.',
    };
    return { validation: refusal, behavior: refusal, dataSources: refusal };
  }
  const edited = (paths: readonly string[]): RulesRefusal | undefined =>
    paths.length === 0
      ? undefined
      : {
          code: 'REFUSED',
          message:
            `${paths.join(', ')} ${paths.length === 1 ? 'was' : 'were'} edited by hand, so code ` +
            'generation no longer rewrites it: these rules can be changed only by editing the ' +
            'file itself. Tell the user.',
        };
  const validation = edited(base.locked.filter((path) => path.startsWith(`${VALIDATION_DIR}/`)));
  const behavior = edited(base.locked.filter((path) => path === BEHAVIOR_FILE));
  if (validation === undefined && behavior === undefined) return undefined;
  return {
    ...(validation === undefined ? {} : { validation }),
    ...(behavior === undefined ? {} : { behavior }),
  };
}

/** Что нужно записи правил. */
export interface RuleWriteDeps {
  readonly files: FormStackFiles;
  readonly generator: ModuleGeneratorService;
  /**
   * Почему генерации нельзя писать этот файл: документ формы и его шаги ход правит своим
   * механизмом. `null` — можно.
   */
  readonly refuse: (id: ResourceId) => string | null;
}

/** Что записать. */
export interface ModuleWriteRequest {
  readonly document: ResourceId;
  readonly base: RuleCodeBase;
  readonly rules: FormRules;
  /**
   * Правила ход поменял. Только тогда правленный руками файл правил — отказ: правила хода в нём
   * не легли. Без новых правил генерация такой файл и не должна трогать.
   */
  readonly rulesChanged: boolean;
  /** Пометка записей хода; нет — запись заказал человек. */
  readonly mark?: FormWriteMark;
}

/** Чем кончилась запись модуля. */
export interface ModuleWriteOutcome {
  /** Записанные файлы — сопутствующие файлы хода. */
  readonly companions: readonly FormLandedCompanion[];
  /** Что напечатала генерация; нет — она отказала целиком. */
  readonly code?: FormLandCode;
  /** Правила легли не все: почему и в каком файле. */
  readonly problem?: { readonly id: ResourceId; readonly error: string };
}

/** Напечатать модуль формы с правилами `request.rules` — генерацией, целиком. Ничего не бросает. */
export async function writeModuleCode(
  deps: RuleWriteDeps,
  request: ModuleWriteRequest
): Promise<ModuleWriteOutcome> {
  const { files, generator } = deps;
  const { base, document } = request;
  const at = (path: string) => files.resolve(base.root, ...path.split('/'));

  const companions: FormLandedCompanion[] = [];
  let report: GenerateReport;
  try {
    report = await generator.generate(document, {
      write: async (id, text) => {
        const refused = deps.refuse(id);
        if (refused !== null) return refused;
        const was = await files.read(id).catch(() => null);
        // Тот же текст не пишется и в сопутствующие не идёт: отменять в нём нечего, а запись без
        // перемены — лишняя пересборка превью. После хода таких файлов большинство.
        if (was === text) return null;
        await files.write(id, text, request.mark);
        companions.push({ id, before: was, after: text });
        return null;
      },
      stackInput: rulesStackInput(request.rules),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { companions, problem: { id: at(FORM_RULES_FILE), error: message } };
  }
  if (!report.ok)
    return { companions, problem: { id: at(FORM_RULES_FILE), error: report.message } };

  const code: FormLandCode = {
    dir: report.dir,
    written: companions.length,
    kept: report.skipped.filter((file) => file.reason === 'edited').map((file) => file.path),
  };
  for (const file of report.failed.filter((failed) => !isRuleCodePath(failed.path))) {
    console.warn(
      `[plugins/reformer/ai] генерация после хода не записала ${file.path}: ${file.message}`
    );
  }
  const failed = report.failed.find((file) => isRuleCodePath(file.path));
  if (failed !== undefined) {
    return { companions, code, problem: { id: at(failed.path), error: failed.message } };
  }
  // Правленный руками файл правил генерация не перепечатывает — правила хода в нём не легли.
  // Пропуск словаря и констант (`authored`) — не отказ: их правят точечно, и пропущены они,
  // когда править в них нечего.
  const kept = request.rulesChanged
    ? report.skipped.find((file) => file.reason === 'edited' && isRuleCodePath(file.path))
    : undefined;
  if (kept !== undefined) {
    return {
      companions,
      code,
      problem: {
        id: at(kept.path),
        error: 'the file was edited by hand, code generation keeps it',
      },
    };
  }
  return { companions, code };
}
