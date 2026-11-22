// @reformer-generated 421f2b3c1c90
// schema/registry.ts — реестр компонентов и источников данных схемы. Регенерируется.

import { Box, Button, CheckboxWithLabel, FormField, Input, Select } from '@reformer/kit-hexa-ui';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';

export function createRegistry(): ComponentRegistry {
  return defineRegistry((reg) => {
    reg.component(FIELD_WRAPPER, FormField);
    reg.component('Box', Box);
    reg.component('Input', Input);
    reg.component('Select', Select);
    reg.component('Checkbox', CheckboxWithLabel);
    reg.component('Button', Button);
  });
}
