import { describe, expect, it } from 'vitest';
import { FORM_SCHEMA_PROVIDER_ID, isFormSchemaDocument } from './document';

describe('isFormSchemaDocument', () => {
  it('модельный документ провайдера схемы формы — свой', () => {
    expect(isFormSchemaDocument({ kind: 'model', providerId: FORM_SCHEMA_PROVIDER_ID })).toBe(true);
  });

  it('модельный документ ДРУГОГО провайдера — чужой, даже если это тот же `.json`', () => {
    // Ради этого случая поле и заведено: медиатип у схем разных стеков одинаковый.
    expect(isFormSchemaDocument({ kind: 'model', providerId: 'plain.form' })).toBe(false);
  });

  it('текстовый документ — чужой: провайдер схемы за него не взялся', () => {
    expect(isFormSchemaDocument({ kind: 'text' })).toBe(false);
  });

  it('модельный документ без провайдера — чужой: «не знаю чей» не значит «мой»', () => {
    expect(isFormSchemaDocument({ kind: 'model' })).toBe(false);
  });
});
