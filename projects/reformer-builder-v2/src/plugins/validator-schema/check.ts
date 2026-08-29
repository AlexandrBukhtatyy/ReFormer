/**
 * Проверка схемы формы — весь быстрый уровень валидатора в одной чистой функции.
 *
 * Собирает четыре источника находок, три из которых перенесены из v1:
 *
 * ```text
 * validateFormSchema  структура узлов, операторы, componentProps   io/validate.ts
 * имена компонентов   $component(X) против каталога активного кита io/validate.ts
 * структурный линт    вкладки и шаги                               io/structure-lint.ts
 * целостность правил  правило, указывающее в никуда                lib/form-model/rules-integrity
 * ```
 *
 * ## Имена компонентов проверяются ЗДЕСЬ, а не переданы в `validateFormSchema`
 *
 * Тому можно отдать `componentNames`, и он вернёт `«root.children[0].component: unknown
 * component "Inpit"»` — строку, из которой узел добывается разбором пути, а имя — разбором
 * фразы. Свой обход даёт то же самое сразу: узел (значит, его `$nodeId`), имя (значит,
 * `params.name`) и каталог под рукой (значит, ближайшее имя для быстрого исправления).
 * Поэтому список имён туда не передаётся вовсе — иначе одна и та же находка приходила бы
 * дважды.
 *
 * ## Мета-схема приходит ПАРАМЕТРОМ и может не прийти вовсе
 *
 * Первая строка таблицы — `validateFormSchema` из `@reformer/renderer-json/validate`, и она
 * стоит 127 кБ raw / 40 кБ gzip в главном чанке (мета-схема form-DSL плюс код валидатора).
 * Открытого документа в этот момент ещё нет, поэтому функция приходит
 * {@link SchemaCheckOptions.validateSchema} — параметром, как и каталог, — и до её появления
 * проход отдаёт находки остальных трёх источников. Сама функция остаётся ЧИСТОЙ: ни импорта
 * по требованию, ни модульного кэша здесь нет, иначе её нельзя было бы звать дважды с разным
 * ответом (а тесты и делают именно это).
 *
 * ## Строгого режима v1 здесь нет
 *
 * В v1 у гейта два режима: мягкий (имена берутся из самой проверяемой схемы) и строгий
 * (только каталог плюс `baseline` — то, что у пользователя уже было). Разделение существовало
 * потому, что там гейт вызывался и на ручном сохранении, и на ходе ассистента, а «имена из
 * самой схемы» для машинного входа — дыра: выдуманное имя проверяет само себя. Здесь режим
 * один и он строгий: сравнение всегда с каталогом. Мягкость возвращать некуда — каталог в v2
 * приходит вкладом кита, а не угадывается по standalone-сборке.
 *
 * @module plugins/validator-schema/check
 */

import type { validateFormSchema } from '@reformer/renderer-json/validate';
import { parseOperator, type JsonFormSchema, type JsonNode } from '@reformer/renderer-json';
import type { CatalogEntry } from '@/lib/catalog/types';
import { isFormSchema } from '@/lib/form-model/normalize';
import { findDuplicateNodeIds, nodeIdOf } from '@/lib/form-model/node-id';
import { componentOf } from '@/lib/form-model/node-ref';
import { walkNodes } from '@/lib/form-model/query';
import { checkRules } from '@/lib/form-model/rules-integrity';
import type { FormRules } from '@/lib/form-model/rules';
import type { Diagnostic, DiagnosticTarget, QuickFix, ResourceId } from '@/sdk';
import { CODES, COMMANDS, QUICKFIX, SCHEMA_VALIDATOR_ID, type DiagnosticCode } from './codes';
import { nodeAt, parseJson, splitLocation, targetAt } from './locate';
import { nearestName } from './nearest';
import { structureFindings } from './structure';
import { translateMessage } from './translate';

