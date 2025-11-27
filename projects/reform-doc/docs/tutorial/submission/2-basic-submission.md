---
sidebar_position: 2
---

# Basic Submission

Implementing form submission with automatic validation and data transformation.

## Overview

Basic submission covers the essential flow:

- **form.getValue()** - Get current form values
- **form.touchAll()** - Mark all fields as touched to show errors
- **Data Transformation** - Serialize form data for API
- **API Service** - Submit to server
- **Success Handling** - Process successful response
- **Error Handling** - Handle submission failures
- **UI States** - Loading and disabled states

## Form Submission Pattern

ReFormer provides methods to get form values and trigger validation display. The recommended pattern combines `getValue()` with state management.

### Basic Usage

```typescript
const handleSubmit = async () => {
  // Mark all fields as touched to show validation errors
  form.touchAll();

  // Get form values
  const formData = form.getValue();

  // Submit to server
  const result = await submitToServer(formData);
  return result;
};
```

**Key methods**:
- `form.getValue()` - Returns current form values
- `form.touchAll()` - Marks all fields as touched (shows validation errors)
- `form.valid.value` - Check if form is valid (reactive signal)

### Submission Flow

```
┌─────────────────────────────────────┐
│   User clicks Submit button         │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│   handleSubmit() is called          │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│   1. form.touchAll()                │
│      - Show all validation errors   │
│      - Mark fields as touched       │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│   2. Get values with getValue()     │
│      - Returns form data object     │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│   3. Transform & send to API        │
│      - Serialize data               │
│      - POST to server               │
└──────────┬──────────────────────────┘
           │
           ▼
              ┌──────────────────────────┐
              │ 4. Handle result         │
              │    - Success: show msg   │
              │    - Error: show error   │
              └──────────────────────────┘
```

## Creating the API Service

Let's create a service to submit credit applications to the server.

### Define API Types

```typescript title="src/services/api/submission.api.ts"
/**
 * Request payload for submitting a credit application
 */
export interface SubmitApplicationRequest {
  // Loan Information
  loanAmount: number;
  loanTerm: number;
  loanType: string;
  loanPurpose: string;

  // Personal Information
  firstName: string;
  lastName: string;
  middleName?: string;
  birthDate: string;
  passportSeries: string;
  passportNumber: string;
  passportIssuer: string;
  passportIssueDate: string;

  // Contact Information
  email: string;
  phoneMain: string;
  phoneAdditional?: string;

  // Address Information
  registrationAddress: {
    postalCode: string;
    country: string;
    region: string;
    city: string;
    street: string;
    house: string;
    apartment?: string;
  };
  residentialAddress?: {
    postalCode: string;
    country: string;
    region: string;
    city: string;
    street: string;
    house: string;
    apartment?: string;
  };

  // Employment Information
  employmentType: string;
  companyName?: string;
  position?: string;
  monthlyIncome: number;
  employmentStartDate?: string;

  // Additional Information
  hasActiveLoan: boolean;
  hasBankruptcy: boolean;
  agreeToTerms: boolean;
  agreeToDataProcessing: boolean;
}

/**
 * Response from submitting a credit application
 */
export interface SubmitApplicationResponse {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'under_review';
  message: string;
  submittedAt: string;
  estimatedDecisionTime?: string;
}

/**
 * Error response from the server
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  errors?: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}
```

### Implement API Function

```typescript title="src/services/api/submission.api.ts"
/**
 * Submit a credit application to the server
 * @param data The application data to submit
 * @returns The submission result
 * @throws {Error} If submission fails
 */
export async function submitApplication(
  data: SubmitApplicationRequest
): Promise<SubmitApplicationResponse> {
  const response = await fetch('/api/applications/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Add authentication if needed
      // 'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  // Handle non-OK responses
  if (!response.ok) {
    const errorData: ApiErrorResponse = await response.json();

    // Create error with response data
    const error = new Error(errorData.message || 'Submission failed');
    (error as any).response = {
      status: response.status,
      data: errorData
    };

    throw error;
  }

  // Parse and return success response
  return await response.json();
}
```

## Data Transformation

Before submitting, transform form data to match the API format.

### Create Transformer

