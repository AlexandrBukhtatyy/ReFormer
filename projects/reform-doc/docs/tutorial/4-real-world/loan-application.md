---
sidebar_position: 1
---

# Loan Application Form

In this final lesson, we'll build a complete loan application form that demonstrates all the concepts you've learned throughout this tutorial.

## What We'll Build

A multi-step loan application form with:
- **Nested groups** for organizing sections
- **Dynamic arrays** for co-borrowers and income sources
- **Validation** throughout
- **Computed fields** for loan calculations
- **Conditional logic** for employment details
- **Multi-step wizard** UI

## Form Structure

```typescript title="src/components/LoanApplication/form.ts"
import { GroupNode } from 'reformer';
import { required, email, min, max, minLength, pattern } from 'reformer/validators';
import { computed, visible } from 'reformer/behaviors';

interface LoanApplicationData {
  // Personal Information
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
  };

  // Employment Information
  employment: {
    status: 'employed' | 'self-employed' | 'retired' | 'unemployed';
    employerName: string;
    position: string;
    monthlyIncome: number;
    yearsEmployed: number;
  };

  // Loan Details
  loanDetails: {
    amount: number;
    term: number; // months
    purpose: string;
    monthlyPayment: number; // computed
  };

  // Co-borrowers (dynamic array)
  coBorrowers: Array<{
    firstName: string;
    lastName: string;
    relationship: string;
  }>;
}

const phonePattern = /^\+?[\d\s\-()]+$/;

export const loanApplicationForm = new GroupNode<LoanApplicationData>({
  form: {
    personalInfo: {
      firstName: { value: '' },
      lastName: { value: '' },
      email: { value: '' },
      phone: { value: '' },
      dateOfBirth: { value: '' },
    },

    employment: {
      status: { value: 'employed' },
      employerName: { value: '' },
      position: { value: '' },
      monthlyIncome: { value: 0 },
      yearsEmployed: { value: 0 },
    },

    loanDetails: {
      amount: { value: 10000 },
      term: { value: 12 },
      purpose: { value: '' },
      monthlyPayment: { value: 0 },
    },

    coBorrowers: [{
      firstName: { value: '' },
      lastName: { value: '' },
      relationship: { value: '' },
    }],
  },

  validation: (path, { when }) => {
    // Personal Info Validation
    required(path.personalInfo.firstName);
    minLength(path.personalInfo.firstName, 2);
    required(path.personalInfo.lastName);
    minLength(path.personalInfo.lastName, 2);
    required(path.personalInfo.email);
    email(path.personalInfo.email);
    required(path.personalInfo.phone);
    pattern(path.personalInfo.phone, phonePattern);
    required(path.personalInfo.dateOfBirth);

    // Employment Validation
    required(path.employment.status);
    required(path.employment.monthlyIncome);
    min(path.employment.monthlyIncome, 0);

    // Conditional: employer fields required for employed/self-employed
    when(
      () => {
        const status = loanApplicationForm.controls.employment.controls.status.value;
        return status === 'employed' || status === 'self-employed';
      },
      (path) => {
        required(path.employment.employerName);
        required(path.employment.position);
        required(path.employment.yearsEmployed);
        min(path.employment.yearsEmployed, 0);
      }
    );

    // Loan Details Validation
    required(path.loanDetails.amount);
    min(path.loanDetails.amount, 1000);
    max(path.loanDetails.amount, 500000);
    required(path.loanDetails.term);
    min(path.loanDetails.term, 6);
    max(path.loanDetails.term, 360);
    required(path.loanDetails.purpose);
    minLength(path.loanDetails.purpose, 10);

    // Co-borrowers Validation
    required(path.coBorrowers.$each.firstName);
    required(path.coBorrowers.$each.lastName);
    required(path.coBorrowers.$each.relationship);
  },

  behaviors: (path, { use }) => [
    // Show employment fields only for employed/self-employed
    use(visible(
      path.employment.employerName,
      [path.employment.status],
      (status) => status === 'employed' || status === 'self-employed'
    )),

    use(visible(
      path.employment.position,
      [path.employment.status],
      (status) => status === 'employed' || status === 'self-employed'
    )),

    use(visible(
      path.employment.yearsEmployed,
      [path.employment.status],
      (status) => status === 'employed' || status === 'self-employed'
    )),

    // Calculate monthly payment (simplified formula)
    use(computed(
      path.loanDetails.monthlyPayment,
      [path.loanDetails.amount, path.loanDetails.term],
      (amount, term) => {
        if (!amount || !term) return 0;
        const monthlyRate = 0.05 / 12; // 5% annual rate
        const payment = (amount * monthlyRate * Math.pow(1 + monthlyRate, term)) /
                       (Math.pow(1 + monthlyRate, term) - 1);
        return Math.round(payment * 100) / 100;
      }
    )),
  ],
});
```