/** Что валидатору дали на проход. */
export interface FormInput {
  /** Ресурс — он попадает в аргументы быстрых исправлений: команда правит конкретный файл. */
  readonly resource: ResourceId;
  readonly text: string;
  /** Разобранная модель, согласованная с текстом. `undefined` — разбирать придётся самим. */
  readonly model?: unknown;
}

/**
 * Проверка формы по мета-схеме form-DSL — фаза (a) и (d) валидатора рендерера.
 *
 * Тип берётся у самой функции (`typeof`), а не переписывается: две копии одной сигнатуры
 * разъехались бы на первом же её изменении, а импорт ТИПА при этом стирается на сборке —
 * значит стоит ноль байт и не тянет за собой ни модуль, ни ajv.
 */
export type ValidateFormSchema = typeof validateFormSchema;

export interface SchemaCheckOptions {
  /**
   * Каталог активного кита: имена компонентов и схемы их пропсов.
   *
   * ПУСТОЙ каталог отключает проверку имён целиком — не потому, что так удобнее, а потому,
   * что сравнивать не с чем: без кита любое имя одинаково неизвестно, и валидатор пометил бы
   * красным всю форму.
   */
  readonly catalog: readonly CatalogEntry[];
  /**
   * Правила-сайдкар, если они у документа есть.
   *
   * Правила живут ОТДЕЛЬНЫМ файлом рядом со схемой (`JsonFormSchema` — закрытый контракт
   * рендерера, положить их внутрь нельзя), а `ValidateContext` описывает ОДИН документ.
   * Поэтому сайдкар приходит параметром: дотянуться до соседнего ресурса валидатору сегодня
   * нечем — см. заметку в `plugin.ts`.
   */
  readonly rules?: FormRules;
  /**
   * Проверка по мета-схеме form-DSL, если тот, кто её грузит, уже её получил.
   *
   * ПАРАМЕТР, а не импорт, ровно по той же причине, по которой параметром приходит каталог:
   * «когда её грузить» — решение владельца, а не проверки. Цена измерена: статический импорт
   * `@reformer/renderer-json/validate` кладёт в главный чанк 127 кБ raw / 40 кБ gzip
   * (мета-схема плюс код валидатора), а нужен он не раньше открытого документа.
   *
   * Без неё проход честно теряет ДВЕ фазы из пяти — структуру узлов, синтаксис операторов
   * и типы `componentProps`; остальные (разбор, имена компонентов, структурный линт,
   * целостность правил) отвечают полностью. Это не режим и не деградация «навсегда»:
   * владелец заказывает загрузку при активации, задолго до первого документа.
   */
  readonly validateSchema?: ValidateFormSchema;
}

/** Собирает диагностику: источник и вид цели проставлены, пустые поля не заводятся. */
function make(
  code: DiagnosticCode,
  severity: Diagnostic['severity'],
  target: DiagnosticTarget,
  params?: Record<string, unknown>,
  fixes?: readonly QuickFix[]
): Diagnostic {
  return {
    source: SCHEMA_VALIDATOR_ID,
    severity,
    code,
    target,
    ...(params !== undefined && Object.keys(params).length > 0 ? { params } : {}),
    ...(fixes !== undefined && fixes.length > 0 ? { fixes } : {}),
  };
}

/** Цель по узлу: его идентификатор, если он есть, иначе ресурс целиком. */
function targetOf(node: JsonNode | undefined): DiagnosticTarget {
  const nodeId = node === undefined ? undefined : nodeIdOf(node);
  return nodeId === undefined ? { kind: 'resource' } : { kind: 'node', nodeId };
}

/** Редактируемые пропсы компонента по каталогу — словарь для подсказки имени пропа. */
function propNamesOf(catalog: readonly CatalogEntry[], component: string | undefined): string[] {
  if (component === undefined) return [];
  const entry = catalog.find((candidate) => candidate.name === component);
  const properties = entry?.propsSchema.properties;
  return properties === undefined ? [] : Object.keys(properties);
}

