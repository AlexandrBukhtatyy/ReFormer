/**
 * CreditApplicationFormRendererJson
 *
 * Та же форма кредитной заявки, но layout описан в JSON-схеме.
 *
 * Архитектура (файлы в папке):
 * - [json-schema.json] — layout формы как ЧИСТЫЙ JSON (операторы — строки `$model(...)` и т.п.;
 *   так схема может прийти строкой с сервера/CMS).
 * - [registry.ts] — реестр компонентов и source-значений.
 * - [render-behavior.ts] — обёртка над TS-variant behavior-ом: инжектит форму
 *   в wizard через `onInit`, делегирует остальное.
 * - [RegistrationFormRendererJson.tsx] — этот файл: создаёт форму, собирает
 *   реестр/behavior, рендерит JsonFormRenderer внутри JsonRendererProvider.
 */

import { useEffect, useMemo } from 'react';
import { createForm } from '@reformer/core';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  convertJsonToM1Tree,
  type JsonFormSchema,
  type ComponentRegistry,
} from '@reformer/renderer-json';
import { createCreditApplicationModel } from '../complex-multy-step-form/schemas/model';
import { setupCreditApplicationBehavior } from '../complex-multy-step-form/schemas/behavior';
import type { CreditApplicationForm } from '../complex-multy-step-form/types/credit-application';
import rawJsonSchema from './json-schema.json';
import { createCreditApplicationRegistry } from './registry';
import { createCreditApplicationJsonRenderBehavior } from './render-behavior';

// Чистый JSON импортируется как данные; операторы-строки (`$model(...)`) типизируются как `string`,
// поэтому приводим к JsonFormSchema (это и есть сценарий «схема пришла строкой с сервера»).
const creditApplicationJsonSchema = rawJsonSchema as unknown as JsonFormSchema;

/**
 * Строит модель + форму из JSON-схемы. Конвертация обёрнута в try/catch: при битой схеме
 * (напр. неизвестный `$component`) `convertJsonToM1Tree` кинул бы ДО рендера JsonFormRenderer
 * и опередил его панель ошибок. На ошибке `form=null` → renderBehavior не вешаем, а
 * JsonFormRenderer (`validate`) сам покажет SchemaErrorPanel вместо формы.
 *
 * Вынесено из `useMemo` отдельной функцией: try/catch в теле мемо ломает React-Compiler
 * (`preserve-manual-memoization`), а вызов-одной-строкой компилятор сохраняет.
 */
function buildModelAndForm(registry: ComponentRegistry) {
  const model = createCreditApplicationModel();
  try {
    const form = createForm<CreditApplicationForm>({
      model,
      schema: convertJsonToM1Tree(creditApplicationJsonSchema, registry, model),
    });
    return { model, form };
  } catch (err) {
    console.error('[json-renderer] schema conversion failed:', err);
    return { model, form: null };
  }
}

export default function CreditApplicationFormRendererJson() {
  const registry = useMemo(() => createCreditApplicationRegistry(), []);
  // M1, единая схема: модель + форма строятся ИЗ JSON-схемы (без отдельной схемы формы).
  const { model, form } = useMemo(() => buildModelAndForm(registry), [registry]);
  // Реактивное поведение (computeFrom/enableWhen/watchField) на модели + нодах
  useEffect(() => {
    if (form) return setupCreditApplicationBehavior(model, form);
  }, [model, form]);
  const renderBehavior = useMemo(
    () => (form ? createCreditApplicationJsonRenderBehavior(form, model) : undefined),
    [form, model]
  );

  return (
    <div className="w-full">
      <JsonRendererProvider settings={{ registry, model }}>
        <JsonFormRenderer<CreditApplicationForm>
          schema={creditApplicationJsonSchema}
          renderBehavior={renderBehavior}
          validate={import.meta.env.DEV}
        />
      </JsonRendererProvider>
    </div>
  );
}
