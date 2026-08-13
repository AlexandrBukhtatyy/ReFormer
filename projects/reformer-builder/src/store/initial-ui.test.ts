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
    expect(ui.rightPanel).toBe('inspector');
    expect(ui.lastRightPanel).toBe('inspector');
    expect(ui.preview).toBe('wire');
    expect(ui.bottomTab).toBe('raw');
    // Нижняя панель (JSON/Модель/Registry) при старте свёрнута.
    expect(ui.rawJsonOpen).toBe(false);
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
    // `ui.rightOpen: false` в конфиге — публикуемый контракт; внутри он означает свёрнутую зону.
    expect(ui.rightPanel).toBeNull();
    expect(ui.preview).toBe('code');
    expect(ui.bottomTab).toBe('model');
  });

  it('leftPanel: null (свёрнут) → lastLeftPanel падает на files', () => {
    setRuntimeConfig({ ui: { leftPanel: null } });
    const ui = initialUi();
    expect(ui.leftPanel).toBeNull();
    expect(ui.lastLeftPanel).toBe('files');
  });

  it('leftPanel: templates — панель шаблонов открыта при старте', () => {
    setRuntimeConfig({ ui: { leftPanel: 'templates' } });
    const ui = initialUi();
    expect(ui.leftPanel).toBe('templates');
    expect(ui.lastLeftPanel).toBe('templates');
  });
});
