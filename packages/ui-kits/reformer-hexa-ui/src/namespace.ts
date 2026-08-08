/**
 * Плоская карта «имя экспорта → компонент» — то, по чему билдер резолвит записи каталога.
 *
 * Здесь же видно, как каноническое имя ReFormer ложится на компонент HexaUI: `Separator` → их
 * `Divider`, `Spinner` → `Loader`, `Progress` → `ProgressBar`. Само соответствие объявляет каталог
 * (`exportName` записи), а namespace лишь обязан отдать символ под этим именем.
 *
 * @module reformer/kit-hexa-ui/namespace
 */

import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Label,
  Link,
  Loader,
  Panel,
  ProgressBar,
  Skeleton,
  Space,
  Tag,
} from '@kaspersky/hexa-ui';
import {
  CheckboxField,
  InputField,
  InputNumberField,
  InputPasswordField,
  SelectField,
  TextareaField,
} from './fields';
import { FormField } from './form-field';
import { Box, KitProvider, Section } from './provider';

/** Namespace кита HexaUI. */
export const HEXA_UI_NAMESPACE: Record<string, unknown> = {
  // Обёртка поля и провайдер темы — инфраструктура кита.
  FormField,
  KitProvider,

  // Поля (canonical + суффикс Field, как требует descriptor.resolve).
  InputField,
  TextareaField,
  InputPasswordField,
  InputNumberField,
  CheckboxField,
  SelectField,

  // Контейнеры и презентационные компоненты.
  Box,
  Section,
  Card,
  Panel,
  Space,
  Alert,
  Badge,
  Button,
  Divider,
  Label,
  Link,
  Loader,
  ProgressBar,
  Skeleton,
  Tag,
};
