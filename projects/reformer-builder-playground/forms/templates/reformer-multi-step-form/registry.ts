// @reformer-generated f7b8f1a94363
// registry.ts — привязка $component/$dataSource к реализациям. Регенерируется.

import { Box, FormField, Input, SelectAsync } from '@reformer/ui-kit';
import { defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';
import { Step, Wizard } from './wizard';
import { CITY_LIST } from './data-sources';

export function createRegistry() {
  return defineRegistry((reg) => {
    reg.component(FIELD_WRAPPER, FormField);
    // Визард и тело шага — из шима wizard.tsx.
    reg.component('Wizard', Wizard);
    reg.component('Step', Step);
    reg.component('Box', Box);
    reg.component('Input', Input);
    reg.component('Select', SelectAsync);

    reg.dataSource('CITY_LIST', CITY_LIST);
  });
}
