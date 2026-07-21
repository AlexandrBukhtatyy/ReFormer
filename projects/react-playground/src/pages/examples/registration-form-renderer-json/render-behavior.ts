/**
 * Render-behavior: инъекция рантайм-сущностей в узлы JSON-схемы.
 *
 * JSON статичен и `FormProxy` выразить не может, поэтому форма доезжает до панели состояния
 * через `onInit` + `patchProps` — build-time хук, срабатывающий до первого рендера.
 * `patchProps` применяется только к КОНТЕЙНЕР-узлам и только по `selector`, поэтому узел
 * `form-state` в схеме несёт `selector` + `component` без `value`.
 *
 * Почему disabled кнопок НЕ здесь: реактивный disabled через `renderEffect` + `patchProps` даёт
 * «Cycle detected» (эффект пишет в версионный сигнал ноды, который сам же читает при мерже).
 * А статус `AsyncBoundary` через `getRef().current.status` не помог бы: это снимок, а не сигнал —
 * `renderEffect` на него не подписывается и не перезапускается (проверено: 0 перезапусков при
 * смене статуса), и вдобавок он отражает загрузку префилла, а не отправку формы. Поэтому блокировку
 * кнопок инкапсулирует компонент `PendingButton` (components.tsx), подписанный на `ui.pending`.
 */

import { onInit, type RenderBehaviorFn } from '@reformer/renderer-react';
import type { FormProxy } from '@reformer/core';
import type { RegistrationFormData } from '../registration-form/RegistrationForm';

export function createRegistrationRenderBehavior(
  form: FormProxy<RegistrationFormData>
): RenderBehaviorFn<RegistrationFormData> {
  return (schema) => {
    onInit(schema.node('form-state'), () => {
      schema.node('form-state').patchProps({ form });
    });
  };
}
