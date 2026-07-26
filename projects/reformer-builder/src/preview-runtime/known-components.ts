/**
 * Карта имя → React-компонент `@reformer/ui-kit` для дефолтного registry Runtime-preview
 * (спека §9). Поля — `*Field`-алиасы (биндят value/onChange через модель), плюс контейнеры и
 * `Step` из `@reformer/cdk`. Ключи совпадают с {@link KNOWN_COMPONENT_NAMES}.
 *
 * @module reformer-builder/preview-runtime/known-components
 */

import type { ComponentType } from 'react';
import {
  InputField,
  InputPasswordField,
  InputMaskField,
  TextareaField,
  SelectField,
  NativeSelectField,
  CheckboxField,
  RadioGroupField,
  SwitchField,
  SliderField,
  FileUploadField,
  FileUploadAvatarField,
  ToggleField,
  ToggleGroupField,
  Box,
  Section,
  Collapsible,
  FormField,
  Button,
  AsyncBoundary,
} from '@reformer/ui-kit';
import { Step } from '@reformer/cdk/form-wizard';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const KNOWN_COMPONENTS: Record<string, ComponentType<any>> = {
  Input: InputField,
  InputPassword: InputPasswordField,
  InputMask: InputMaskField,
  Textarea: TextareaField,
  Select: SelectField,
  NativeSelect: NativeSelectField,
  Checkbox: CheckboxField,
  RadioGroup: RadioGroupField,
  Switch: SwitchField,
  Slider: SliderField,
  FileUpload: FileUploadField,
  FileUploadAvatar: FileUploadAvatarField,
  Toggle: ToggleField,
  ToggleGroup: ToggleGroupField,
  Box,
  Section,
  Collapsible,
  FormField,
  Button,
  AsyncBoundary,
  Step,
};
