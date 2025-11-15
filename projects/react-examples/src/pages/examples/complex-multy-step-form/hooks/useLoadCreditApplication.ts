/**
 * Хук для загрузки данных кредитной заявки
 *
 * Загружает:
 * - Данные заявки из API
 * - Справочники (банки, города)
 * - Заполняет форму через form.setValue()
 */

import { useEffect, useState } from 'react';
import type { GroupNodeWithControls } from 'reformer';
import type { CreditApplicationForm } from '../types/credit-application';
import {
  fetchCreditApplication,
  fetchDictionaries,
  type DictionariesResponse,
} from '.././api/mock-credit-application-api';
import type { Property } from '../components/nested-forms/Property/PropertyForm';
import type { ExistingLoan } from '../components/nested-forms/ExistingLoan/ExistingLoanForm';

// ============================================================================
// Типы
// ============================================================================

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// Функция заполнения формы данными полученными от сервера - маппинг данных
// ============================================================================
const patchFormValue = (
  form: GroupNodeWithControls<CreditApplicationForm>,
  data: Partial<CreditApplicationForm>,
  dictionaries: DictionariesResponse
) => {
  // ======================================================================
  // Заполнение формы через patchValue
  // ======================================================================
  // patchValue рекурсивно заполняет все поля, включая вложенные формы и массивы
  // Использует Partial<T>, поэтому не требует as any
  form.patchValue(data);

  // ======================================================================
  // Обновление динамических справочников через updateComponentProps
  // ======================================================================

  // Обновляем опции городов для адреса регистрации
  // registrationAddress - это GroupNodeWithControls<Address> с полем city
  form.registrationAddress.city.updateComponentProps({
    options: dictionaries.cities,
  });

  // Обновляем опции городов для адреса проживания
  // residenceAddress - это тоже GroupNodeWithControls<Address>
  form.residenceAddress?.city.updateComponentProps({
    options: dictionaries.cities,
  });

  // Обновляем опции типов имущества для всех элементов массива properties
  // properties - это ArrayNode<Property>
  // forEach возвращает GroupNode элементы, а не значения
  form.properties?.forEach((propertyNode: GroupNodeWithControls<Property>) => {
    propertyNode.type.updateComponentProps({
      options: dictionaries.propertyTypes,
    });
  });

  // Обновляем опции банков для всех элементов массива existingLoans
  // existingLoans - это ArrayNode<ExistingLoan>
  // forEach возвращает GroupNode элементы, а не значения
  form.existingLoans?.forEach((loanNode: GroupNodeWithControls<ExistingLoan>) => {
    loanNode.bank.updateComponentProps({
      options: dictionaries.banks,
    });
  });
};

// ============================================================================
// Хук загрузки данных
// ============================================================================

export const useLoadCreditApplication = (
  form: GroupNodeWithControls<CreditApplicationForm>,
  applicationId: string | null
) => {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: !!applicationId, // Загружаем только если есть ID
    error: null,
  });

  useEffect(() => {
    // Если нет ID, не загружаем
    if (!applicationId) {
      setLoadingState({ isLoading: false, error: null });
      return;
    }

    const loadData = async () => {
      try {
        setLoadingState({ isLoading: true, error: null });

        // Параллельная загрузка данных и справочников
        const [applicationResponse, dictionariesResponse] = await Promise.all([
          fetchCreditApplication(applicationId),
          fetchDictionaries(),
        ]);

        // Проверка ошибок
        if (!applicationResponse.success) {
          throw new Error(applicationResponse.error || 'Ошибка загрузки заявки');
        }

        if (!dictionariesResponse.success) {
          throw new Error(dictionariesResponse.error || 'Ошибка загрузки справочников');
        }

        // Обновляем данные формы и словари
        patchFormValue(form, applicationResponse.data!, dictionariesResponse.data!);

        // Успешная загрузка
        setLoadingState({ isLoading: false, error: null });
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        setLoadingState({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        });
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]); // Перезагружаем только при изменении ID (form стабилен)

  return loadingState;
};
