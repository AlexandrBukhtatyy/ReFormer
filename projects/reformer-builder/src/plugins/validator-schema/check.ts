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
import type { JsonPath } from '@/lib/form-model/paths';
import type {
  Diagnostic,
  DiagnosticTarget,
  NodePart,
  QuickFix,
  ResourceId,
  TextRange,
} from '@/sdk';
import { CODES, COMMANDS, QUICKFIX, SCHEMA_VALIDATOR_ID, type DiagnosticCode } from './codes';
import { nodeSiteAt, parseJson, splitLocation, targetAt } from './locate';
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

/**
 * Цель по узлу: его идентификатор, если он есть, иначе ресурс целиком.
 *
 * `inner` — место ошибки ВНУТРИ узла, путь от него самого; пустой означает «узел целиком».
 * `at` — что там подчеркнуть; см. {@link VALUE_CODES}.
 */
function targetOf(node: JsonNode | undefined, inner?: JsonPath, at?: NodePart): DiagnosticTarget {
  const nodeId = node === undefined ? undefined : nodeIdOf(node);
  if (nodeId === undefined) return { kind: 'resource' };
  if (inner === undefined || inner.length === 0) return { kind: 'node', nodeId };
  return { kind: 'node', nodeId, within: inner, ...(at !== undefined ? { at } : {}) };
}

/**
 * Коды, у которых виновато ЗНАЧЕНИЕ, а не имя поля.
 *
 * Знание кодовое, поэтому живёт у валидатора, а не у того, кто рисует: «нет такого свойства» —
 * про имя (`"readOnly"`), «значение не того типа» и «такого компонента нет» — про значение
 * (`"$component(Inpit)"`). Тот, кто рисует, кодов не разбирает вовсе — он получает готовое
 * «имя или значение» и остаётся к списку кодов безразличен.
 */
const VALUE_CODES: ReadonlySet<DiagnosticCode> = new Set<DiagnosticCode>([
  CODES.WRONG_TYPE,
  CODES.VALUE_NOT_ALLOWED,
  CODES.OUT_OF_RANGE,
  CODES.PATTERN_MISMATCH,
  CODES.UNKNOWN_COMPONENT,
  CODES.HTML_TAG_NOT_ALLOWED,
  CODES.UNKNOWN_DATA_SOURCE,
  CODES.UNKNOWN_FN,
  CODES.UNKNOWN_LOCALE_KEY,
  // Сюда же — неузнанное сообщение. Через `INVALID` доезжают `must match pattern`,
  // `must NOT have fewer than N items` и прочие проверки ajv, и ВСЕ они говорят о значении:
  // ajv адресует то, что проверял. Показывать при этом на имя — противоречить фразе, которую
  // человек читает. Значение-поддерево при этом всё равно не подчёркивается — решает тот,
  // кто рисует.
  CODES.INVALID,
]);

/** Редактируемые пропсы компонента по каталогу — словарь для подсказки имени пропа. */
function propNamesOf(catalog: readonly CatalogEntry[], component: string | undefined): string[] {
  if (component === undefined) return [];
  const entry = catalog.find((candidate) => candidate.name === component);
  const properties = entry?.propsSchema.properties;
  return properties === undefined ? [] : Object.keys(properties);
}

/**
 * Список допустимых значений пропа — из той же схемы каталога, по которой ajv и ругался.
 *
 * Сам ajv список НЕ передаёт: его сообщение ровно `must be equal to one of the allowed values`,
 * без единого значения. А без списка находка получается тонкой — «не из списка» не говорит, из
 * какого. Восстановить его можно, и восстановление честное: `enum` встречается ТОЛЬКО в схемах
 * пропсов кита, а раз ajv до них дошёл, компонент в каталоге есть (нет — и пропсы не проверялись
 * бы вовсе, схему для них взять неоткуда).
 *
 * Путь берётся тот же, что и у цели, минус ведущий `componentProps`: дальше он ложится на схему
 * как `properties.<имя>` для ключей и `items` для индексов массива.
 */
