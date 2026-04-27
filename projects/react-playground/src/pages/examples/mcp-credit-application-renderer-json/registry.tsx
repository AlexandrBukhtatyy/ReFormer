import { defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';
import { Input, Textarea, Select, Checkbox, FormField } from '@reformer/ui-kit';
import { FormRoot } from './form-root';
import { Section } from './section';

// ── Registry definition ───────────────────────────────────────────────────────

export const registry = defineRegistry((reg) => {
  // Field components
  reg.field('Input', Input);
  reg.field('Textarea', Textarea);
  reg.field('Select', Select);
  reg.field('Checkbox', Checkbox);

  // Containers
  reg.container('FormRoot', FormRoot);
  reg.container('Section', Section);

  // Field wrapper (used by FormRenderer settings)
  reg.container(FIELD_WRAPPER, FormField);
});
