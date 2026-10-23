/**
 * Стек форм ReFormer в ассистенте: вклад точки `FormAssistantStackPoint`.
 *
 * Ассистент общий для стеков: канал к модели, лента, вопросы человеку, отмена хода. Что такое
 * форма ReFormer, какие у модели инструменты, что она видит и как правка ложится в документ —
 * здесь. Сеанс стека живёт столько же, сколько ассистент, к которому стек подключён: в нём память
 * правил по документам для платформы без файлов и загруженная проверка по мета-схеме.
 *
 * @module plugins/reformer/ai/stack
 */

import type {
  FormAssistantStack,
  FormStackSession,
  ResourceId,
} from '@reformer/builder-plugin-api';
import type { CatalogEntry } from '../../../core/catalog';
import { fileRoleOf } from '../../../core/codegen/layout';
import { FORM_SCHEMA_PROVIDER_ID } from '../../../core/form-model';
import type { FileScope } from '../host';
import type { KnowledgeLoader } from '../knowledge';
import { systemPrompt } from '../loop/prompt';
import { parseSchemaText } from '../model/schema-text';
import type { LoadValidateForm, ValidateFormSchema } from '../model/validate';
import { relInScope } from '../files/scope';
import { structuredSlots } from '../tools';
import { fileModeSlots } from '../tools/files';
import { createFilesMode } from './files-mode';
import { createStructuredMode } from './structured';

/** Идентификатор стека — им помечены разобранные им документы. */
export const SCHEMA_FORM_STACK_ID = 'reformer.form-schema';

/** Отказ инструменту плагина в документе формы и его частях. */
const FORM_PART_REFUSAL =
  'The assistant edits the form document itself; a plugin tool cannot write it.';

/** Отказ инструменту плагина в файле правил формы — его ход пишет из черновика правил. */
const RULES_REFUSAL =
  'The assistant writes the form rules itself; a plugin tool cannot write them.';

/** Что стеку нужно от плагина. */
export interface SchemaFormStackOptions {
  /**
   * Каталог активного кита. Функция: кит переключают, и ход обязан идти против того каталога,
   * который действует СЕЙЧАС.
   */
  readonly catalog: () => readonly CatalogEntry[];
  /** Заказ проверки по мета-схеме — его ждёт подготовка хода и строгий гейт записи. */
  readonly validateForm: LoadValidateForm;
  /** Корпус знаний о библиотеке; без него `ask_reformer` отвечает «недоступно». */
  readonly knowledge?: KnowledgeLoader;
  /**
   * Модуль формы документа. Нет — у платформы нет файлов: режима файлов нет, а частей модуля стек
   * не различает.
   */
  readonly scopeOf?: (id: ResourceId) => FileScope | null;
}

/** Собрать стек форм ReFormer. */
export function createSchemaFormStack(options: SchemaFormStackOptions): FormAssistantStack {
  const knowledge = options.knowledge === undefined ? {} : { knowledge: options.knowledge };
  const structuredTools = structuredSlots(knowledge);
  const fileTools = fileModeSlots(knowledge);
  return {
    id: SCHEMA_FORM_STACK_ID,
    // Документ без провайдера модели (открыт текстом) стек тоже пробует: разберётся — это схема.
    applies: (document) =>
      document.providerId === undefined || document.providerId === FORM_SCHEMA_PROVIDER_ID,
    connect(host): FormStackSession {
      let validate: ValidateFormSchema | null = null;
      const prepared = (): ValidateFormSchema => {
        if (validate === null) throw new Error('Стек форм не подготовлен к ходу.');
        return validate;
      };
      const structured = createStructuredMode({
        stack: SCHEMA_FORM_STACK_ID,
        host,
        tools: structuredTools,
        catalog: options.catalog,
        validateForm: options.validateForm,
        prepared,
      });
      const files =
        host.files === undefined || options.scopeOf === undefined
          ? undefined
          : createFilesMode({
              files: host.files,
              tools: fileTools,
              catalog: options.catalog,
              prepared,
              ...knowledge,
              scopeOf: options.scopeOf,
            });

      /**
       * Почему ход не отдаёт ресурс инструменту плагина: документ формы и его шаги ход правит
       * своим механизмом, и вторая дверь к ним разошлась бы с первой. `null` — отдаёт.
       */
      const formPartRefusal = (id: ResourceId, form: ResourceId): string | null => {
        if (id === form) return FORM_PART_REFUSAL;
        const scope = options.scopeOf?.(form) ?? null;
        if (scope === null || host.files === undefined) return null;
        const rel = relInScope(host.files, scope, id);
        if (rel === null) return null;
        const role = fileRoleOf(rel, scope.schemaPath);
        // Файл правил ход тоже пишет сам — из черновика правил вместе со схемой.
        return role === 'form' || role === 'step' || role === 'rules' ? FORM_PART_REFUSAL : null;
      };

      return {
        async prepare() {
          // Одним ожиданием на ход: инструменты внутри хода синхронны, и гейт обязан получить
          // УЖЕ загруженную функцию. Отказ загрузки поднимается наружу: ход без гейта провести
          // нельзя, а сделать вид можно.
          validate = await options.validateForm();
        },
        recognizes(text) {
          try {
            parseSchemaText(text);
            return true;
          } catch {
            return false;
          }
        },
        creationPrompt: () => systemPrompt(options.catalog()),
        refuseWrite(id, form) {
          // Файл правил хода закрыт и у формы без модуля, где роль по пути не определить.
          if (form.loaded?.companions.includes(id) === true) return RULES_REFUSAL;
          return formPartRefusal(id, form.resource);
        },
        structured,
        ...(files === undefined ? {} : { files }),
      };
    },
  };
}
