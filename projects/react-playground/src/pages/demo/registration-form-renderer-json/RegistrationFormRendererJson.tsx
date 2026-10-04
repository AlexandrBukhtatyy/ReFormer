/**
 * Форма регистрации, описанная JSON-схемой ЦЕЛИКОМ.
 *
 * В JSX здесь только рендерер. Всё остальное —
 * колонки, заголовки, поля, кнопки, панель состояния, блок подсказок и даже загрузка
 * префилла с индикатором/ошибкой/повтором — живёт в JSON.
 *
 * Обязанности разведены по файлам:
 * - [json-schema.json] — весь layout. Чистый JSON, может прийти строкой с сервера.
 * - [validation.ts] — правила значений TS-схемой над моделью (в JSON-DSL валидаторов нет).
 * - [registry.tsx] — компоненты, обработчики, UI-сигналы и PendingButton: то, что JSON выразить не может.
 * - [form.behavior.ts] — единственное поведение: submit-флоу, реактивность данных, правила узлов.
 * - [form-setup.ts] — сборка `createForm`: модель, дерево из схемы, реестр, поведение. Без React-хуков.
 *
 * Состояния отправки в `useState` нет: оно живёт в сигналах (`registry.ts`), поэтому
 * текстовый узел схемы подписывается на него напрямую.
 *
 * AsyncBoundary — корень схемы и гейтит форму: при 404 (неизвестное приглашение) видно только
 * блок ошибки с «Повторить», полей нет. Для примера это осознанно — так демонстрируется состояние
 * ошибки. В invite-only регистрации это и есть нужное поведение; если бы префилл был лишь удобством,
 * поля вынесли бы из-под гейта и показывали при ошибке пустую форму.
 */

import { useFormBundle } from '@reformer/core';
import { FormRenderer } from '@reformer/renderer-react';
import type { RegistrationFormData } from '../registration-form/RegistrationForm';
import { createRegistrationSetup } from './form-setup';

export default function RegistrationFormRendererJson() {
  // Сборка одним вызовом `createForm`. useFormBundle зовёт фабрику ровно один раз — повторная
  // сборка создала бы новый реестр и новый тип AsyncBoundary, из-за чего загрузка префилла
  // стартовала бы заново.
  const registration = useFormBundle(createRegistrationSetup);

  return (
    // Обёртку поля рендерер берёт из бандла: её положил туда реестр (FIELD_WRAPPER).
    <FormRenderer<RegistrationFormData> form={registration} />
  );
}
