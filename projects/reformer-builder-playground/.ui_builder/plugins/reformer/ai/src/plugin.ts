/**
 * Стек форм ReFormer в ассистенте — вклад в точку `FormAssistantStackPoint`.
 *
 * Ассистент — общий плагин (`plugins/forms/ai`, `reformer.ai`): канал к модели, лента, вопросы
 * человеку, отмена хода. Что такое форма ReFormer, какие у модели инструменты, что она видит и
 * как правка ложится в документ — здесь: стек (`./stack`) со своими инструментами (`./tools`),
 * промптом (`./loop`), корпусом знаний о библиотеке (`./knowledge`) и рабочей областью
 * (`./stack/workspace`). Ассистент спрашивает точку на каждый ход, поэтому порядок активации
 * плагинов не важен.
 *
 * @module plugins/reformer/ai/plugin
 */

import {
  definePlugin,
  FormAssistantStackPoint,
  type Plugin,
  type PluginContext,
} from '@reformer/builder-plugin-api';
import manifest from './manifest.json';
import { createKnowledgeLoader } from './knowledge';
import type { LoadValidateForm, ValidateFormSchema } from './model/validate';
import { createSchemaFormStack } from './stack';
import { schemaStackWorkspace, type SchemaStackWorkspace } from './stack/workspace';

/** Идентификатор плагина стека. */
export const AI_SCHEMA_PLUGIN_ID = manifest.id;

/** Что плагину приходится получить снаружи. */
export interface SchemaStackPluginOptions {
  /** Рабочая область стека целиком — только для теста, зовущего плагин без реестра служб. */
  readonly workspace?: SchemaStackWorkspace;
}

/**
 * Загрузка проверки по мета-схеме form-DSL — одна на плагин, память в ЗАМЫКАНИИ.
 *
 * Не модульный синглтон, и это то же решение, что у отложенной проверки валидатора схемы:
 * общая на модуль ячейка означала бы, что два плагина (тест и приложение, два окна) делят
 * одну загрузку, и порядок тестов начинает влиять на их результат. Здесь ячейка живёт
 * столько же, сколько активация.
 *
 * Промис запоминается ЦЕЛИКОМ, а не его результат: параллельные заказы (активация и первый
 * ход, случившийся раньше её завершения) обязаны дождаться одной и той же загрузки, а не
 * завести вторую.
 *
 * Отказ НЕ гасится, в отличие от валидатора схемы: там пустая ячейка — состояние с
 * определённым поведением (находок мета-схемы нет), а здесь на этой функции стоит барьер
 * перед записью, и «загрузка не удалась» обязана дойти до вызывающего отказом. Ход при этом
 * упадёт строкой ошибки в панели, а не молча применит непроверенное.
 *
 * Неудача при этом НЕ запоминается: ячейка освобождается, и следующий ход пробует снова.
 * Запомнить её значило бы, что одна сорвавшаяся загрузка выключает ассистента до перезагрузки
 * страницы, — а поводов у сети сорваться ровно один раз предостаточно. Стучаться без конца
 * это не даёт: повтор случается на действие пользователя, а не по таймеру.
 *
 * @param loader - чем грузить; подменяется в тестах, чтобы не тянуть настоящий модуль.
 */
export function createValidateFormLoader(
  loader: () => Promise<{ validateFormSchema: ValidateFormSchema }> = () =>
    import('@reformer/renderer-json/validate')
): LoadValidateForm {
  let started: Promise<ValidateFormSchema> | undefined;
  return () => {
    started ??= loader().then(
      (module) => module.validateFormSchema,
      (error: unknown) => {
        started = undefined;
        throw error;
      }
    );
    return started;
  };
}

/**
 * Плагин стека. `activate` только регистрирует: стек подключается к ассистенту лениво, на первый
 * ход по форме ReFormer.
 */
export function createSchemaStackPlugin(options: SchemaStackPluginOptions = {}): Plugin {
  return definePlugin({
    id: AI_SCHEMA_PLUGIN_ID,
    activate(ctx: PluginContext) {
      const workspace = options.workspace ?? schemaStackWorkspace(ctx);
      const validateForm = createValidateFormLoader();
      const stack = createSchemaFormStack({
        catalog: () => workspace.catalog(),
        validateForm,
        knowledge: createKnowledgeLoader(() => workspace.projectFiles()),
        scopeOf: (id) => workspace.scopeOf(id),
        door: (id) => workspace.door(id),
      });
      ctx.subscriptions.push(
        ctx.extensions.contribute(FormAssistantStackPoint, stack, { id: stack.id })
      );

      // Заказ, а не ожидание: `activate` только регистрирует, и держать на себе сеть ей нельзя.
      // Модуль едет параллельно оболочке и успевает задолго до первого вопроса пользователя —
      // между активацией и первым ходом лежит как минимум набранная им строка.
      //
      // Отказ здесь гасится ТОЛЬКО как необработанный промис: ячейка загрузки его не запомнила,
      // и следующий ход попробует снова, а если снова не выйдет — скажет об этом в панели.
      void validateForm().catch((error: unknown) => {
        console.warn('[plugins/reformer/ai] проверка по мета-схеме не загрузилась', error);
      });
    },
  });
}
