/**
 * HTML-узлы в схеме — мини-пример, две колонки с одинаковым результатом:
 *
 * - слева схема на TS (`component: 'div'`, `children: [model.$.x]`),
 * - справа та же схема документом JSON (`"$html(div)"`, `"children": ["$model(x)"]`).
 *
 * Сборка и рендерер у колонок одни и те же — `createForm` и `FormRenderer`; отличается только вид
 * схемы: билдер `(model) => узел` или документ с реестром.
 *
 * Каждая колонка со своей моделью, чтобы видеть, что реактивный текст обновляется независимо
 * и подписан именно на свою модель.
 */

import { createForm, useFormBundle } from '@reformer/core';
import { FormRenderer } from '@reformer/renderer-react';
import type { JsonFormSchema } from '@reformer/renderer-json';
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
  // Сборка одним вызовом: форма нужна ради нод состояния полей, рендер идёт по её же схеме.
  const installmentForm = useFormBundle(() =>
    createForm<InstallmentRequest>({
      model: createInstallmentModel(),
      schema: buildInstallmentSchema,
    })
  );

  return (
    <Panel title="Схема на TS" hint="component: 'div' | 'h2' | 'hr', children: [model.$.fullName]">
      <div data-testid="typed-schema">
        <FormRenderer<InstallmentRequest>
          form={installmentForm}
          settings={{ fieldWrapper: FormField }}
        />
      </div>
    </Panel>
  );
}

function JsonSchemaColumn() {
  // Та же сборка: схема — документ, дерево из него строит реестр. Модель отдаём готовой
  // (createInstallmentModel) — начальные значения те же.
  const jsonForm = useFormBundle(() =>
    createForm<InstallmentRequest>({
      schema: installmentJsonSchema,
      registry: createHtmlNodesRegistry(),
      model: createInstallmentModel(),
    })
  );

  return (
    <Panel
      title="Схема документом JSON"
      hint='component: "$html(div)", children: ["$model(fullName)"]'
    >
      <div data-testid="json-schema">
        {/* Обёртку поля рендерер берёт из бандла: её положил туда реестр (FIELD_WRAPPER). */}
        <FormRenderer<InstallmentRequest> form={jsonForm} />
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
