/**
 * CreditApplicationFormRenderer
 *
 * Та же форма кредитной заявки, но с использованием renderSchema API.
 * Демонстрирует полностью декларативный подход к описанию сложных multi-step форм.
 *
 * Использует:
 * - FormRendererWithNavigation для рендеринга NavigationRenderNode
 * - Единую renderSchema для всей формы (включая навигацию)
 * - Переиспользует типы, схему, валидацию и API из complex-multy-step-form
 */

import { useMemo } from 'react';
import { createCreditApplicationForm } from '../complex-multy-step-form/schemas/create-credit-application-form';
import { useLoadCreditApplication } from '../complex-multy-step-form/hooks/useLoadCreditApplication';
import { FormRendererWithNavigation } from '@reformer/ui/form-navigation';
import { FormField } from '@/components/ui/form-field';
import { Button } from '@/components/ui/button';
import { creditApplicationRenderSchema } from './render-schema';

function CreditApplicationFormRenderer() {
  // Инициализируем форму (мемоизируем, чтобы не пересоздавать при каждом рендере)
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Загружаем данные заявки
  const { isLoading, error } = useLoadCreditApplication(form, '1');

  // Рендер: Загрузка
  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center p-12">
        <div className="text-center space-y-4">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <div className="text-lg text-gray-600">Загрузка данных...</div>
          <div className="text-sm text-gray-500">Пожалуйста, подождите</div>
        </div>
      </div>
    );
  }

  // Рендер: Ошибка
  if (error) {
    return (
      <div className="w-full">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center space-y-4">
          <div className="text-red-600 text-5xl">!</div>
          <div className="text-xl font-semibold text-red-800">Ошибка загрузки</div>
          <div className="text-red-700">{error}</div>
          <Button onClick={() => window.location.reload()}>Попробовать снова</Button>
        </div>
      </div>
    );
  }

  // Рендер: Форма через FormRendererWithNavigation
  return (
    <div className="w-full">
      <FormRendererWithNavigation
        form={form}
        render={creditApplicationRenderSchema}
        fieldWrapper={FormField}
      />
    </div>
  );
}

export default CreditApplicationFormRenderer;