## Multi-Step Component

```tsx title="src/components/LoanApplication/index.tsx"
import { useState } from 'react';
import { useFormControl } from 'reformer';
import { loanApplicationForm } from './form';

export function LoanApplicationForm() {
  const [currentStep, setCurrentStep] = useState(1);

  const handleNext = () => {
    // Validate current step before proceeding
    const currentSection = getCurrentSection();
    currentSection.markAllAsTouched();

    if (currentSection.valid) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    loanApplicationForm.markAllAsTouched();

    if (!loanApplicationForm.valid) {
      return;
    }

    console.log('Loan application:', loanApplicationForm.value);
    alert('Application submitted successfully!');
  };

  const getCurrentSection = () => {
    switch (currentStep) {
      case 1: return loanApplicationForm.controls.personalInfo;
      case 2: return loanApplicationForm.controls.employment;
      case 3: return loanApplicationForm.controls.loanDetails;
      default: return loanApplicationForm;
    }
  };

  return (
    <div className="loan-application">
      <h1>Loan Application</h1>

      {/* Progress Indicator */}
      <div className="steps">
        <div className={currentStep >= 1 ? 'step active' : 'step'}>Personal Info</div>
        <div className={currentStep >= 2 ? 'step active' : 'step'}>Employment</div>
        <div className={currentStep >= 3 ? 'step active' : 'step'}>Loan Details</div>
        <div className={currentStep >= 4 ? 'step active' : 'step'}>Co-borrowers</div>
      </div>

      <form onSubmit={handleSubmit}>
        {currentStep === 1 && <PersonalInfoStep />}
        {currentStep === 2 && <EmploymentStep />}
        {currentStep === 3 && <LoanDetailsStep />}
        {currentStep === 4 && <CoBorrowersStep />}

        {/* Navigation */}
        <div className="navigation">
          {currentStep > 1 && (
            <button type="button" onClick={handleBack}>
              Back
            </button>
          )}

          {currentStep < 4 ? (
            <button type="button" onClick={handleNext}>
              Next
            </button>
          ) : (
            <button type="submit" disabled={!loanApplicationForm.valid}>
              Submit Application
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// Step 1: Personal Information
function PersonalInfoStep() {
  const firstName = useFormControl(loanApplicationForm.controls.personalInfo.controls.firstName);
  const lastName = useFormControl(loanApplicationForm.controls.personalInfo.controls.lastName);
  const email = useFormControl(loanApplicationForm.controls.personalInfo.controls.email);
  const phone = useFormControl(loanApplicationForm.controls.personalInfo.controls.phone);
  const dateOfBirth = useFormControl(loanApplicationForm.controls.personalInfo.controls.dateOfBirth);

  return (
    <div className="step-content">
      <h2>Personal Information</h2>

      <div>
        <label htmlFor="firstName">First Name</label>
        <input
          id="firstName"
          value={firstName.value}
          onChange={(e) => firstName.setValue(e.target.value)}
          onBlur={() => firstName.markAsTouched()}
        />
        {firstName.touched && firstName.errors?.required && (
          <span className="error">First name is required</span>
        )}
      </div>

      <div>
        <label htmlFor="lastName">Last Name</label>
        <input
          id="lastName"
          value={lastName.value}
          onChange={(e) => lastName.setValue(e.target.value)}
          onBlur={() => lastName.markAsTouched()}
        />
        {lastName.touched && lastName.errors?.required && (
          <span className="error">Last name is required</span>
        )}
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email.value}
          onChange={(e) => email.setValue(e.target.value)}
          onBlur={() => email.markAsTouched()}
        />
        {email.touched && email.errors?.email && (
          <span className="error">Invalid email</span>
        )}
      </div>

      <div>
        <label htmlFor="phone">Phone</label>
        <input
          id="phone"
          value={phone.value}
          onChange={(e) => phone.setValue(e.target.value)}
          onBlur={() => phone.markAsTouched()}
        />
        {phone.touched && phone.errors?.pattern && (
          <span className="error">Invalid phone format</span>
        )}
      </div>

      <div>
        <label htmlFor="dateOfBirth">Date of Birth</label>
        <input
          id="dateOfBirth"
          type="date"
          value={dateOfBirth.value}
          onChange={(e) => dateOfBirth.setValue(e.target.value)}
          onBlur={() => dateOfBirth.markAsTouched()}
        />
      </div>
    </div>
  );
}

// Step 2: Employment (with conditional fields)
function EmploymentStep() {
  const status = useFormControl(loanApplicationForm.controls.employment.controls.status);
  const employerName = useFormControl(loanApplicationForm.controls.employment.controls.employerName);
  const position = useFormControl(loanApplicationForm.controls.employment.controls.position);
  const monthlyIncome = useFormControl(loanApplicationForm.controls.employment.controls.monthlyIncome);
  const yearsEmployed = useFormControl(loanApplicationForm.controls.employment.controls.yearsEmployed);

  return (
    <div className="step-content">
      <h2>Employment Information</h2>

      <div>
        <label>Employment Status</label>
        <select
          value={status.value}
          onChange={(e) => status.setValue(e.target.value as any)}
        >
          <option value="employed">Employed</option>
          <option value="self-employed">Self-Employed</option>
          <option value="retired">Retired</option>
          <option value="unemployed">Unemployed</option>
        </select>
      </div>

      {employerName.visible && (
        <div>
          <label>Employer Name</label>
          <input
            value={employerName.value}
            onChange={(e) => employerName.setValue(e.target.value)}
            onBlur={() => employerName.markAsTouched()}
          />
          {employerName.touched && employerName.errors?.required && (
            <span className="error">Employer name is required</span>
          )}
        </div>
      )}

      {position.visible && (
        <div>
          <label>Position</label>
          <input
            value={position.value}
            onChange={(e) => position.setValue(e.target.value)}
            onBlur={() => position.markAsTouched()}
          />
          {position.touched && position.errors?.required && (
            <span className="error">Position is required</span>
          )}
        </div>
      )}

      <div>
        <label>Monthly Income ($)</label>
        <input
          type="number"
          value={monthlyIncome.value}
          onChange={(e) => monthlyIncome.setValue(Number(e.target.value))}
        />
      </div>

      {yearsEmployed.visible && (
        <div>
          <label>Years Employed</label>
          <input
            type="number"
            value={yearsEmployed.value}
            onChange={(e) => yearsEmployed.setValue(Number(e.target.value))}
          />
        </div>
      )}
    </div>
  );
}

// Step 3: Loan Details (with computed monthly payment)
function LoanDetailsStep() {
  const amount = useFormControl(loanApplicationForm.controls.loanDetails.controls.amount);
  const term = useFormControl(loanApplicationForm.controls.loanDetails.controls.term);
  const purpose = useFormControl(loanApplicationForm.controls.loanDetails.controls.purpose);
  const monthlyPayment = useFormControl(loanApplicationForm.controls.loanDetails.controls.monthlyPayment);

  return (
    <div className="step-content">
      <h2>Loan Details</h2>

      <div>
        <label>Loan Amount ($)</label>
        <input
          type="number"
          value={amount.value}
          onChange={(e) => amount.setValue(Number(e.target.value))}
        />
        {amount.touched && amount.errors?.min && (
          <span className="error">Minimum $1,000</span>
        )}
        {amount.touched && amount.errors?.max && (
          <span className="error">Maximum $500,000</span>
        )}
      </div>

      <div>
        <label>Loan Term (months)</label>
        <input
          type="number"
          value={term.value}
          onChange={(e) => term.setValue(Number(e.target.value))}
        />
        {term.touched && term.errors?.min && (
          <span className="error">Minimum 6 months</span>
        )}
      </div>

      <div>
        <label>Loan Purpose</label>
        <textarea
          value={purpose.value}
          onChange={(e) => purpose.setValue(e.target.value)}
          onBlur={() => purpose.markAsTouched()}
          rows={3}
        />
        {purpose.touched && purpose.errors?.minLength && (
          <span className="error">Please provide more detail (at least 10 characters)</span>
        )}
      </div>

      {/* Computed field */}
      <div className="computed-field">
        <label>Estimated Monthly Payment</label>
        <strong>${monthlyPayment.value.toFixed(2)}</strong>
      </div>
    </div>
  );
}

// Step 4: Co-borrowers (dynamic array)
function CoBorrowersStep() {
  const coBorrowers = useFormControl(loanApplicationForm.controls.coBorrowers);

  return (
    <div className="step-content">
      <h2>Co-borrowers (Optional)</h2>

      {coBorrowers.items.map((coBorrower, index) => {
        const firstName = useFormControl(coBorrower.controls.firstName);
        const lastName = useFormControl(coBorrower.controls.lastName);
        const relationship = useFormControl(coBorrower.controls.relationship);

        return (
          <div key={coBorrower.id} className="co-borrower">
            <h3>Co-borrower {index + 1}</h3>

            <div>
              <label>First Name</label>
              <input
                value={firstName.value}
                onChange={(e) => firstName.setValue(e.target.value)}
                onBlur={() => firstName.markAsTouched()}
              />
              {firstName.touched && firstName.errors?.required && (
                <span className="error">First name is required</span>
              )}
            </div>

            <div>
              <label>Last Name</label>
              <input
                value={lastName.value}
                onChange={(e) => lastName.setValue(e.target.value)}
                onBlur={() => lastName.markAsTouched()}
              />
            </div>

            <div>
              <label>Relationship</label>
              <select
                value={relationship.value}
                onChange={(e) => relationship.setValue(e.target.value)}
              >
                <option value="">Select...</option>
                <option value="spouse">Spouse</option>
                <option value="parent">Parent</option>
                <option value="sibling">Sibling</option>
                <option value="friend">Friend</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => coBorrowers.removeAt(index)}
            >
              Remove Co-borrower
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => coBorrowers.push()}
      >
        Add Co-borrower
      </button>
    </div>
  );
}
```

