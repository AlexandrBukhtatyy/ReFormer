import { createContext, useContext, type ReactNode } from 'react';
import type { FormProxy } from '@reformer/core';
import { useFormControl } from '@reformer/core';
import { FormArray } from '@reformer/cdk/form-array';
import { Button, FormField } from '@reformer/ui-kit';

import type { CreditApplicationForm } from './types';
import { propertyTemplate, existingLoanTemplate, coBorrowerTemplate } from './schema';

// ----- Form context: provides the live FormProxy to custom block components rendered inside JSON renderer -----
const CreditFormContext = createContext<FormProxy<CreditApplicationForm> | null>(null);

export function CreditFormProvider({
  form,
  children,
}: {
  form: FormProxy<CreditApplicationForm>;
  children: ReactNode;
}) {
  return <CreditFormContext.Provider value={form}>{children}</CreditFormContext.Provider>;
}

function useCreditForm(): FormProxy<CreditApplicationForm> {
  const form = useContext(CreditFormContext);
  if (!form) {
    throw new Error(
      '[mcp-credit-renderer-json-v2] CreditFormContext missing — wrap with <CreditFormProvider>'
    );
  }
  return form;
}

// ----- Generic helpers -----

function ItemCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-gray-200 p-4 space-y-3 bg-gray-50">{children}</div>
  );
}

function ItemRemoveButton({ visible, remove }: { visible: boolean; remove: () => void }) {
  if (!visible) return null;
  return (
    <div className="flex justify-end">
      <Button type="button" variant="outline" size="sm" onClick={remove}>
        Удалить
      </Button>
    </div>
  );
}

// =========================================================================
// PropertiesArrayBlock — visible when hasProperty=true
// =========================================================================

export function PropertiesArrayBlock() {
  const form = useCreditForm();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasState = useFormControl(form.hasProperty as any) as unknown as { value: boolean };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arrayState = useFormControl(form.properties as any) as unknown as { length: number };
  const length = arrayState?.length ?? 0;

  if (!hasState?.value) return null;

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <FormArray.Root control={form.properties as any}>
      <div className="space-y-3">
        <FormArray.List>
          {({ control, index, remove, id }) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const item = control as any;
            return (
              <ItemCard key={id}>
                <div className="text-sm font-medium text-gray-700">
                  Объект имущества #{index + 1}
                </div>
                <FormField control={item.type} />
                <FormField control={item.description} />
                <FormField control={item.estimatedValue} />
                <ItemRemoveButton visible={length > 1} remove={remove} />
              </ItemCard>
            );
          }}
        </FormArray.List>
        <div>
          <FormArray.AddButton asChild initialValue={propertyTemplate()}>
            <Button type="button" variant="outline" size="sm">
              + Добавить объект
            </Button>
          </FormArray.AddButton>
        </div>
      </div>
    </FormArray.Root>
  );
}

// =========================================================================
// ExistingLoansArrayBlock — visible when hasExistingLoans=true
// =========================================================================

export function ExistingLoansArrayBlock() {
  const form = useCreditForm();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasState = useFormControl(form.hasExistingLoans as any) as unknown as { value: boolean };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arrayState = useFormControl(form.existingLoans as any) as unknown as { length: number };
  const length = arrayState?.length ?? 0;

  if (!hasState?.value) return null;

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <FormArray.Root control={form.existingLoans as any}>
      <div className="space-y-3">
        <FormArray.List>
          {({ control, index, remove, id }) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const item = control as any;
            return (
              <ItemCard key={id}>
                <div className="text-sm font-medium text-gray-700">Кредит #{index + 1}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField control={item.bankName} />
                  <FormField control={item.loanType} />
                  <FormField control={item.remainingDebt} />
                  <FormField control={item.monthlyPayment} />
                  <FormField control={item.status} />
                </div>
                <ItemRemoveButton visible={length > 1} remove={remove} />
              </ItemCard>
            );
          }}
        </FormArray.List>
        <div>
          <FormArray.AddButton asChild initialValue={existingLoanTemplate()}>
            <Button type="button" variant="outline" size="sm">
              + Добавить кредит
            </Button>
          </FormArray.AddButton>
        </div>
      </div>
    </FormArray.Root>
  );
}

// =========================================================================
// CoBorrowersArrayBlock — visible when hasCoBorrower=true
// =========================================================================

export function CoBorrowersArrayBlock() {
  const form = useCreditForm();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasState = useFormControl(form.hasCoBorrower as any) as unknown as { value: boolean };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arrayState = useFormControl(form.coBorrowers as any) as unknown as { length: number };
  const length = arrayState?.length ?? 0;

  if (!hasState?.value) return null;

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <FormArray.Root control={form.coBorrowers as any}>
      <div className="space-y-3">
        <FormArray.List>
          {({ control, index, remove, id }) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const item = control as any;
            return (
              <ItemCard key={id}>
                <div className="text-sm font-medium text-gray-700">Созаёмщик #{index + 1}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField control={item.fullName} />
                  <FormField control={item.relationship} />
                  <FormField control={item.monthlyIncome} />
                  <FormField control={item.passport} />
                </div>
                <ItemRemoveButton visible={length > 1} remove={remove} />
              </ItemCard>
            );
          }}
        </FormArray.List>
        <div>
          <FormArray.AddButton asChild initialValue={coBorrowerTemplate()}>
            <Button type="button" variant="outline" size="sm">
              + Добавить созаёмщика
            </Button>
          </FormArray.AddButton>
        </div>
      </div>
    </FormArray.Root>
  );
}
