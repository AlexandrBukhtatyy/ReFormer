/**
 * HTML-узлы в схеме — мини-пример, две колонки с одинаковым результатом:
 *
 * - слева типизованная RenderSchema (`component: 'div'`, `children: [model.$.x]`),
 * - справа JSON-схема (`"$html(div)"`, `"children": ["$model(x)"]`).
 *
 * Каждая колонка со своей моделью, чтобы видеть, что реактивный текст обновляется независимо
 * и подписан именно на свою модель.
 */

import { useMemo } from 'react';
import { createForm } from '@reformer/core';
import { FormRenderer } from '@reformer/renderer-react';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  createJsonForm,
  useJsonForm,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import { FormField } from '@reformer/ui-kit';
import { createInstallmentModel, type InstallmentRequest } from './model';
import { buildInstallmentSchema } from './react-schema';
import { createHtmlNodesRegistry } from './registry';
import rawJsonSchema from './json-schema.json';

// Чистый JSON приходит как данные: операторы-строки типизируются как `string`, поэтому
// приведение к JsonFormSchema здесь — тот же сценарий, что «схема пришла с сервера».
const installmentJsonSchema = rawJsonSchema as unknown as JsonFormSchema<InstallmentRequest>;

/** Панель-обёртка колонки: заголовок + подпись, чем эта колонка отличается. */
function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white p-6 rounded-lg shadow-md">
      <header className="mb-4">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500 mt-1">{hint}</p>
      </header>
      {children}
    </section>
  );
}

function TypedSchemaColumn() {
  const { model, form } = useMemo(() => {
    const model = createInstallmentModel();
    const form = createForm<InstallmentRequest>({ model, schema: buildInstallmentSchema(model) });
    return { model, form };
  }, []);
  void form; // форма нужна ради нод состояния полей; рендер идёт по схеме

  const schema = useMemo(() => () => buildInstallmentSchema(model), [model]);

  return (
    <Panel
      title="RenderSchema (renderer-react)"
      hint="component: 'div' | 'h2' | 'hr', children: [model.$.fullName]"
    >
      <div data-testid="typed-schema">
        <FormRenderer<InstallmentRequest> render={schema} settings={{ fieldWrapper: FormField }} />
      </div>
    </Panel>
  );
}

function JsonSchemaColumn() {
  // Сборка одним проходом (§7): бандл createJsonForm, стабильный через useJsonForm (ленивый useState).
  // Модель отдаём готовой (createInstallmentModel) — начальные значения те же.
  const jsonForm = useJsonForm(() =>
    createJsonForm<InstallmentRequest>({
      schema: installmentJsonSchema,
      registry: createHtmlNodesRegistry(),
      model: createInstallmentModel(),
    })
  );

  return (
    <Panel
      title="JSON-схема (renderer-json)"
      hint='component: "$html(div)", children: ["$model(fullName)"]'
    >
      <div data-testid="json-schema">
        <JsonRendererProvider settings={{ registry: jsonForm.registry }}>
          <JsonFormRenderer<InstallmentRequest>
            form={jsonForm}
            validateSchema={import.meta.env.DEV}
          />
        </JsonRendererProvider>
      </div>
    </Panel>
  );
}

export default function HtmlNodesExample() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <TypedSchemaColumn />
      <JsonSchemaColumn />
    </div>
  );
}
