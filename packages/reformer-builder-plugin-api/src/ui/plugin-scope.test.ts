import { describe, expect, it } from 'vitest';
import { PLUGIN_SCOPE_ATTRIBUTE, pluginScopeAttributes } from './plugin-scope.js';

describe('скоуп стилей плагина', () => {
  it('атрибут — тот, под который оболочка переписывает таблицы стилей', () => {
    // Строка — часть контракта с оболочкой (`shell/platform/plugin/styles`): смени её здесь,
    // и стили внешних плагинов перестанут действовать без единой ошибки.
    expect(PLUGIN_SCOPE_ATTRIBUTE).toBe('data-rb-plugin');
  });

  it('атрибуты контейнера несут идентификатор плагина-владельца', () => {
    expect(pluginScopeAttributes('kit-hexa-ui')).toEqual({ 'data-rb-plugin': 'kit-hexa-ui' });
  });
});
