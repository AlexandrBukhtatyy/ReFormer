import type { Property } from '../../components/nested-forms/Property/types';

export const blankProperty = (): Property => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});
