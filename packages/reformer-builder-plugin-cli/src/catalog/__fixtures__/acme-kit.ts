/**
 * Фикстура генератора каталога: кит `acme` поверх дизайн-системы `@acme/ds`.
 *
 * Файлы — строки, программа строится на {@link memoryHost} (CompilerHost в памяти); тот же
 * набор пишется на диск для сквозного теста команды. Устроено так, чтобы в нём было всё, на чём
 * генератор может ошибиться:
 *
 * - мини-`@types/react` БЕЗ `VFC` (как у React 19) и без глобального `JSX`;
 * - `@acme/ds` (свой пакет): функция, `FC` со статиками (и `@deprecated`-статикой), `VFC`,
 *   `React.VFC`, `forwardRef`, `memo`, `StyledComponent` с тегом и с функцией, нераспознаваемый
 *   тип, PascalCase-помощник, компонент высшего порядка, контекст, хук, `@deprecated`-проп, переобъявленный `onClick`, union, чей
 *   порядок у компилятора отличается от объявленного;
 * - `@acme/base` (чужой пакет): пропсы, которые наследует поле;
 * - исходники кита: обёртки полей со статикой `reformerAdapter`, компонент с умолчаниями
 *   в деструктуризации, плоский экспорт статики.
 *
 * @module @reformer/builder-plugin-cli/catalog/__fixtures__/acme-kit
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import type * as TS from 'typescript';

import type { KitCatalogConfig } from '../config.js';

export function slash(path: string): string {
  return path.replace(/\\/g, '/');
}

/** Корень кита в памяти — абсолютный путь этой ОС (`D:/kit` на Windows). */
export const ROOT = slash(resolve('/acme-kit'));

const REACT_TYPES = `
export = React;
export as namespace React;

declare namespace React {
  interface ReactElement { type: unknown; props: unknown; key: string | null }
  type ReactNode = ReactElement | string | number | boolean | null | undefined;
  interface Attributes { key?: string | number | null }
  type Ref<T> = { current: T | null } | ((instance: T | null) => void) | null;
  interface RefAttributes<T> extends Attributes { ref?: Ref<T> }
  interface MouseEvent<T = unknown> { target: T; button: number }
  interface KeyboardEvent<T = unknown> { target: T; key: string }
  interface CSSProperties { color?: string; width?: number }

  interface DOMAttributes<T> {
    children?: ReactNode;
    onClick?: (event: MouseEvent<T>) => void;
    onKeyDown?: (event: KeyboardEvent<T>) => void;
    onFocus?: (event: MouseEvent<T>) => void;
  }
  interface AriaAttributes {
    'aria-label'?: string;
    'aria-hidden'?: boolean;
  }
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    className?: string;
    id?: string;
    title?: string;
    style?: CSSProperties;
    'data-testid'?: string;
  }
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    placeholder?: string;
    name?: string;
  }
  type DetailedHTMLProps<E, T> = RefAttributes<T> & E;

  interface FunctionComponent<P = {}> {
    (props: P): ReactNode;
    displayName?: string;
  }
  type FC<P = {}> = FunctionComponent<P>;
  class Component<P = {}> {
    constructor(props: P);
    props: P;
    render(): ReactNode;
  }
  interface ComponentClass<P = {}> {
    new (props: P): Component<P>;
    displayName?: string;
  }
  type ComponentType<P = {}> = ComponentClass<P> | FunctionComponent<P>;
  interface ExoticComponent<P = {}> {
    (props: P): ReactNode;
    readonly $$typeof: symbol;
  }
  interface NamedExoticComponent<P = {}> extends ExoticComponent<P> { displayName?: string }
  interface ForwardRefExoticComponent<P> extends NamedExoticComponent<P> {}
  type ComponentProps<T> = T extends ComponentType<infer P> ? P : never;
  type MemoExoticComponent<T extends ComponentType<any>> = NamedExoticComponent<ComponentProps<T>> & {
    readonly type: T;
  };

  interface Context<T> extends ExoticComponent<{ value: T }> {
    Provider: ExoticComponent<{ value: T }>;
    Consumer: ExoticComponent<{ children: (value: T) => ReactNode }>;
  }

  interface DivElement { tagName: 'DIV' }
  interface SpanElement { tagName: 'SPAN' }
  namespace JSX {
    interface Element extends ReactElement {}
    interface IntrinsicElements {
      div: DetailedHTMLProps<HTMLAttributes<DivElement>, DivElement>;
      span: DetailedHTMLProps<HTMLAttributes<SpanElement>, SpanElement>;
    }
  }
}
`;

