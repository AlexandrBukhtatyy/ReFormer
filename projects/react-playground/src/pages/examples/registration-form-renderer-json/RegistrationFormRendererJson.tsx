/**
 * Форма регистрации, описанная JSON-схемой ЦЕЛИКОМ.
 *
 * В JSX здесь только два компонента: провайдер реестра и рендерер. Всё остальное —
 * колонки, заголовки, поля, кнопки, панель состояния, блок подсказок и даже загрузка
 * префилла с индикатором/ошибкой/повтором — живёт в JSON.
 *
 * Обязанности разведены по файлам:
 * - [json-schema.json] — весь layout. Чистый JSON, может прийти строкой с сервера.
 * - [validation.ts] — правила значений TS-схемой над моделью (в JSON-DSL валидаторов нет).
 * - [behavior.ts] — реактивность данных (createForm behavior): снятие устаревшей ошибки паролей.
 * - [registry.ts] — компоненты, обработчики и UI-сигналы: то, что JSON выразить не может.
 * - [render-behavior.ts] — инъекция рантайм-формы в панель состояния (patchProps).
 * - [form-setup.ts] — сборка модели/формы/реестра и submit-флоу, без React-хуков.
 *
 * Состояния отправки в `useState` нет: оно живёт в сигналах (`registry.ts`), поэтому
 * текстовый узел схемы подписывается на него напрямую.
 *
 * AsyncBoundary — корень схемы и гейтит форму: при 404 (неизвестное приглашение) видно только
 * блок ошибки с «Повторить», полей нет. Для примера это осознанно — так демонстрируется состояние
 * ошибки. В invite-only регистрации это и есть нужное поведение; если бы префилл был лишь удобством,
 * поля вынесли бы из-под гейта и показывали при ошибке пустую форму.
 */

import { useMemo } from 'react';
import { JsonFormRenderer, JsonRendererProvider } from '@reformer/renderer-json';
import type { RegistrationFormData } from '../registration-form/RegistrationForm';
import { createRegistrationSetup, registrationJsonSchema } from './form-setup';

export default function RegistrationFormRendererJson() {
  // Один раз: повторная сборка создала бы новый реестр и новый тип AsyncBoundary,
  // из-за чего загрузка префилла стартовала бы заново на каждый рендер.
  const { model, registry, renderBehavior } = useMemo(() => createRegistrationSetup(), []);

  return (
    <JsonRendererProvider settings={{ registry, model }}>
      <JsonFormRenderer<RegistrationFormData>
        schema={registrationJsonSchema}
        renderBehavior={renderBehavior}
        validate={import.meta.env.DEV}
      />
    </JsonRendererProvider>
  );
}
