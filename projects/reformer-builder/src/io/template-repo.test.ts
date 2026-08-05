import { afterEach, describe, expect, it } from 'vitest';
import { resetRuntimeState, setRuntimeConfig } from '../config/state';
import { templatesDir } from './template-repo';

afterEach(resetRuntimeState);

describe('templatesDir', () => {
  it('по умолчанию — .reformer/templates', () => {
    expect(templatesDir()).toBe('.reformer/templates');
  });

  it('переопределяется конфигом проекта, ведущие/замыкающие слэши срезаются', () => {
    setRuntimeConfig({ project: { templatesDir: '/tools/form-templates/' } });
    expect(templatesDir()).toBe('tools/form-templates');
  });

  it('пустая строка в конфиге → дефолт', () => {
    setRuntimeConfig({ project: { templatesDir: '   ' } });
    expect(templatesDir()).toBe('.reformer/templates');
  });
});
