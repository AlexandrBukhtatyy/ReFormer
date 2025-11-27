---
sidebar_position: 1
---

# Introduction to Form Submission

Understanding the complete lifecycle of form submission from validation to server response.

## What is Form Submission?

Form submission is the final stage of the form lifecycle where validated data is sent to the server:

- **Pre-Submission Validation** - Ensuring all data is valid before sending
- **Data Transformation** - Converting form data to API format
- **Network Request** - Sending data to the server
- **Response Handling** - Processing success or error responses
- **State Management** - Updating UI based on submission status
- **Error Recovery** - Handling failures and enabling retry

## Why Proper Submission Management?

Instead of manually handling every aspect of submission:

```tsx
// ❌ Imperative approach - manual submission handling
const handleSubmit = async () => {
  // Manual validation
  const errors = [];
  if (!formData.loanAmount) errors.push('Loan amount required');
  if (!formData.loanTerm) errors.push('Loan term required');
  if (errors.length > 0) {
    setErrors(errors);
    return;
  }

  // Manual transformation
  const apiData = {
    loanAmount: formData.loanAmount,
    loanTerm: formData.loanTerm,
    // ... manually map every field
  };

  // Manual submission
  setSubmitting(true);
  setError(null);

  try {
    const response = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message);
    }

    const result = await response.json();
    setSuccess(true);
    navigate(`/success?id=${result.id}`);
  } catch (error) {
    setError(error.message);
  } finally {
    setSubmitting(false);
  }
};
```

Use ReFormer's form methods with structured submission:

```tsx
// ✅ Declarative approach - structured submission
const handleSubmit = async () => {
  try {
    // Mark all fields as touched to show validation errors
    form.touchAll();

    // Get current form values
    const data = form.getValue();

    // Transform and send
    const apiData = transformer.serialize(data);
    const result = await submitApplication(apiData);

    // Handle success
    navigate(`/success?id=${result.id}`);
  } catch (error) {
    // Handle error
    showNotification('Submission failed');
  }
};
```

Benefits:
- **Automatic Validation** - No manual checks needed
- **Type-Safe** - Full TypeScript support
- **Clean Separation** - Validation, transformation, and submission are separate concerns
- **Error Handling** - Built-in error types and handling
- **State Management** - Integrated with form state

## Submission Lifecycle

Understanding the complete flow from button click to server response:

```
┌─────────────────────────────────────────────────────────────┐
│                   Submission Lifecycle                       │
└─────────────────────────────────────────────────────────────┘

1. USER CLICKS SUBMIT
   ↓
2. PRE-VALIDATION
   ├─ Run all validators (sync + async)
   ├─ Check required fields
   ├─ Check conditional validation
   └─ If invalid → Show errors, STOP
   ↓
3. DATA PREPARATION
   ├─ Get current form values
   ├─ Apply transformations (serialize)
   ├─ Remove computed fields
   └─ Format for API
   ↓
4. SUBMISSION STATE
   ├─ Set form.isSubmitting = true
   ├─ Disable submit button
   └─ Show loading indicator
   ↓
5. NETWORK REQUEST
   ├─ Send POST/PUT request
   ├─ Include auth headers
   └─ Wait for response
   ↓
6. RESPONSE HANDLING
   ├─ Success (2xx)
   │   ├─ Mark form as submitted
   │   ├─ Clear draft
   │   └─ Navigate to success page
   │
   ├─ Validation Error (422)
   │   ├─ Map errors to fields
   │   ├─ Show field-level errors
   │   └─ Keep form editable
   │
   ├─ Server Error (5xx)
   │   ├─ Show error message
   │   ├─ Enable retry
   │   └─ Keep form data
   │
   └─ Network Error
       ├─ Show offline message
       ├─ Auto-retry with backoff
       └─ Save draft locally
   ↓
7. STATE UPDATE
   ├─ Set form.isSubmitting = false
   ├─ Update submission status
   └─ Re-enable interactions
```

## Submission Scenarios

Our credit application form handles various real-world scenarios:

### 1. Simple Submission
- User fills all required fields
- Clicks Submit
- Form validates and sends
- Success message and redirect

### 2. Validation Failure
- User clicks Submit with errors
- Client-side validation catches issues
- Errors shown on fields
- Submit blocked until fixed

### 3. Server-Side Validation
- Form passes client validation
- Server finds additional issues
- Server returns field-specific errors
- Errors mapped to form fields

### 4. Network Error with Retry
- Form submits successfully
- Network connection fails
- Automatic retry with backoff
- Manual retry button available

### 5. Optimistic Update
- Form submits
- UI updates immediately (optimistic)
- If server returns error, rollback
- If success, confirm update

### 6. Multi-Step Submission
- Validate each step individually
- Final step submits entire form
- Can go back to edit previous steps
- Review page before final submit

## What We'll Implement

By the end of this section, our credit application will have:

### Basic Submission
- ✅ Submit with automatic validation
- ✅ Transform data before sending
- ✅ Handle success response
- ✅ Handle error response

### State Management
- ✅ Submission states (idle, submitting, success, error)
- ✅ Loading indicators
- ✅ Disabled state during submission
- ✅ Progress tracking

### Error Handling
- ✅ Client-side validation errors
- ✅ Server-side validation errors
- ✅ Network errors
- ✅ Generic server errors
- ✅ Error recovery strategies

