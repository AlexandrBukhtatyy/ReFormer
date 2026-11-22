/**
 * Bench theme for RJSF: the documented `withTheme` HOC over the neutral primitives of `src/shared/ui`.
 * https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-themes
 *
 * Contract-relevant Form props are not part of a theme (`ThemeProps` carries only fields, widgets
 * and templates), so every form passes them itself:
 * - `idSeparator="-"` — the testid path is derived from RJSF ids (see `fieldPath.ts`);
 * - `noHtml5Validate`, `showErrorList={false}` — no browser bubbles, no error summary.
 *
 * Optional `formContext` the theme understands: `BenchFormContext` (`fieldPath.ts`).
 */
import { withTheme, type ThemeProps } from '@rjsf/core';
import {
  ArrayFieldItemTemplate,
  ArrayFieldTemplate,
  BaseInputTemplate,
  FieldTemplate,
  ObjectFieldTemplate,
  SubmitButton,
} from './templates';
import {
  CaptchaWidget,
  CheckboxWidget,
  ComputedWidget,
  MaskedWidget,
  RadioWidget,
  RemoteSelectWidget,
  SelectWidget,
  TextareaWidget,
} from './widgets';

export type { BenchFormContext } from './fieldPath';

export const benchTheme: ThemeProps = {
  templates: {
    FieldTemplate,
    ObjectFieldTemplate,
    ArrayFieldTemplate,
    ArrayFieldItemTemplate,
    BaseInputTemplate,
    ButtonTemplates: { SubmitButton },
  },
  widgets: {
    CheckboxWidget,
    SelectWidget,
    RadioWidget,
    TextareaWidget,
    masked: MaskedWidget,
    captcha: CaptchaWidget,
    remoteSelect: RemoteSelectWidget,
    computed: ComputedWidget,
  },
};

export const BenchForm = withTheme(benchTheme);