```typescript title="src/utils/credit-application-transformer.ts"
import type { CreditApplicationFormValue } from '../schemas/credit-application-schema';
import type { SubmitApplicationRequest } from '../services/api/submission.api';

/**
 * Transform form data to API format
 */
export const creditApplicationTransformer = {
  /**
   * Serialize: Form → API
   */
  serialize(formData: CreditApplicationFormValue): SubmitApplicationRequest {
    return {
      // Loan Information
      loanAmount: formData.step1.loanAmount,
      loanTerm: formData.step1.loanTerm,
      loanType: formData.step1.loanType,
      loanPurpose: formData.step1.loanPurpose,

      // Personal Information
      firstName: formData.step2.personalData.firstName,
      lastName: formData.step2.personalData.lastName,
      middleName: formData.step2.personalData.middleName || undefined,
      birthDate: formData.step2.personalData.birthDate,
      passportSeries: formData.step2.passportData.passportSeries,
      passportNumber: formData.step2.passportData.passportNumber,
      passportIssuer: formData.step2.passportData.passportIssuer,
      passportIssueDate: formData.step2.passportData.passportIssueDate,

      // Contact Information
      email: formData.step3.email,
      phoneMain: formData.step3.phoneMain,
      phoneAdditional: formData.step3.phoneAdditional || undefined,

      // Registration Address
      registrationAddress: {
        postalCode: formData.step3.registrationAddress.postalCode,
        country: formData.step3.registrationAddress.country,
        region: formData.step3.registrationAddress.region,
        city: formData.step3.registrationAddress.city,
        street: formData.step3.registrationAddress.street,
        house: formData.step3.registrationAddress.house,
        apartment: formData.step3.registrationAddress.apartment || undefined,
      },

      // Residential Address (if different)
      residentialAddress: formData.step3.sameAsRegistration
        ? undefined
        : formData.step3.residentialAddress
        ? {
            postalCode: formData.step3.residentialAddress.postalCode,
            country: formData.step3.residentialAddress.country,
            region: formData.step3.residentialAddress.region,
            city: formData.step3.residentialAddress.city,
            street: formData.step3.residentialAddress.street,
            house: formData.step3.residentialAddress.house,
            apartment: formData.step3.residentialAddress.apartment || undefined,
          }
        : undefined,

      // Employment Information
      employmentType: formData.step4.employmentType,
      companyName: formData.step4.companyName || undefined,
      position: formData.step4.position || undefined,
      monthlyIncome: formData.step4.monthlyIncome,
      employmentStartDate: formData.step4.employmentStartDate || undefined,

      // Additional Information
      hasActiveLoan: formData.step5.hasActiveLoan,
      hasBankruptcy: formData.step5.hasBankruptcy,
      agreeToTerms: formData.step5.agreeToTerms,
      agreeToDataProcessing: formData.step5.agreeToDataProcessing,
    };
  },

  /**
   * Deserialize: API → Form (for loading existing applications)
   */
  deserialize(apiData: SubmitApplicationRequest): CreditApplicationFormValue {
    return {
      step1: {
        loanAmount: apiData.loanAmount,
        loanTerm: apiData.loanTerm,
        loanType: apiData.loanType,
        loanPurpose: apiData.loanPurpose,
      },
      step2: {
        personalData: {
          firstName: apiData.firstName,
          lastName: apiData.lastName,
          middleName: apiData.middleName || '',
          birthDate: apiData.birthDate,
        },
        passportData: {
          passportSeries: apiData.passportSeries,
          passportNumber: apiData.passportNumber,
          passportIssuer: apiData.passportIssuer,
          passportIssueDate: apiData.passportIssueDate,
        },
      },
      step3: {
        email: apiData.email,
        phoneMain: apiData.phoneMain,
        phoneAdditional: apiData.phoneAdditional || '',
        registrationAddress: apiData.registrationAddress,
        sameAsRegistration: !apiData.residentialAddress,
        residentialAddress: apiData.residentialAddress || {
          postalCode: '',
          country: '',
          region: '',
          city: '',
          street: '',
          house: '',
          apartment: '',
        },
      },
      step4: {
        employmentType: apiData.employmentType,
        companyName: apiData.companyName || '',
        position: apiData.position || '',
        monthlyIncome: apiData.monthlyIncome,
        employmentStartDate: apiData.employmentStartDate || '',
      },
      step5: {
        hasActiveLoan: apiData.hasActiveLoan,
        hasBankruptcy: apiData.hasBankruptcy,
        agreeToTerms: apiData.agreeToTerms,
        agreeToDataProcessing: apiData.agreeToDataProcessing,
      },
    };
  },
};
```

