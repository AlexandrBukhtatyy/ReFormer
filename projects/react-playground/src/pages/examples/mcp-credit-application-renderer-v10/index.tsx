/**
 * MCP Credit Application Renderer v10 — target=renderer-react
 *
 * Iter-10 regression page. Verifies:
 * - Patch G — FormWizard hierarchy A1: ui-kit FormWizard. (Default for ui-kit stacks.)
 * - Patch H — `readOnly: true` (camelCase) on computed fields; `maxLength` (camelCase) on Textarea.
 * - Patch I — `computeFrom([path.personalData], ...)` subscribes to GROUP NODE for fullName/age.
 * - Patch J — RenderSchema callback uses `path.X` (FieldPathNode), NEVER `form.X` (FieldNode).
 * - Patch L — JSX/`useEffect` orchestration: each conditional sub-section gets its own
 *             `useEffect` reacting to `useFormControlValue(form.flag)` and calling
 *             `schema.node('selector').setHidden(...)`. NO raw `effect()` + signal-write
 *             combination (would trip Cycle detected).
 * - Patch M — defensive `hideWhen` calls (none used here — orchestration goes through
 *             React-side useEffect bridge per Patch L). Documented for completeness.
 * - D1 — Select/RadioGroup carry `options` in createForm schema componentProps.
 * - D3 — FormArray.AddButton initialValue = plain primitive item factory.
 *
 * Dev-only fixture button: `data-testid="fill-fake-data"` calls form.setValue(happyPathFixture).
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFormControlValue } from '@reformer/core';
import { FormRenderer } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';

import { createCreditApplicationForm } from './schema';
import { createCreditApplicationRenderSchema } from './render-schema';
import { happyPathFixture } from './data-fixture';
import type { CreditApplicationForm } from './types';

export default function McpCreditApplicationRendererV10() {
  // 1. Form (memoized — single instance for the lifetime of the page)
  const form = useMemo(() => createCreditApplicationForm(), []);

  // 2. Submit handler — must be stable so schema doesn't have to be re-created.
  //    We close over the latest `form` via ref-capture inside useMemo below.
  const submitRef = useRef<(values: CreditApplicationForm) => Promise<unknown>>(null!);
  submitRef.current = async (values: CreditApplicationForm) => {
    console.log('[mcp-credit-application-renderer-v10] submit', values);
    window.alert('Заявка отправлена (mock)');
    return { ok: true };
  };

  // 3. RenderSchema — built once, contains FormWizard with RenderNode step bodies.
  const schema = useMemo(
    () =>
      createCreditApplicationRenderSchema(form, async (values) => {
        return submitRef.current(values);
      }),
    [form]
  );

  // 4. Patch L — React-side orchestration of conditional sub-section visibility.
  //    Each useEffect subscribes (via useFormControlValue) to ONE source signal
  //    and calls schema.node('selector').setHidden(...) on dep change.
  //    NO raw `effect()` + setHidden combo (would trip Cycle detected).

  const loanType = useFormControlValue(form.loanType as never) as string;
  useEffect(() => {
    schema.node('step1.mortgage-section').setHidden(loanType !== 'mortgage');
    schema.node('step1.car-section').setHidden(loanType !== 'car');
    // loanPurpose is hidden ONLY for mortgage and car (it has its own section selector).
    schema
      .node('step1.loanPurpose-section')
      .setHidden(loanType === 'mortgage' || loanType === 'car');
  }, [schema, loanType]);

  const employmentStatus = useFormControlValue(form.employmentStatus as never) as string;
  useEffect(() => {
    schema.node('step4.employed-section').setHidden(employmentStatus !== 'employed');
    schema.node('step4.selfEmployed-section').setHidden(employmentStatus !== 'selfEmployed');
  }, [schema, employmentStatus]);

  const sameAsRegistration = useFormControlValue(form.sameAsRegistration as never) as boolean;
  useEffect(() => {
    schema.node('step3.residence-section').setHidden(sameAsRegistration === true);
  }, [schema, sameAsRegistration]);

  const hasProperty = useFormControlValue(form.hasProperty as never) as boolean;
  useEffect(() => {
    schema.node('step5.properties-array').setHidden(hasProperty !== true);
  }, [schema, hasProperty]);

  const hasExistingLoans = useFormControlValue(form.hasExistingLoans as never) as boolean;
  useEffect(() => {
    schema.node('step5.existingLoans-array').setHidden(hasExistingLoans !== true);
  }, [schema, hasExistingLoans]);

  const hasCoBorrower = useFormControlValue(form.hasCoBorrower as never) as boolean;
  useEffect(() => {
    schema.node('step5.coBorrowers-array').setHidden(hasCoBorrower !== true);
  }, [schema, hasCoBorrower]);

  // 5. Fill fake data button (dev-only)
  const fillFakeData = () => {
    form.setValue(happyPathFixture);
  };

  return (
    <div className="w-full">
      {import.meta.env.DEV && (
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={fillFakeData}
            data-testid="fill-fake-data"
            className="px-3 py-1.5 text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 rounded border border-amber-300"
          >
            🎭 Заполнить тестовыми данными
          </button>
          <span className="text-xs text-gray-500">
            target=renderer-react · Iter-10 · A1 (ui-kit FormWizard) · B2 (RenderNode bodies)
          </span>
        </div>
      )}
      <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
    </div>
  );
}
