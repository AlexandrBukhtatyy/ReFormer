/**
 * Форма регистрации, отрендеренная из JSON-схемы.
 *
 * Тот же результат, что у TS-варианта [registration-form](../registration-form/RegistrationForm.tsx),
 * но обязанности разведены по трём файлам:
 *
 * - [json-schema.json] — ВЕСЬ layout: поля, сетка колонок, заголовки, кнопки, блок подсказок.
 *   Чистый JSON — может прийти строкой с сервера.
 * - [validation.ts] — правила значений TS-схемой над моделью (в JSON-DSL валидаторов нет).
 * - [registry.ts] — компоненты полей и обработчики кнопок: то, что JSON выразить не может.
 *
 * Этот файл — только монтаж и submit-флоу.
 */

import { useMemo, useState } from 'react';
import { createModel, createForm, validateFormModel } from '@reformer/core';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  convertJsonToM1Tree,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import type { RegistrationFormData } from '../registration-form/RegistrationForm';
import { FormStateDisplay } from '../registration-form/FormSateDisplay';
import { buildValidationSchema } from './validation';
import { createRegistrationRegistry, type FormActions } from './registry';
import rawJsonSchema from './json-schema.json';

// Операторы в чистом JSON типизируются как `string`, поэтому приведение — это и есть
// сценарий «схема пришла строкой с сервера».
const registrationJsonSchema = rawJsonSchema as unknown as JsonFormSchema;

const INITIAL: RegistrationFormData = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  fullName: '',
  phone: '',
  captcha: '',
  acceptTerms: false,
};

export default function RegistrationFormRendererJson() {
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const { model, form, registry, actions } = useMemo(() => {
    // Пустые заглушки: реестр замыкает объект, поля дозаполняются ниже — см. FormActions.
    const actions: FormActions = { submit: () => {}, reset: () => {} };
    const registry = createRegistrationRegistry(actions);
    const model = createModel<RegistrationFormData>({ ...INITIAL });
    // M1: форма строится из ТОЙ ЖЕ JSON-схемы, что рендерится.
    const form = createForm<RegistrationFormData>({
      model,
      schema: convertJsonToM1Tree(registrationJsonSchema, registry, model),
    });
    return { model, form, registry, actions };
  }, []);

  // Валидационная схема зависит только от формы данных — строится один раз.
  const validationSchema = useMemo(() => buildValidationSchema(model), [model]);

  // Канонический submit-флоу: валидация данных → снимок → запрос → reset только после успеха.
  actions.submit = async () => {
    if (pending) return;
    form.markAsTouched();
    setStatus(null);
    setPending(true);
    const result = await validateFormModel(model, validationSchema);
    if (!result.valid) {
      setPending(false);
      setStatus('Проверьте выделенные поля');
      return;
    }
    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(model.get()),
      });
      const json = await response.json();
      if (json.success) {
        setStatus(`Регистрация успешна. User ID: ${json.userId}`);
        model.reset();
      } else {
        setStatus(`Ошибка: ${json.message}`);
      }
    } catch (error) {
      setStatus(`Ошибка сети: ${String(error)}`);
    } finally {
      setPending(false);
    }
  };

  actions.reset = () => {
    model.reset();
    form.reset();
    setStatus(null);
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 mx-auto">
      <div className="flex-1">
        <JsonRendererProvider settings={{ registry, model }}>
          <JsonFormRenderer<RegistrationFormData>
            schema={registrationJsonSchema}
            validate={import.meta.env.DEV}
          />
        </JsonRendererProvider>
        {status ? (
          <p className="mt-4 text-sm text-gray-700" data-testid="submit-status">
            {pending ? 'Проверка…' : status}
          </p>
        ) : null}
      </div>

      <div className="flex-1 p-6 bg-white rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Состояние формы</h2>
        <FormStateDisplay form={form} />
        <div className="mt-6 p-4 bg-gray-50 border rounded text-sm text-gray-700">
          Layout целиком в <code>json-schema.json</code>; правила значений — в{' '}
          <code>validation.ts</code>. Реестр содержит только компоненты полей и два обработчика.
        </div>
      </div>
    </div>
  );
}