## Implementing Basic Submission

Now let's implement the submission in our form component.

### Submit Handler

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo, useState } from 'react';
import { createCreditApplicationForm } from '../schemas/create-form';
import { creditApplicationTransformer } from '../utils/credit-application-transformer';
import { submitApplication } from '../services/api/submission.api';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setError(null);
    setSubmitting(true);

    try {
      // Mark all fields as touched to show validation errors
      form.touchAll();

      // Get current form values
      const formData = form.getValue();

      // Transform form data to API format
      const apiData = creditApplicationTransformer.serialize(formData);

      // Submit to server
      const result = await submitApplication(apiData);

      // Success!
      console.log('Application submitted:', result);

      // Show success message
      alert(`Application ${result.id} submitted successfully!`);

      // Optionally navigate to success page
      // navigate(`/applications/${result.id}/success`);

    } catch (err) {
      // Handle errors
      console.error('Submission failed:', err);

      const errorMessage = err instanceof Error
        ? err.message
        : 'Failed to submit application';

      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Error message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Form fields */}
      <FormRenderer form={form} />

      {/* Submit button */}
      <button
        type="submit"
        disabled={submitting}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {submitting ? 'Submitting...' : 'Submit Application'}
      </button>
    </form>
  );
}
```

### Understanding the Flow

```typescript
// 1. User clicks submit
handleSubmit() // called

// 2. Mark all fields as touched to show errors
form.touchAll();

// 3. Get form values
const formData = form.getValue();

// 4. Transform data
const apiData = transformer.serialize(formData);

// 5. Send to server
const result = await submitApplication(apiData);

// 6. Handle result
// - Success: show success message
// - Error: show error message
```

## Creating a Submit Button Component

Let's create a reusable submit button with loading states.

### SubmitButton Component

```tsx title="src/components/SubmitButton.tsx"
import { useFormControl } from 'reformer';
import type { FormNode } from 'reformer';

interface SubmitButtonProps {
  form: FormNode;
  loading?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

export function SubmitButton({
  form,
  loading = false,
  onClick,
  children = 'Submit'
}: SubmitButtonProps) {
  const { value: isValid } = useFormControl(form.valid);

  return (
    <button
      type="submit"
      onClick={onClick}
      disabled={loading || !isValid}
      className={`
        px-6 py-3 rounded-lg font-medium
        transition-all duration-200
        ${
          loading || !isValid
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
        }
        text-white
        disabled:opacity-50
      `}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Submitting...
        </span>
      ) : (
        children
      )}
    </button>
  );
}
```

### Using SubmitButton

```tsx title="src/components/CreditApplicationForm.tsx"
import { SubmitButton } from './SubmitButton';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      form.touchAll();
      const data = form.getValue();
      const apiData = creditApplicationTransformer.serialize(data);
      const result = await submitApplication(apiData);

      console.log('Success:', result);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormRenderer form={form} />

      <SubmitButton
        form={form}
        loading={submitting}
      >
        Submit Application
      </SubmitButton>
    </form>
  );
}
```

## Complete Integration Example

Here's a complete example with all pieces together:

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo, useState } from 'react';
import { createCreditApplicationForm } from '../schemas/create-form';
import { creditApplicationTransformer } from '../utils/credit-application-transformer';
import { submitApplication } from '../services/api/submission.api';
import { SubmitButton } from './SubmitButton';
import { FormRenderer } from './FormRenderer';

export function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
    setSuccess(false);
    setSubmitting(true);

    try {
      // Mark all fields as touched to show validation errors
      form.touchAll();

      // Get current form values
      const validData = form.getValue();

      // Transform to API format
      const apiData = creditApplicationTransformer.serialize(validData);

      // Submit to server
      const result = await submitApplication(apiData);

      // Success!
      setSuccess(true);
      console.log('Application submitted successfully:', result);

      // Optional: Reset form after success
      // form.reset();

      // Optional: Navigate to success page
      // setTimeout(() => {
      //   navigate(`/applications/${result.id}/success`);
      // }, 1500);

    } catch (err) {
      console.error('Submission error:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to submit application. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Credit Application</h1>

      <form onSubmit={handleSubmit}>
        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-green-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  Application submitted successfully! We'll review it and get back to you soon.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Form Fields */}
        <FormRenderer form={form} />

        {/* Submit Button */}
        <div className="mt-6">
          <SubmitButton form={form} loading={submitting}>
            Submit Application
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
```

