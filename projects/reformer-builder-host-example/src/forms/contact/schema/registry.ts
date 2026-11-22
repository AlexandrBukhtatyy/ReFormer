// @reformer-generated bfea6251ef0a
// schema/registry.ts — реестр компонентов и источников данных схемы. Регенерируется.

import { Box, Button, CheckboxWithLabel, FormField, Input, SelectAsync } from '@reformer/ui-kit';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';

export function createRegistry(): ComponentRegistry {
  return defineRegistry((reg) => {
    reg.component(FIELD_WRAPPER, FormField);
    reg.component('Box', Box);
    reg.component('Input', Input);
    reg.component('Select', SelectAsync);
    reg.component('Checkbox', CheckboxWithLabel);
    reg.component('Button', Button);
  });
}
