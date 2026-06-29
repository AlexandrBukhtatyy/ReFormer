/**
 * CreditApplicationFormRendererJson
 *
 * Та же форма кредитной заявки, но layout описан в JSON-схеме.
 *
 * Архитектура (файлы в папке):
 * - [json-schema.ts] — layout формы.
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
} from '@reformer/renderer-json';
import { createCreditApplicationModel } from '../complex-multy-step-form/schemas/model';
import { setupCreditApplicationBehavior } from '../complex-multy-step-form/schemas/behavior';
import type { CreditApplicationForm } from '../complex-multy-step-form/types/credit-application';
import { creditApplicationJsonSchema } from './json-schema';
import { createCreditApplicationRegistry } from './registry';
import { createCreditApplicationJsonRenderBehavior } from './render-behavior';

export default function CreditApplicationFormRendererJson() {
  const registry = useMemo(() => createCreditApplicationRegistry(), []);
  // M1, единая схема: модель + форма строятся ИЗ JSON-схемы (без отдельной схемы формы).
  const { model, form } = useMemo(() => {
    const model = createCreditApplicationModel();
    const form = createForm<CreditApplicationForm>({
      model,
      schema: convertJsonToM1Tree(creditApplicationJsonSchema, registry, model),
    });
    return { model, form };
  }, [registry]);
  // Реактивное поведение (computeFrom/enableWhen/watchField) на модели + нодах
  useEffect(() => setupCreditApplicationBehavior(model, form), [model, form]);
  const renderBehavior = useMemo(
    () => createCreditApplicationJsonRenderBehavior(form, model),
    [form, model]
  );

  return (
    <div className="w-full">
      <JsonRendererProvider settings={{ registry, model }}>
        <JsonFormRenderer<CreditApplicationForm>
          schema={creditApplicationJsonSchema}
          renderBehavior={renderBehavior}
        />
      </JsonRendererProvider>
    </div>
  );
}