const ACME_DS = `
import * as React from 'react';
import { FC, VFC } from 'react';
import type { BaseInputProps, BaseShape } from '@acme/base';

/** Литерал 'ghost' создаётся раньше union'а — компилятор поставит его в union первым. */
export type EarlierLiteral = 'ghost';
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends React.HTMLAttributes<unknown> {
  /**
   * Вид кнопки.
   * @default primary
   */
  variant?: ButtonVariant;
  /** Текст на кнопке. */
  text?: string;
  /**
   * Прежний размер.
   * @deprecated используйте variant
   */
  legacySize?: number;
  /** Открытие меню кнопки. */
  onOpenChange?: (open: boolean) => void;
  /** DOM-событие, переобъявленное библиотекой. */
  onClick?: (event: unknown) => void;
  Zeta?: boolean;
  alpha?: boolean;
  shape?: BaseShape;
  tone?: 'tone-01' | 'tone-02' | 'tone-03' | 'tone-04' | 'tone-05' | 'tone-06' | 'tone-07' | 'tone-08' | 'tone-09' | 'tone-10' | 'tone-11' | 'tone-12' | 'tone-13' | 'tone-14' | 'tone-15' | number;
}
/** Обычная функция-компонент. */
export declare function Button(props: ButtonProps): React.ReactNode;

export interface TextInputProps extends BaseInputProps {
  /** Значение. */
  value?: string | null;
  onChange?: (value: string) => void;
  /** Подсказка в пустом поле. */
  placeholder?: string;
  /** Статус проверки. */
  validationStatus?: 'default' | 'error';
}
export declare const TextInput: FC<TextInputProps> & {
  Password: FC<TextInputProps>;
  /** @deprecated соберите сами */
  Legacy: FC<TextInputProps>;
};

export interface DateInputProps {
  /** Выбранная дата. */
  value?: Date | null;
  /** Формат отображения. */
  format?: string;
  onChange?: (value: Date | null) => void;
}
/** VFC — его нет в @types/react 19: тип символа не разрешится. */
export declare const DateInput: VFC<DateInputProps>;
export declare const DateRange: React.VFC<DateInputProps & { separator?: string }>;
/** memo над VFC: сигнатура есть, а пропсы размыты. */
export declare const MemoDate: React.MemoExoticComponent<VFC<DateInputProps>>;

export interface PanelProps {
  /** Заголовок панели. */
  title?: string;
  collapsible?: boolean;
  children?: React.ReactNode;
}
export declare const Panel: React.ForwardRefExoticComponent<PanelProps & React.RefAttributes<unknown>>;
/** @deprecated используйте Panel */
export declare const Card: React.MemoExoticComponent<FC<{ elevated?: boolean }>>;

export interface GridItemProps {
  span?: number;
  area?: string;
}
export declare const GridItem: import("styled-components").StyledComponent<"div", any, GridItemProps, never>;
export interface SkeletonProps {
  size?: 'small' | 'large';
  flex?: boolean;
}
export declare const Skeleton: import("styled-components").StyledComponent<({ size, flex }: SkeletonProps) => JSX.Element, any, {}, never>;

export declare const Tabs: FC<{ activeKey?: string }> & { TabPane: FC<{ tab?: string }> };
export declare const Wizard: FC<{ steps?: number }>;
export declare const Unknown: SomethingMissing<{ a?: string }>;
export declare const ACME_VERSION: string;
export declare function useAcme(): void;
export declare function FormatLabel(value: string): string;
/** Компонент высшего порядка — не компонент. */
export declare const WithTheme: <P>(component: FC<P>) => FC<P>;
/** Контекст React 19 вызываем, но узлом формы не бывает. */
export declare const AcmeContext: React.Context<string>;
`;

