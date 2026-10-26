/**
 * Структурный режим стека ReFormer: черновик схемы в памяти, одна запись в конце хода.
 *
 * Ассистент проводит попытку и решает, когда писать (форма открыта, текст не разошёлся, человек
 * не отклонил). Здесь — то, что знает только ReFormer: как разобрать документ, что видит модель,
 * как черновик становится текстом и где в модуле формы живут её правила.
 *
 * ## Правила формы — код модуля
 *
 * Правила структурного режима (`set_form_rules`, `set_render_rules`) копятся в черновике вместе
 * со схемой. Ложатся они после неё: схема — в документ, правила — в код модуля генерацией кода
 * (`./rule-code`). Записанное генерацией — сопутствующие файлы хода: их отменяют и возвращают
 * вместе с формой.
 *
 * @module plugins/reformer/ai/stack/structured
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type {
  FormDocumentDoor,
  FormLandOutcome,
  FormLoaded,
  FormStackHost,
  FormStructuredMode,
  FormStructuredTurn,
  FormToolSlot,
  ModuleGeneratorService,
  ResourceId,
} from '@reformer/builder-plugin-api';
import type { CatalogEntry } from '../../../core/catalog';
import { FORM_RULES_NAME, VALIDATION_DIR } from '../../../core/codegen/layout';
import { emptyRules, type FormRules } from '../../../core/form-model';
import { createChangeSet, hasChanges, withOutcome, type ChangeSet } from '../model/changeset';
import { parseSchemaText } from '../model/schema-text';
import type { RulesLock, ToolContext, ToolOutcome } from '../model/types';
import type { LoadValidateForm, ValidateFormSchema } from '../model/validate';
import { systemPrompt } from '../loop/prompt';
import { applyChangeSet } from './land';
import {
  readRuleCode,
  ruleFilesUnchanged,
  rulesLockOf,
  sameRules,
  writeRuleCode,
  type RuleCodeBase,
} from './rule-code';
import { formSeed } from './seed';

/** Документ формы, как его разобрал стек: схема и правила на начало хода. */
export interface SchemaState {
  readonly schema: JsonFormSchema;
  readonly rules: FormRules;
  /** Код правил модуля на начало хода; нет — файлового доступа нет, правила живут в памяти стека. */
  readonly ruleCode?: RuleCodeBase;
}

/** Состояние документа, разобранного этим стеком: ассистент его только носит. */
export const stateOf = (loaded: FormLoaded): SchemaState => loaded.state as SchemaState;

/** Попытка структурного хода: набор изменений и есть черновик. */
export interface SchemaTurn extends FormStructuredTurn {
  result(): ChangeSet;
}

/** Из чего собирается попытка. */
export interface SchemaTurnOptions {
  /** Схема на начало попытки. */
  readonly base: JsonFormSchema;
  /**
   * Правила на начало попытки. Без них ход начинается с пустого набора, и правка правил в режиме
   * merge — режиме по умолчанию — молча СТИРАЕТ всё, что было накоплено раньше: инструмент
   * добавляет новое правило к пустоте, а применение записывает результат целиком.
   */
  readonly rules?: FormRules;
  /**
   * Каталог активного кита: словарь имён для инструментов и материал системного промпта. Один на
   * попытку — промпт и инструменты обязаны говорить об одном и том же ките.
   */
  readonly catalog: readonly CatalogEntry[];
  /** Проверка по мета-схеме — уже загруженная: инструменты внутри хода синхронны. */
  readonly validateForm: ValidateFormSchema;
  /** Какие правила ход не сможет записать; нет — записать можно всё. */
  readonly rulesLock?: RulesLock;
  /** Переопределение системного промпта (тесты). */
  readonly system?: string;
}

/** Фразы отказов запертых правил — для затравки. */
function lockMessages(lock: RulesLock | undefined): string[] {
  if (lock === undefined) return [];
  return [lock.validation, lock.behavior, lock.dataSources]
    .filter((refusal) => refusal !== undefined)
    .map((refusal) => refusal.message);
}

