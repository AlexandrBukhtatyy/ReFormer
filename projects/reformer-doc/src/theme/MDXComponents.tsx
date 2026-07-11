import MDXComponents from '@theme-original/MDXComponents';
import {
  ComponentDoc,
  Demo,
  VariantGallery,
  Playground,
  PropsTable,
} from '@site/src/components/demo';

/**
 * Глобальная регистрация doc-компонентов: доступны в любой `.mdx` без импортов.
 */
export default {
  ...MDXComponents,
  ComponentDoc,
  Demo,
  VariantGallery,
  Playground,
  PropsTable,
};
