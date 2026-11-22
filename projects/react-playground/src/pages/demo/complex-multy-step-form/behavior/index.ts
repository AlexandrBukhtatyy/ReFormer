/**
 * Поведение кредитной заявки: значения модели, состояние полей и видимость секций.
 *
 * Загрузка заявки, отправка и работа с визардом сюда не входят — это уровень приложения
 * (`application/`): поведение статично и не знает идентификатора заявки.
 */

import { apply, defineFormBehavior, type BehaviorScope } from '@reformer/core/behaviors';
import { addressBehavior } from '../components/nested-forms/Address/address-behavior';
import type { CreditApplicationForm } from '../types/credit-application';
import { derived } from './derived';
import { synchronization } from './synchronization';
import { conditions } from './conditions';
import { dynamicOptions } from './dynamic-options';

/**
 * Правила поведения заявки — тело схемы поведения. Вынесено функцией, чтобы его можно было
 * включить в поведение, которое добавляет к правилам заявки свои (см. `application/renderer.ts`).
 */
export function creditApplicationRules(scope: BehaviorScope<CreditApplicationForm>): void {
  derived(scope);
  synchronization(scope);
  conditions(scope);
  dynamicOptions(scope);

  // Поведение подформы адреса — на оба адреса
  const { model } = scope;
  apply([model.$.registrationAddress, model.$.residenceAddress], addressBehavior);
}

export const creditApplicationBehavior =
  defineFormBehavior<CreditApplicationForm>(creditApplicationRules);
