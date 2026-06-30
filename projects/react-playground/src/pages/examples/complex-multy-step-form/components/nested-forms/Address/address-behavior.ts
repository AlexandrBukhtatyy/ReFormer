/**
 * Переиспользуемая под-схема поведения адреса (применяется к адресу регистрации и проживания).
 */

import { defineFormBehavior, transformValue } from '@reformer/core/behaviors';
import { loadOptionsOn } from '../../../schemas/operators';
import { fetchCities } from '../../../api';
import type { Address } from './types';

export const addressBehavior = defineFormBehavior<Address>(({ model, form }) => {
  // Подгрузка городов по региону. Город НЕ сбрасываем (region выставляется раньше city при загрузке;
  // поле «Город» — обычный Input, список носит вспомогательный характер).
  loadOptionsOn(model.$.region, form.city, fetchCities);

  // Автоформат почтового индекса (только цифры, ≤ 6).
  transformValue(model.$.postalCode, (pc) => (pc ?? '').replace(/\D/g, '').slice(0, 6));
});
