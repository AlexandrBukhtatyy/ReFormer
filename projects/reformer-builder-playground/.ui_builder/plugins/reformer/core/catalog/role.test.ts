import { describe, expect, it } from 'vitest';
import { defaultPropSchemas } from '@reformer/ui-kit/meta';
import { inferRole } from './role';

describe('inferRole', () => {
  it('form-control (seam value) → field', () => {
    expect(inferRole(defaultPropSchemas.Input)).toBe('field');
    expect(inferRole(defaultPropSchemas.Select)).toBe('field');
    expect(inferRole(defaultPropSchemas.Checkbox)).toBe('field');
    expect(inferRole(defaultPropSchemas.Slider)).toBe('field');
  });

  it('без seam → container', () => {
    expect(inferRole(defaultPropSchemas.Box)).toBe('container');
    expect(inferRole(defaultPropSchemas.Section)).toBe('container');
  });
});
