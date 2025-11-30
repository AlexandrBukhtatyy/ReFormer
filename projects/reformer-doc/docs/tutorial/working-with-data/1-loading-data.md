---
sidebar_position: 1
---

# Loading Data

How to load data from an API and populate your form.

## Overview

In previous sections of the tutorial, we created a credit application form with nested structures like `personalData`, `passportData`, and `registrationAddress`. Now let's learn how to load data into this form from an API.

ReFormer provides two methods:

- `setValue()` - completely replace value (field, group, or form)
- `patchValue()` - partially update values (only specified fields)

## Mock API Service

Let's create a mock service that returns data matching our form structure:

```typescript title="src/forms/credit-application/services/api.ts"
import type { CreditApplicationForm } from '../types/credit-application.types';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Get current user profile
 * Used for pre-filling new application form
 */
export async function fetchUserProfile(): Promise<UserProfile> {
  await delay(500);

  return {
    firstName: 'John',
    lastName: 'Smith',
    middleName: '',
    email: 'john.smith@example.com',
    phone: '+1234567890',
    birthDate: '1990-05-15',
  };
}

/**
 * Get existing application by ID
 * Used for editing application
 */
export async function fetchApplication(id: string): Promise<ApiApplicationData> {
  await delay(800);

  // Mock data for existing application
  return {
    loanType: 'consumer',
    loanAmount: 500000,
    loanTerm: 24,
    loanPurpose: 'Home renovation',
    propertyValue: 0,
    initialPayment: 0,
    carBrand: '',
    carModel: '',
    carYear: 0,
    carPrice: 0,
    personalData: {
      lastName: 'Smith',
      firstName: 'John',
      middleName: '',
      birthDate: '1990-05-15',
      birthPlace: 'New York',
      gender: 'male',
    },
    passportData: {
      series: '1234',
      number: '567890',
      issueDate: '2015-03-20',
      issuedBy: 'Passport Office',
      departmentCode: '123-456',
    },
    inn: '123456789012',
    snils: '12345678901',
    phoneMain: '+1234567890',
    phoneAdditional: '',
    email: 'john.smith@example.com',
    emailAdditional: '',
    registrationAddress: {
      region: 'New York',
      city: 'New York',
      street: 'Main St',
      house: '10',
      apartment: '25',
      postalCode: '10001',
    },
    sameAsRegistration: true,
    residenceAddress: {
      region: 'New York',
      city: 'New York',
      street: 'Main St',
      house: '10',
      apartment: '25',
      postalCode: '10001',
    },
    employmentStatus: 'employed',
    companyName: 'Acme Corp',
    companyInn: '1234567890',
    companyPhone: '+1234567890',
    companyAddress: 'New York, Broadway 1',
    position: 'Manager',
    workExperienceTotal: 60,
    workExperienceCurrent: 24,
    monthlyIncome: 100000,
    additionalIncome: 0,
    additionalIncomeSource: '',
    businessType: '',
    businessInn: '',
    businessActivity: '',
    maritalStatus: 'married',
    dependents: 1,
    education: 'higher',
    hasProperty: false,
    properties: [],
    hasExistingLoans: false,
    existingLoans: [],
    hasCoBorrower: false,
    coBorrowers: [],
    agreePersonalData: false,
    agreeCreditHistory: false,
    agreeMarketing: false,
    agreeTerms: false,
    confirmAccuracy: false,
    electronicSignature: '',
  };
}

/**
 * Save application to server
 */
export async function saveApplication(
  data: ApiApplicationData
): Promise<{ id: string; status: string }> {
  await delay(1000);

  // Simulate sending to server
  console.log('Sending application to server:', data);

  // Return created application ID
  return {
    id: 'app-' + Date.now(),
    status: 'pending',
  };
}
```

## Populating Form with Data

There are 2 ways to populate the form with data: `setValue(value)` and `patchValue(value)`.
`setValue(value)` - Fills all fields
`patchValue(value)` - Fills only fields present in the passed value

### Using setValue()

`setValue(value)` completely replaces the value of any control (field, group, or form):

```typescript
// Set entire form
form.setValue(applicationData);

// Set nested group
form.personalData.setValue({
  lastName: 'Smith',
  firstName: 'John',
  middleName: '',
  birthDate: new Date('1990-05-15'),
  birthPlace: 'New York',
  gender: 'male',
});

// Set single field
form.loanAmount.setValue(500000);

// Set with options
form.email.setValue('user@example.com', {
  emitEvent: false, // Don't trigger validation
});
```

### Using patchValue()

`patchValue(value)` updates only specified fields, leaving others unchanged:

```typescript
// Update only personal data fields
form.patchValue({
  personalData: {
    firstName: 'John',
    lastName: 'Smith',
  },
  email: 'john@example.com',
  phoneMain: '+1234567890',
});

// Other fields (loanAmount, passportData, etc.) remain unchanged
```

### Loading Full Application

```tsx title="src/forms/credit-application/CreditApplicationForm.tsx"
interface CreditApplicationFormProps {
  applicationId: string;
}

function CreditApplicationForm({ applicationId }: CreditApplicationFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form instance
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Ref for navigation methods access
  const navRef = useRef<StepNavigationHandle<CreditApplicationFormType>>(null);

  // Form submission
  const handleSubmit = async (values: CreditApplicationFormType) => {
    ...
  };

  // Load form data
  useEffect(() => {
    async function loadApplication() {
      try {
        setIsLoading(true);
        setError(null);

        const data = await fetchApplication(applicationId);

        // Load all data into form
        form.setValue(data);
      } catch (error: unknown) {
        console.error(error);
        setError('Failed to load application');
      } finally {
        setIsLoading(false);
      }
    }

    loadApplication();
  }, [form, applicationId]);

  if (isLoading) {
    return <div>Loading application...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <StepNavigation ref={navRef} form={form} config={STEP_CONFIG}>
      ...
    </StepNavigation>
  );
}

export default CreditApplicationForm;
```

## Key Points

1. **`setValue()`** - replaces value completely (works on any control)
2. **`patchValue()`** - partial updates (only specified fields)
3. Both methods work with nested structures (`personalData`, `passportData`, etc.)
4. Both methods trigger validation by default
5. Use `{ emitEvent: false }` to skip validation during loading
6. Always handle loading and error states

## Next Steps

- [Data Transformation](./2-data-transformation.md) - Convert data between form and API formats
- [Validation and Saving](./3-validation-and-saving.md) - Validate and submit form data
