import { describe, expect, it } from 'vitest';
import { collectUnknownComponentNames } from './unknown';
import { sampleSchema } from '../model/__fixtures__/sample-schema';

describe('collectUnknownComponentNames', () => {
  it('возвращает только незарегистрированные $component', () => {
    // sample: RendererFormWizard, Step, Select, Input, Box — известны все, кроме RendererFormWizard
    expect(collectUnknownComponentNames(sampleSchema())).toEqual(['RendererFormWizard']);
  });
});
