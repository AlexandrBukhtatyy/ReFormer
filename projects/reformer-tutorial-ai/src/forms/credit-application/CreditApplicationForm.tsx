import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAutosave } from '@/hooks/useAutosave';
import { useLoadDraft } from '@/hooks/useLoadDraft';

import { createCreditApplicationForm } from './createCreditApplicationForm';
import { creditApplicationService } from './services/credit-application.service';
import { BasicInfoForm } from './steps/BasicInfoForm';
import { PersonalInfoForm } from './steps/PersonalInfoForm';
import { ContactInfoForm } from './steps/ContactInfoForm';
import { EmploymentForm } from './steps/EmploymentForm';
import { AdditionalInfoForm } from './steps/AdditionalInfoForm';
import { ConfirmationForm } from './steps/ConfirmationForm';

const STEPS = [
  { id: 1, title: 'Loan Info' },
  { id: 2, title: 'Personal' },
  { id: 3, title: 'Contact' },
  { id: 4, title: 'Employment' },
  { id: 5, title: 'Additional' },
  { id: 6, title: 'Confirmation' },
];

export function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    applicationId?: string;
    error?: string;
  } | null>(null);
  const totalSteps = STEPS.length;

  // Data Flow: Autosave hook
  const { lastSaved, isSaving, clearDraft } = useAutosave(form, { delay: 2000 });

  // Data Flow: Draft loading hook
  const { hasDraft, draftTimestamp, loadDraft, discardDraft, draftLoaded } = useLoadDraft(form);

  const goToNextStep = async () => {
    // Touch all fields to show validation errors
    form.touchAll();

    // Run validation to update field statuses
    await form.validate();

    // Check if form is valid before proceeding
    const isValid = form.valid.value;

    if (!isValid) {
      console.log('Form has validation errors, please fix them before proceeding');
      return;
    }

    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (step: number) => {
    if (step >= 1 && step <= totalSteps) {
      setCurrentStep(step);
    }
  };

  const handleSubmit = async () => {
    // Touch all fields to show validation errors
    form.touchAll();

    // Run validation to update field statuses
    await form.validate();

    // Check if form is valid
    if (!form.valid.value) {
      console.log('Form has validation errors');
      return;
    }

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const values = form.getValue();
      console.log('Form values:', values);

      // Use the service to submit
      const result = await creditApplicationService.submitApplication(values);

      setSubmitResult({ success: true, applicationId: result.applicationId });
      clearDraft(); // Clear draft after successful submission
    } catch (error) {
      console.error('Submission failed:', error);
      setSubmitResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Draft restoration banner */}
      {hasDraft && !draftLoaded && (
        <div
          className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between"
          data-testid="draft-banner"
        >
          <div>
            <p className="font-medium text-yellow-800">Draft found</p>
            <p className="text-sm text-yellow-700">
              You have an unsaved draft from{' '}
              {draftTimestamp ? new Date(draftTimestamp).toLocaleString() : 'earlier'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={discardDraft} data-testid="discard-draft">
              Discard
            </Button>
            <Button size="sm" onClick={loadDraft} data-testid="load-draft">
              Restore Draft
            </Button>
          </div>
        </div>
      )}

      {/* Submission result */}
      {submitResult && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            submitResult.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
          data-testid="submit-result"
        >
          {submitResult.success ? (
            <div>
              <p className="font-medium text-green-800">Application submitted successfully!</p>
              <p className="text-sm text-green-700">Application ID: {submitResult.applicationId}</p>
            </div>
          ) : (
            <div>
              <p className="font-medium text-red-800">Submission failed</p>
              <p className="text-sm text-red-700">{submitResult.error}</p>
            </div>
          )}
        </div>
      )}

      {/* Step indicator */}
      <div className="flex flex-wrap gap-2 mb-8">
        {STEPS.map((step) => (
          <button
            key={step.id}
            onClick={() => goToStep(step.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentStep === step.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            {step.id}. {step.title}
          </button>
        ))}
      </div>

      {/* Current step content */}
      <div className="bg-white p-8 rounded-lg shadow-md border">
        {currentStep === 1 && <BasicInfoForm control={form} />}
        {currentStep === 2 && <PersonalInfoForm control={form} />}
        {currentStep === 3 && <ContactInfoForm control={form} />}
        {currentStep === 4 && <EmploymentForm control={form} />}
        {currentStep === 5 && <AdditionalInfoForm control={form} />}
        {currentStep === 6 && <ConfirmationForm control={form} />}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between mt-6">
        <Button
          type="button"
          variant="outline"
          onClick={goToPreviousStep}
          disabled={currentStep === 1}
        >
          Previous
        </Button>

        {currentStep < totalSteps ? (
          <Button type="button" onClick={goToNextStep}>
            Next
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Application'}
          </Button>
        )}
      </div>

      {/* Progress info with autosave status */}
      <div className="mt-4 text-center text-sm text-muted-foreground">
        <div>
          Step {currentStep} of {totalSteps} • {Math.round((currentStep / totalSteps) * 100)}%
          complete
        </div>
        <div className="mt-1" data-testid="autosave-status">
          {isSaving ? (
            <span className="text-yellow-600">Saving...</span>
          ) : lastSaved ? (
            <span className="text-green-600">
              Last saved: {new Date(lastSaved).toLocaleTimeString()}
            </span>
          ) : (
            <span>Autosave enabled</span>
          )}
        </div>
      </div>
    </div>
  );
}
