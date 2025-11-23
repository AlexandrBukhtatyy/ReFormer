import type { Option } from '../../pages/examples/complex-multy-step-form/types/option';

export const regionsByCountry: Record<string, Option[]> = {
  RU: [
    { value: 'moscow', label: 'Москва' },
    { value: 'spb', label: 'Санкт-Петербург' },
    { value: 'ekaterinburg', label: 'Екатеринбург' },
    { value: 'kazan', label: 'Казань' },
    { value: 'novosibirsk', label: 'Новосибирск' },
  ],
  KZ: [
    { value: 'almaty', label: 'Алматы' },
    { value: 'astana', label: 'Нур-Султан' },
    { value: 'shymkent', label: 'Шымкент' },
  ],
};