const ACME_BASE = `
export type BaseShape = { radius: number; inset: boolean };
export interface BaseInputProps {
  /** Размер из базовой библиотеки. */
  size?: 'small' | 'large';
  bordered?: boolean;
  addonBefore?: string;
}
`;

const KIT_FIELDS = `
import type { ComponentType } from 'react';
import { TextInput, type DateInputProps } from '@acme/ds';

export interface FieldAdapter { strip?: readonly string[] }
export interface FieldStatics { reformerAdapter?: FieldAdapter }
declare function fieldControl<P>(component: ComponentType<P>, statics: FieldStatics): ComponentType<P> & FieldStatics;

/** Текстовое поле. */
export const Input = fieldControl(TextInput, { reformerAdapter: { strip: ['label'] } });

/** Дата: у DateInput тип не разрешается, поэтому обёртка типизирована точно. */
export declare const DateField: ComponentType<DateInputProps & {
  /** Подсказка под календарём. */
  hint?: string;
}> & FieldStatics;
`;

const KIT_EXTRA = `
import type { ReactNode } from 'react';
import { Tabs } from '@acme/ds';

export interface BadgeProps {
  /** Тон бейджа. */
  tone?: 'info' | 'warning' | 'danger';
  label?: string;
  count?: number;
}
/** Бейдж кита: умолчания — в деструктуризации. */
export function Badge({ tone = 'info', count = -1 }: BadgeProps): ReactNode {
  return tone + String(count);
}
export const TabPane = Tabs.TabPane;
`;

const KIT_INDEX = `
export {
  ACME_VERSION,
  AcmeContext,
  Button,
  Card,
  DateInput,
  DateRange,
  FormatLabel,
  GridItem,
  MemoDate,
  Panel,
  Skeleton,
  Tabs,
  TextInput,
  Unknown,
  useAcme,
  WithTheme,
  Wizard,
} from '@acme/ds';
export { DateField, Input } from './fields';
export { Badge, TabPane } from './extra';
`;

/** Файлы фикстуры: путь относительно корня кита → текст. */
export const ACME_FILES: Readonly<Record<string, string>> = {
  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      target: 'es2022',
      lib: ['es2022'],
      module: 'esnext',
      moduleResolution: 'bundler',
      strict: true,
      types: [],
    },
  }),
  'node_modules/@types/react/package.json': JSON.stringify({
    name: '@types/react',
    version: '19.0.0',
    types: 'index.d.ts',
  }),
  'node_modules/@types/react/index.d.ts': REACT_TYPES,
  'node_modules/@acme/ds/package.json': JSON.stringify({
    name: '@acme/ds',
    version: '1.0.0',
    types: 'index.d.ts',
  }),
  'node_modules/@acme/ds/index.d.ts': ACME_DS,
  'node_modules/@acme/base/package.json': JSON.stringify({
    name: '@acme/base',
    version: '1.0.0',
    types: 'index.d.ts',
  }),
  'node_modules/@acme/base/index.d.ts': ACME_BASE,
  'src/fields.ts': KIT_FIELDS,
  'src/extra.ts': KIT_EXTRA,
  'src/index.ts': KIT_INDEX,
};

