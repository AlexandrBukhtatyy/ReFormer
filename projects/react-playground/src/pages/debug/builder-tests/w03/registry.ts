// @reformer-generated 9004e40fd41d
// registry.ts — привязка $component/$dataSource к реализациям. Регенерируется.

import { Box, FormField, InputField, SelectField } from '@reformer/ui-kit';
import { defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';
import { Step, Wizard } from './renderer.wizard';
import { CITY_LIST } from './data-sources';

export function createRegistry() {
  return defineRegistry((reg) => {
    reg.component(FIELD_WRAPPER, FormField);
    // Визард и тело шага — из шима renderer.wizard.tsx.
    reg.component('Wizard', Wizard);
    reg.component('Step', Step);
    reg.component('Box', Box);
    reg.component('Input', InputField);
    reg.component('Select', SelectField);

    reg.dataSource('CITY_LIST', CITY_LIST);
  });
}
