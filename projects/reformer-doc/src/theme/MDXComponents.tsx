import MDXComponents from '@theme-original/MDXComponents';
import {
  ComponentDoc,
  Demo,
  LiveExample,
  VariantGallery,
  Playground,
  PropsTable,
} from '@site/src/components/demo';
import { PackageMap } from '@site/src/components/diagrams';

/**
 * Глобальная регистрация doc-компонентов: доступны в любой `.mdx` без импортов.
 * Нарисованные схемы — тоже: страница пишет `<PackageMap />`, а не путь к компоненту.
 */
export default {
  ...MDXComponents,
  ComponentDoc,
  Demo,
  LiveExample,
  VariantGallery,
  Playground,
  PropsTable,
  PackageMap,
};
