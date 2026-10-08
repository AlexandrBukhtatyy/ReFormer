import type { Address } from '../../components/nested-forms/Address/types';

export const blankAddress = (): Address => ({
  region: '',
  city: '',
  street: '',
  house: '',
  apartment: '',
  postalCode: '',
});
