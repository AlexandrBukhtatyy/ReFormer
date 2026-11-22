/**
 * Root `ObjectFieldTemplate` of the registration form, set per form via `ui:ObjectFieldTemplate`:
 * the account fields in the two-column grid, the rest below — the baseline page's markup.
 * https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates#objectfieldtemplate
 */
import type { ObjectFieldTemplateProps } from '@rjsf/utils';

const ACCOUNT_FIELDS = new Set(['username', 'email', 'password', 'confirmPassword']);

export function RegistrationLayout({ properties }: ObjectFieldTemplateProps) {
  return (
    <>
      <div className="b-grid">
        {properties.filter((p) => ACCOUNT_FIELDS.has(p.name)).map((p) => p.content)}
      </div>
      {properties.filter((p) => !ACCOUNT_FIELDS.has(p.name)).map((p) => p.content)}
    </>
  );
}
