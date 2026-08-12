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

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { createCreditApplicationModel } from '../complex-multy-step-form/schemas/model';
import { creditApplicationBehavior } from '../complex-multy-step-form/schemas/behavior';
import { FormRenderer, createReactForm, useReactForm } from '@reformer/renderer-react';
import type { RenderSchemaProxy } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { fileUploadMessages } from '../complex-multy-step-form/constants/file-upload-messages';
import { buildCreditApplicationSchema } from './render-schema';
import { createCreditApplicationRenderBehavior } from './render-behavior';
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
  // Сборка ОДНИМ вызовом: модель + форма + render-схема + поведение. Двойной проход по билдеру
  // (без формы — для нод, с формой — для рендера wizard-узла) фабрика делает сама.
  const creditForm = useReactForm(() =>
    createReactForm<CreditApplicationForm>({
      model: createCreditApplicationModel(),
      schema: buildCreditApplicationSchema,
      behavior: creditApplicationBehavior,
      renderBehavior: (form) => createCreditApplicationRenderBehavior(form),
    })
  );

  return (
    <div className="w-full">
      <SchemaControlPanel schema={creditForm.render} />
      {/* Резолвер текстов для кодов отбора FileUpload (поле «Документы», шаг 5). */}
      <ValidationMessagesProvider resolver={fileUploadMessages}>
        <FormRenderer form={creditForm} settings={{ fieldWrapper: FormField }} />
      </ValidationMessagesProvider>
    </div>
  );
}

export default CreditApplicationFormRenderer;
