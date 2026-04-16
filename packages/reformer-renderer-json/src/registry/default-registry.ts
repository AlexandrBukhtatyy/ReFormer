/**
 * Дефолтный реестр с компонентами из @reformer/ui-kit
 *
 * @module reformer/renderer-json/registry/default-registry
 */

import {
  Input,
  InputPassword,
  InputMask,
  Textarea,
  Select,
  Checkbox,
  RadioGroup,
  Box,
  Section,
  Collapsible,
  FormField,
  Button,
  AsyncBoundary,
} from '@reformer/ui-kit';

import { createComponentRegistry } from './component-registry';
import type { ComponentRegistry } from './types';

/**
 * Создаёт реестр с предустановленными компонентами из @reformer/ui-kit
 *
 * Включает:
 * - Input-компоненты: Input, InputPassword, InputMask, Textarea
 * - Selection-компоненты: Select, Checkbox, RadioGroup
 * - Layout-компоненты: Box, Section, Collapsible
 * - Utility-компоненты: FormField, Button
 *
 * @example
 * ```typescript
 * // Использование как есть
 * const registry = createDefaultRegistry();
 *
 * // Расширение кастомными компонентами
 * const customRegistry = createDefaultRegistry()
 *   .register('DatePicker', { component: MyDatePicker, type: 'field' })
 *   .register('CustomWizard', { component: MyWizard, type: 'container' });
 * ```
 */
export function createDefaultRegistry(): ComponentRegistry {
  return createComponentRegistry()
    // Input components (field type)
    .register('Input', {
      component: Input,
      type: 'field',
      description: 'Text input field',
    })
    .register('InputPassword', {
      component: InputPassword,
      type: 'field',
      description: 'Password input with visibility toggle',
    })
    .register('InputMask', {
      component: InputMask,
      type: 'field',
      description: 'Masked input (phone, card, etc.)',
    })
    .register('Textarea', {
      component: Textarea,
      type: 'field',
      description: 'Multi-line text input',
    })

    // Selection components (field type)
    .register('Select', {
      component: Select,
      type: 'field',
      description: 'Dropdown select',
    })
    .register('Checkbox', {
      component: Checkbox,
      type: 'field',
      description: 'Boolean checkbox',
    })
    .register('RadioGroup', {
      component: RadioGroup,
      type: 'field',
      description: 'Radio button group',
    })

    // Layout components (container type)
    .register('Box', {
      component: Box,
      type: 'container',
      description: 'Simple div wrapper',
    })
    .register('Section', {
      component: Section,
      type: 'container',
      description: 'Section with optional title',
    })
    .register('Collapsible', {
      component: Collapsible,
      type: 'container',
      description: 'Expandable/collapsible section',
    })
    .register('AsyncBoundary', {
      component: AsyncBoundary,
      type: 'container',
      description: 'Switches between loading/error/ready slots by status prop',
    })

    // Utility components
    .register('FormField', {
      component: FormField,
      type: 'container',
      description: 'Field wrapper with label and errors',
    })
    .register('Button', {
      component: Button,
      type: 'container',
      description: 'Button component',
    });
}

/**
 * Синглтон дефолтного реестра
 *
 * Используется по умолчанию в JsonRendererProvider если registry не указан.
 */
export const defaultRegistry = createDefaultRegistry();
