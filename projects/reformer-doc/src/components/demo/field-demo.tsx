import type { ComponentType } from 'react';
import { FormField } from '@reformer/ui-kit';
import { useDemoField, type DemoFieldConfig } from './harness';

/**
 * Собирает готовый React-компонент, который поднимает M1-поле и рендерит его
 * через `<FormField>`. Используется для variant-карточек и example-демо
 * field-bound компонентов ui-kit (schema-driven путь).
 */
export function makeFieldVariant(config: DemoFieldConfig): ComponentType {
  return function FieldVariant() {
    const { control } = useDemoField(config);
    return (
      <div style={{ maxWidth: 380, width: '100%' }}>
        <FormField control={control} />
      </div>
    );
  };
}
