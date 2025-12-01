export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';

export interface EmploymentStep {
  employmentStatus: EmploymentStatus;
  companyName: string;
  companyInn: string;
  companyPhone: string;
  companyAddress: string;
  position: string;
  workExperienceTotal: number;
  workExperienceCurrent: number;
  monthlyIncome: number;
  additionalIncome: number;
  additionalIncomeSource: string;

  // Поля для ИП
  businessType: string;
  businessInn: string;
  businessActivity: string;

  // Вычисляемое поле
  totalIncome: number;
}
