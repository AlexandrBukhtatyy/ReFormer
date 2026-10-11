// @reformer-generated b8a87affcd29
// validation/form.ts — валидация формы: поле `validation` сборки (application/create.ts).
// Правила шагов — в validation/<шаг>.ts (их проверяет «Далее»); здесь — только правила вне шагов.
// Пока файл не правили руками, билдер перегенерирует его из правил формы; правленный не трогает.

import type { FormValidation } from '@reformer/core';
import type { ReformerMultiStepForm } from '../types/reformer-multi-step-form';

/**
 * Валидация формы — поле `validation` сборки. Правил вне шагов нет: полный набор сборка собирает
 * из правил шагов потока. Появятся — объявите их здесь и передайте полем `extras`; сюда же —
 * стратегия живой проверки (`strategy`).
 */
export const formValidation: FormValidation<ReformerMultiStepForm> = {};