function allowedValuesAt(
  catalog: readonly CatalogEntry[],
  component: string | undefined,
  inner: JsonPath
): string[] | undefined {
  if (component === undefined || inner[0] !== 'componentProps') return undefined;
  const entry = catalog.find((candidate) => candidate.name === component);
  if (entry === undefined) return undefined;

  let node: Record<string, unknown> | undefined = entry.propsSchema as Record<string, unknown>;
  for (const segment of inner.slice(1)) {
    if (node === undefined) return undefined;
    const next: unknown =
      typeof segment === 'number'
        ? node.items
        : (node.properties as Record<string, unknown> | undefined)?.[segment];
    node =
      next !== null && typeof next === 'object' ? (next as Record<string, unknown>) : undefined;
  }
  const values = node?.enum;
  if (!Array.isArray(values) || values.length === 0) return undefined;
  return values.map((value) => String(value));
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

    if (code === CODES.VALUE_NOT_ALLOWED) {
      // Список допустимого ajv не передаёт — достаём его из той же схемы каталога.
      const site = nodeSiteAt(schema, path);
      const allowed =
        site === undefined
          ? undefined
          : allowedValuesAt(options.catalog, componentOf(site.node), site.inner);
      return make(code, 'error', targetAt(schema, path, 'value'), {
        // Ветка фразы: без списка она обязана быть другой, иначе на экране появится
        // маркер пропущенного аргумента (`⟦allowed⟧`), а не текст.
        list: allowed === undefined ? 'no' : 'yes',
        ...(allowed === undefined ? {} : { allowed: allowed.join(', ') }),
      });
    }

    if (code !== CODES.UNKNOWN_PROPERTY) {
      return make(
        code,
        'error',
        targetAt(schema, path, VALUE_CODES.has(code) ? 'value' : undefined),
        params
      );
    }

    // Опечатка в имени пропа — тот случай, когда исправление очевидно: у компонента есть
    // словарь пропсов, и промах обычно отличается от попадания одной буквой.
    //
    // Узел ищется по НОСИТЕЛЮ ИДЕНТИФИКАТОРА, а не по «первому, что похоже на узел». Разница
    // не косметическая: узлом считается любой объект с ключом `value`/`array`/`component`,
    // а у `TabsTrigger`, `TabsContent`, `RadioGroupItem` ровно такой `componentProps`
    // (`{ value: 'one' }`). Подъём «до похожего» останавливался на самих пропсах — а у них
    // ни идентификатора (цель уезжала в `resource`, то есть на первую строку файла), ни
    // компонента (словарь пропсов пуст → ни подсказки, ни быстрого исправления).
    const site = nodeSiteAt(schema, path);
    const node = site?.node;
    const property = String(params.property ?? '');
    // Лишний проп в тексте ЕСТЬ — на него и показываем: путь от узла до объекта, которому
    // проп принадлежит, плюс само имя. Имя берётся СТРОКОЙ: числовой ключ (`"0"`) остаётся
    // ключом объекта и индексом массива притворяться не должен.
    const inner: JsonPath = site === undefined ? [] : [...site.inner, property];
    const component = node === undefined ? undefined : componentOf(node);
    const suggestion = nearestName(propNamesOf(options.catalog, component), property);
    if (suggestion === undefined) {
      return make(code, 'error', targetOf(node, inner), params);
    }
    const nodeId = node === undefined ? undefined : nodeIdOf(node);
    return make(
      code,
      'error',
      targetOf(node, inner),
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
        // Имя, которого нет в каталоге, стоит в ЗНАЧЕНИИ `component` — его и подчёркиваем.
        // Ровно так же выбирает якорь узел без идентификатора (см. `node-ranges`); с
        // идентификатором якорь занят им, и без этого уточнения находка показывала бы на него.
        targetOf(node, ['component'], 'value'),
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
 * Цель — ПРИЛОЖЕННЫЙ ФАЙЛ, а не узел и не ресурс, и ни то, ни другое не подходит. Узла,
 * на который правило указывает, не существует — в том и находка. А `resource` означает
 * «ошибка уровня документа», и рисующий ставит на неё маркер первой строки: человек читал бы
 * «Правило валидации на «loanAmount»: такого поля в форме нет», глядя на подчёркнутую `{`
 * схемы, тогда как чинить надо соседний файл.
 *
 * Адресом при этом остаётся ресурс СХЕМЫ, и это не компромисс: команда правки правил получает
 * именно его (`args.resource`), а файл правил находит по нему сама (`SchemaRulesPort`). Схема —
 * законная ручка для находок о своём сайдкаре; неверна была только отрисовка.
 *
 * Быстрое исправление одно и оно разрушительное (убрать правило), поэтому предлагается,
 * но не применяется само: осиротевшее правило — работа пользователя, и стереть её без спроса
 * значит потерять её.
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
        { kind: 'attached' },
        { target: problem.missing },
        [fix]
      );
    }
    if (problem.list === 'behavior') {
      return make(
        CODES.RULE_BEHAVIOR_TARGET_MISSING,
        'warning',
        { kind: 'attached' },
        { target: problem.missing, kind: rules.behavior[problem.index]?.kind ?? '' },
        [fix]
      );
    }
    return make(
      CODES.RULE_RENDER_SELECTOR_MISSING,
      'warning',
      { kind: 'attached' },
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
 *
 * **Единственная находка, адресуемая ДИАПАЗОНОМ при живом дереве.** Узлом её адресовать нельзя
 * ровно потому, в чём и состоит находка: идентификатор называет ДВА места, и указатель по тексту
 * («первый выигрывает») отдаёт из них одно — то, которое не чинили. Раньше подчёркивался именно
 * этот, невиновный: перевыдачу получают ВТОРОЙ и следующие носители, первый свой адрес сохраняет.
 *
 * Отмечаются ВСЕ вхождения, а не «все, кроме первого». Порядок обхода модели и порядок в тексте
 * — разные вещи (`componentProps.steps` в тексте может стоять раньше `children`), и «первый»
 * в одном не обязан быть первым в другом; выбирать по такому совпадению значило бы иногда
 * помечать невиновного и молчать о виновном. Пара подчёркиваний называет обоих двойников —
 * то, что человеку и нужно, чтобы развести их. Так же поступает VS Code с повторным ключом JSON.
 */
function duplicateNodeIds(input: FormInput): Diagnostic[] {
  const parsed = parseJson(input.text);
  if (!parsed.ok) return [];
  const duplicates = new Set(findDuplicateNodeIds(parsed.value as JsonFormSchema));
  if (duplicates.size === 0) return [];

  const out: Diagnostic[] = [];
  for (const written of writtenNodeIds(input.text)) {
    if (!duplicates.has(written.id)) continue;
    out.push(
      make(
        CODES.DUPLICATE_NODE_ID,
        'warning',
        { kind: 'range', range: written.range },
        {
          node: written.id,
        }
      )
    );
  }
  return out;
}

/**
 * Все места, где в тексте ЗАПИСАН `$nodeId`, вместе со значением.
 *
 * Свой проход, а не указатель из `editor-monaco`: плагины друг друга не видят (граница
 * проверяется линтером), и половина разбора JSON здесь дешевле общей зависимости — нужны
 * только пары «ключ → место значения».
 *
 * Ищется КЛЮЧ, а не любое вхождение восьми символов: значение вида `"$nodeId"` встречается
 * в подписях и в текстах формы. Экранированная кавычка перед ключом отсекается — внутри
 * строки `"он сказал \"$nodeId\": \"abc\""` ключа нет, есть текст.
 */
function writtenNodeIds(text: string): { id: string; range: TextRange }[] {
  const out: { id: string; range: TextRange }[] = [];
  const re = /"\$nodeId"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > 0 && text[match.index - 1] === '\\') continue;
    // Подчёркивается ЗНАЧЕНИЕ вместе с кавычками: именно оно повторяется, и именно его правят.
    const start = match.index + match[0].lastIndexOf('"', match[0].length - 2);
    out.push({ id: match[1], range: { start, end: match.index + match[0].length } });
  }
  return out;
}

