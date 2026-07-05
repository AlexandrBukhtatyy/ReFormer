import CodeBlock from '@theme/CodeBlock';
import { Live } from './Demo';
import type { VariantDef } from './types';
import styles from './styles.module.css';

/** Таб Variants: адаптивный грид карточек-пресетов. */
export function VariantGallery({ variants }: { variants: VariantDef[] }) {
  return (
    <div className={styles.gallery}>
      {variants.map((v) => (
        <VariantCard key={v.id} variant={v} />
      ))}
    </div>
  );
}

function VariantCard({ variant }: { variant: VariantDef }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <p className={styles.cardTitle}>{variant.title}</p>
        {variant.description && <p className={styles.cardDesc}>{variant.description}</p>}
      </div>
      <div className={styles.cardPreview}>
        <Live render={variant.render} />
      </div>
      <div className={styles.cardCode}>
        <CodeBlock language={variant.language ?? 'tsx'}>{variant.code}</CodeBlock>
      </div>
    </div>
  );
}