/**
 * Находки `validateFormSchema`, переведённые в коды.
 *
 * `componentNames`/`dataSourceNames`/`fnNames`/`localeKeys` не передаются намеренно: имена
 * компонентов проверяет собственный обход (см. шапку модуля), а имена источников, функций
 * и ключей локализации в билдере знать неоткуда ни в каком режиме — там мягкость не дыра,
 * а единственно возможное поведение.
 */
function fromSchemaValidator(
  schema: JsonFormSchema,
  input: FormInput,
  options: SchemaCheckOptions
): Diagnostic[] {
  // Проверки не дали — значит владелец её ещё не загрузил. Молчание здесь честнее выдумки:
  // ни одной находки этих фаз мы предъявить не можем, а изобрести их нечем.
  if (options.validateSchema === undefined) return [];
  const propSchemas = Object.fromEntries(
    options.catalog.map((entry) => [entry.name, entry.propsSchema])
  );
  const { errors } = options.validateSchema(schema, { propSchemas });

  return errors.map((raw) => {
    const { path, message } = splitLocation(raw);
    const { code, params } = translateMessage(message);

    if (code !== CODES.UNKNOWN_PROPERTY) {
      return make(code, 'error', targetAt(schema, path), params);
    }

    // Опечатка в имени пропа — тот случай, когда исправление очевидно: у компонента есть
    // словарь пропсов, и промах обычно отличается от попадания одной буквой.
    const node = nodeAt(schema, path);
    const property = String(params.property ?? '');
    const component = node === undefined ? undefined : componentOf(node);
    const suggestion = nearestName(propNamesOf(options.catalog, component), property);
    if (suggestion === undefined) {
      return make(code, 'error', targetOf(node), params);
    }
    const nodeId = node === undefined ? undefined : nodeIdOf(node);
    return make(
      code,
      'error',
      targetOf(node),
      { ...params, suggestion },
      nodeId === undefined
        ? []
        : [
            {
              titleKey: QUICKFIX.RENAME_PROPERTY,
              commandId: COMMANDS.RENAME_PROP,
              args: { resource: input.resource, nodeId, from: property, to: suggestion },
            },
          ]
    );
  });
}

/** `$component(X)`, которых нет в каталоге, — с ближайшим именем как быстрым исправлением. */
function unknownComponents(
  schema: JsonFormSchema,
  input: FormInput,
  options: SchemaCheckOptions
): Diagnostic[] {
  const known = options.catalog.map((entry) => entry.name);
  if (known.length === 0) return [];
  const registry = new Set(known);
  const out: Diagnostic[] = [];

  walkNodes(schema, (node) => {
    const op = parseOperator((node as { component?: unknown }).component);
    // Только `$component(...)`: `$html(tag)` проверяется по whitelist самим рендерером,
    // а array-узел без `component` каталожного имени в схеме не несёт.
    if (op?.op !== 'component' || registry.has(op.arg)) return;

    const suggestion = nearestName(known, op.arg);
    const nodeId = nodeIdOf(node);
    const fixes: QuickFix[] =
      suggestion === undefined || nodeId === undefined
        ? []
        : [
            {
              titleKey: QUICKFIX.REPLACE_COMPONENT,
              commandId: COMMANDS.SET_COMPONENT,
              args: { resource: input.resource, nodeId, name: suggestion },
            },
          ];
    out.push(
      make(
        CODES.UNKNOWN_COMPONENT,
        'error',
        targetOf(node),
        suggestion === undefined ? { name: op.arg } : { name: op.arg, suggestion },
        fixes
      )
    );
  });
  return out;
}

/**
 * Осиротевшие правила: правило на удалённое поле или на несуществующий селектор.
 *
 * Цель — РЕСУРС, а не узел, и это не упрощение: узла, на который правило указывает, не
 * существует — в том и находка. Быстрое исправление одно и оно разрушительное (убрать
 * правило), поэтому предлагается, но не применяется само: осиротевшее правило — работа
 * пользователя, и стереть её без спроса значит потерять её.
 */
