/**
 * Судья intent: один вердикт для `form_build`, `validate_form kind="bundle"` и ассистента билдера.
 *
 * Раньше каждый потребитель судил intent по-своему. `form_build` читал его через `readIntent`, а
 * `validate_form kind="bundle"` — через `normalizeIntent` и падал `-32603` на полях-словаре; одно
 * уходило ошибкой, другое предупреждением, которое тонуло (аудит 2026-11, B2, B4, B5). Здесь одна
 * цепочка — чтение, окружение, сборка, кросс-проверка, размещение, тексты, компоненты, таргет, — и
 * вердикт у всех потребителей один. Документу формы (`forDocument`) судья добавляет то, чего
 * документ не держит (`./document`).
 *
 * Чего судья не делает: не проверяет типы (это работа компилятора в `form_build`) и не пишет диск.
 *
 * @module reformer-mcp/core/generate/judge
 */

import { buildBundle, collectUsedComponents, isLostMessageWarning } from './builders.js';
import type { FormCatalogs } from './catalogs.js';
import {
  BUILTIN_COMPONENTS,
  crossCheckBundle,
  inspectLayoutRefs,
  type CrossCheckCode,
} from './cross-check.js';
import { documentCapabilities } from './document.js';
import {
  readIntent,
  type FormIntent,
  type IntentProblemCode,
  type IntentWarningCode,
} from './form-intent.js';
import { nearestKey } from './intent-messages.js';
import { buildFormSchemaJson } from './schema-emit.js';
import { checkComponentProps } from './ui-kit-props.js';

/** Код находки судьи: проблема чтения, код кросс-проверки или своя проверка судьи. */
export type JudgeCode =
  | IntentProblemCode
  | CrossCheckCode
  /** Поле или массив объявлены, но не стоят в раскладке: модель их знает, пользователь не увидит. */
  | 'unplaced'
  /** У кода замечания нет своего текста либо их два. */
  | 'lost-message'
  /** Компонента нет в ките. */
  | 'unknown-component'
  /** Окружение не даёт собрать модуль: нет индекса ядра или каталога кита. */
  | 'environment'
  /** Правило, которое выбранный таргет не исполняет: видимость и правила узлов на core. */
  | 'not-on-target'
  /** Записи, которым в документе формы нет места: код модуля (`./document`). */
  | 'not-in-document';

/** Код предупреждения судьи: заметка чтения, кросс-проверки, сборки или свойств компонента. */
export type JudgeWarningCode =
  | IntentWarningCode
  | CrossCheckCode
  | 'module-note'
  | 'component-props'
  /** Документ формы этого не сохранит: начальные значения, справочник без значений. */
  | 'not-kept';

export interface JudgeFinding<C extends string = JudgeCode> {
  code: C;
  message: string;
  /** Место в intent (`fields[2].lable`), когда оно известно. */
  at?: string;
  /** Что сделать либо что ожидается. */
  hint?: string;
}

export interface JudgeOptions {
  /**
   * Судить документ билдера, а не модуль: без требований к окружению модуля, без правил таргета и
   * без заметок о печати модуля.
   */
  forDocument?: boolean;
  /** Схема, присланная на сверку (`validate_form`). Без неё — схема, собранная из intent. */
  schema?: unknown;
  /** Ключи реестра компонентов — для сверки присланной схемы (C2). */
  componentNames?: string[];
  /** Ключи реестра справочников. */
  dataSourceNames?: string[];
  /**
   * Требовать окружение модуля: индекс ядра и каталог кита (по умолчанию — да). `validate_form` модуль
   * не собирает и без них лишь не сверяет имена — об этом он говорит сам.
   */
  requireEnvironment?: boolean;
}

export interface IntentVerdict {
  /** Ошибок нет: модуль собирается. */
  ok: boolean;
  /** Прочитанный intent — и при ошибках: потребитель показывает, что из него понято. */
  intent: FormIntent;
  errors: JudgeFinding[];
  warnings: JudgeFinding<JudgeWarningCode>[];
  /** Сборка модуля: файлы, их заметки и схема. Есть, когда судили модуль и intent прочитан. */
  bundle?: ReturnType<typeof buildBundle>;
}

/**
 * Окружение модуля: без индекса ядра правила и импорты сверять не с чем, и проверка импортов
 * бракует собственный вывод сборки (B3); без каталога кита компоненты нечем импортировать.
 */
