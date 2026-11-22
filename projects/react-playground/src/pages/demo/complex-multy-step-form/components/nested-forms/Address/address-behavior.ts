/**
 * Переиспользуемая под-схема поведения адреса (применяется к адресу регистрации и проживания).
 */

import { defineFormBehavior, onChange, transformValue } from '@reformer/core/behaviors';
import { loadOptionsOn } from '../../../behavior/operators';
import { fetchCities } from '../../../api';
import type { Address } from './types';

export const addressBehavior = defineFormBehavior<Address>(({ model, form }) => {
  // Подгрузка городов по региону; поле «Город» — обычный Input, список вспомогательный.
  loadOptionsOn(model.$.region, form.city, fetchCities);

  // Смена региона очищает город. Регион, пришедший в пустое поле, — это заполнение (загрузка
  // заявки, копия адреса регистрации): город приходит вместе с ним и остаётся.
  let previousRegion = model.region;
  onChange(model.$.region, (region) => {
    if (previousRegion && region !== previousRegion) model.city = '';
    previousRegion = region;
  });

  // Автоформат почтового индекса (только цифры, ≤ 6).
  transformValue(model.$.postalCode, (pc) => (pc ?? '').replace(/\D/g, '').slice(0, 6));
});
