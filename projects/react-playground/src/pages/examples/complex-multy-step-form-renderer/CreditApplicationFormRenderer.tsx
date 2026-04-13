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
import { createCreditApplicationForm } from '../complex-multy-step-form/schemas/create-credit-application-form';
import { useLoadCreditApplication } from '../complex-multy-step-form/hooks/useLoadCreditApplication';
import { FormRenderer } from '@reformer/renderer-react';
import type { RenderSchemaProxy } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';
import { createCreditApplicationRenderSchema } from './render-schema';
import { LoadingState } from '../complex-multy-step-form/components/ui/LoadingState';
import { ErrorState } from '../complex-multy-step-form/components/ui/ErrorState';
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
        <span className="text-xs text-blue-500 font-normal">
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
  // Инициализируем форму (мемоизируем, чтобы не пересоздавать при каждом рендере)
  const form = useMemo(() => createCreditApplicationForm(), []);
  // Создаём схему с формой и применённым поведением
  const schema = useMemo(() => createCreditApplicationRenderSchema(form), [form]);

  // Загружаем данные заявки
  const { isLoading, error } = useLoadCreditApplication(form, '1');

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="w-full">
      <SchemaControlPanel schema={schema} />
      <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
    </div>
  );
}

export default CreditApplicationFormRenderer;
