/**
 * CreditApplicationFormRenderer
 *
 * Та же форма кредитной заявки, но с использованием renderSchema API.
 * Демонстрирует полностью декларативный подход к описанию сложных multi-step форм.
 *
 * Использует:
 * - FormRenderer с пользовательским CreditApplicationWizard компонентом
 * - Единую renderSchema для всей формы (включая навигацию)
 * - Переиспользует типы, схему, валидацию и API из complex-multy-step-form
 */

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { createForm } from '@reformer/core';
import { createCreditApplicationModel } from '../complex-multy-step-form/schemas/model';
import { creditApplicationBehavior } from '../complex-multy-step-form/schemas/behavior';
import { FormRenderer } from '@reformer/renderer-react';
import type { RenderSchemaProxy } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';
import { buildCreditApplicationSchema, createCreditApplicationRenderSchema } from './render-schema';
import type { CreditApplicationForm } from '../complex-multy-step-form/types/credit-application';

// Демо-панель для демонстрации программного управления схемой
function SchemaControlPanel({ schema }: { schema: RenderSchemaProxy<CreditApplicationForm> }) {
  const [mortgageHidden, setMortgageHidden] = useState(false);
  const [carHidden, setCarHidden] = useState(false);
  const [employerTitle, setEmployerTitle] = useState('Информация о работодателе');
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left group"
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-blue-600 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-blue-600 shrink-0" />
        )}
        <span className="text-sm font-semibold text-blue-800 group-hover:text-blue-600">
          Программное управление схемой (createRenderSchema)
        </span>
        <span className="text-xs text-blue-700 font-normal">
          — управление через сигналы, перерисовывается только затронутая нода
        </span>
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
              onClick={() => {
                const next = !mortgageHidden;
                setMortgageHidden(next);
                if (next) {
                  schema.node('mortgage-section').setHidden(true);
                } else {
                  schema.node('mortgage-section').resetHidden();
                }
              }}
            >
              Секция ипотеки: {mortgageHidden ? 'скрыта' : 'авто'}
            </button>
            <button
              className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
              onClick={() => {
                const next = !carHidden;
                setCarHidden(next);
                if (next) {
                  schema.node('car-section').setHidden(true);
                } else {
                  schema.node('car-section').resetHidden();
                }
              }}
            >
              Секция авто: {carHidden ? 'скрыта' : 'авто'}
            </button>
            <button
              className="rounded bg-purple-600 px-3 py-1.5 text-xs text-white hover:bg-purple-700"
              onClick={() => {
                const next =
                  employerTitle === 'Информация о работодателе'
                    ? '🏢 Место работы (обновлено программно)'
                    : 'Информация о работодателе';
                setEmployerTitle(next);
                schema.node('employer-section').patchProps({ title: next });
              }}
            >
              Заголовок работодателя: переключить
            </button>
            <button
              className="rounded bg-gray-500 px-3 py-1.5 text-xs text-white hover:bg-gray-600"
              onClick={() => {
                setMortgageHidden(false);
                setCarHidden(false);
                setEmployerTitle('Информация о работодателе');
                schema.node('mortgage-section').resetHidden();
                schema.node('car-section').resetHidden();
                schema.node('employer-section').resetProps();
              }}
            >
              Сбросить всё
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreditApplicationFormRenderer() {
  // M1, единая схема: форма строится ИЗ render-схемы (без отдельной схемы формы).
  const { form, model } = useMemo(() => {
    const model = createCreditApplicationModel();
    // Дерево БЕЗ form (чтобы harvest не обходил FormProxy) → createForm строит ноды + массивы.
    const form = createForm<CreditApplicationForm>({
      model,
      schema: buildCreditApplicationSchema(model),
      behavior: creditApplicationBehavior,
    });
    return { model, form };
  }, []);
  // Render-схема (то же дерево + form для wizard) + применённое render-поведение
  const schema = useMemo(() => createCreditApplicationRenderSchema(model, form), [model, form]);

  return (
    <div className="w-full">
      <SchemaControlPanel schema={schema} />
      <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
    </div>
  );
}

export default CreditApplicationFormRenderer;
