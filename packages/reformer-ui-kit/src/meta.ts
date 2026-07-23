// СГЕНЕРИРОВАНО scripts/generate-meta.mjs — не редактировать вручную.
// eslint-disable
import type { PropsSchema } from './fields/props-schema';
export type { PropDoc, PropWidget, PropsSchema, RuntimePropDoc } from './fields/props-schema';
export { mergeFieldPropsSchema } from './fields/props-schema';
import * as m0 from './components/box/variants/base/box-base.props';
import * as m1 from './components/calendar/variants/base/calendar-base.props';
import * as m2 from './components/checkbox/variants/base/checkbox-base.props';
import * as m3 from './components/combobox/variants/base/combobox-base.props';
import * as m4 from './components/date-picker/variants/base/date-picker-base.props';
import * as m5 from './components/file-upload/variants/avatar/file-upload-avatar.props';
import * as m6 from './components/file-upload/variants/base/file-upload-base.props';
import * as m7 from './components/input-mask/variants/base/input-mask-base.props';
import * as m8 from './components/input-otp/variants/base/input-otp-base.props';
import * as m9 from './components/input-password/variants/base/input-password-base.props';
import * as m10 from './components/input/variants/base/input-base.props';
import * as m11 from './components/native-select/variants/base/native-select-base.props';
import * as m12 from './components/radio-group/variants/base/radio-group-base.props';
import * as m13 from './components/section/variants/base/section-base.props';
import * as m14 from './components/select/variants/async/select-async.props';
import * as m15 from './components/slider/variants/base/slider-base.props';
import * as m16 from './components/switch/variants/base/switch-base.props';
import * as m17 from './components/textarea/variants/base/textarea-base.props';
import * as m18 from './components/toggle-group/variants/base/toggle-group-base.props';
import * as m19 from './components/toggle/variants/base/toggle-base.props';

export * from './components/box/variants/base/box-base.props';
export * from './components/calendar/variants/base/calendar-base.props';
export * from './components/checkbox/variants/base/checkbox-base.props';
export * from './components/combobox/variants/base/combobox-base.props';
export * from './components/date-picker/variants/base/date-picker-base.props';
export * from './components/file-upload/variants/avatar/file-upload-avatar.props';
export * from './components/file-upload/variants/base/file-upload-base.props';
export * from './components/input-mask/variants/base/input-mask-base.props';
export * from './components/input-otp/variants/base/input-otp-base.props';
export * from './components/input-password/variants/base/input-password-base.props';
export * from './components/input/variants/base/input-base.props';
export * from './components/native-select/variants/base/native-select-base.props';
export * from './components/radio-group/variants/base/radio-group-base.props';
export * from './components/section/variants/base/section-base.props';
export * from './components/select/variants/async/select-async.props';
export * from './components/slider/variants/base/slider-base.props';
export * from './components/switch/variants/base/switch-base.props';
export * from './components/textarea/variants/base/textarea-base.props';
export * from './components/toggle-group/variants/base/toggle-group-base.props';
export * from './components/toggle/variants/base/toggle-base.props';

const modules: Array<Record<string, unknown>> = [
  m0,
  m1,
  m2,
  m3,
  m4,
  m5,
  m6,
  m7,
  m8,
  m9,
  m10,
  m11,
  m12,
  m13,
  m14,
  m15,
  m16,
  m17,
  m18,
  m19,
];

/** Карта регистр-имя → полная props-схема дефолтного варианта (для renderer-json/MCP). */
export const defaultPropSchemas: Record<string, PropsSchema> = Object.fromEntries(
  modules
    .flatMap((m) => Object.values(m) as PropsSchema[])
    .filter((s): s is PropsSchema => Boolean(s) && typeof s === 'object' && 'x-registryName' in s)
    .map((s) => [s['x-registryName'] as string, s])
);
