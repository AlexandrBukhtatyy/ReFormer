// @reformer-generated 8dcdef7d95ec
// schema/registry.ts — реестр компонентов и источников данных схемы. Регенерируется.

import { Box, Button, FormField } from '@reformer/ui-kit';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';

export function createRegistry(): ComponentRegistry {
  return defineRegistry((reg) => {
    reg.component(FIELD_WRAPPER, FormField);
    reg.component('Box', Box);
    reg.component('Button', Button);
  });
}
