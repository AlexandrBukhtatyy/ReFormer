// registry.ts — привязка $component/$dataSource к реализациям. Регенерируется.

import { Box, Button, CheckboxWithLabel, FormField, Input, SelectAsync } from '@reformer/ui-kit';
import { defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';

export function createRegistry() {
  return defineRegistry((reg) => {
    reg.component(FIELD_WRAPPER, FormField);
    reg.component('Box', Box);
    reg.component('Input', Input);
    reg.component('Select', SelectAsync);
    reg.component('Checkbox', CheckboxWithLabel);
    reg.component('Button', Button);
  });
}
