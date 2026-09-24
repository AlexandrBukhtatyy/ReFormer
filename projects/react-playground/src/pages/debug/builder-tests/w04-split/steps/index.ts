// @reformer-generated 80e5e4a7a782
// steps/index.ts — шаги визарда по порядку: схема, валидация и render-слой каждого шага.
// Регенерируется билдером (порядок шагов берётся из схемы); правки будут перезаписаны.

import type { JsonFormStep } from '@reformer/renderer-json';

import step1Schema from './dannye/form.schema.json';
import { stepValidation as step1Validation } from './dannye/form.validation';
import { stepRender as step1Render } from './dannye/form.render';
import step2Schema from './kontakty/form.schema.json';
import { stepValidation as step2Validation } from './kontakty/form.validation';
import { stepRender as step2Render } from './kontakty/form.render';

/**
 * Схемы шагов по ссылке из корневого form.schema.json: index.tsx собирает из них форму
 * (`composeJsonFormSchema`). В чистом JSON операторы типизируются как `string` — отсюда приведение.
 */
export const stepSchemas: Record<string, JsonFormStep> = {
  './steps/dannye/form.schema.json': step1Schema as unknown as JsonFormStep,
  './steps/kontakty/form.schema.json': step2Schema as unknown as JsonFormStep,
};

/** Под-схемы валидации шагов: индекс — номер шага минус один. */
export const stepValidations = [step1Validation, step2Validation];

/** Render-слой шагов по порядку: корневой form.render.ts вызывает каждый. */
export const stepRenders = [step1Render, step2Render];
