// @reformer-generated 842e0b2eb270
// registry.ts — привязка $component/$dataSource к реализациям. Регенерируется.

import { Box, Button, FormField, InputField, SelectField } from '@reformer/ui-kit';
import { defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';
import { CITY_LIST } from './data-sources';

export function createRegistry() {
  return defineRegistry((reg) => {
    reg.component(FIELD_WRAPPER, FormField);
    reg.component('Box', Box);
    reg.component('Input', InputField);
    reg.component('Select', SelectField);
    reg.component('Button', Button);

    reg.dataSource('CITY_LIST', CITY_LIST);
  });
}
