export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';

export interface LoanInfoStep {
  loanType: LoanType;
  loanAmount: number;
  loanTerm: number;
  loanPurpose: string;

  // Поля для ипотеки
  propertyValue: number;
  initialPayment: number;

  // Поля для автокредита
  carBrand: string;
  carModel: string;
  carYear: number;
  carPrice: number;

  // Вычисляемые поля
  interestRate: number;
  monthlyPayment: number;
}