/** Попытка структурного хода над схемой. */
export function createSchemaTurn(options: SchemaTurnOptions): SchemaTurn {
  let set = createChangeSet(options.base, options.rules);
  return {
    system: () => options.system ?? systemPrompt(options.catalog),
    seed: () => formSeed(options.base, options.rules, lockMessages(options.rulesLock)),
    context: (): ToolContext => ({
      draft: set.draft,
      base: options.base,
      rules: set.draftRules,
      catalog: options.catalog,
      validateForm: options.validateForm,
      ...(options.rulesLock === undefined ? {} : { rulesLock: options.rulesLock }),
    }),
    // Ответ инструмента ассистента или плагина схемы не несёт и набор не меняет.
    accept: (outcome) => {
      set = withOutcome(set, outcome as ToolOutcome);
    },
    result: () => set,
  };
}

/** Что нужно режиму от стека. */
export interface StructuredModeOptions {
  /** Идентификатор стека — им помечен разобранный документ. */
  readonly stack: string;
  readonly host: FormStackHost;
  readonly tools: readonly FormToolSlot[];
  readonly catalog: () => readonly CatalogEntry[];
  /** Заказ проверки — для строгого гейта перед записью. */
  readonly validateForm: LoadValidateForm;
  /** Проверка, загруженная подготовкой сеанса (`FormStackSession.prepare`). */
  readonly prepared: () => ValidateFormSchema;
  /** Своя дверь документа (составная форма); `null` — документ пишется как есть. */
  readonly door: (id: ResourceId) => FormDocumentDoor | null;
  /**
   * Генерация кода — ею правила ложатся в код модуля. Функция: плагин генерации вправе подняться
   * позже стека и уйти раньше. Нет — правила хода записать нечем, и инструменты правил отказывают.
   */
  readonly generator?: () => ModuleGeneratorService | undefined;
  /**
   * Почему генерации в ходе нельзя писать файл формы `form`: документ формы и его шаги ход правит
   * сам. `null` — можно.
   */
  readonly refuse: (id: ResourceId, form: ResourceId) => string | null;
}

