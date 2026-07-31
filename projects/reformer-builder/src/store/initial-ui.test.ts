import { afterEach, describe, expect, it } from 'vitest';
import { initialUi } from './reducers';
import { resetRuntimeState, setRuntimeConfig } from '../config/state';

afterEach(resetRuntimeState);

describe('initialUi — дефолты UI из runtime-конфига', () => {
  it('без конфига — встроенные дефолты (регресс не меняется)', () => {
    const ui = initialUi();
    expect(ui.theme).toBe('light');
    expect(ui.leftPanel).toBe('files');
    expect(ui.lastLeftPanel).toBe('files');
    expect(ui.rightOpen).toBe(true);
    expect(ui.preview).toBe('wire');
    expect(ui.bottomTab).toBe('raw');
  });

  it('конфиг переопределяет тему/панели/превью', () => {
    setRuntimeConfig({
      ui: {
        theme: 'dark',
        leftPanel: 'palette',
        rightOpen: false,
        preview: 'code',
        bottomTab: 'model',
      },
    });
    const ui = initialUi();
    expect(ui.theme).toBe('dark');
    expect(ui.leftPanel).toBe('palette');
    expect(ui.lastLeftPanel).toBe('palette');
    expect(ui.rightOpen).toBe(false);
    expect(ui.preview).toBe('code');
    expect(ui.bottomTab).toBe('model');
  });

  it('leftPanel: null (свёрнут) → lastLeftPanel падает на files', () => {
    setRuntimeConfig({ ui: { leftPanel: null } });
    const ui = initialUi();
    expect(ui.leftPanel).toBeNull();
    expect(ui.lastLeftPanel).toBe('files');
  });
});
