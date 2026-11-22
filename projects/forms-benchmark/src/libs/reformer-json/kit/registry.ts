/**
 * Реестр renderer-json формы регистрации: общие записи (./base-registry.ts) + капча. Модульная
 * константа: состояния в реестре нет.
 */
import { defineRegistry } from '@reformer/renderer-json';
import { CaptchaWidget } from '../../../shared/ui/CaptchaWidget';
import { registerBase } from './base-registry';

export const benchRegistry = defineRegistry((reg) => {
  registerBase(reg);
  reg.component('CaptchaWidget', CaptchaWidget);
});
