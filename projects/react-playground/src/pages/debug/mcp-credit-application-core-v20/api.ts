// api.ts — mock submit + prefill/load (imitates /api/v1/credit-applications).
import { blankAddress, blankPersonalData } from './model';
import type { CreditForm } from './types';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type LoadResult =
  | { success: true; data: Partial<CreditForm> }
  | { success: false; error: string };

export type SubmitResult =
  | { success: true; data: { id: string; message: string } }
  | { success: false; error: string };

/** GET /api/v1/credit-applications/{id} — mock. Заявки '1' и '2' предзаполнены. */
export async function loadApplication(id: string): Promise<LoadResult> {
  await delay(600);

  if (id === '1') {
    return {
      success: true,
      data: {
        loanType: 'mortgage',
        loanAmount: 5_000_000,
        loanTerm: 240,
        loanPurpose: 'Покупка двухкомнатной квартиры в новостройке',
        propertyValue: 7_000_000,
        personalData: {
          ...blankPersonalData(),
          lastName: 'Иванов',
          firstName: 'Иван',
          middleName: 'Иванович',
          birthDate: '1988-04-12',
          gender: 'male',
          birthPlace: 'г. Москва',
        },
        inn: '771234567890',
        snils: '123-456-789 00',
        phoneMain: '+7 (495) 123-45-67',
        email: 'ivanov@example.com',
        registrationAddress: {
          ...blankAddress(),
          region: 'moscow',
          city: 'moscow',
          street: 'Тверская',
          house: '10',
          postalCode: '125009',
        },
        employmentStatus: 'employed',
        companyName: 'ООО «Ромашка»',
        companyInn: '7712345678',
        position: 'Ведущий инженер',
        workExperienceTotal: 120,
        workExperienceCurrent: 48,
        monthlyIncome: 180_000,
      },
    };
  }

  if (id === '2') {
    return {
      success: true,
      data: {
        loanType: 'car',
        loanAmount: 1_200_000,
        loanTerm: 60,
        loanPurpose: 'Покупка нового автомобиля для семьи',
        carBrand: 'Toyota',
        carModel: 'camry',
        carYear: 2023,
        carPrice: 3_200_000,
        personalData: {
          ...blankPersonalData(),
          lastName: 'Петрова',
          firstName: 'Мария',
          middleName: 'Сергеевна',
          birthDate: '1992-09-30',
          gender: 'female',
          birthPlace: 'г. Казань',
        },
        employmentStatus: 'selfEmployed',
        businessType: 'ИП',
        businessInn: '160512345678',
        monthlyIncome: 220_000,
      },
    };
  }

  return { success: false, error: `Заявка с ID "${id}" не найдена` };
}

/** POST /api/v1/credit-applications — mock */
export async function submitApplication(values: CreditForm): Promise<SubmitResult> {
  await delay(2000);

  console.log('[mock] submit credit application', values);
  return { success: true, data: { id: '123', message: 'Заявка успешно создана' } };
}