function orphanRules(
  schema: JsonFormSchema,
  input: FormInput,
  rules: FormRules | undefined
): Diagnostic[] {
  if (rules === undefined) return [];
  return checkRules(schema, rules).map((problem) => {
    const fix: QuickFix = {
      titleKey: QUICKFIX.REMOVE_ORPHAN_RULE,
      commandId: COMMANDS.REMOVE_RULE,
      args: { resource: input.resource, list: problem.list, index: problem.index },
    };
    if (problem.list === 'validation') {
      return make(
        CODES.RULE_VALIDATION_TARGET_MISSING,
        'warning',
        { kind: 'resource' },
        { target: problem.missing },
        [fix]
      );
    }
    if (problem.list === 'behavior') {
      return make(
        CODES.RULE_BEHAVIOR_TARGET_MISSING,
        'warning',
        { kind: 'resource' },
        { target: problem.missing, kind: rules.behavior[problem.index]?.kind ?? '' },
        [fix]
      );
    }
    return make(
      CODES.RULE_RENDER_SELECTOR_MISSING,
      'warning',
      { kind: 'resource' },
      { selector: problem.missing, kind: rules.render[problem.index]?.kind ?? '' },
      [fix]
    );
  });
}

/** Проверка разобранной схемы. Отдельно от {@link checkForm} — её зовут тесты и ассистент. */
/**
 * Двойники `$nodeId` в ИСХОДНОМ тексте.
 *
 * Разбор чинит их перевыдачей и не отказывает — файл пишут руками и генерируют чужим
 * инструментом, копипаста поддерева даёт двойника регулярно, и отказ закрыл бы такой файл
 * для структурного редактора целиком. Но починка молчалива, поэтому о ней сообщают здесь.
 *
 * Смотрится ТЕКСТ, а не модель: в модели двойников уже нет — их там и не было ни секунды.
 */
function duplicateNodeIds(input: FormInput): Diagnostic[] {
  const parsed = parseJson(input.text);
  if (!parsed.ok) return [];
  const duplicates = findDuplicateNodeIds(parsed.value as JsonFormSchema);
  return duplicates.map((id) =>
    make(CODES.DUPLICATE_NODE_ID, 'warning', { kind: 'node', nodeId: id }, { node: id })
  );
}

export function checkSchema(
  schema: JsonFormSchema,
  input: FormInput,
  options: SchemaCheckOptions
): Diagnostic[] {
  return [
    ...fromSchemaValidator(schema, input, options),
    ...unknownComponents(schema, input, options),
    ...structureFindings(schema).map((finding) =>
      make(finding.code, 'warning', targetOf(finding.node), finding.params)
    ),
    ...orphanRules(schema, input, options.rules),
    // Единственное место, где двойник ещё ВИДЕН: модель после разбора уже исправлена
    // перевыдачей, и спросить о нём можно только исходный текст.
    ...duplicateNodeIds(input),
  ];
}

/**
 * Полный быстрый уровень: разбор (если модели не дали) и все проверки.
 *
 * Ошибка разбора — ЕДИНСТВЕННАЯ находка такого прохода и единственная, адресуемая диапазоном:
 * дерева нет, узлов нет, и всё остальное сказать не о чем.
 */
export function checkForm(input: FormInput, options: SchemaCheckOptions): Diagnostic[] {
  let value = input.model;
  if (value === undefined) {
    const parsed = parseJson(input.text);
    if (!parsed.ok) {
      return [
        make(
          CODES.PARSE_FAILED,
          'error',
          { kind: 'range', range: parsed.range },
          { message: parsed.message }
        ),
      ];
    }
    value = parsed.value;
  }

  if (!isFormSchema(value)) {
    return [make(CODES.NOT_A_FORM, 'error', { kind: 'resource' })];
  }
  return checkSchema(value, input, options);
}