### Advanced Features
- ✅ Retry logic with exponential backoff
- ✅ Optimistic UI updates
- ✅ Multi-step submission workflow
- ✅ Confirmation dialogs
- ✅ Success/error callbacks
- ✅ Post-submission navigation

## Integration with Previous Sections

Submission builds on everything we've created:

### Behaviors (Automatic)
```typescript
// Computed fields are included automatically
const data = form.value.value;
// {
//   loanAmount: 500000,
//   interestRate: 8.5,        // ← Computed by behavior
//   monthlyPayment: 3845,     // ← Computed by behavior
//   age: 35,                  // ← Computed by behavior
// }
```

### Validation (Check Before Submit)
```typescript
// Check form validity before sending
form.touchAll(); // Show validation errors if any
const data = form.getValue();
// form.valid.value tells you if the form is valid
if (form.valid.value) {
  await sendToServer(data);
}
```

### Data Flow (Manual)
```typescript
// Transform before submission
form.touchAll();
const data = form.getValue();
const apiData = transformer.serialize(data);
const result = await submitApplication(apiData);

// Clear draft after success
if (result.success) {
  deleteDraft(draftId);
}
```

## File Structure

We'll create this structure for submission:

```
src/
├── services/
│   ├── api/
│   │   └── submission.api.ts        # API for submitting applications
│   ├── submission.service.ts        # Submission service with retry
│   └── optimistic.service.ts        # Optimistic update utilities
│
├── hooks/
│   ├── useSubmission.ts             # Main submission hook
│   ├── useSubmissionState.ts        # State management
│   ├── useRetry.ts                  # Retry logic
│   └── useOptimistic.ts             # Optimistic updates
│
├── components/
│   ├── CreditApplicationForm.tsx    # Form with submission
│   ├── SubmitButton.tsx             # Submit button with states
│   ├── SubmissionStatus.tsx         # Status indicator
│   ├── RetryIndicator.tsx           # Retry progress
│   ├── ConfirmationDialog.tsx       # Submit confirmation
│   └── SuccessPage.tsx              # Post-submission success
│
└── errors/
    ├── ValidationError.ts           # Validation error type
    ├── ServerError.ts               # Server error type
    └── NetworkError.ts              # Network error type
```

## Key Concepts

### 1. Form Submission Pattern

The recommended submission pattern:

```typescript
const handleSubmit = async () => {
  // Show validation errors
  form.touchAll();

  // Get form values
  const data = form.getValue();

  // Submit to server
  const result = await apiCall(data);
  return result;
};
```

**Key methods**:
- `form.touchAll()` - Marks all fields as touched to show validation errors
- `form.getValue()` - Returns current form values
- `form.valid.value` - Check if form is currently valid

### 2. Submission States

Track the submission status:

```typescript
type SubmissionState =
  | { status: 'idle' }                    // Not submitted
  | { status: 'submitting' }              // In progress
  | { status: 'success'; data: T }        // Succeeded
  | { status: 'error'; error: Error }     // Failed
```

### 3. Error Types

Different errors require different handling:

```typescript
// Validation error - user can fix
class ValidationError extends Error {
  fields: Array<{ field: string; message: string }>;
}

// Server error - might be temporary
class ServerError extends Error {
  code: string;
  retryable: boolean;
}

// Network error - definitely temporary
class NetworkError extends Error {
  retryable: true;
}
```

### 4. Transformers

Convert between form and API formats:

```typescript
const transformer = {
  serialize: (formData) => {
    // Form → API
    return {
      loan_amount: formData.loanAmount,
      loan_term: formData.loanTerm,
      // ... API format
    };
  },
  deserialize: (apiData) => {
    // API → Form
    return {
      loanAmount: apiData.loan_amount,
      loanTerm: apiData.loan_term,
      // ... Form format
    };
  },
};
```

## Common Patterns

### Basic Submit
```typescript
const handleSubmit = async () => {
  form.touchAll();
  const data = form.getValue();
  return await api.submit(data);
};
```

### Submit with Transform
```typescript
const handleSubmit = async () => {
  form.touchAll();
  const data = form.getValue();
  const transformed = transformer.serialize(data);
  return await api.submit(transformed);
};
```

### Submit with State
```typescript
const [submitting, setSubmitting] = useState(false);

const handleSubmit = async () => {
  setSubmitting(true);
  try {
    form.touchAll();
    const data = form.getValue();
    await api.submit(data);
  } finally {
    setSubmitting(false);
  }
};
```

### Submit with Retry
```typescript
let attempts = 0;
while (attempts < maxAttempts) {
  try {
    form.touchAll();
    const data = form.getValue();
    return await api.submit(data);
  } catch (error) {
    if (!isRetryable(error)) throw error;
    attempts++;
    await sleep(exponentialBackoff(attempts));
  }
}
```

## Getting Started

Let's start with **Basic Submission** - the foundation of form submission. This covers:
- Using `form.touchAll()` and `form.getValue()`
- Creating API service
- Handling validation
- Success and error responses
- Submit button states

In the next section, we'll:
1. Create submission API service
2. Implement basic submit handler
3. Add submit button with loading state
4. Handle success and error responses
5. Test submission flow

Ready? Let's begin!