/**
 * Ключ тождественности находки: код, место и данные фразы.
 *
 * Сериализация, а не сравнение по полям: части ключа — объекты произвольной формы (`target`,
 * `params`), и ручное сравнение пришлось бы держать в согласии с их формой вручную. Порядок
 * ключей в сериализации значим, но записи строит один и тот же код одними и теми же литералами,
 * поэтому одинаковые находки дают одинаковую строку.
 *
 * `fixes` в ключ НЕ входят: находка — это «что не так и где», а исправление — приложение к ней.
 */
function identityOf(item: Diagnostic): string {
  return JSON.stringify([item.code, item.severity, item.target, item.params ?? null]);
}

/**
 * Отсеивает находки, неотличимые для человека: тот же код, то же место, те же данные.
 *
 * Дубли рождаются не по недосмотру, а в мета-схеме: `component` объявлен как `anyOf` из
 * `$component(...)` и `$html(...)`, обе ветки жалуются `must be string`, и `{ component: 5 }`
 * приходит ДВУМЯ одинаковыми сообщениями. Пока находки садились на якорь узла, два маркера
 * лежали друг на друге незаметно; с точным местом они дают две одинаковые строки в панели
 * проблем и два наложенных маркера в редакторе — одна ошибка, показанная дважды.
 *
 * Выигрывает вхождение С исправлением, а при прочих равных — первое: порядок находок должен
 * быть устойчив, иначе панель проблем переставляла бы строки от прохода к проходу.
 *
 * Экспортируется ради теста правила «остаётся то, которым можно починить»: собрать пару
 * неотличимых находок, у которых исправление есть только у второй, проходом по реальной схеме
 * сегодня нечем — одинаковые находки родом из одной ветки кода и исправления несут одинаковые.
 */
