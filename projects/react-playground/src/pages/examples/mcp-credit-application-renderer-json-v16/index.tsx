/**
 * iter-16 / renderer-json — page entry.
 *
 * Wires:
 * 1. createForm<CreditApplicationForm>({ form, validation, behavior }) — TS schema.
 * 2. JsonFormApp closure-pattern wrapper — injects form into FormRoot.
 * 3. Registry — extended at runtime with WIZARD_CONFIG / onSubmit / form sources.
 *
 * G3-iter15 cookbook recipe (JsonFormApp) used to keep boilerplate ~30 LOC.
 */
import { useMemo, useState } from 'react';
import { createForm } from '@reformer/core';
import { FormField } from '@reformer/ui-kit';

import { formSchema, fullValidation, formBehavior, STEP_VALIDATIONS } from './schema';
import { jsonSchema } from './json-schema';
import { buildRegistry } from './registry';
import { JsonFormApp } from './JsonFormApp';
import type { CreditApplicationForm } from './types';

export default function MccaRendererJsonV16() {
  const [submittedValues, setSubmittedValues] = useState<CreditApplicationForm | null>(null);

  const form = useMemo(
    () =>
      createForm<CreditApplicationForm>({
        form: formSchema,
        validation: fullValidation,
        behavior: formBehavior,
      }),
    []
  );

  // Build the registry at runtime with closures (form, onSubmit, config) merged in
  const registry = useMemo(() => {
    const handleSubmit = async () => {
      const values = form.getValue();
      console.log('[mcc-rj-v16] submitted values', values);
      setSubmittedValues(values);
      alert('Заявка отправлена. Подробности в консоли.');
    };

    return buildRegistry({
      sources: {
        WIZARD_CONFIG: {
          stepValidations: STEP_VALIDATIONS,
          fullValidation,
        },
        handleSubmit,
        FORM: form,
      },
    });
  }, [form]);

  // Augment the JSON schema's FormWizard node — set componentProps.form/config/onSubmit
  // via source-name strings (resolved by registry at render time).
  const wiredJsonSchema = useMemo(() => {
    // shallow-clone schema so we don't mutate the imported constant
    const cloned = JSON.parse(JSON.stringify(jsonSchema)) as typeof jsonSchema;
    const wizardNode =
      cloned.root && 'children' in cloned.root && cloned.root.children
        ? cloned.root.children.find(
            (c) => 'component' in c && c.component === 'FormWizard'
          )
        : undefined;
    if (wizardNode && 'componentProps' in wizardNode) {
      wizardNode.componentProps = {
        ...(wizardNode.componentProps ?? {}),
        form: 'FORM',
        config: 'WIZARD_CONFIG',
        onSubmit: 'handleSubmit',
      };
    }
    return cloned;
  }, []);

  return (
    <div className="mx-auto max-w-3xl py-8 px-4">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-2">
          Заявка на кредит — renderer-json (iter-16)
        </h1>
        <p className="text-sm text-gray-500">
          Полная реализация спеки через `@reformer/renderer-json` + closure pattern.
        </p>
      </header>

      <JsonFormApp<CreditApplicationForm>
        schema={wiredJsonSchema}
        form={form}
        registry={registry}
        fieldWrapper={FormField}
      />

      {submittedValues ? (
        <pre className="mt-6 rounded border bg-gray-50 p-4 text-xs overflow-x-auto">
          {JSON.stringify(submittedValues, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