function environmentErrors(catalogs: FormCatalogs): JudgeFinding[] {
  const errors: JudgeFinding[] = [];
  if (!catalogs.core.found) {
    errors.push({
      code: 'environment',
      message:
        'the index of @reformer/core is not found — rules and imports cannot be checked, and the ' +
        'build would reject its own output',
      hint: 'install @reformer/core in the project; what the server found: resource reformer://status',
    });
  }
  if (!catalogs.uiKit.found) {
    errors.push({
      code: 'environment',
      message:
        'the catalog of @reformer/ui-kit is not found — the form components cannot be imported',
      hint: 'install @reformer/ui-kit in the project; what the server found: resource reformer://status',
    });
  }
  return errors;
}

/** Компоненты intent, которых нет в ките, — с ближайшим именем кита. */
function unknownComponents(
  intent: FormIntent,
  catalogs: FormCatalogs,
  forDocument: boolean
): JudgeFinding[] {
  if (!catalogs.uiKit.found) return [];
  const kit = Object.keys(catalogs.uiKit.exports);
  const known = new Set([...kit, ...BUILTIN_COMPONENTS]);
  const names = new Map(kit.map((name) => [name, name]));
  return [...collectUsedComponents(intent)]
    .filter((name) => !known.has(name))
    .sort()
    .map((name) => {
      const near = nearestKey(name, names);
      return {
        code: 'unknown-component' as const,
        message:
          `the component \`${name}\` is not in @reformer/ui-kit` +
          (near ? ` — did you mean \`${near}\`?` : ''),
        // Перечень — раздел `## components` грамматики. Раньше подсказка вела в грамматику, где были
        // одни поля, и контейнер модель угадывала заново (ReFormer-11oe.15). У билдера form_build нет.
        hint: forDocument
          ? 'a component of the kit: ## components of the grammar lists them by purpose'
          : 'a component of @reformer/ui-kit: form_build {"grammar":"components"} lists them by purpose',
      };
    });
}

/**
 * Правила слоя рендера на core: разметку там рисует JSX агента, и видимость с правилами узлов
 * сборке исполнить нечем. Раньше они пропускались предупреждением, которое тонуло, и форма теряла
 * условия молча (B5).
 */
function coreRenderRules(intent: FormIntent): JudgeFinding[] {
  const errors: JudgeFinding[] = [];
  if (intent.visibility.length > 0) {
    errors.push({
      code: 'not-on-target',
      at: 'visibility',
      message:
        `visibility rules: ${intent.visibility.length} — on the core target your JSX draws the ` +
        'form, so the build has nothing to hide them with',
      hint:
        'write the condition in the JSX of index.tsx — {model.loanType === "mortgage" && ' +
        '<FormField control={bundle.form.propertyValue} />} — and remove `visibility` from the ' +
        'intent; or build for renderer-react',
    });
  }
  const nodes = intent.nodes ?? [];
  if (nodes.length > 0) {
    const kinds = [...new Set(nodes.map((rule) => rule.kind))].join(', ');
    errors.push({
      code: 'not-on-target',
      at: 'behavior',
      message:
        `node rules (${kinds}): ${nodes.length} — a renderer runs them, and on the core target ` +
        'there is none',
      hint:
        'write the handlers in the JSX of index.tsx and remove these behavior records; or build ' +
        'for renderer-react',
    });
  }
  return errors;
}

/**
 * Предупреждения, которые смысла формы не меняют: запись приведена к канону, а прочитано то, что
 * имелось в виду. Они идут после меняющих смысл — подставленного типа или компонента, выброшенной
 * записи, переписанной связи, — которые иначе тонули среди переименований ключей.
 */
const COSMETIC_WARNINGS: ReadonlySet<string> = new Set<JudgeWarningCode>([
  'consumer',
  'intent-string',
  'keys-renamed',
  'list-as-map',
  'layout-as-list',
  'bare-refs',
  'intent-as-node',
  'step-as-key',
  'steps-as-object',
  'inline-fields',
  'inline-arrays',
  'inline-merged',
  'rules-in-fields',
  'rules-on-fields',
  'rule-empty-dropped',
  'required-lifted',
  'array-as-field',
  'item-interface-default',
  'initial-value-default',
  'prop-lifted',
  'value-coerced',
  'each-lifted',
]);

/** Предупреждения по важности: меняющие смысл — первыми, порядок внутри группы сохраняется. */
export function rankWarnings<W extends { code: string }>(warnings: readonly W[]): W[] {
  return [
    ...warnings.filter((warning) => !COSMETIC_WARNINGS.has(warning.code)),
    ...warnings.filter((warning) => COSMETIC_WARNINGS.has(warning.code)),
  ];
}