/** Конфиг, на котором фикстура генерируется без отказов. */
export function acmeConfig(): KitCatalogConfig {
  return {
    entry: './src/index.ts',
    schemaRef: './node_modules/@reformer/builder-plugin-api/component-catalog.schema.json',
    kit: {
      id: 'acme',
      label: 'Acme DS',
      package: '@acme/ds',
      infra: { fieldWrapper: 'Panel' },
      adapters: { wizard: null, step: null, provider: { symbol: 'Card' } },
      codegen: { importSpecifier: '@acme/kit' },
    },
    ownership: { packages: ['@acme/ds'] },
    fields: {
      Input: { value: 'string | null', variantGroup: 'Input', variant: 'Текст' },
      DatePicker: {
        exportName: 'DateField',
        value: 'Date | null',
        description: 'Выбранная дата; пусто — null.',
      },
    },
    exclude: ['Wizard'],
    statics: { 'TextInput.Password': 'ignore', 'Tabs.TabPane': 'TabPane' },
    parts: { TabPane: 'Tabs' },
    categories: {
      'Поля ввода': ['Input', 'DatePicker'],
      Контейнеры: ['Panel', 'Card', 'Tabs', 'GridItem'],
      Отображение: ['Badge', 'Skeleton'],
    },
    palette: ['Button'],
    limited: { DateRange: 'тяжёлый виджет' },
    service: ['TextInput', 'DateInput', 'MemoDate'],
    leaves: ['Skeleton'],
    props: {
      pick: { Input: ['bordered'] },
      omit: { '@field': ['validationStatus'] },
      override: { Button: { variant: { description: 'Вид кнопки (уточнено конфигом).' } } },
    },
  };
}

/** Каталог кита как файлы с абсолютными путями (ключи — с прямыми слешами). */
export function absoluteFiles(root: string, files = ACME_FILES): Map<string, string> {
  return new Map(Object.entries(files).map(([path, text]) => [`${root}/${path}`, text]));
}

/** Разобранные файлы библиотек TypeScript — общие для всех программ теста. */
const libCache = new Map<string, TS.SourceFile>();

/**
 * CompilerHost в памяти: файлы фикстуры — из карты, библиотеки TypeScript (`lib.*.d.ts`) — с
 * диска, с кешем разбора на весь прогон.
 */
export function memoryHost(
  ts: typeof TS,
  files: ReadonlyMap<string, string>,
  root = ROOT
): TS.CompilerHost {
  const real = ts.createCompilerHost({});
  const libDir = slash(dirname(ts.getDefaultLibFilePath({})));
  const isLib = (file: string): boolean => slash(file).startsWith(`${libDir}/`);
  return {
    getSourceFile(fileName, languageVersion) {
      const key = slash(fileName);
      const text = files.get(key);
      if (text !== undefined) return ts.createSourceFile(key, text, languageVersion, true);
      if (!isLib(key)) return undefined;
      const cacheKey = `${key}|${String(languageVersion)}`;
      let lib = libCache.get(cacheKey);
      if (lib === undefined) {
        lib = real.getSourceFile(fileName, languageVersion);
        if (lib !== undefined) libCache.set(cacheKey, lib);
      }
      return lib;
    },
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    writeFile: () => undefined,
    getCurrentDirectory: () => root,
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: (file) => files.has(slash(file)) || (isLib(file) && real.fileExists(file)),
    readFile: (file) => files.get(slash(file)) ?? (isLib(file) ? real.readFile(file) : undefined),
    directoryExists: (dir) => {
      const prefix = `${slash(dir).replace(/\/$/, '')}/`;
      if (isLib(`${prefix}x`)) return true;
      for (const key of files.keys()) if (key.startsWith(prefix)) return true;
      return false;
    },
    getDirectories: () => [],
    realpath: (file) => file,
  };
}

/** Пишет файлы фикстуры на диск — для сквозного теста команды. */
export async function writeFixture(dir: string, files = ACME_FILES): Promise<void> {
  for (const [path, text] of Object.entries(files)) {
    const file = join(dir, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, text);
  }
}