export function dedupe(items: readonly Diagnostic[]): Diagnostic[] {
  const seen = new Map<string, number>();
  const out: Diagnostic[] = [];
  for (const item of items) {
    const key = identityOf(item);
    const at = seen.get(key);
    if (at === undefined) {
      seen.set(key, out.length);
      out.push(item);
      continue;
    }
    const kept = out[at];
    if ((kept.fixes?.length ?? 0) === 0 && (item.fixes?.length ?? 0) > 0) out[at] = item;
  }
  return out;
}

export function checkSchema(
  schema: JsonFormSchema,
  input: FormInput,
  options: SchemaCheckOptions
): Diagnostic[] {
  return dedupe([
    ...fromSchemaValidator(schema, input, options),
    ...unknownComponents(schema, input, options),
    ...structureFindings(schema).map((finding) =>
      make(
        finding.code,
        'warning',
        targetOf(finding.node, finding.within, finding.at),
        finding.params
      )
    ),
    ...orphanRules(schema, input, options.rules),
    // Единственное место, где двойник ещё ВИДЕН: модель после разбора уже исправлена
    // перевыдачей, и спросить о нём можно только исходный текст.
    ...duplicateNodeIds(input),
  ]);
}

/**
 * Полный быстрый уровень: разбор (если модели не дали) и все проверки.
 *
 * Ошибка разбора — ЕДИНСТВЕННАЯ находка такого прохода: дерева нет, узлов нет, и всё остальное
 * сказать не о чем. Диапазоном она адресуется не одна — так же адресуется двойник `$nodeId`
 * ({@link duplicateNodeIds}), и по той же причине: у обеих нет годного узлового адреса, только
 * там его ещё нет, а тут он называет сразу два места.
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
