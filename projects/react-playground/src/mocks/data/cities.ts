import type { Option } from '../../pages/examples/complex-multy-step-form/types/option';

export const citiesByRegion: Record<string, Option[]> = {
  moscow: [
    { value: 'moscow_center', label: 'Центральный округ' },
    { value: 'moscow_north', label: 'Северный округ' },
    { value: 'moscow_south', label: 'Южный округ' },
  ],
  spb: [
    { value: 'spb_center', label: 'Центральный район' },
    { value: 'spb_nevsky', label: 'Невский район' },
    { value: 'spb_vasilievsky', label: 'Василеостровский район' },
  ],
};
