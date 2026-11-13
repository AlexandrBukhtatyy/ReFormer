/**
 * Диалект `NumberInput` для ReFormer: строка `input type="number"` ⇄ `number | null` формы
 * (общие `parseNumberInput` / `formatNumberInput`: пусто — `null`). Статика `reformerAdapter`, как
 * у остальных примитивов (../adapters.ts).
 */
import type { ChangeEvent } from 'react';
import type { FieldAdapter } from '@reformer/core/react';
import { NumberInput } from '../../../shared/ui/controls';
import { formatNumberInput, parseNumberInput } from '../../../shared/domain/credit';

export const numberEventAdapter: FieldAdapter = {
  fromEmit: (e) => parseNumberInput((e as ChangeEvent<HTMLInputElement>).target.value),
  toValue: (v) => formatNumberInput(v as number | null),
};

Object.assign(NumberInput, { reformerAdapter: numberEventAdapter });
