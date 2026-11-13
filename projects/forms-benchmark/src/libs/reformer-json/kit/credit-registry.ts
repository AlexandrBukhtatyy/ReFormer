/**
 * Реестр renderer-json кредитной заявки: общие записи (./base-registry.ts) + контролы и контейнеры
 * многошаговой формы. Шаг — `Step` из `@reformer/cdk/form-wizard` (рисует детей; `title` читает
 * визард), как велит renderer-json 07-form-wizard.md.
 */
import { defineRegistry } from '@reformer/renderer-json';
import { Step } from '@reformer/cdk/form-wizard';
import { DateInput, NumberInput, RadioGroup, ReadonlyValue } from '../../../shared/ui/controls';
import { Section } from '../../../shared/ui/array';
import { registerBase } from './base-registry';
import { ArraySection, Group, Wizard } from './layout';

export const creditRegistry = defineRegistry((reg) => {
  registerBase(reg);
  reg.component('NumberInput', NumberInput);
  reg.component('DateInput', DateInput);
  reg.component('RadioGroup', RadioGroup);
  reg.component('ReadonlyValue', ReadonlyValue);
  reg.component('Section', Section);
  reg.component('Group', Group);
  reg.component('ArraySection', ArraySection);
  reg.component('Wizard', Wizard);
  reg.component('Step', Step);
});
