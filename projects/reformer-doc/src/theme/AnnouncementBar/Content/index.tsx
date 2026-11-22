import React, { type ReactNode } from 'react';
import clsx from 'clsx';
import { useThemeConfig } from '@docusaurus/theme-common';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import type { Props } from '@theme/AnnouncementBar/Content';
import styles from './styles.module.css';

const translations: Record<string, string> = {
  en: '🚧 ReFormer is in the testing stage, the release is coming soon. <a href="https://github.com/AlexandrBukhtatyy/ReFormer/issues">Report issues</a>',
  ru: '🚧 ReFormer находится на стадии тестирования, скоро релиз. <a href="https://github.com/AlexandrBukhtatyy/ReFormer/issues">Сообщить о проблеме</a>',
};

export default function AnnouncementBarContent(props: Props): ReactNode {
  const { announcementBar } = useThemeConfig();
  const { i18n } = useDocusaurusContext();
  const currentLocale = i18n.currentLocale;

  const content = translations[currentLocale] || translations.en || announcementBar!.content;

  return (
    <div
      {...props}
      className={clsx(styles.content, props.className)}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
