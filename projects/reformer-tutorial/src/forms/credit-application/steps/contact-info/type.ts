import type { Address } from '../../sub-forms/address/type';

export interface ContactInfoStep {
  phoneMain: string;
  phoneAdditional: string;
  email: string;
  emailAdditional: string;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;
}
