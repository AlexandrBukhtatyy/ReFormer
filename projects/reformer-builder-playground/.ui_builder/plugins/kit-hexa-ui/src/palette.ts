/**
 * Компоненты HexaUI для палитры — «как есть», явным списком и с ПОДПУТЕЙ пакета
 * (`@kaspersky/hexa-ui/button`), а не с его главного входа.
 *
 * ## Почему подпути
 *
 * Этот модуль входит в пространство имён билдера (`./namespace`), а сборка плагина делит код
 * esbuild'ом. Главный вход HexaUI реэкспортирует всё — и редакторы на slate и CodeMirror, и
 * календарь с локалями date-fns, которые кит грузит лениво (`import()` с подпутей). Стоит
 * пространству имён коснуться главного входа, и esbuild считает эти модули достижимыми из него:
 * они уезжают в общий чанк, который грузится вместе с пространством имён, — плюс пять мегабайт
 * к тому, что ленивым и задумывалось. Подпуть тянет ровно свой компонент.
 *
 * Поэтому в графе пространства имён (поля, визард, провайдер, обёртка поля — тоже) значения из
 * HexaUI берутся только с подпутей; типы — откуда угодно (`import type` в сборку не попадает).
 *
 * @module reformer/kit-hexa-ui/palette
 */

// --- Контейнеры и раскладка ------------------------------------------------------------------
export { Card } from '@kaspersky/hexa-ui/card';
export { Expand } from '@kaspersky/hexa-ui/expand';
export { ExpandableText } from '@kaspersky/hexa-ui/expandable-text';
export { FormGrid, Grid, GridItem } from '@kaspersky/hexa-ui/grid';
export { LockGroup } from '@kaspersky/hexa-ui/lock-group';
export { Panel } from '@kaspersky/hexa-ui/panel';
export { Scrollbar } from '@kaspersky/hexa-ui/scrollbar';
export { Space } from '@kaspersky/hexa-ui/space';

// --- Отображение и типографика -----------------------------------------------------------------
export { Alert } from '@kaspersky/hexa-ui/alert';
export { Badge } from '@kaspersky/hexa-ui/badge';
export { Chip } from '@kaspersky/hexa-ui/chip';
export { Divider } from '@kaspersky/hexa-ui/divider';
export { FormLabel } from '@kaspersky/hexa-ui/form-label';
export { H1, H2, H3, H4, H5, H6, Heading, P, Text } from '@kaspersky/hexa-ui/typography';
export { HelpMessage } from '@kaspersky/hexa-ui/help-message';
export { Icon } from '@kaspersky/hexa-ui/icon';
export { Indicator } from '@kaspersky/hexa-ui/indicator';
export { InformationCard } from '@kaspersky/hexa-ui/informationCard';
export { KeyValue, KeyWithIcon } from '@kaspersky/hexa-ui/key-value';
export { Label } from '@kaspersky/hexa-ui/label';
export { Link } from '@kaspersky/hexa-ui/link';
export { Loader } from '@kaspersky/hexa-ui/loader';
export { Markdown } from '@kaspersky/hexa-ui/markdown';
export { Placeholder } from '@kaspersky/hexa-ui/placeholder';
export { ProgressBar } from '@kaspersky/hexa-ui/progress-bar';
export { SectionMessage } from '@kaspersky/hexa-ui/section-message';
export { Severity } from '@kaspersky/hexa-ui/severity';
export { Skeleton, SkeletonTemplate } from '@kaspersky/hexa-ui/skeleton';
export { Status } from '@kaspersky/hexa-ui/status';
export { StatusCard } from '@kaspersky/hexa-ui/status-card';
export { Tag, TagReductionGroup } from '@kaspersky/hexa-ui/tag';
export { TextDiff } from '@kaspersky/hexa-ui/text-diff';

// --- Действия -----------------------------------------------------------------------------------
export { ActionButton } from '@kaspersky/hexa-ui/action-button';
export { Button } from '@kaspersky/hexa-ui/button';
export { FormTrigger } from '@kaspersky/hexa-ui/form-trigger';