/** Структурный режим одного сеанса стека. */
export function createStructuredMode(options: StructuredModeOptions): FormStructuredMode {
  const { host } = options;

  /**
   * Правила формы по документам — запасной путь для платформы без файлового доступа.
   *
   * Правила формы живут кодом модуля: ход читает их на старте и пишет в конце, а эта память
   * нужна только там, где файлов нет (`host.files` не дан), — иначе ассистенту пришлось бы
   * отказать в правилах совсем. Перезагрузка страницы такую память забудет.
   */
  const rulesByResource = new Map<ResourceId, FormRules>();

  return {
    tools: options.tools,

    async load({ resource, path, text }) {
      let schema: JsonFormSchema;
      try {
        schema = parseSchemaText(text);
      } catch {
        // Не диагностика, а ответ «править нечего»: про синтаксис скажет валидатор того, кто
        // за файл взялся, а ассистент правит только разбирающуюся схему.
        return null;
      }
      const files = host.files;
      if (files === undefined) {
        const state: SchemaState = { schema, rules: rulesByResource.get(resource) ?? emptyRules() };
        return { stack: options.stack, resource, path, text, state, companions: [] };
      }
      // Код правил читается на каждом ходу заново: его правят и мимо ассистента. Файлы правил в
      // сопутствующие не попадают: их пишет генерация, и `generate_code` того же хода обязан
      // их перепечатать, а не получить отказ.
      const { rules, ...ruleCode } = await readRuleCode(files, resource, path);
      const state: SchemaState = { schema, rules, ruleCode };
      return { stack: options.stack, resource, path, text, state, companions: [] };
    },

    begin(loaded) {
      const { schema, rules, ruleCode } = stateOf(loaded);
      const rulesLock =
        ruleCode === undefined
          ? undefined
          : rulesLockOf(ruleCode, options.generator?.() !== undefined);
      return createSchemaTurn({
        base: schema,
        rules,
        catalog: options.catalog(),
        validateForm: options.prepared(),
        ...(rulesLock === undefined ? {} : { rulesLock }),
      });
    },

    hasChanges: (set) => hasChanges(set as ChangeSet),

    async land({ loaded, set, mark, force }): Promise<FormLandOutcome> {
      const state = stateOf(loaded);
      const changes = set as ChangeSet;
      const files = host.files;
      const ruleCode = files === undefined ? undefined : state.ruleCode;
      const rulesChanged = !sameRules(changes.draftRules, state.rules);
      const applied = await applyChangeSet(
        {
          host: {
            documentOf: (id) => options.door(id) ?? host.documentOf(id),
            writeText: (id, text, writeMark) =>
              options.door(id)?.write(text, writeMark) ?? host.writeText(id, text, writeMark),
          },
          catalog: options.catalog,
          validateForm: options.validateForm,
        },
        {
          set: changes,
          resource: loaded.resource,
          baseText: loaded.text,
          ...(mark.txId === undefined ? {} : { txId: mark.txId }),
          // Файлы правил сверяются, только если ход их запишет: иначе расходиться нечему.
          ...(files === undefined || ruleCode === undefined || !rulesChanged
            ? {}
            : { companionsUnchanged: () => ruleFilesUnchanged(files, ruleCode) }),
        },
        { force }
      );
      switch (applied.status) {
        case 'conflict':
        case 'invalid':
        case 'failed':
          return applied;
        // Обе проверки ассистент делает до записи; сюда они доходят, только если форму закрыли
        // или набор опустел, пока шла запись.
        case 'no-form':
          return { status: 'failed', error: new Error('The form document is closed.') };
        case 'empty':
          return { status: 'applied', companions: [] };
        case 'applied':
          break;
      }
      if (files === undefined || ruleCode === undefined) {
        // Правила уезжают в память вместе с применением, а не раньше: набор, который не лёг,
        // не должен менять то, от чего пойдёт следующий ход.
        rulesByResource.set(loaded.resource, changes.draftRules);
        return { status: 'applied', companions: [] };
      }
      if (!rulesChanged) return { status: 'applied', companions: [] };

      // Правила — после документа: правила без узлов, на которые они ссылаются, хуже, чем узлы
      // без правил. Инструменты правил отказывают заранее, если записать нечем, — сюда без
      // генерации доходит лишь тот, у кого она пропала посреди хода.
      const generator = options.generator?.();
      const formRules = files.resolve(ruleCode.root, VALIDATION_DIR, `${FORM_RULES_NAME}.ts`);
      if (generator === undefined) {
        return {
          status: 'applied',
          companions: [],
          broken: { id: formRules, error: 'code generation is not available' },
        };
      }
      const written = await writeRuleCode(
        { files, generator, refuse: (id) => options.refuse(id, loaded.resource) },
        {
          document: loaded.resource,
          base: ruleCode,
          rules: changes.draftRules,
          before: state.rules,
          mark,
        }
      );
      return {
        status: 'applied',
        companions: written.companions,
        ...(written.problem === undefined ? {} : { broken: written.problem }),
      };
    },

    async rewind(loaded, { files }) {
      const state = stateOf(loaded);
      rulesByResource.set(loaded.resource, state.rules);
      // Код правил возвращается только «Восстановить»: отмена хода уже вернула файлы сама. Без
      // пометки хода, как и текст формы: восстановление заказал человек. Правила в коде те же,
      // что в снимке, — писать нечего.
      const port = host.files;
      if (!files || port === undefined || state.ruleCode === undefined) return;
      if (host.documentOf(loaded.resource) === null) return;
      const current = await readRuleCode(port, loaded.resource, loaded.path);
      if (sameRules(current.rules, state.rules)) return;
      const generator = options.generator?.();
      if (generator === undefined) {
        // Печатать нечем — файлы правил возвращаются текстами снимка.
        for (const [id, text] of state.ruleCode.texts)
          if (text !== null) await port.write(id, text);
        return;
      }
      await writeRuleCode(
        { files: port, generator, refuse: (id) => options.refuse(id, loaded.resource) },
        { document: loaded.resource, base: current, rules: state.rules }
      );
    },
  };
}