/** Вынести вердикт intent. Не бросает: всё, что не так, — находками. */
export function judgeIntent(
  raw: unknown,
  catalogs: FormCatalogs,
  options: JudgeOptions = {}
): IntentVerdict {
  const reading = readIntent(raw, {
    uiKit: catalogs.uiKit,
    uiKitProps: catalogs.uiKitProps,
    ...(options.forDocument ? { forDocument: true } : {}),
  });
  const { intent } = reading;
  const warnings: JudgeFinding<JudgeWarningCode>[] = reading.notices.map((notice) => ({
    code: notice.code,
    message: notice.message,
    ...(notice.at === undefined ? {} : { at: notice.at }),
  }));
  // Недочитанный intent дальше не судится: ошибки сборки по нему — эхо выброшенных записей.
  if (reading.problems.length > 0) {
    return {
      ok: false,
      intent,
      errors: reading.problems.map((p) => ({
        code: p.code,
        at: p.at,
        message: p.message,
        hint: p.expected,
      })),
      warnings: rankWarnings(warnings),
    };
  }
  if (!options.forDocument && options.requireEnvironment !== false) {
    const environment = environmentErrors(catalogs);
    if (environment.length > 0) {
      return { ok: false, intent, errors: environment, warnings: rankWarnings(warnings) };
    }
  }

  const errors: JudgeFinding[] = [];
  if (options.forDocument) {
    const document = documentCapabilities(intent);
    errors.push(...document.errors);
    warnings.push(...document.notes);
  }
  const bundle = options.forDocument ? undefined : buildBundle(intent, catalogs);
  const explicit = options.schema !== undefined;
  const schema = explicit
    ? options.schema
    : JSON.parse(bundle?.layoutJson ?? buildFormSchemaJson(intent));
  const cross = crossCheckBundle(intent, schema, {
    core: catalogs.core,
    ...(options.componentNames ? { componentNames: options.componentNames } : {}),
    ...(options.dataSourceNames ? { dataSourceNames: options.dataSourceNames } : {}),
  });
  for (const error of cross.errors) errors.push({ code: error.code, message: error.message });

  // Поле вне раскладки: модель его знает, а пользователь не увидит. Сборка считает это ошибкой, как
  // и всё, что молча теряет часть формы.
  const { placed } = inspectLayoutRefs(intent);
  const unplaced = [...intent.fields, ...intent.arrays]
    .map((entity) => entity.modelPath ?? entity.name)
    .filter((name) => !placed.has(name));
  if (unplaced.length > 0) {
    errors.push({
      code: 'unplaced',
      at: 'layoutRoot',
      message:
        `not placed in layoutRoot: ${unplaced.join(', ')} — the model has them, the user would ` +
        'not see them',
      hint: intent.wizard
        ? 'in the `steps` shorthand a field name goes to `steps[i].fields`'
        : 'put each name into a node of `layoutRoot`',
    });
  }

  // C9 — мёртвое объявление — ошибка везде. Поле, не стоящее в собранной схеме, уже названо
  // `unplaced`; в присланной схеме C9 — о ней самой.
  for (const warning of cross.warnings) {
    if (warning.code !== 'C9') {
      warnings.push({ code: warning.code, message: warning.message });
    } else if (explicit || warning.subject?.kind !== 'field') {
      errors.push({ code: 'C9', message: warning.message });
    }
  }

  for (const note of bundle?.warnings ?? []) {
    if (isLostMessageWarning(note)) {
      errors.push({
        code: 'lost-message',
        message: note,
        hint: 'one `validation` row per issue code, each with its own message',
      });
    } else {
      warnings.push({ code: 'module-note', message: note });
    }
  }

  errors.push(...unknownComponents(intent, catalogs, options.forDocument === true));
  if (!options.forDocument && intent.target === 'core') errors.push(...coreRenderRules(intent));

  if (catalogs.uiKitProps) {
    // Типы и значения пропсов — описание компонента; у билдера form_build нет, ему хватает перечня.
    const details = options.forDocument
      ? undefined
      : (component: string) => `types and values: form_build {"grammar":"components:${component}"}`;
    for (const note of checkComponentProps(intent, catalogs.uiKitProps, catalogs.uiKit, details)) {
      warnings.push({ code: 'component-props', message: note });
    }
  }

  return {
    ok: errors.length === 0,
    intent,
    errors,
    warnings: rankWarnings(warnings),
    ...(bundle ? { bundle } : {}),
  };
}