## Testing Submission

### Manual Testing Checklist

Test these scenarios:

- [ ] **Valid submission** - Fill form correctly and submit
- [ ] **Invalid submission** - Try to submit with validation errors
- [ ] **Empty form** - Submit button should be disabled
- [ ] **Loading state** - Button shows loading during submission
- [ ] **Success response** - Success message appears
- [ ] **Error response** - Error message appears
- [ ] **Network error** - Handle connection failures
- [ ] **Double submit** - Prevent multiple simultaneous submissions

### Example Test

```typescript title="src/components/CreditApplicationForm.test.tsx"
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreditApplicationForm } from './CreditApplicationForm';
import { submitApplication } from '../services/api/submission.api';

// Mock the API
jest.mock('../services/api/submission.api');

describe('CreditApplicationForm - Basic Submission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('submits form successfully', async () => {
    // Mock successful submission
    (submitApplication as jest.Mock).mockResolvedValue({
      id: 'app-123',
      status: 'pending',
      message: 'Application received',
    });

    const { container } = render(<CreditApplicationForm />);

    // Fill required fields
    // ... (fill form fields)

    // Click submit
    const submitButton = screen.getByText('Submit Application');
    fireEvent.click(submitButton);

    // Should show loading state
    expect(screen.getByText('Submitting...')).toBeInTheDocument();

    // Wait for submission to complete
    await waitFor(() => {
      expect(screen.getByText(/submitted successfully/i)).toBeInTheDocument();
    });

    // API should have been called
    expect(submitApplication).toHaveBeenCalledTimes(1);
  });

  test('shows error on submission failure', async () => {
    // Mock failed submission
    (submitApplication as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );

    const { container } = render(<CreditApplicationForm />);

    // Fill and submit form
    // ...

    const submitButton = screen.getByText('Submit Application');
    fireEvent.click(submitButton);

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  test('disables submit button when form is invalid', () => {
    render(<CreditApplicationForm />);

    const submitButton = screen.getByText('Submit Application');

    // Should be disabled when form is empty/invalid
    expect(submitButton).toBeDisabled();
  });
});
```

## Key Takeaways

### Submission Pattern

```typescript
// ✅ Correct: Use form.touchAll() + form.getValue()
const handleSubmit = async () => {
  form.touchAll(); // Show validation errors
  const data = form.getValue();
  const apiData = transformer.serialize(data);
  return await submitToAPI(apiData);
};

// ❌ Wrong: Direct access without touchAll
const data = form.getValue();
await submitToAPI(data); // User won't see validation errors
```

### Always Transform Data

```typescript
// ✅ Correct: Transform before sending
const handleSubmit = async () => {
  form.touchAll();
  const data = form.getValue();
  const apiData = transformer.serialize(data);
  return await submitApplication(apiData);
};

// ❌ Wrong: Send raw form data
const data = form.getValue();
await submitApplication(data); // May not match API format
```

### Handle Loading State

```typescript
// ✅ Correct: Track loading state
const [submitting, setSubmitting] = useState(false);

const handleSubmit = async () => {
  setSubmitting(true);
  try {
    form.touchAll();
    const data = form.getValue();
    await submitToAPI(data);
  } finally {
    setSubmitting(false);
  }
};

// ❌ Wrong: No loading indication
form.touchAll();
await submitToAPI(form.getValue()); // User doesn't know submission is happening
```

### Disable Submit When Invalid

```tsx
// ✅ Correct: Disable when invalid or submitting
<SubmitButton
  form={form}
  loading={submitting}
/>

// ❌ Wrong: Always enabled
<button type="submit">Submit</button>
```

## What's Next?

You've implemented basic submission! Next, we'll add **Submission States** to track the complete submission lifecycle:

- Idle state (not submitted)
- Submitting state (in progress)
- Success state (completed)
- Error state (failed)
- State transitions
- UI for each state

In the next section, we'll create a state management system that provides a better user experience and clearer feedback during submission.
