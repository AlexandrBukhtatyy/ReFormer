/**
 * Структурный режим стека ReFormer: черновик схемы в памяти, одна запись в конце хода.
 *
 * Ассистент проводит попытку и решает, когда писать (форма открыта, текст не разошёлся, человек
 * не отклонил). Здесь — то, что знает только ReFormer: как разобрать документ, что видит модель,
 * как черновик становится текстом и где рядом со схемой лежат правила формы.
 *
 * ## Правила формы — сайдкар
 *
 * Правила структурного режима (`set_form_rules`, `set_render_rules`) копятся в черновике вместе
 * со схемой и ложатся вместе с ней — схема в документ, правила в файл рядом (`../session/rules-file`).
 * Для ассистента файл правил — сопутствующий файл хода: его отменяют и возвращают вместе с формой.
 *
 * @module plugins/reformer/ai/stack/structured
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type {
  FormLandedCompanion,
  FormLandOutcome,
  FormLoaded,
  FormStackHost,
  FormStructuredMode,
  FormStructuredTurn,
  FormToolSlot,
  ResourceId,
} from '@reformer/builder-plugin-api';
import type { CatalogEntry } from '../../../core/catalog';
import { emptyRules, type FormRules } from '../../../core/form-model';
import { createChangeSet, hasChanges, withOutcome, type ChangeSet } from '../model/changeset';
import { parseSchemaText } from '../model/schema-text';
import type { ToolContext, ToolOutcome } from '../model/types';
import type { LoadValidateForm, ValidateFormSchema } from '../model/validate';
import { systemPrompt } from '../loop/prompt';
import { applyChangeSet } from '../session/apply';
import {
  readRulesFile,
  rulesTextBefore,
  rulesTextToWrite,
  type RulesFileBase,
} from '../session/rules-file';
import { formSeed } from './seed';

/** Документ формы, как его разобрал стек: схема и правила на начало хода. */
export interface SchemaState {
  readonly schema: JsonFormSchema;
  readonly rules: FormRules;
  /** Файл правил на начало хода; нет — файлового доступа нет, правила живут в памяти стека. */
  readonly rulesFile?: RulesFileBase;
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
  /** Переопределение системного промпта (тесты). */
  readonly system?: string;
}

/** Попытка структурного хода над схемой. */
export function createSchemaTurn(options: SchemaTurnOptions): SchemaTurn {
  let set = createChangeSet(options.base, options.rules);
  return {
    system: () => options.system ?? systemPrompt(options.catalog),
    seed: () => formSeed(options.base, options.rules),
    context: (): ToolContext => ({
      draft: set.draft,
      base: options.base,
      rules: set.draftRules,
      catalog: options.catalog,
      validateForm: options.validateForm,
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
}

/** Структурный режим одного сеанса стека. */
export function createStructuredMode(options: StructuredModeOptions): FormStructuredMode {
  const { host } = options;

  /**
   * Правила формы по документам — запасной путь для платформы без файлового доступа.
   *
   * Правила формы — сайдкар: файл рядом со схемой. Ход читает его на старте и пишет в конце, а эта
   * память нужна только там, где файлов нет (`host.files` не дан), — иначе ассистенту пришлось бы
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
      // Файл правил читается на каждом ходу заново: его правят и мимо ассистента.
      const { rules, ...rulesFile } = await readRulesFile(files, resource, path);
      const state: SchemaState = { schema, rules, rulesFile };
      return { stack: options.stack, resource, path, text, state, companions: [rulesFile.id] };
    },

    begin(loaded) {
      const { schema, rules } = stateOf(loaded);
      return createSchemaTurn({
        base: schema,
        rules,
        catalog: options.catalog(),
        validateForm: options.prepared(),
      });
    },

    hasChanges: (set) => hasChanges(set as ChangeSet),

    async land({ loaded, set, mark, force }): Promise<FormLandOutcome> {
      const state = stateOf(loaded);
      const changes = set as ChangeSet;
      const applied = await applyChangeSet(
        {
          host: {
            documentOf: (id) => host.documentOf(id),
            writeText: (id, text, writeMark) => host.writeText(id, text, writeMark),
            catalog: options.catalog,
            ...(host.files === undefined ? {} : { files: host.files }),
          },
          validateForm: options.validateForm,
        },
        {
          set: changes,
          resource: loaded.resource,
          baseText: loaded.text,
          ...(mark.txId === undefined ? {} : { txId: mark.txId }),
          ...(state.rulesFile === undefined ? {} : { rulesFile: state.rulesFile }),
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
      // Правила уезжают в память вместе с применением, а не раньше: набор, который не лёг,
      // не должен менять то, от чего пойдёт следующий ход.
      rulesByResource.set(loaded.resource, changes.draftRules);
      const companions: FormLandedCompanion[] = [];
      const files = host.files;
      const rulesFile = state.rulesFile;
      if (rulesFile !== undefined && files !== undefined) {
        const after = await files.read(rulesFile.id);
        // Отмена файл правил не удаляет (удаления у плагинов нет), а очищает: до хода его не было —
        // значит, правил не было.
        if (after !== null && after !== rulesFile.text) {
          companions.push({ id: rulesFile.id, before: rulesTextBefore(rulesFile), after });
        }
      }
      return applied.rulesBroken === true && rulesFile !== undefined
        ? {
            status: 'applied',
            companions,
            broken: { id: rulesFile.id, error: rulesFile.broken ?? '' },
          }
        : { status: 'applied', companions };
    },

    async rewind(loaded, { files }) {
      const state = stateOf(loaded);
      rulesByResource.set(loaded.resource, state.rules);
      // Файл правил возвращается только «Восстановить»: отмена хода уже вернула его сама. Без
      // пометки хода, как и текст формы: восстановление заказал человек. Файла не было и правил в
      // снимке нет — писать нечего; битый файл не трогается, как и при ходе.
      const port = host.files;
      if (!files || port === undefined || host.documentOf(loaded.resource) === null) return;
      const current = await readRulesFile(port, loaded.resource, loaded.path);
      if (current.broken !== undefined) return;
      const text = rulesTextToWrite(current, state.rules);
      if (text !== null) await port.write(current.id, text);
    },
  };
}