## Key Features Demonstrated

### 1. Nested Groups
```typescript
personalInfo: { ... }  // Nested object becomes a group
employment: { ... }    // Nested object becomes a group
loanDetails: { ... }   // Nested object becomes a group
```

### 2. Dynamic Arrays
```typescript
coBorrowers: [{        // Array syntax with item template
  firstName: { value: '' },
  lastName: { value: '' },
  relationship: { value: '' },
}]
```

### 3. Validation
- Required fields
- Email and phone patterns
- Numeric ranges (min/max)
- Conditional validation with `when`

### 4. Computed Fields
```typescript
use(computed(
  path.loanDetails.monthlyPayment,
  [path.loanDetails.amount, path.loanDetails.term],
  (amount, term) => calculatePayment(amount, term)
))
```

### 5. Conditional Logic
```typescript
use(visible(
  path.employment.employerName,
  [path.employment.status],
  (status) => status === 'employed' || status === 'self-employed'
))
```

### 6. Multi-Step Wizard
- Step-by-step navigation
- Section-level validation
- Progress indicator
- Form state preserved across steps

## Congratulations!

You've completed the ReFormer tutorial! You now know how to:
- ✅ Create forms with simple configuration syntax
- ✅ Add validation with built-in validators
- ✅ Handle form submission
- ✅ Organize complex forms with nested objects
- ✅ Manage dynamic lists with array syntax
- ✅ Create computed fields
- ✅ Implement conditional logic
- ✅ Add async validation

## Next Steps

- Explore the [API Reference](/docs/api) for detailed documentation
- Check out [Core Concepts](/docs/core-concepts/nodes) for deeper understanding
- Review [Behaviors](/docs/behaviors/overview) for more advanced patterns
- Join the community and share your ReFormer forms!
