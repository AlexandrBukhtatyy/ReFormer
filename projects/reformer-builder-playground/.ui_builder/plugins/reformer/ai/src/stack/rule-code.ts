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
 * ## Объём записи — гибрид
 *
 * Код у модуля уже есть (`validation/form.ts`) — ход пишет только файлы правил
 * (`GenerateRequest.only`): производные файлы обновляет «Сгенерировать код», и правка правила не
 * должна молча перепечатывать страницу. Кода нет — генерируется модуль целиком: файлам правил без
 * модуля не на чем стоять.
 *
 * ## Отмена созданного файла правил
 *
 * Удаления у плагинов нет, и созданный ходом файл отмена оставляет. Для файла правил это значило
 * бы, что правила хода пережили отмену: следующий ход прочёл бы их из кода. Поэтому «до хода» у
 * созданного файла правил — не пустота, а текст без правил хода: у модуля без кода — печать
 * генерации с правилами на начало хода (сухой прогон, он ничего не пишет), у модуля с кодом —
 * заглушка файла шага без правил.
 *
 * @module plugins/reformer/ai/stack/rule-code
 */

import type {
  FormLandedCompanion,
  FormStackFiles,
  FormWriteMark,
  ModuleGeneratorService,
  ResourceId,
} from '@reformer/builder-plugin-api';
import { pathWithin } from '@reformer/builder-toolkit';
import {
  FORM_RULES_NAME,
  legacyRulesNameOf,
  MESSAGES_NAME,
  moduleRootOfDocument,
  VALIDATION_DIR,
} from '../../../core/codegen/layout';
import { parseRulesText } from '../../../core/codegen/rules-file';
import {
  isRuleCodePath,
  loadRulesFromModule,
  lockedRuleFiles,
  normalizeRules,
  RULE_TARGET_IDS,
  ruleFileTombstone,
  rulesStackInput,
} from '../../../core/codegen/rules-code';
import { hasRules, type FormRules } from '../../../core/form-model';
import type { RulesLock, RulesRefusal } from '../model/types';

/** Файл правил формы — по нему видно, что код модуля уже генерировали. */
const FORM_RULES_FILE = `${VALIDATION_DIR}/${FORM_RULES_NAME}.ts`;
const MESSAGES_FILE = `${VALIDATION_DIR}/${MESSAGES_NAME}.ts`;
const BEHAVIOR_FILE = 'behavior/index.ts';

/** Отказ записи сухого прогона: он только печатает. */
const DRY_RUN = 'dry run';

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
export interface RuleWriteRequest {
  readonly document: ResourceId;
  readonly base: RuleCodeBase;
  readonly rules: FormRules;
  /**
   * Правила на начало хода: из них печатается «до» созданного файла правил у модуля без кода.
   * Нет — запись не отменяют («Восстановить»), и печатать «до» незачем.
   */
  readonly before?: FormRules;
  /** Пометка записей хода; нет — запись заказал человек. */
  readonly mark?: FormWriteMark;
}

/** Чем кончилась запись правил. */
export interface RuleWriteOutcome {
  /** Записанные файлы — сопутствующие файлы хода. */
  readonly companions: readonly FormLandedCompanion[];
  /** Правила легли не все: почему и в каком файле. */
  readonly problem?: { readonly id: ResourceId; readonly error: string };
}

/** Записать правила формы в код её модуля — генерацией кода. Ничего не бросает. */
export async function writeRuleCode(
  deps: RuleWriteDeps,
  request: RuleWriteRequest
): Promise<RuleWriteOutcome> {
  const { files, generator } = deps;
  const { base, document } = request;
  const at = (path: string) => files.resolve(base.root, ...path.split('/'));
  const relOf = (id: ResourceId) => pathWithin(files.pathOf(id), base.rootPath);
  const isRuleFile = (id: ResourceId) => {
    const rel = relOf(id);
    return rel !== null && isRuleCodePath(rel);
  };
  const only = base.hasCode ? { only: RULE_TARGET_IDS } : {};

  // Сухой прогон — до настоящего: открытая панель экспорта показывает последний прогон, и им
  // должен быть тот, что записал.
  const printedBefore = new Map<ResourceId, string>();
  if (!base.hasCode && request.before !== undefined) {
    await generator.generate(document, {
      write: async (id, text) => {
        if (isRuleFile(id)) printedBefore.set(id, text);
        return DRY_RUN;
      },
      stackInput: rulesStackInput(request.before),
    });
  }
  const createdBefore = (id: ResourceId): string | null => {
    const printed = printedBefore.get(id);
    if (printed !== undefined) return printed;
    const rel = relOf(id);
    return rel !== null &&
      rel.startsWith(`${VALIDATION_DIR}/`) &&
      isRuleCodePath(rel) &&
      rel !== MESSAGES_FILE
      ? ruleFileTombstone(rel)
      : null;
  };

  const companions: FormLandedCompanion[] = [];
  const report = await generator.generate(document, {
    write: async (id, text) => {
      const refused = deps.refuse(id);
      if (refused !== null) return refused;
      const was = await files.read(id);
      await files.write(id, text, request.mark);
      companions.push({ id, before: was ?? createdBefore(id), after: text });
      return null;
    },
    stackInput: rulesStackInput(request.rules),
    ...only,
  });
  if (!report.ok)
    return { companions, problem: { id: at(FORM_RULES_FILE), error: report.message } };

  const failed = report.failed.find((file) => isRuleCodePath(file.path));
  if (failed !== undefined) {
    return { companions, problem: { id: at(failed.path), error: failed.message } };
  }
  // Правленный руками файл правил генерация не перепечатывает — правила хода в нём не легли.
  // Пропуск словаря и констант (`authored`) — не отказ: их правят точечно, и пропущены они,
  // когда править в них нечего.
  const kept = report.skipped.find((file) => file.reason === 'edited' && isRuleCodePath(file.path));
  if (kept !== undefined) {
    return {
      companions,
      problem: {
        id: at(kept.path),
        error: 'the file was edited by hand, code generation keeps it',
      },
    };
  }
  return { companions };
}
