import { useMemo, useCallback } from 'react';
import { Button, FormField } from '@reformer/ui-kit';
import {
  FormRenderer,
  createRenderSchema,
  type RenderSchemaFn,
  type ContainerRenderNode,
} from '@reformer/renderer-react';
import { JsonRendererProvider, createRenderSchemaFromJson } from '@reformer/renderer-json';

import { createCreditApplicationForm } from './schema';
import { creditApplicationJsonSchema } from './render-schema';
import { registry } from './registry';
import type { CreditApplicationForm } from './types';

export default function McpCreditApplicationRendererJsonV2() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const schema = useMemo(() => {
    // Wrap the JSON-derived RenderSchemaFn so the root container receives the live form.
    const factory: RenderSchemaFn<CreditApplicationForm> = (path) => {
      const baseFn = createRenderSchemaFromJson<CreditApplicationForm>(
        creditApplicationJsonSchema,
        registry
      );
      const baseRoot = baseFn(path) as ContainerRenderNode<CreditApplicationForm>;
      return {
        ...baseRoot,
        componentProps: { ...baseRoot.componentProps, form },
      } as ContainerRenderNode<CreditApplicationForm>;
    };
    return createRenderSchema<CreditApplicationForm>(factory);
  }, [form]);

  const handleSubmit = useCallback(async () => {
    form.markAsTouched();
    const ok = await form.validate();
    const value = form.getValue();

    console.log('[mcp-credit-renderer-json-v2] submit', { ok, value });
  }, [form]);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Заявка на кредит — renderer-json v2</h1>
      <p className="text-sm text-gray-600 mb-6">
        Demo: JSON-схема + ui-kit + Tailwind. Все 6 шагов отрендерены вертикально через Section/Box.
      </p>

      <JsonRendererProvider settings={{ registry, fieldWrapper: FormField }}>
        <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
      </JsonRendererProvider>

      <div className="mt-6 flex gap-2">
        <Button onClick={handleSubmit}>Отправить заявку</Button>
      </div>
    </div>
  );
}
